-- Qualquer usuário autenticado compartilha o mesmo papel Postgres; RLS restringe
-- linhas, grants por coluna restringem o que um cliente pode solicitar via REST.
-- Identidade de quem publicou, motivo de revogação e IDs internos ficam privados.
REVOKE SELECT ON public.construction_schedule_publications FROM authenticated;
GRANT SELECT (id,project_id,baseline_version,published_snapshot,published_at,revoked_at)
 ON public.construction_schedule_publications TO authenticated;

-- IMPORTANTE: qualificar a coluna externa nos EXISTS. Dentro da subconsulta
-- project_portal_settings também possui project_id; usar "project_id" sem
-- qualificador produziria settings.project_id=settings.project_id e permitiria
-- liberar publicações por causa do módulo de OUTRO projeto.
DROP POLICY IF EXISTS construction_publication_client_select ON public.construction_schedule_publications;
CREATE POLICY construction_publication_client_select ON public.construction_schedule_publications
 FOR SELECT TO authenticated USING (
  revoked_at IS NULL AND (SELECT auth.uid()) IS NOT NULL
  AND (SELECT public.current_client_id()) IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.projetos p
    WHERE p.id=construction_schedule_publications.project_id
      AND p.cliente_id=(SELECT public.current_client_id()))
  AND EXISTS (SELECT 1 FROM public.project_portal_settings settings
    WHERE settings.project_id=construction_schedule_publications.project_id
      AND settings.show_schedule IS TRUE)
 );
