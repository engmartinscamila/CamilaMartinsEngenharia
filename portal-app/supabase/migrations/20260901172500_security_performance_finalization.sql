BEGIN;

-- RPCs administrativos de armazenamento nunca devem ser públicos/anônimos.
REVOKE EXECUTE ON FUNCTION public.admin_storage_orphan_details() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_storage_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_storage_orphan_details() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_storage_overview() TO authenticated, service_role;

-- Regra de negócio: cliente cria a solicitação, mas não responde à própria solicitação.
DROP POLICY IF EXISTS cliente_cria_resposta_propria ON public.solicitacao_respostas;

DO $$
BEGIN
  IF to_regprocedure('public.reply_to_own_request(bigint,text)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.reply_to_own_request(bigint,text) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.reply_to_own_request(bigint,text) TO service_role';
  END IF;
END $$;

-- Índices de cobertura das FKs reportadas pelo advisor do Supabase.
CREATE INDEX IF NOT EXISTS document_generation_history_commercial_record_id_idx
  ON public.document_generation_history (commercial_record_id);
CREATE INDEX IF NOT EXISTS document_generation_history_contract_id_idx
  ON public.document_generation_history (contract_id);
CREATE INDEX IF NOT EXISTS document_generation_history_generated_by_idx
  ON public.document_generation_history (generated_by);
CREATE INDEX IF NOT EXISTS notificacoes_projeto_id_idx
  ON public.notificacoes (projeto_id);
CREATE INDEX IF NOT EXISTS protected_asset_issues_project_id_idx
  ON public.protected_asset_issues (project_id);

-- Tabelas internas: manter inacessíveis pela Data API e tornar a intenção explícita.
DROP POLICY IF EXISTS deny_direct_api_access ON public.app_admin_rate_limits;
CREATE POLICY deny_direct_api_access ON public.app_admin_rate_limits
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS deny_direct_api_access ON public.app_push_tokens;
CREATE POLICY deny_direct_api_access ON public.app_push_tokens
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DO $$
BEGIN
  IF to_regclass('public.google_calendar_oauth_states') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS deny_direct_api_access ON public.google_calendar_oauth_states';
    EXECUTE 'CREATE POLICY deny_direct_api_access ON public.google_calendar_oauth_states FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)';
  END IF;
END $$;

COMMIT;
