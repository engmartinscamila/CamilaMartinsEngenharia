/*
  Execute somente depois das migrações da Fase 4, primeiro em branch/backup.
  Este arquivo é somente leitura e retorna PASS/FAIL para a estrutura crítica.
*/

WITH expected(table_name) AS (
  VALUES ('clientes'),('projetos'),('documentos'),('fotos'),('biblioteca'),
         ('agenda'),('cronograma'),('solicitacoes'),('solicitacao_respostas'),
         ('notificacoes'),('aprovacoes'),('financeiro'),('extrato_financeiro'),
         ('configuracoes'),('usuarios'),('pdf_admins'),('protected_site_pdfs'),
         ('protected_pdf_issues'),('audit_log'),('contratos'),('project_members'),
         ('app_migration_issues'),('app_admin_rate_limits')
)
SELECT
  'RLS habilitado' AS check_name,
  CASE WHEN count(*) FILTER (WHERE c.relrowsecurity) = count(*) THEN 'PASS' ELSE 'FAIL' END AS result,
  count(*) FILTER (WHERE c.oid IS NULL OR NOT c.relrowsecurity) AS failures
FROM expected e
LEFT JOIN (
  SELECT c.oid, c.relname, c.relrowsecurity
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
) c ON c.relname = e.table_name;

SELECT
  'Políticas públicas legadas neutralizadas' AS check_name,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS result,
  array_agg(tablename || '.' || policyname) AS failures
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = ANY(ARRAY[
    'clientes','projetos','documentos','fotos','biblioteca','agenda',
    'cronograma','solicitacoes','solicitacao_respostas','notificacoes',
    'aprovacoes','financeiro','extrato_financeiro','configuracoes',
    'usuarios','pdf_admins','protected_site_pdfs','protected_pdf_issues','audit_log'
  ])
  AND policyname <> ALL(ARRAY[
    'clients_read_own_or_admin','clients_admin_manage','clients_admin_update',
    'projects_members_read','projects_admin_manage','documents_project_read',
    'documents_admin_manage','photos_project_read','photos_admin_manage',
    'library_scoped_read','library_admin_manage','agenda_project_read',
    'agenda_admin_manage','schedule_project_read','schedule_admin_manage',
    'requests_project_read','requests_client_insert','requests_admin_manage',
    'request_replies_read','request_replies_admin_manage','notifications_read',
    'notifications_admin_manage','approvals_project_read','approvals_admin_manage',
    'finance_admin_only','ledger_admin_only','settings_authenticated_read',
    'settings_admin_manage','users_self_read','users_admin_manage',
    'pdf_admins_self_read','pdf_admins_admin_manage','protected_pdfs_read',
    'protected_pdfs_admin_manage','protected_issues_read',
    'protected_issues_admin_manage','audit_admin_read'
  ])
  AND (
    (cmd IN ('SELECT','DELETE') AND regexp_replace(coalesce(qual,''),'[()[:space:]]','','g') <> 'false')
    OR (cmd = 'INSERT' AND regexp_replace(coalesce(with_check,''),'[()[:space:]]','','g') <> 'false')
    OR (cmd IN ('UPDATE','ALL') AND (
      regexp_replace(coalesce(qual,''),'[()[:space:]]','','g') <> 'false'
      OR regexp_replace(coalesce(with_check,''),'[()[:space:]]','','g') <> 'false'
    ))
  );

WITH expected(bucket_id) AS (
  VALUES ('documentos'),('fotos'),('materiais-protegidos'),('biblioteca'),
         ('projetos'),('cronograma'),('clientes')
)
SELECT
  'Buckets privados' AS check_name,
  CASE WHEN count(b.id) = count(*) AND bool_and(b.public = false) THEN 'PASS' ELSE 'FAIL' END AS result,
  array_agg(e.bucket_id) FILTER (WHERE b.id IS NULL OR b.public) AS failures
FROM expected e
LEFT JOIN storage.buckets b ON b.id = e.bucket_id;

WITH expected(table_name) AS (
  SELECT unnest(ARRAY[
    'clientes','projetos','documentos','fotos','biblioteca','agenda','cronograma',
    'solicitacoes','solicitacao_respostas','notificacoes','aprovacoes','financeiro',
    'extrato_financeiro','configuracoes','usuarios','pdf_admins',
    'protected_site_pdfs','protected_pdf_issues','audit_log','contratos','project_members',
    'app_migration_issues','app_admin_rate_limits'
  ])
), checks AS (
  SELECT table_name,
    has_table_privilege('anon', format('public.%I', table_name), 'SELECT')
    OR has_table_privilege('anon', format('public.%I', table_name), 'INSERT')
    OR has_table_privilege('anon', format('public.%I', table_name), 'UPDATE')
    OR has_table_privilege('anon', format('public.%I', table_name), 'DELETE') AS has_privilege
  FROM expected
)
SELECT
  'Nenhum privilégio anon nas tabelas de negócio' AS check_name,
  CASE WHEN count(*) FILTER (WHERE has_privilege) = 0 THEN 'PASS' ELSE 'FAIL' END AS result,
  array_agg(table_name) FILTER (WHERE has_privilege) AS failures
FROM checks;

SELECT
  'Políticas legadas do Storage neutralizadas' AS check_name,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS result,
  array_agg(policyname) AS failures
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname = ANY(ARRAY[
    'authenticated_read_documentos','authenticated_read_fotos',
    'authenticated_read_biblioteca','authenticated_read_materiais_protegidos',
    'authenticated_read_projetos','authenticated_read_cronograma',
    'authenticated_read_clientes','admin_write_documentos',
    'admin_delete_documentos','admin_write_fotos','admin_delete_fotos',
    'admin_write_biblioteca','admin_delete_biblioteca',
    'admin_write_materiais_protegidos','admin_delete_materiais_protegidos',
    'admin_write_projetos','admin_delete_projetos','admin_write_cronograma',
    'admin_delete_cronograma','admin_write_clientes','admin_delete_clientes',
    'scoped_client_file_read','admin_manage_portal_storage_insert',
    'admin_manage_portal_storage_update','admin_manage_portal_storage_delete'
  ])
  AND (
    (cmd IN ('SELECT','DELETE') AND regexp_replace(coalesce(qual,''),'[()[:space:]]','','g') <> 'false')
    OR (cmd = 'INSERT' AND regexp_replace(coalesce(with_check,''),'[()[:space:]]','','g') <> 'false')
    OR (cmd IN ('UPDATE','ALL') AND (
      regexp_replace(coalesce(qual,''),'[()[:space:]]','','g') <> 'false'
      OR regexp_replace(coalesce(with_check,''),'[()[:space:]]','','g') <> 'false'
    ))
  );

SELECT
  'Funções administrativas presentes' AS check_name,
  CASE WHEN count(DISTINCT p.proname) = 7 THEN 'PASS' ELSE 'FAIL' END AS result,
  7 - count(DISTINCT p.proname) AS failures
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = ANY(ARRAY[
    'admin_create_contract_project','admin_reply_request',
    'admin_storage_overview','admin_purge_client_database','admin_set_client_status',
    'admin_create_project_for_contract','consume_admin_rate_limit'
  ]);
