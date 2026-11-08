-- Contrato → Financeiro: cada parcela do contrato EMITIDO vira uma conta a receber,
-- uma única vez, sem duplicar.
--  * Fonte da verdade: o snapshot do contrato emitido (documentos.generated_data
--    -> commercial_record_snapshot), nunca o rascunho em edição. Só sincroniza
--    quando o cadastro está "convertido" (contrato vinculado) e a emissão está
--    concluída (commercial_finalization_state = 'complete').
--  * Idempotência: tabela de vínculo contract_receivable_installments com
--    unique(commercial_record_id, installment_no) + client_request_id único no
--    financeiro. Reexecutar não cria nada novo.
--  * Revisão do contrato: parcelas em aberto (previsto/pendente/atrasado) são
--    atualizadas; parcelas pagas NUNCA são alteradas (divergência vai para
--    audit_log); parcelas removidas na revisão são canceladas se em aberto.
--  * Contrato cancelado: parcelas em aberto são canceladas; pagas ficam.
--  * Nada é inventado: soma das parcelas ≠ valor total, valor inválido ou
--    lançamentos manuais já existentes para o contrato → nada é gerado e a
--    pendência fica registrada em audit_log para conferência.
--  * Lançamento gerado excluído manualmente não é recriado.
--  * Falha na sincronização nunca bloqueia o fluxo comercial (registra em audit_log).
-- Migração aditiva e idempotente.

