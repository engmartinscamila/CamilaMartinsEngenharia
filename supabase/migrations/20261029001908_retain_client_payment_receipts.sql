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
  v_auth uuid;
  v_emission_snapshots integer := 0;
  v_document_acceptances integer := 0;
  v_fiscal_documents integer := 0;
  v_payment_receipts integer := 0;
  v_legal_acceptances integer := 0;
  v_protected_asset_issues integer := 0;
  v_protected_pdf_issues integer := 0;
begin
  if not public.is_portal_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;

  select jsonb_build_object('id', c.id, 'name', c.nome, 'email', c.email, 'status', c.status), c.auth_id
    into v_client, v_auth
  from public.clientes c
  where c.id = p_cliente_id;

  if v_client is null then
    raise exception 'Cliente não encontrado';
  end if;

  select coalesce(array_agg(p.id), '{}'::uuid[])
    into v_projects
  from public.projetos p
  where p.cliente_id = p_cliente_id;

  select count(*)::integer into v_emission_snapshots
  from public.document_emission_snapshots s
  join public.documentos d on d.id = s.document_id
  where d.cliente_id = p_cliente_id or d.projeto_id = any(v_projects);

  select count(*)::integer into v_document_acceptances
  from public.document_acceptances a
  where a.client_id = p_cliente_id or a.project_id = any(v_projects);

  select count(*)::integer into v_fiscal_documents
  from public.fiscal_documents f
  where f.project_id = any(v_projects);

  select count(*)::integer into v_payment_receipts from public.payment_receipts r where r.client_id=p_cliente_id;

  if v_auth is not null then
    select count(*)::integer into v_legal_acceptances
    from public.legal_acceptances l where l.user_id = v_auth;
  end if;

  select count(*)::integer into v_protected_asset_issues
  from public.protected_asset_issues i
  where i.client_id = p_cliente_id
     or i.project_id = any(v_projects)
     or (v_auth is not null and i.user_id = v_auth);

  select count(*)::integer into v_protected_pdf_issues
  from public.protected_pdf_issues i
  where i.client_id = p_cliente_id
     or (v_auth is not null and i.user_id = v_auth);

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
    'paymentReceipts', v_payment_receipts,
    'legalAcceptances', v_legal_acceptances,
    'protectedAssetIssues', v_protected_asset_issues,
    'protectedPdfIssues', v_protected_pdf_issues,
    'retainedSecurityEvents', v_legal_acceptances + v_protected_asset_issues + v_protected_pdf_issues,
    'retentionBlockers', v_emission_snapshots + v_document_acceptances + v_fiscal_documents + v_payment_receipts,
    'canDelete', (v_emission_snapshots + v_document_acceptances + v_fiscal_documents + v_payment_receipts) = 0
  );
end
$$;

revoke all on function public.admin_client_deletion_preview(uuid) from public, anon;
grant execute on function public.admin_client_deletion_preview(uuid) to authenticated, service_role;

