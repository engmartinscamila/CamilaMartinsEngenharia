-- Fase 7: teste estrutural SOMENTE LEITURA. Execute após a migração em homologação.
DO $$
DECLARE
  v_count integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contratos' AND column_name='contract_value') THEN
    RAISE EXCEPTION 'FALHA: contratos.contract_value ausente';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='documentos' AND column_name='protection_mode') THEN
    RAISE EXCEPTION 'FALHA: documentos.protection_mode ausente';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fotos' AND column_name='protection_mode') THEN
    RAISE EXCEPTION 'FALHA: fotos.protection_mode ausente';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='solicitacoes' AND column_name='categoria') THEN
    RAISE EXCEPTION 'FALHA: solicitacoes.categoria ausente';
  END IF;
  IF to_regclass('public.client_financial_archive') IS NULL OR to_regclass('public.protected_asset_issues') IS NULL THEN
    RAISE EXCEPTION 'FALHA: tabelas de arquivo financeiro/proteção ausentes';
  END IF;

  SELECT count(*) INTO v_count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname IN ('financeiro','extrato_financeiro','client_financial_archive')
    AND c.relrowsecurity AND c.relforcerowsecurity;
  IF v_count <> 3 THEN RAISE EXCEPTION 'FALHA: RLS forçada não está ativa nas três tabelas financeiras'; END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename IN ('financeiro','extrato_financeiro','client_financial_archive')
      AND coalesce(qual,'') NOT LIKE '%is_portal_admin%'
  ) THEN RAISE EXCEPTION 'FALHA: existe política financeira sem verificação administrativa'; END IF;

  SELECT count(*) INTO v_count FROM pg_policies
  WHERE schemaname='public' AND (
    (tablename='financeiro' AND policyname='finance_admin_only') OR
    (tablename='extrato_financeiro' AND policyname='ledger_admin_only') OR
    (tablename='client_financial_archive' AND policyname='financial_archive_admin_read')
  );
  IF v_count <> 3 THEN RAISE EXCEPTION 'FALHA: políticas financeiras finais incompletas'; END IF;

  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id IN ('documentos','fotos','materiais-protegidos') AND public=true) THEN
    RAISE EXCEPTION 'FALHA: bucket privado foi marcado como público';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public'
      AND tablename IN ('financeiro','extrato_financeiro','client_financial_archive','protected_asset_issues')
  ) THEN RAISE EXCEPTION 'FALHA: tabela financeira/sensível publicada no Realtime'; END IF;

  SELECT count(*) INTO v_count FROM pg_publication_tables
  WHERE pubname='supabase_realtime' AND schemaname='public'
    AND tablename IN ('clientes','contratos','projetos','documentos','fotos','biblioteca','agenda','cronograma','aprovacoes','solicitacoes','notificacoes');
  IF v_count <> 11 THEN RAISE EXCEPTION 'FALHA: espelhamento operacional Realtime incompleto'; END IF;

  IF to_regprocedure('public.admin_client_deletion_preview(uuid)') IS NULL
    OR to_regprocedure('public.admin_archive_client_financial_history(uuid,text)') IS NULL
    OR to_regprocedure('public.admin_storage_orphan_details()') IS NULL THEN
    RAISE EXCEPTION 'FALHA: funções administrativas da Fase 7 ausentes';
  END IF;
END;
$$;

SELECT jsonb_build_object(
  'status','APROVADO',
  'financeOnlyAdmin',true,
  'forcedRls',true,
  'privateBuckets',true,
  'financialRetention',true,
  'protectedIssues',true,
  'operationalMirror',true,
  'financeOutsideRealtime',true
) AS phase7_security_status;
