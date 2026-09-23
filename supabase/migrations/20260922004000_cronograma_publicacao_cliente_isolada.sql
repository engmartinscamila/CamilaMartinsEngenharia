-- Etapa 6: publicação EXPLÍCITA de um resumo sem honorários, custos, notas internas
-- ou escopo comercial integral. Não abrir RLS das tabelas administrativas.
-- Publicações antigas são revogadas, nunca apagadas: rastreabilidade preservada.
CREATE TABLE IF NOT EXISTS public.construction_schedule_publications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE RESTRICT,
 schedule_id uuid NOT NULL REFERENCES public.construction_schedules(id) ON DELETE RESTRICT,
 baseline_version integer NOT NULL CHECK (baseline_version>=1),
 published_snapshot jsonb NOT NULL,
 published_at timestamptz NOT NULL DEFAULT now(),
 published_by uuid NOT NULL DEFAULT auth.uid(),
 revoked_at timestamptz,
 revoked_by uuid,
 revoke_reason text,
 CONSTRAINT publication_revocation_consistent CHECK (
  (revoked_at IS NULL AND revoked_by IS NULL AND revoke_reason IS NULL) OR
  (revoked_at IS NOT NULL AND revoked_by IS NOT NULL AND char_length(btrim(coalesce(revoke_reason,'')))>=10)
 )
);
CREATE UNIQUE INDEX IF NOT EXISTS construction_publication_current_project_idx
 ON public.construction_schedule_publications(project_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS construction_publication_history_idx
 ON public.construction_schedule_publications(project_id,published_at DESC);
ALTER TABLE public.construction_schedule_publications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.construction_schedule_publications FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.construction_schedule_publications TO authenticated;
DROP POLICY IF EXISTS construction_publication_admin_select ON public.construction_schedule_publications;
CREATE POLICY construction_publication_admin_select ON public.construction_schedule_publications
 FOR SELECT TO authenticated USING (public.is_portal_admin());
DROP POLICY IF EXISTS construction_publication_admin_insert ON public.construction_schedule_publications;
CREATE POLICY construction_publication_admin_insert ON public.construction_schedule_publications
 FOR INSERT TO authenticated WITH CHECK (public.is_portal_admin() AND published_by=(SELECT auth.uid()));
DROP POLICY IF EXISTS construction_publication_admin_update ON public.construction_schedule_publications;
CREATE POLICY construction_publication_admin_update ON public.construction_schedule_publications
 FOR UPDATE TO authenticated USING (public.is_portal_admin()) WITH CHECK (public.is_portal_admin());
DROP POLICY IF EXISTS construction_publication_client_select ON public.construction_schedule_publications;
CREATE POLICY construction_publication_client_select ON public.construction_schedule_publications
 FOR SELECT TO authenticated USING (
  revoked_at IS NULL AND (SELECT auth.uid()) IS NOT NULL
  AND (SELECT public.current_client_id()) IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.projetos p WHERE p.id=project_id
    AND p.cliente_id=(SELECT public.current_client_id()))
  AND EXISTS (SELECT 1 FROM public.project_portal_settings settings
    WHERE settings.project_id=project_id AND settings.show_schedule IS TRUE)
 );

