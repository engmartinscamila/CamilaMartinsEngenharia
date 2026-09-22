-- Qualquer usuário autenticado compartilha o mesmo papel Postgres; RLS restringe
-- linhas, grants por coluna restringem o que um cliente pode solicitar via REST.
-- Identidade de quem publicou, motivo de revogação e IDs internos ficam privados.
REVOKE SELECT ON public.construction_schedule_publications FROM authenticated;
GRANT SELECT (id,project_id,baseline_version,published_snapshot,published_at,revoked_at)
 ON public.construction_schedule_publications TO authenticated;
