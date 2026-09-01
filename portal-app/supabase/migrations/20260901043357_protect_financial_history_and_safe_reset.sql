-- Retenção financeira automática e reset contábil seguro.
-- Migração aditiva e idempotente alinhada ao banco de produção real.

create or replace function private.archive_financial_rows(
  p_client_id uuid default null,
  p_project_id uuid default null,
  p_finance_id uuid default null,
  p_reason text default 'financial_entry_deleted',
  p_archived_by uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
begin
  insert into public.client_financial_archive(
    source_table, source_row_id, original_client_id, original_contract_id,
    original_project_id, client_name_snapshot, client_email_snapshot,
    contract_number_snapshot, service_type_snapshot, contract_value_snapshot,
    currency, transaction_type, description, amount, occurred_on,
    source_snapshot, archived_reason, archived_by
  )
  select
    'financeiro', f.id::text, p.cliente_id, p.contract_id, p.id,
    coalesce(cl.nome, 'Cliente não identificado'), cl.email,
    coalesce(ct.contract_number, p.numero_contrato),
    coalesce(ct.service_type, p.tipo), ct.contract_value,
    coalesce(ct.currency, 'BRL'), f.tipo, f.descricao, f.valor, f.data,
    jsonb_build_object(
      'financeiro', to_jsonb(f),
      'projeto', to_jsonb(p),
      'cliente', to_jsonb(cl),
      'contrato', to_jsonb(ct)
    ),
    coalesce(nullif(btrim(p_reason), ''), 'financial_entry_deleted'),
    coalesce(p_archived_by, auth.uid())
  from public.financeiro f
  join public.projetos p on p.id = f.projeto_id
  left join public.clientes cl on cl.id = p.cliente_id
  left join public.contratos ct on ct.id = p.contract_id
  where (p_client_id is null or p.cliente_id = p_client_id)
    and (p_project_id is null or p.id = p_project_id)
    and (p_finance_id is null or f.id = p_finance_id)
  on conflict (source_table, source_row_id) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function private.archive_financial_rows(uuid,uuid,uuid,text,uuid) from public, anon, authenticated;

create or replace function private.archive_client_contracts(
  p_client_id uuid,
  p_reason text default 'client_deleted',
  p_archived_by uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
begin
  insert into public.client_financial_archive(
    source_table, source_row_id, original_client_id, original_contract_id,
    client_name_snapshot, client_email_snapshot, contract_number_snapshot,
    service_type_snapshot, contract_value_snapshot, currency, transaction_type,
    description, amount, occurred_on, source_snapshot, archived_reason, archived_by
  )
  select
    'contratos', ct.id::text, ct.cliente_id, ct.id,
    coalesce(cl.nome, 'Cliente não identificado'), cl.email,
    coalesce(ct.contract_number, ct.legacy_contract_number), ct.service_type,
    ct.contract_value, coalesce(ct.currency, 'BRL'), 'contract_value',
    'Valor contratado', ct.contract_value, coalesce(ct.signed_at, ct.start_date),
    jsonb_build_object('contrato', to_jsonb(ct), 'cliente', to_jsonb(cl)),
    coalesce(nullif(btrim(p_reason), ''), 'client_deleted'),
    coalesce(p_archived_by, auth.uid())
  from public.contratos ct
  left join public.clientes cl on cl.id = ct.cliente_id
  where ct.cliente_id = p_client_id
  on conflict (source_table, source_row_id) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function private.archive_client_contracts(uuid,text,uuid) from public, anon, authenticated;

create or replace function private.trg_archive_financeiro_before_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text;
begin
  v_reason := nullif(current_setting('app.financial_archive_reason', true), '');
  perform private.archive_financial_rows(
    null, null, old.id,
    coalesce(v_reason, 'financial_entry_deleted'),
    auth.uid()
  );
  return old;
end;
$$;

revoke all on function private.trg_archive_financeiro_before_delete() from public, anon, authenticated;

drop trigger if exists archive_financeiro_before_delete on public.financeiro;
create trigger archive_financeiro_before_delete
before delete on public.financeiro
for each row execute function private.trg_archive_financeiro_before_delete();

create or replace function private.trg_archive_project_finance_before_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.archive_financial_rows(null, old.id, null, 'project_deleted', auth.uid());
  return old;
end;
$$;

revoke all on function private.trg_archive_project_finance_before_delete() from public, anon, authenticated;

drop trigger if exists archive_project_finance_before_delete on public.projetos;
create trigger archive_project_finance_before_delete
before delete on public.projetos
for each row execute function private.trg_archive_project_finance_before_delete();

create or replace function private.trg_archive_client_finance_before_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.archive_financial_rows(old.id, null, null, 'client_deleted', auth.uid());
  perform private.archive_client_contracts(old.id, 'client_deleted', auth.uid());
  return old;
end;
$$;

revoke all on function private.trg_archive_client_finance_before_delete() from public, anon, authenticated;

drop trigger if exists archive_client_finance_before_delete on public.clientes;
create trigger archive_client_finance_before_delete
before delete on public.clientes
for each row execute function private.trg_archive_client_finance_before_delete();

create or replace function private.prevent_financial_archive_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'O histórico financeiro preservado é imutável.';
end;
$$;

revoke all on function private.prevent_financial_archive_mutation() from public, anon, authenticated;

drop trigger if exists prevent_financial_archive_update_delete on public.client_financial_archive;
create trigger prevent_financial_archive_update_delete
before update or delete on public.client_financial_archive
for each row execute function private.prevent_financial_archive_mutation();

drop trigger if exists prevent_financial_archive_truncate on public.client_financial_archive;
create trigger prevent_financial_archive_truncate
before truncate on public.client_financial_archive
for each statement execute function private.prevent_financial_archive_mutation();

create or replace function private.prevent_finance_truncate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'TRUNCATE bloqueado. Use o reset financeiro seguro para preservar o histórico.';
end;
$$;

revoke all on function private.prevent_finance_truncate() from public, anon, authenticated;

drop trigger if exists prevent_finance_truncate on public.financeiro;
create trigger prevent_finance_truncate
before truncate on public.financeiro
for each statement execute function private.prevent_finance_truncate();

revoke insert, update, delete, truncate on public.client_financial_archive from anon, authenticated;
revoke truncate on public.financeiro from anon, authenticated;
grant select on public.client_financial_archive to authenticated;

create or replace function public.admin_archive_client_financial_history(
  p_cliente_id uuid,
  p_reason text default 'client_deletion'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_finance integer := 0;
  v_contracts integer := 0;
begin
  if not public.is_portal_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;

  if not exists (select 1 from public.clientes where id = p_cliente_id) then
    raise exception 'Cliente não encontrado';
  end if;

  v_finance := private.archive_financial_rows(
    p_cliente_id, null, null,
    coalesce(nullif(btrim(p_reason), ''), 'client_deletion'),
    auth.uid()
  );
  v_contracts := private.archive_client_contracts(
    p_cliente_id,
    coalesce(nullif(btrim(p_reason), ''), 'client_deletion'),
    auth.uid()
  );

  return jsonb_build_object(
    'financialEntries', v_finance,
    'contracts', v_contracts,
    'totalArchived', v_finance + v_contracts
  );
end;
$$;

revoke all on function public.admin_archive_client_financial_history(uuid,text) from public, anon;
grant execute on function public.admin_archive_client_financial_history(uuid,text) to authenticated;

create or replace function public.admin_reset_financial_data(
  p_confirmation text,
  p_reason text default 'accounting_reset'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before integer := 0;
  v_archived integer := 0;
  v_deleted integer := 0;
  v_reason text;
begin
  if not public.is_portal_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;

  if upper(btrim(coalesce(p_confirmation, ''))) <> 'RESETAR FINANCEIRO' then
    raise exception 'Confirmação inválida. Digite RESETAR FINANCEIRO.';
  end if;

  v_reason := coalesce(nullif(btrim(p_reason), ''), 'accounting_reset');
  select count(*)::integer into v_before from public.financeiro;

  v_archived := private.archive_financial_rows(null, null, null, v_reason, auth.uid());

  perform set_config('app.financial_archive_reason', v_reason, true);
  delete from public.financeiro;
  get diagnostics v_deleted = row_count;

  return jsonb_build_object(
    'activeBefore', v_before,
    'archivedNow', v_archived,
    'deletedActive', v_deleted,
    'historyPreserved', true,
    'resetAt', now()
  );
end;
$$;

revoke all on function public.admin_reset_financial_data(text,text) from public, anon;
grant execute on function public.admin_reset_financial_data(text,text) to authenticated;
