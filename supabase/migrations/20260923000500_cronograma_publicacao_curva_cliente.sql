-- Curva S sanitizada para o portal do cliente.
-- O snapshot publica SOMENTE datas e percentuais agregados; não publica pesos,
-- custos, honorários, fontes, notas internas ou identificadores de medições.

CREATE OR REPLACE FUNCTION public.full_schedule_planned_percent_at(
  p_schedule_id uuid,
  p_reference date
) RETURNS numeric
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $planned$
WITH schedule AS (
  SELECT s.work_calendar, s.baseline_snapshot
  FROM public.construction_schedules s
  WHERE s.id = p_schedule_id
), activities AS (
  SELECT
    (a->>'weight_percent')::numeric AS weight_percent,
    (a->>'planned_start')::date AS planned_start,
    (a->>'planned_finish')::date AS planned_finish,
    sc.work_calendar
  FROM schedule sc,
       LATERAL jsonb_array_elements(sc.baseline_snapshot->'activities') a
), fractions AS (
  SELECT activity.*,
    CASE
      WHEN p_reference < planned_start THEN 0::numeric
      WHEN p_reference >= planned_finish THEN 1::numeric
      WHEN work_calendar = 'calendar_days' THEN
        ((p_reference - planned_start + 1)::numeric /
          nullif((planned_finish - planned_start + 1)::numeric,0))
      ELSE
        (
          SELECT count(*)::numeric
          FROM generate_series(planned_start,p_reference,'1 day'::interval) d(day)
          WHERE extract(isodow from d.day) < 6
            AND NOT EXISTS (
              SELECT 1 FROM public.construction_schedule_holidays h
              WHERE h.schedule_id=p_schedule_id AND h.holiday_date=d.day::date
            )
        ) / nullif((
          SELECT count(*)::numeric
          FROM generate_series(planned_start,planned_finish,'1 day'::interval) d(day)
          WHERE extract(isodow from d.day) < 6
            AND NOT EXISTS (
              SELECT 1 FROM public.construction_schedule_holidays h
              WHERE h.schedule_id=p_schedule_id AND h.holiday_date=d.day::date
            )
        ),0)
    END AS fraction
  FROM activities activity
)
SELECT round(coalesce(sum(weight_percent * greatest(0,least(1,fraction))),0),2)
FROM fractions;
$planned$;

CREATE OR REPLACE FUNCTION public.full_schedule_measured_percent_at(
  p_schedule_id uuid,
  p_reference date
) RETURNS numeric
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $measured$
WITH baseline AS (
  SELECT a->>'code' code,(a->>'weight_percent')::numeric weight_percent
  FROM public.construction_schedules s,
       LATERAL jsonb_array_elements(s.baseline_snapshot->'activities') a
  WHERE s.id=p_schedule_id
), latest AS (
  SELECT b.code,b.weight_percent,m.actual_progress
  FROM baseline b
  LEFT JOIN LATERAL (
    SELECT e.actual_progress
    FROM public.construction_schedule_items i
    JOIN public.construction_schedule_measurements e ON e.item_id=i.id
    WHERE i.schedule_id=p_schedule_id AND i.code=b.code
      AND e.schedule_id=p_schedule_id AND e.measured_on<=p_reference
    ORDER BY e.measured_on DESC,e.recorded_at DESC,e.id DESC
    LIMIT 1
  ) m ON TRUE
)
SELECT CASE WHEN count(*) FILTER (WHERE actual_progress IS NOT NULL)=count(*) AND count(*)>0
  THEN round(sum(weight_percent*actual_progress/100),2)
  ELSE NULL END
FROM latest;
$measured$;

CREATE OR REPLACE FUNCTION public.admin_publish_full_schedule_to_client(p_schedule_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $publish$
DECLARE v_schedule public.construction_schedules%ROWTYPE;
DECLARE v_stages jsonb;v_curve jsonb;v_summary jsonb;v_publication uuid;
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
 IF v_schedule.is_current IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'Somente a revisão vigente pode ser publicada ao cliente';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.project_portal_settings settings
      WHERE settings.project_id=v_schedule.project_id AND settings.show_schedule IS TRUE) THEN
  RAISE EXCEPTION 'O módulo de cronograma deve estar habilitado no portal deste projeto';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.projetos p WHERE p.id=v_schedule.project_id
      AND p.cliente_id=v_schedule.client_id AND p.contract_id=v_schedule.contract_id) THEN
  RAISE EXCEPTION 'Projeto, cliente e contrato estão inconsistentes';
 END IF;

 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'code',a->>'code','activity',a->>'activity',
  'planned_start',a->>'planned_start','planned_finish',a->>'planned_finish',
  'actual_progress',m.actual_progress,'measurement_date',m.measured_on
 ) ORDER BY (a->>'display_order')::integer,a->>'code'),'[]'::jsonb) INTO v_stages
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
 IF v_schedule.planned_start IS NULL OR v_schedule.planned_finish IS NULL OR
    v_schedule.planned_finish<v_schedule.planned_start OR
    (v_schedule.planned_finish-v_schedule.planned_start)>3653 THEN
  RAISE EXCEPTION 'Prazo inválido para gerar Curva S do cliente';
 END IF;

 WITH dates AS (
   SELECT v_schedule.planned_start AS day
   UNION
   SELECT least(d::date,v_schedule.planned_finish)
   FROM generate_series(v_schedule.planned_start,v_schedule.planned_finish,'7 days'::interval) d
   UNION
   SELECT v_schedule.planned_finish
   UNION
   SELECT e.measured_on
   FROM public.construction_schedule_measurements e
   WHERE e.schedule_id=v_schedule.id
     AND e.measured_on BETWEEN v_schedule.planned_start AND v_schedule.planned_finish
 ), points AS (
   SELECT day,
     public.full_schedule_planned_percent_at(v_schedule.id,day) planned,
     public.full_schedule_measured_percent_at(v_schedule.id,day) actual
   FROM dates
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'date',day,'planned_percent',planned,'actual_percent',actual
 ) ORDER BY day),'[]'::jsonb) INTO v_curve FROM points;

 v_summary:=jsonb_build_object(
   'reference_date',current_date,
   'planned_percent',public.full_schedule_planned_percent_at(v_schedule.id,current_date),
   'actual_percent',public.full_schedule_measured_percent_at(v_schedule.id,current_date),
   'deadline',v_schedule.planned_finish,
   'revision_number',v_schedule.revision_number
 );

 UPDATE public.construction_schedule_publications SET
  revoked_at=now(),revoked_by=(SELECT auth.uid()),
  revoke_reason='Substituída por nova publicação auditável'
 WHERE project_id=v_schedule.project_id AND revoked_at IS NULL;
 INSERT INTO public.construction_schedule_publications(
  project_id,schedule_id,baseline_version,published_snapshot,published_by)
 VALUES(v_schedule.project_id,v_schedule.id,v_schedule.baseline_version,
  jsonb_build_object(
    'title',v_schedule.title,'baseline_version',v_schedule.baseline_version,
    'planned_start',v_schedule.planned_start,'planned_finish',v_schedule.planned_finish,
    'summary',v_summary,'curve',v_curve,'activities',v_stages
  ),(SELECT auth.uid()))
 RETURNING id INTO v_publication;
 RETURN v_publication;
END;
$publish$;

REVOKE ALL ON FUNCTION public.full_schedule_planned_percent_at(uuid,date) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.full_schedule_measured_percent_at(uuid,date) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.admin_publish_full_schedule_to_client(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_publish_full_schedule_to_client(uuid) TO authenticated;
