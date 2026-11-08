-- A02 — Recebimento com recibo emitido não pode sofrer alteração material nem
--       exclusão; a correção é feita por estorno rastreável, preservando o
--       recibo original e sua equivalência financeira.
-- A03 — Cliente, contrato e projeto de um lançamento devem pertencer à mesma
--       cadeia comercial (validação no servidor).
--
-- Migração aditiva e idempotente: nenhuma tabela, coluna ou dado é removido.
-- Reversão: ver bloco "ROLLBACK" no final deste arquivo.

-- ---------------------------------------------------------------------------
-- A02.1 Rastreabilidade do estorno no recibo (colunas novas, opcionais)
-- ---------------------------------------------------------------------------
alter table public.payment_receipts
  add column if not exists reversed_at timestamptz,
  add column if not exists reversed_by uuid,
  add column if not exists reversal_reason text,
  add column if not exists reversal_financial_id uuid;

create unique index if not exists payment_receipts_reversal_financial_uidx
  on public.payment_receipts(reversal_financial_id) where reversal_financial_id is not null;

-- ---------------------------------------------------------------------------
-- A02.2 Guarda de imutabilidade do recebimento com recibo
-- ---------------------------------------------------------------------------
create or replace function private.guard_receipted_financial_entry()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  r public.payment_receipts;
begin
  select * into r from public.payment_receipts where financial_entry_id = old.id for update;
  if not found then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'Este recebimento possui o recibo REC-% emitido e não pode ser excluído. Use "Estornar recebimento" para registrar a correção sem apagar o documento.',
      lpad(r.receipt_number::text, 6, '0')
      using errcode = 'P0001', hint = 'receipt_locked';
  end if;

  -- Campos que definem a equivalência entre recibo e caixa.
  if new.valor is distinct from old.valor
     or new.tipo is distinct from old.tipo
     or new.data is distinct from old.data
     or coalesce(new.data_pagamento, new.data) is distinct from coalesce(old.data_pagamento, old.data)
     or new.projeto_id is distinct from old.projeto_id
     or (old.cliente_id is not null and new.cliente_id is distinct from old.cliente_id)
     or (old.cliente_id is null and new.cliente_id is distinct from r.client_id and new.cliente_id is not null)
     or (old.contract_id is not null and new.contract_id is distinct from old.contract_id)
     or lower(coalesce(new.status, '')) not in ('pago', 'recebido', 'quitado')
     or btrim(coalesce(new.descricao, '')) is distinct from btrim(coalesce(old.descricao, ''))
     or coalesce(new.forma_pagamento, '') is distinct from coalesce(old.forma_pagamento, '')
  then
    raise exception 'Este recebimento possui o recibo REC-% emitido. Valor, data, cliente, contrato, projeto, descrição, forma e situação ficam bloqueados. Use "Estornar recebimento" e registre o lançamento correto.',
      lpad(r.receipt_number::text, 6, '0')
      using errcode = 'P0001', hint = 'receipt_locked';
  end if;
  return new;
end
$function$;

drop trigger if exists a00_guard_receipted_financial_entry on public.financeiro;
create trigger a00_guard_receipted_financial_entry
  before update or delete on public.financeiro
  for each row execute function private.guard_receipted_financial_entry();

-- O recibo também não pode ter seus dados materiais alterados nem ser apagado.
create or replace function private.guard_payment_receipt_immutability()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if tg_op = 'DELETE' then
    raise exception 'Recibos emitidos são preservados e não podem ser excluídos.' using errcode = 'P0001', hint = 'receipt_locked';
  end if;
  if new.receipt_number is distinct from old.receipt_number
     or new.client_id is distinct from old.client_id
     or new.project_id is distinct from old.project_id
     or new.amount is distinct from old.amount
     or new.paid_on is distinct from old.paid_on
     or new.payment_method is distinct from old.payment_method
     or new.description is distinct from old.description
     or new.snapshot is distinct from old.snapshot
     or new.created_at is distinct from old.created_at
     or (old.financial_entry_id is not null and new.financial_entry_id is distinct from old.financial_entry_id)
     or (old.reversed_at is not null and (new.reversed_at is distinct from old.reversed_at
          or new.reversal_financial_id is distinct from old.reversal_financial_id
          or new.reversal_reason is distinct from old.reversal_reason))
  then
    raise exception 'Os dados do recibo emitido são imutáveis.' using errcode = 'P0001', hint = 'receipt_locked';
  end if;
  return new;
end
$function$;

drop trigger if exists a00_guard_payment_receipt_immutability on public.payment_receipts;
create trigger a00_guard_payment_receipt_immutability
  before update or delete on public.payment_receipts
  for each row execute function private.guard_payment_receipt_immutability();