create table if not exists public.contract_receivable_installments (
  id uuid primary key default gen_random_uuid(),
  commercial_record_id uuid not null references public.commercial_records(id) on delete restrict,
  contract_id uuid not null references public.contratos(id) on delete restrict,
  installment_no integer not null check (installment_no > 0),
  amount numeric(12,2) not null check (amount > 0),
  due_date date,
  due_event text,
  source_document_id uuid references public.documentos(id) on delete set null,
  financial_entry_id uuid unique references public.financeiro(id) on delete set null,
  status text not null default 'active' check (status in ('active','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (commercial_record_id, installment_no)
);
create index if not exists contract_receivable_installments_contract_idx
  on public.contract_receivable_installments(contract_id);
alter table public.contract_receivable_installments enable row level security;
drop policy if exists contract_receivable_installments_admin_read on public.contract_receivable_installments;
create policy contract_receivable_installments_admin_read on public.contract_receivable_installments
  for select to authenticated using ((select public.is_portal_admin()));
revoke insert, update, delete on public.contract_receivable_installments from anon, authenticated;

create or replace function private.payment_method_label(p text)
returns text language sql immutable set search_path to '' as $$
  select case lower(btrim(coalesce(p,'')))
    when '' then null
    when 'pix' then 'Pix'
    when 'boleto' then 'Boleto Bancário'
    when 'transferencia' then 'Transferência'
    when 'transferência' then 'Transferência'
    when 'ted' then 'Transferência'
    when 'cartao' then 'Cartão'
    when 'cartão' then 'Cartão'
    when 'dinheiro' then 'Dinheiro'
    else btrim(p) end
$$;

create or replace function private.safe_date(p text)
returns date language plpgsql immutable set search_path to '' as $$
begin
  if p is null or btrim(p) = '' then return null; end if;
  if btrim(p) !~ '^\d{4}-\d{2}-\d{2}$' then return null; end if;
  return btrim(p)::date;
exception when others then return null;
end $$;

create or replace function private.sync_contract_receivables(p_record_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  r public.commercial_records;
  d public.documentos;
  snap jsonb;
  terms jsonb;
  inst jsonb;
  v_total numeric;
  v_sum numeric := 0;
  v_n int;
  v_i int;
  v_item jsonb;
  v_ev jsonb;
  v_amount numeric;
  v_due date;
  v_event text;
  v_method text;
  v_bad text;
  m public.contract_receivable_installments;
  f public.financeiro;
  v_map uuid;
  v_entry uuid;
  v_desc text;
  v_created int := 0; v_updated int := 0; v_cancelled int := 0; v_kept int := 0;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  perform pg_advisory_xact_lock(hashtextextended('contract_receivables:'||p_record_id::text, 0));
  select * into r from public.commercial_records where id = p_record_id;
  if not found or r.record_kind is distinct from 'contrato' or r.linked_contract_id is null then
    return jsonb_build_object('status','skipped','reason','sem contrato vinculado');
  end if;

  -- Contrato cancelado: encerra só o que está em aberto.
  if r.status = 'cancelado' then
    for m in select * from public.contract_receivable_installments
             where commercial_record_id = r.id and status = 'active' loop
      select * into f from public.financeiro where id = m.financial_entry_id;
      if found and f.status in ('previsto','pendente','atrasado') then
        update public.financeiro set status = 'cancelado',
          observacoes = coalesce(observacoes || ' ', '') || '[Cancelado: contrato cancelado]'
        where id = f.id;
        update public.contract_receivable_installments set status='cancelled', updated_at=now() where id=m.id;
        v_cancelled := v_cancelled + 1;
      end if;
    end loop;
    return jsonb_build_object('status','cancelled','cancelled',v_cancelled);
  end if;

  if r.status is distinct from 'convertido' or r.contract_document_id is null then
    return jsonb_build_object('status','skipped','reason','contrato ainda não convertido');
  end if;

  select * into d from public.documentos where id = r.contract_document_id;
  if not found or d.generated_at is null
     or coalesce(d.generated_data->>'commercial_finalization_state','complete') <> 'complete'
     or d.generated_data->'commercial_record_snapshot' is null then
    return jsonb_build_object('status','skipped','reason','emissão do contrato não concluída');
  end if;

  snap := d.generated_data->'commercial_record_snapshot';
  terms := coalesce(snap->'payment_terms','[]'::jsonb);
  inst := coalesce(snap#>'{commercial_terms,installments}','[]'::jsonb);
  if jsonb_typeof(terms) <> 'array' then terms := '[]'::jsonb; end if;
  if jsonb_typeof(inst) <> 'array' then inst := '[]'::jsonb; end if;
  if jsonb_array_length(terms) = 0 then
    -- formato estruturado (commercial_terms.installments)
    select coalesce(jsonb_agg(jsonb_build_object('value',x->'amount','due',x->>'due_date','event',x->>'due_event',
             'method',snap#>>'{commercial_terms,payment_method}') order by o), '[]'::jsonb)
      into terms from jsonb_array_elements(inst) with ordinality t(x,o);
  end if;
  v_n := jsonb_array_length(terms);
  v_total := private.parse_brl_amount(snap->'total_value');

  -- Validação: nada é inventado.
  if v_n = 0 then v_bad := 'Contrato emitido sem parcelas.'; end if;
  if v_bad is null then
    for v_i in 1..v_n loop
      v_amount := private.parse_brl_amount(terms->(v_i-1)->'value');
      if v_amount is null then v_bad := 'Parcela '||v_i||' sem valor válido.'; exit; end if;
      v_sum := v_sum + v_amount;
    end loop;
  end if;
  if v_bad is null and v_total is not null and abs(v_sum - v_total) > 0.009 then
    v_bad := 'Soma das parcelas ('||v_sum||') diferente do valor total ('||v_total||').';
  end if;
  if v_bad is not null then
    insert into public.audit_log(user_id, action, entity_type, entity_id, details)
    values (auth.uid(), 'contract_receivables_pending', 'commercial_records', r.id,
            jsonb_build_object('contract_id', r.linked_contract_id, 'document_id', d.id, 'reason', v_bad));
    return jsonb_build_object('status','pending','reason',v_bad);
  end if;

  -- Primeira sincronização: se já há recebimentos lançados à mão para o contrato,
  -- não gera nada (evita duplicar) e pede conciliação.
  if not exists (select 1 from public.contract_receivable_installments where commercial_record_id = r.id)
     and exists (select 1 from public.financeiro x where x.contract_id = r.linked_contract_id and x.tipo = 'entrada'
                 and x.status <> 'cancelado' and x.source not in ('addendum','contract_installment')) then
    insert into public.audit_log(user_id, action, entity_type, entity_id, details)
    values (auth.uid(), 'contract_receivables_manual_conflict', 'commercial_records', r.id,
            jsonb_build_object('contract_id', r.linked_contract_id,
              'note', 'Já existem recebimentos lançados manualmente para este contrato; parcelas não geradas para não duplicar.'));
    return jsonb_build_object('status','pending','reason','recebimentos manuais já existentes para o contrato');
  end if;

  for v_i in 1..v_n loop
    v_item := terms->(v_i-1);
    v_ev := case when jsonb_array_length(inst) = v_n then inst->(v_i-1) else null end;
    v_amount := private.parse_brl_amount(v_item->'value');
    v_due := private.safe_date(coalesce(v_item->>'due', v_ev->>'due_date'));
    v_event := nullif(btrim(coalesce(v_item->>'event', v_ev->>'due_event', '')), '');
    v_method := private.payment_method_label(coalesce(v_item->>'method', snap#>>'{commercial_terms,payment_method}'));
    v_desc := 'Parcela '||v_i||'/'||v_n||' — '||coalesce(r.contract_number,'contrato');

    select * into m from public.contract_receivable_installments
     where commercial_record_id = r.id and installment_no = v_i for update;

    if not found then
      insert into public.contract_receivable_installments(commercial_record_id, contract_id, installment_no, amount,
             due_date, due_event, source_document_id)
      values (r.id, r.linked_contract_id, v_i, v_amount, v_due, v_event, d.id)
      returning id into v_map;
      insert into public.financeiro(projeto_id, cliente_id, contract_id, descricao, tipo, valor, data, status,
             data_vencimento, forma_pagamento, categoria, source, client_request_id, observacoes)
      values (r.linked_project_id, r.linked_client_id, r.linked_contract_id, v_desc, 'entrada', v_amount,
             coalesce(v_due, v_today), case when v_due is null then 'previsto' else 'pendente' end,
             v_due, v_method, 'honorarios', 'contract_installment', v_map,
             'Gerado automaticamente do contrato '||coalesce(r.contract_number,'')||' v'||coalesce(d.versao,'')||
             case when v_event is not null then '. Vencimento: '||v_event else '' end||'.')
      returning id into v_entry;
      update public.contract_receivable_installments set financial_entry_id = v_entry where id = v_map;
      v_created := v_created + 1;
      continue;
    end if;

    if m.financial_entry_id is null then
      -- lançamento excluído manualmente: não recria.
      v_kept := v_kept + 1;
      continue;
    end if;
    select * into f from public.financeiro where id = m.financial_entry_id for update;

    if f.status in ('previsto','pendente','atrasado') or (f.status = 'cancelado' and m.status = 'cancelled') then
      if f.valor is distinct from v_amount or f.data_vencimento is distinct from v_due
         or f.forma_pagamento is distinct from v_method or f.descricao is distinct from v_desc
         or m.status = 'cancelled' then
        update public.financeiro set valor = v_amount, data_vencimento = v_due, data = coalesce(v_due, f.data),
               forma_pagamento = v_method, descricao = v_desc,
               status = case when f.status = 'cancelado' or f.status = 'previsto' or f.status = 'pendente'
                             then case when v_due is null then 'previsto' else 'pendente' end else f.status end
         where id = f.id;
        v_updated := v_updated + 1;
      end if;
      update public.contract_receivable_installments set amount = v_amount, due_date = v_due, due_event = v_event,
             source_document_id = d.id, status = 'active', updated_at = now() where id = m.id;
    else
      -- pago (ou cancelado manualmente): não mexe.
      if f.valor is distinct from v_amount then
        insert into public.audit_log(user_id, action, entity_type, entity_id, details)
        values (auth.uid(), 'contract_receivable_paid_divergence', 'financeiro', f.id,
                jsonb_build_object('installment', v_i, 'recorded', f.valor, 'contract', v_amount, 'document_id', d.id));
      end if;
      v_kept := v_kept + 1;
    end if;
  end loop;

  -- Parcelas que deixaram de existir na revisão.
  for m in select * from public.contract_receivable_installments
           where commercial_record_id = r.id and installment_no > v_n and status = 'active' loop
    select * into f from public.financeiro where id = m.financial_entry_id;
    if found and f.status in ('previsto','pendente','atrasado') then
      update public.financeiro set status = 'cancelado',
        observacoes = coalesce(observacoes || ' ', '') || '[Cancelado: parcela removida na revisão v'||coalesce(d.versao,'')||']'
       where id = f.id;
      update public.contract_receivable_installments set status = 'cancelled', updated_at = now() where id = m.id;
      v_cancelled := v_cancelled + 1;
    elsif found then
      insert into public.audit_log(user_id, action, entity_type, entity_id, details)
      values (auth.uid(), 'contract_receivable_paid_removed', 'financeiro', f.id,
              jsonb_build_object('installment', m.installment_no, 'document_id', d.id));
    end if;
  end loop;

  if v_created + v_updated + v_cancelled > 0 then
    insert into public.audit_log(user_id, action, entity_type, entity_id, details)
    values (auth.uid(), 'contract_receivables_synced', 'commercial_records', r.id,
            jsonb_build_object('contract_id', r.linked_contract_id, 'document_id', d.id, 'version', d.versao,
              'created', v_created, 'updated', v_updated, 'cancelled', v_cancelled, 'kept', v_kept));
  end if;
  return jsonb_build_object('status','synced','created',v_created,'updated',v_updated,'cancelled',v_cancelled,'kept',v_kept);
end
$function$;
revoke all on function private.sync_contract_receivables(uuid) from public, anon, authenticated;

-- Gatilhos: o fluxo comercial nunca é bloqueado por falha aqui.
create or replace function private.trg_sync_contract_receivables_record()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  begin
    perform private.sync_contract_receivables(new.id);
  exception when others then
    insert into public.audit_log(user_id, action, entity_type, entity_id, details)
    values (auth.uid(), 'contract_receivables_sync_failed', 'commercial_records', new.id,
            jsonb_build_object('error', left(sqlerrm, 300)));
  end;
  return new;
end $function$;

create or replace function private.trg_sync_contract_receivables_document()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare v_id uuid;
begin
  if new.document_kind is distinct from 'contrato' then return new; end if;
  for v_id in select id from public.commercial_records where contract_document_id = new.id loop
    begin
      perform private.sync_contract_receivables(v_id);
    exception when others then
      insert into public.audit_log(user_id, action, entity_type, entity_id, details)
      values (auth.uid(), 'contract_receivables_sync_failed', 'commercial_records', v_id,
              jsonb_build_object('error', left(sqlerrm, 300)));
    end;
  end loop;
  return new;
end $function$;
revoke all on function private.trg_sync_contract_receivables_record() from public, anon, authenticated;
revoke all on function private.trg_sync_contract_receivables_document() from public, anon, authenticated;

drop trigger if exists zz_sync_contract_receivables on public.commercial_records;
create trigger zz_sync_contract_receivables
  after insert or update of status, linked_contract_id, contract_document_id on public.commercial_records
  for each row execute function private.trg_sync_contract_receivables_record();

drop trigger if exists zz_sync_contract_receivables on public.documentos;
create trigger zz_sync_contract_receivables
  after update of generated_data, generated_at on public.documentos
  for each row when (new.document_kind = 'contrato')
  execute function private.trg_sync_contract_receivables_document();

-- Ação manual para a administradora (botão "Sincronizar parcelas").
create or replace function public.admin_sync_contract_receivables(p_record_id uuid)
returns jsonb language plpgsql security definer set search_path to '' as $function$
begin
  if auth.uid() is null or not public.is_portal_admin() then
    raise exception 'Acesso administrativo necessário.' using errcode = '42501';
  end if;
  return private.sync_contract_receivables(p_record_id);
end $function$;
revoke all on function public.admin_sync_contract_receivables(uuid) from public, anon;
grant execute on function public.admin_sync_contract_receivables(uuid) to authenticated;

-- Contratos já convertidos: sincroniza uma vez (idempotente).
do $$ declare v uuid; begin
  for v in select id from public.commercial_records
           where record_kind = 'contrato' and status = 'convertido' and linked_contract_id is not null loop
    perform private.sync_contract_receivables(v);
  end loop;
end $$;

-- ROLLBACK (manual):
--   drop trigger zz_sync_contract_receivables on public.commercial_records;
--   drop trigger zz_sync_contract_receivables on public.documentos;
--   (lançamentos gerados e a tabela de vínculo são preservados; cancele pelo Financeiro se necessário)