CREATE OR REPLACE FUNCTION public.admin_publish_full_schedule_to_client(p_schedule_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $publish$
DECLARE v_schedule public.construction_schedules%ROWTYPE;
DECLARE v_stages jsonb;v_publication uuid;
BEGIN
 IF NOT public.is_portal_admin() OR (SELECT auth.uid()) IS NULL THEN
  RAISE EXCEPTION 'Somente administradora autenticada pode publicar';
 END IF;
 SELECT * INTO v_schedule FROM public.construction_schedules WHERE id=p_schedule_id FOR UPDATE;
 IF v_schedule.id IS NULL OR v_schedule.activation_status IS DISTINCT FROM 'approved'
    OR v_schedule.baseline_version<1 OR v_schedule.baseline_snapshot IS NULL
    OR v_schedule.quote_record_id IS NULL OR v_schedule.contract_record_id IS NULL THEN
  RAISE EXCEPTION 'Cronograma deve possuir vínculo comercial e linha de base aprovada';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.project_portal_settings settings
      WHERE settings.project_id=v_schedule.project_id AND settings.show_schedule IS TRUE) THEN
  RAISE EXCEPTION 'O módulo de cronograma deve estar habilitado no portal deste projeto';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.projetos p WHERE p.id=v_schedule.project_id
      AND p.cliente_id=v_schedule.client_id AND p.contract_id=v_schedule.contract_id) THEN
  RAISE EXCEPTION 'Projeto, cliente e contrato estão inconsistentes';
 END IF;
 -- Somente campos explicitamente permitidos; nenhuma coluna livre da tabela
 -- de atividade ou de contratos pode ser serializada integralmente.
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'code',a->>'code', 'activity',a->>'activity',
  'planned_start',a->>'planned_start', 'planned_finish',a->>'planned_finish',
  'actual_progress',m.actual_progress, 'measurement_date',m.measured_on
 ) ORDER BY (a->>'display_order')::integer, a->>'code'),'[]'::jsonb) INTO v_stages
 FROM jsonb_array_elements(v_schedule.baseline_snapshot->'activities') a
 JOIN public.construction_schedule_items i
   ON i.schedule_id=v_schedule.id AND i.code=a->>'code'
 LEFT JOIN LATERAL (
  SELECT e.actual_progress,e.measured_on
  FROM public.construction_schedule_measurements e
  WHERE e.schedule_id=v_schedule.id AND e.item_id=i.id AND e.measured_on<=current_date
  ORDER BY e.measured_on DESC,e.recorded_at DESC,e.id DESC LIMIT 1
 ) m ON TRUE;
 IF jsonb_array_length(v_stages)<>jsonb_array_length(v_schedule.baseline_snapshot->'activities')
    OR jsonb_array_length(v_stages)=0 THEN
  RAISE EXCEPTION 'Linha de base e atividades divergentes: não publicar';
 END IF;
 UPDATE public.construction_schedule_publications SET
  revoked_at=now(),revoked_by=(SELECT auth.uid()),
  revoke_reason='Substituída por nova publicação auditável'
 WHERE project_id=v_schedule.project_id AND revoked_at IS NULL;
 INSERT INTO public.construction_schedule_publications(
  project_id,schedule_id,baseline_version,published_snapshot,published_by)
 VALUES(v_schedule.project_id,v_schedule.id,v_schedule.baseline_version,
  jsonb_build_object('title',v_schedule.title,'baseline_version',v_schedule.baseline_version,
    'planned_start',v_schedule.planned_start,'planned_finish',v_schedule.planned_finish,
    'activities',v_stages),(SELECT auth.uid()))
 RETURNING id INTO v_publication;
 RETURN v_publication;
END;
$publish$;

CREATE OR REPLACE FUNCTION public.admin_revoke_full_schedule_publication(p_publication_id uuid,p_reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $revoke$
DECLARE v_count integer;
BEGIN
 IF NOT public.is_portal_admin() OR (SELECT auth.uid()) IS NULL THEN
  RAISE EXCEPTION 'Somente administradora autenticada pode retirar publicação';
 END IF;
 IF char_length(btrim(coalesce(p_reason,'')))<10 THEN
  RAISE EXCEPTION 'Informe motivo de revogação auditável';
 END IF;
 UPDATE public.construction_schedule_publications SET
   revoked_at=now(),revoked_by=(SELECT auth.uid()),revoke_reason=btrim(p_reason)
 WHERE id=p_publication_id AND revoked_at IS NULL;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 RETURN v_count=1;
END;
$revoke$;
REVOKE ALL ON FUNCTION public.admin_publish_full_schedule_to_client(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.admin_revoke_full_schedule_publication(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_publish_full_schedule_to_client(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_full_schedule_publication(uuid,text) TO authenticated;
