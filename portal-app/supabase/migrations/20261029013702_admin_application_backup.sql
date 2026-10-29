-- Read-only, admin-only application export. Credentials, sessions, invitation
-- tokens and Vault remain outside this export; this is not a PostgreSQL dump.
create or replace function public.admin_export_application_backup()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  t text; rows_json jsonb; columns_json jsonb; row_count bigint;
  tables_json jsonb := '{}'::jsonb; counts_json jsonb := '{}'::jsonb;
  schemas_json jsonb := '{}'::jsonb; objects_json jsonb;
  included constant text[] := array[
    'admin_financial_preferences','agenda','aprovacoes','audit_log','bank_transactions',
    'biblioteca','client_financial_archive','client_retention_event_archive','clientes',
    'clientes_camila','commercial_contract_quote_links','commercial_records','configuracoes',
    'construction_schedule_baseline_versions','construction_schedule_holidays',
    'construction_schedule_items','construction_schedule_measurements','construction_schedule_publications',
    'construction_schedule_revision_requests','construction_schedule_template_items',
    'construction_schedule_templates','construction_schedules','contract_master_versions',
    'contract_scope_items','contratos','cronograma','document_acceptances','document_archive_batches',
    'document_emission_snapshots','document_generation_history','document_number_counters',
    'document_pending_alerts','document_rule_reviews','document_text_catalog','document_text_catalog_versions',
    'documentos','financeiro','financial_accounts','fiscal_documents','fotos','legal_acceptances',
    'notificacoes','payment_receipts','project_members','project_portal_settings',
    'project_task_dependencies','project_tasks','projetos','protected_site_pdfs',
    'purchase_quote_items','purchase_quotes','service_catalog','service_catalog_versions',
    'service_level_catalog','service_level_catalog_versions','service_level_scope_catalog',
    'service_level_scope_versions','solicitacao_respostas','solicitacoes','supplier_bids',
    'suppliers','task_template_items','task_templates','timesheets','usuarios','work_diary_entries'
  ];
begin
  if auth.uid() is null or not public.is_portal_admin() then
    raise exception 'Acesso administrativo necessário.' using errcode = '42501';
  end if;
  foreach t in array included loop
    execute format('select count(*) from public.%I', t) into row_count;
    if row_count > 100000 then raise exception 'Tabela % excede o limite da exportação assistida.', t; end if;
    execute format('select coalesce(jsonb_agg(to_jsonb(r)), ''[]''::jsonb) from public.%I r', t) into rows_json;
    if jsonb_array_length(rows_json) <> row_count then raise exception 'Exportação incompleta: %.', t; end if;
    select jsonb_agg(jsonb_build_object('name',column_name,'type',udt_name,'nullable',is_nullable='YES') order by ordinal_position)
      into columns_json from information_schema.columns where table_schema='public' and table_name=t;
    tables_json := tables_json || jsonb_build_object(t, rows_json);
    counts_json := counts_json || jsonb_build_object(t, row_count);
    schemas_json := schemas_json || jsonb_build_object(t, columns_json);
    if octet_length(tables_json::text) > 31457280 then raise exception 'Dados excedem 30 MB; utilize a exportação administrativa do banco.'; end if;
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('bucket',bucket_id,'path',name,
      'size',coalesce((metadata->>'size')::bigint,0),'updated_at',updated_at,
      'etag',coalesce(metadata->>'eTag',metadata->>'etag')) order by bucket_id,name),'[]'::jsonb)
    into objects_json from storage.objects;
  return jsonb_build_object('version',3,'scope','application-data','created_at',statement_timestamp(),
    'tables',tables_json,'counts',counts_json,'columns',schemas_json,'storage_objects',objects_json,
    'limitations',jsonb_build_array('Não é um dump do PostgreSQL. A restauração exige o esquema e as migrações da mesma versão.',
      'Auth, senhas, sessões, Vault, tokens de acesso, filas de e-mail e configurações externas não são exportados.',
      'O JSON contém o inventário dos arquivos. Os arquivos físicos só estão incluídos na opção ZIP.',
      'Arquivos locais ainda não enviados e mídias externas ao Supabase não fazem parte deste pacote.'));
end;
$$;
revoke all on function public.admin_export_application_backup() from public, anon;
grant execute on function public.admin_export_application_backup() to authenticated;