-- ---------------------------------------------------------------------------
-- A02.3 Estorno rastreável (idempotente por recibo)
-- ---------------------------------------------------------------------------
create or replace function public.admin_reverse_receipted_payment(p_financial_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  f public.financeiro;
  r public.payment_receipts;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_id uuid;
  v_label text;
begin
  if auth.uid() is null or not public.is_portal_admin() then
    raise exception 'Acesso administrativo necessário.' using errcode = '42501';
  end if;
  if p_financial_id is null then raise exception 'Informe o recebimento a estornar.'; end if;
  if length(v_reason) < 5 then raise exception 'Descreva o motivo do estorno (mínimo de 5 caracteres).'; end if;

  perform pg_advisory_xact_lock(hashtextextended('receipt-reversal:' || p_financial_id::text, 0));
  select * into r from public.payment_receipts where financial_entry_id = p_financial_id for update;
  if not found then raise exception 'Este recebimento não possui recibo emitido; edite-o normalmente.'; end if;

  -- Repetição da mesma solicitação devolve o estorno já registrado.
  if r.reversed_at is not null then
    return jsonb_build_object('receipt_id', r.id, 'reversal_financial_id', r.reversal_financial_id, 'already_reversed', true);
  end if;

  select * into f from public.financeiro where id = p_financial_id for share;
  if not found then raise exception 'Recebimento original não encontrado.'; end if;

  v_label := 'REC-' || lpad(r.receipt_number::text, 6, '0');
  insert into public.financeiro(projeto_id, cliente_id, contract_id, descricao, tipo, valor, data, status,
                                data_pagamento, data_vencimento, forma_pagamento, categoria, source, observacoes, account_id)
  values (f.projeto_id, coalesce(f.cliente_id, r.client_id), f.contract_id,
          'Estorno do recebimento ' || v_label || ' — ' || coalesce(f.descricao, ''),
          'saida', f.valor, (now() at time zone 'America/Sao_Paulo')::date, 'pago',
          (now() at time zone 'America/Sao_Paulo')::date, (now() at time zone 'America/Sao_Paulo')::date,
          f.forma_pagamento, 'estorno', 'receipt_reversal',
          'Estorno de ' || v_label || ' (lançamento ' || f.id::text || '). Motivo: ' || v_reason, f.account_id)
  returning id into v_id;

  update public.payment_receipts
     set reversed_at = now(), reversed_by = auth.uid(), reversal_reason = v_reason, reversal_financial_id = v_id
   where id = r.id;

  insert into public.audit_log(user_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'reverse_receipted_payment', 'payment_receipts', r.id,
          jsonb_build_object('financial_entry_id', f.id, 'reversal_financial_id', v_id, 'amount', f.valor, 'reason', v_reason));

  return jsonb_build_object('receipt_id', r.id, 'reversal_financial_id', v_id, 'already_reversed', false);
end
$function$;

revoke all on function public.admin_reverse_receipted_payment(uuid, text) from public, anon;
grant execute on function public.admin_reverse_receipted_payment(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- A03 Coerência cliente / contrato / projeto
-- ---------------------------------------------------------------------------
create or replace function private.guard_financial_origin_chain()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_project_client uuid;
  v_project_contract uuid;
  v_contract_client uuid;
begin
  if tg_op = 'UPDATE'
     and new.projeto_id is not distinct from old.projeto_id
     and new.cliente_id is not distinct from old.cliente_id
     and new.contract_id is not distinct from old.contract_id then
    return new;
  end if;

  if new.projeto_id is not null then
    select cliente_id, contract_id into v_project_client, v_project_contract
      from public.projetos where id = new.projeto_id;
    if v_project_client is not null then
      if new.cliente_id is null then
        new.cliente_id := v_project_client;
      elsif new.cliente_id <> v_project_client then
        raise exception 'O projeto selecionado pertence a outro cliente. Revise cliente e projeto do lançamento.'
          using errcode = '23514', hint = 'financial_origin_mismatch';
      end if;
    end if;
    if v_project_contract is not null and new.contract_id is not null and new.contract_id <> v_project_contract then
      raise exception 'O projeto selecionado está vinculado a outro contrato. Revise contrato e projeto do lançamento.'
        using errcode = '23514', hint = 'financial_origin_mismatch';
    end if;
  end if;

  if new.contract_id is not null then
    select cliente_id into v_contract_client from public.contratos where id = new.contract_id;
    if v_contract_client is not null then
      if new.cliente_id is null then
        new.cliente_id := v_contract_client;
      elsif new.cliente_id <> v_contract_client then
        raise exception 'O contrato selecionado pertence a outro cliente. Revise cliente e contrato do lançamento.'
          using errcode = '23514', hint = 'financial_origin_mismatch';
      end if;
    end if;
  end if;
  return new;
end
$function$;

drop trigger if exists a01_guard_financial_origin_chain on public.financeiro;
create trigger a01_guard_financial_origin_chain
  before insert or update on public.financeiro
  for each row execute function private.guard_financial_origin_chain();

-- ROLLBACK (manual, não destrutivo para dados):
--   drop trigger if exists a00_guard_receipted_financial_entry on public.financeiro;
--   drop trigger if exists a01_guard_financial_origin_chain on public.financeiro;
--   drop trigger if exists a00_guard_payment_receipt_immutability on public.payment_receipts;
--   drop function if exists public.admin_reverse_receipted_payment(uuid, text);
--   (as colunas reversed_* podem permanecer; não afetam fluxos existentes)
