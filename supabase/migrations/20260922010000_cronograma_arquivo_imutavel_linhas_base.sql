-- Fundação do versionamento: cada aprovação guarda uma cópia imutável do plano,
-- sem remover UNIQUE(project_id) ou permitir reprogramação silenciosa da versão atual.
-- Revisões/aditivos posteriores exigem fluxo próprio de aprovação e ativação.
CREATE TABLE IF NOT EXISTS public.construction_schedule_baseline_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 schedule_id uuid NOT NULL REFERENCES public.construction_schedules(id) ON DELETE RESTRICT,
 baseline_version integer NOT NULL CHECK (baseline_version>=1),
 baseline_snapshot jsonb NOT NULL,
 source_scope_snapshot jsonb NOT NULL,
 approved_at timestamptz,
 approved_by uuid,
 archived_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT construction_baseline_versions_unique UNIQUE(schedule_id,baseline_version),
 CONSTRAINT construction_baseline_snapshot_has_activities CHECK (
  jsonb_typeof(baseline_snapshot->'activities')='array' AND
  jsonb_array_length(baseline_snapshot->'activities')>0)
);
CREATE INDEX IF NOT EXISTS construction_baseline_versions_schedule_idx
 ON public.construction_schedule_baseline_versions(schedule_id,baseline_version DESC);
ALTER TABLE public.construction_schedule_baseline_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.construction_schedule_baseline_versions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.construction_schedule_baseline_versions TO authenticated;
DROP POLICY IF EXISTS construction_baseline_versions_admin_read ON public.construction_schedule_baseline_versions;
CREATE POLICY construction_baseline_versions_admin_read ON public.construction_schedule_baseline_versions
 FOR SELECT TO authenticated USING (public.is_portal_admin());
DROP POLICY IF EXISTS construction_baseline_versions_admin_insert ON public.construction_schedule_baseline_versions;
CREATE POLICY construction_baseline_versions_admin_insert ON public.construction_schedule_baseline_versions
 FOR INSERT TO authenticated WITH CHECK (public.is_portal_admin() AND (SELECT auth.uid()) IS NOT NULL);

-- Primeiro arquivar as versões já aprovadas com os privilégios de migração.
-- Se a proteção de INSERT fosse instalada antes, o contexto de migração sem
-- JWT legítimo bloquearia a cópia e reverteria a atualização de esquema.
INSERT INTO public.construction_schedule_baseline_versions(
 schedule_id,baseline_version,baseline_snapshot,source_scope_snapshot,approved_at,approved_by)
SELECT id,baseline_version,baseline_snapshot,source_scope_snapshot,approved_at,approved_by
FROM public.construction_schedules
WHERE activation_status='approved' AND baseline_version>=1
 AND baseline_snapshot IS NOT NULL AND source_scope_snapshot IS NOT NULL
ON CONFLICT (schedule_id,baseline_version) DO NOTHING;

CREATE OR REPLACE FUNCTION public.guard_construction_baseline_archive()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $guard$
DECLARE v_header public.construction_schedules%ROWTYPE;
BEGIN
 IF TG_OP <> 'INSERT' THEN
  RAISE EXCEPTION 'Histórico de linhas de base é imutável; não edite nem apague versões';
 END IF;
 IF (SELECT auth.uid()) IS NULL OR NOT public.is_portal_admin() THEN
  RAISE EXCEPTION 'Somente a administradora autenticada arquiva a linha de base';
 END IF;
 SELECT * INTO v_header FROM public.construction_schedules WHERE id=NEW.schedule_id;
 IF v_header.id IS NULL OR v_header.activation_status IS DISTINCT FROM 'approved'
    OR v_header.baseline_version IS DISTINCT FROM NEW.baseline_version
    OR v_header.baseline_snapshot IS DISTINCT FROM NEW.baseline_snapshot
    OR v_header.source_scope_snapshot IS DISTINCT FROM NEW.source_scope_snapshot
    OR v_header.approved_at IS DISTINCT FROM NEW.approved_at
    OR v_header.approved_by IS DISTINCT FROM NEW.approved_by THEN
  RAISE EXCEPTION 'O arquivo não corresponde integralmente à linha de base aprovada';
 END IF;
 RETURN NEW;
END;
$guard$;
DROP TRIGGER IF EXISTS construction_baseline_archive_guard ON public.construction_schedule_baseline_versions;
CREATE TRIGGER construction_baseline_archive_guard BEFORE INSERT OR UPDATE OR DELETE
 ON public.construction_schedule_baseline_versions FOR EACH ROW
 EXECUTE FUNCTION public.guard_construction_baseline_archive();

-- Uma aprovação e seu arquivo acontecem na mesma transação: se o arquivo não
-- puder ser gravado, a aprovação também será revertida.
CREATE OR REPLACE FUNCTION public.archive_approved_construction_baseline()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $archive$
BEGIN
 IF NEW.activation_status='approved' AND NEW.baseline_version>=1
    AND NEW.baseline_snapshot IS NOT NULL
    AND (TG_OP='INSERT' OR OLD.activation_status IS DISTINCT FROM 'approved') THEN
   INSERT INTO public.construction_schedule_baseline_versions(
    schedule_id,baseline_version,baseline_snapshot,source_scope_snapshot,approved_at,approved_by)
   VALUES(NEW.id,NEW.baseline_version,NEW.baseline_snapshot,NEW.source_scope_snapshot,
     NEW.approved_at,NEW.approved_by);
 END IF;
 RETURN NEW;
END;
$archive$;
DROP TRIGGER IF EXISTS construction_archive_approved_baseline ON public.construction_schedules;
CREATE TRIGGER construction_archive_approved_baseline AFTER INSERT OR UPDATE OF activation_status
 ON public.construction_schedules FOR EACH ROW
 EXECUTE FUNCTION public.archive_approved_construction_baseline();
REVOKE ALL ON FUNCTION public.guard_construction_baseline_archive() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.archive_approved_construction_baseline() FROM PUBLIC,anon,authenticated;
