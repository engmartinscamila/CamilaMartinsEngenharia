-- A18 — Aditivo (Termo Aditivo / Serviço Adicional) aceito pelo cliente gera,
-- uma única vez, a obrigação financeira correspondente.
--  * Evento de exigibilidade: aceite registrado em document_acceptances
--    (decisão accepted ou accepted_with_notes). Rejeição não gera cobrança.
--  * O valor original do contrato (contratos.contract_value) NÃO é alterado;
--    o aditivo fica registrado em contract_addenda e somado ao total de
--    referência no extrato.
--  * A cobrança entra como lançamento "previsto" (não é caixa) e pode ser
--    cancelada pelo fluxo normal; a repetição do aceite não duplica.
--  * Valor ausente ou inválido: nada é inventado; registra-se pendência em
--    audit_log para a administradora completar.
-- Migração aditiva e idempotente.

create table if not exists public.contract_addenda (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null unique references public.documentos(id) on delete restrict,
  acceptance_id uuid not null unique,
  contract_id uuid references public.contratos(id) on delete set null,
  project_id uuid references public.projetos(id) on delete set null,
  client_id uuid references public.clientes(id) on delete set null,
  amount numeric(12,2) not null check (amount > 0),
  document_version text,
  financial_entry_id uuid unique,
  status text not null default 'accepted' check (status in ('accepted','cancelled')),
  created_at timestamptz not null default now()
);
alter table public.contract_addenda enable row level security;
drop policy if exists contract_addenda_admin_read on public.contract_addenda;
create policy contract_addenda_admin_read on public.contract_addenda
  for select to authenticated using ((select public.is_portal_admin()));

create or replace function private.parse_brl_amount(p_value jsonb)
returns numeric
language plpgsql
immutable
set search_path to ''
as $function$
declare
  v_text text;
  v_num numeric;
begin
  if p_value is null or p_value = 'null'::jsonb then return null; end if;
  if jsonb_typeof(p_value) = 'number' then v_num := (p_value #>> '{}')::numeric;
  else
    v_text := regexp_replace(coalesce(p_value #>> '{}', ''), '[^0-9,.-]', '', 'g');
    if v_text = '' then return null; end if;
    if position(',' in v_text) > 0 then v_text := replace(replace(v_text, '.', ''), ',', '.');
    elsif v_text ~ '^\d{1,3}(\.\d{3})+$' then v_text := replace(v_text, '.', '');
    end if;
    begin v_num := v_text::numeric; exception when others then return null; end;
  end if;
  if v_num is null or v_num <= 0 or v_num <> round(v_num, 2) then return null; end if;
  return v_num;
end
$function$;

create or replace function private.register_accepted_addendum()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  d public.documentos;
  v_options jsonb;
  v_amount numeric;
  v_contract uuid;
  v_client uuid;
  v_addendum uuid;
  v_entry uuid;
begin
  if new.decision not in ('accepted','accepted_with_notes') then return new; end if;
  select * into d from public.documentos where id = new.document_id;
  if not found or d.document_kind is distinct from 'servico_adicional' then return new; end if;

  v_options := coalesce(d.generated_data->'document_options', '{}'::jsonb);
  v_amount := coalesce(private.parse_brl_amount(v_options->'additional_value'),
                       private.parse_brl_amount(d.generated_data->'additional_value'));
  if v_amount is null then
    insert into public.audit_log(user_id, action, entity_type, entity_id, details)
    values (new.user_id, 'addendum_accepted_without_value', 'documentos', d.id,
            jsonb_build_object('acceptance_id', new.id, 'note', 'Aditivo aceito sem valor válido; cobrança não gerada.'));
    return new;
  end if;

  v_contract := coalesce(d.contract_id, (select contract_id from public.projetos where id = d.projeto_id));
  v_client := coalesce(new.client_id, d.cliente_id, (select cliente_id from public.projetos where id = d.projeto_id));

  insert into public.contract_addenda(document_id, acceptance_id, contract_id, project_id, client_id, amount, document_version)
  values (d.id, new.id, v_contract, d.projeto_id, v_client, v_amount, new.document_version)
  on conflict (document_id) do nothing
  returning id into v_addendum;
  if v_addendum is null then return new; end if; -- já registrado: não duplica

  insert into public.financeiro(projeto_id, cliente_id, contract_id, descricao, tipo, valor, data, status,
                                data_vencimento, categoria, source, client_request_id, observacoes)
  values (d.projeto_id, v_client, v_contract,
          'Aditivo — ' || coalesce(d.nome, 'Serviço adicional') || ' (v' || coalesce(new.document_version, '1.0') || ')',
          'entrada', v_amount, (now() at time zone 'America/Sao_Paulo')::date, 'previsto',
          (now() at time zone 'America/Sao_Paulo')::date, 'honorarios', 'addendum', v_addendum,
          'Gerado automaticamente pelo aceite do aditivo. Ajuste o vencimento conforme a forma de pagamento acordada.')
  returning id into v_entry;

  update public.contract_addenda set financial_entry_id = v_entry where id = v_addendum;
  insert into public.audit_log(user_id, action, entity_type, entity_id, details)
  values (new.user_id, 'addendum_financial_obligation_created', 'documentos', d.id,
          jsonb_build_object('acceptance_id', new.id, 'addendum_id', v_addendum, 'financial_entry_id', v_entry, 'amount', v_amount));
  return new;
end
$function$;

drop trigger if exists a10_register_accepted_addendum on public.document_acceptances;
create trigger a10_register_accepted_addendum
  after insert on public.document_acceptances
  for each row execute function private.register_accepted_addendum();

-- ROLLBACK (manual): drop trigger a10_register_accepted_addendum on public.document_acceptances;
--   (a tabela contract_addenda e os lançamentos gerados são preservados)
