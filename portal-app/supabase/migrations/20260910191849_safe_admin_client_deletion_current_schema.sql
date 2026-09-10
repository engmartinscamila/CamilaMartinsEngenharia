create or replace function public.admin_client_deletion_preview(p_cliente_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_projects uuid[] := '{}'::uuid[];
  v_client jsonb;
  v_emission_snapshots integer := 0;
  v_document_acceptances integer := 0;
  v_fiscal_documents integer := 0;
begin
  if not public.is_portal_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;

  select jsonb_build_object('id', c.id, 'name', c.nome, 'email', c.email, 'status', c.status)
    into v_client
  from public.clientes c
  where c.id = p_cliente_id;

  if v_client is null then
    raise exception 'Cliente não encontrado';
  end if;

  select coalesce(array_agg(p.id), '{}'::uuid[])
    into v_projects
  from public.projetos p
  where p.cliente_id = p_cliente_id;

  select count(*)::integer
    into v_emission_snapshots
  from public.document_emission_snapshots s
  join public.documentos d on d.id = s.document_id
  where d.cliente_id = p_cliente_id or d.projeto_id = any(v_projects);

  select count(*)::integer
    into v_document_acceptances
  from public.document_acceptances a
  where a.client_id = p_cliente_id or a.project_id = any(v_projects);

  select count(*)::integer
    into v_fiscal_documents
  from public.fiscal_documents f
  where f.project_id = any(v_projects);

  return v_client || jsonb_build_object(
    'contracts', (select count(*) from public.contratos c where c.cliente_id = p_cliente_id),
    'projects', coalesce(array_length(v_projects, 1), 0),
    'documents', (select count(*) from public.documentos d where d.cliente_id = p_cliente_id or d.projeto_id = any(v_projects)),
    'photos', (select count(*) from public.fotos f where f.cliente_id = p_cliente_id or f.projeto_id = any(v_projects)),
    'libraryItems', (select count(*) from public.biblioteca b where b.cliente_id = p_cliente_id or b.projeto_id = any(v_projects)),
    'financialEntries', (select count(*) from public.financeiro f where f.projeto_id = any(v_projects)),
    'ledgerEntries', 0,
    'contractedValue', (select coalesce(sum(c.contract_value), 0) from public.contratos c where c.cliente_id = p_cliente_id),
    'alreadyArchived', (select count(*) from public.client_financial_archive a where a.original_client_id = p_cliente_id),
    'emissionSnapshots', v_emission_snapshots,
    'documentAcceptances', v_document_acceptances,
    'fiscalDocuments', v_fiscal_documents,
    'retentionBlockers', v_emission_snapshots + v_document_acceptances + v_fiscal_documents,
    'canDelete', (v_emission_snapshots + v_document_acceptances + v_fiscal_documents) = 0
  );
end
$$;

revoke all on function public.admin_client_deletion_preview(uuid) from public, anon;
grant execute on function public.admin_client_deletion_preview(uuid) to authenticated, service_role;

create or replace function public.admin_purge_client_database(p_cliente_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth uuid;
  v_projects uuid[] := '{}'::uuid[];
  v_blockers integer := 0;
begin
  if not public.is_portal_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;

  select c.auth_id
    into v_auth
  from public.clientes c
  where c.id = p_cliente_id
  for update;

  if not found then
    raise exception 'Cliente não encontrado';
  end if;

  perform 1
  from public.projetos p
  where p.cliente_id = p_cliente_id
  for update;

  select coalesce(array_agg(p.id), '{}'::uuid[])
    into v_projects
  from public.projetos p
  where p.cliente_id = p_cliente_id;

  select
      (select count(*) from public.document_emission_snapshots s
       join public.documentos d on d.id = s.document_id
       where d.cliente_id = p_cliente_id or d.projeto_id = any(v_projects))
    + (select count(*) from public.document_acceptances a
       where a.client_id = p_cliente_id or a.project_id = any(v_projects))
    + (select count(*) from public.fiscal_documents f
       where f.project_id = any(v_projects))
    into v_blockers;

  if v_blockers > 0 then
    raise exception 'Exclusão bloqueada: existem registros documentais ou fiscais de retenção obrigatória. Arquive ou revogue o acesso em vez de apagar o cadastro.';
  end if;

  perform public.admin_archive_client_financial_history(p_cliente_id, 'client_deletion');
  perform set_config('app.financial_archive_reason', 'client_deletion', true);

  delete from public.agenda a
  where a.cliente_id = p_cliente_id or a.projeto_id = any(v_projects);

  update public.documentos d
  set revision_of = null, superseded_by = null
  where d.cliente_id = p_cliente_id or d.projeto_id = any(v_projects);

  delete from public.documentos d
  where d.cliente_id = p_cliente_id or d.projeto_id = any(v_projects);

  delete from public.projetos p
  where p.id = any(v_projects);

  delete from public.contratos c
  where c.cliente_id = p_cliente_id;

  delete from public.clientes c
  where c.id = p_cliente_id;

  return v_auth;
end
$$;

revoke all on function public.admin_purge_client_database(uuid) from public, anon;
grant execute on function public.admin_purge_client_database(uuid) to authenticated, service_role;
