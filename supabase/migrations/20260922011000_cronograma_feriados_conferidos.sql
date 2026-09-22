-- Datas informadas pela administradora; não pressupõe calendário oficial de cidade,
-- estado ou convenção coletiva. Dias corridos incluem feriados normalmente.
CREATE TABLE IF NOT EXISTS public.construction_schedule_holidays (
 schedule_id uuid NOT NULL REFERENCES public.construction_schedules(id) ON DELETE CASCADE,
 holiday_date date NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 recorded_by uuid NOT NULL DEFAULT auth.uid(),
 source_note text NOT NULL DEFAULT 'Data não útil conferida para esta obra pela administradora',
 PRIMARY KEY(schedule_id,holiday_date)
);
CREATE INDEX IF NOT EXISTS construction_schedule_holidays_day_idx
 ON public.construction_schedule_holidays(holiday_date);
ALTER TABLE public.construction_schedule_holidays ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.construction_schedule_holidays FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,DELETE ON public.construction_schedule_holidays TO authenticated;
DROP POLICY IF EXISTS construction_schedule_holidays_admin_select ON public.construction_schedule_holidays;
CREATE POLICY construction_schedule_holidays_admin_select ON public.construction_schedule_holidays
 FOR SELECT TO authenticated USING (public.is_portal_admin());
DROP POLICY IF EXISTS construction_schedule_holidays_admin_insert ON public.construction_schedule_holidays;
CREATE POLICY construction_schedule_holidays_admin_insert ON public.construction_schedule_holidays
 FOR INSERT TO authenticated WITH CHECK (public.is_portal_admin() AND recorded_by=(SELECT auth.uid()));
DROP POLICY IF EXISTS construction_schedule_holidays_admin_delete ON public.construction_schedule_holidays;
CREATE POLICY construction_schedule_holidays_admin_delete ON public.construction_schedule_holidays
 FOR DELETE TO authenticated USING (public.is_portal_admin());

CREATE OR REPLACE FUNCTION public.guard_construction_schedule_holiday()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $guard$
DECLARE v_schedule public.construction_schedules%ROWTYPE;
BEGIN
 IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Feriados não podem ser editados; revise datas no rascunho'; END IF;
 IF (SELECT auth.uid()) IS NULL OR NOT public.is_portal_admin() THEN
  RAISE EXCEPTION 'Feriados exigem administração autenticada';
 END IF;
 SELECT * INTO v_schedule FROM public.construction_schedules
 WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.schedule_id ELSE NEW.schedule_id END FOR UPDATE;
 IF v_schedule.id IS NULL OR v_schedule.activation_status IS DISTINCT FROM 'draft' THEN
  RAISE EXCEPTION 'Calendário de linha de base aprovada ou legado não pode ser alterado';
 END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.holiday_date NOT BETWEEN v_schedule.planned_start AND v_schedule.planned_finish THEN
   RAISE EXCEPTION 'Feriado fora das datas planejadas; revise a data inicial e final da obra';
  END IF;
  RETURN NEW;
 END IF;
 RETURN OLD;
END;
$guard$;
DROP TRIGGER IF EXISTS construction_schedule_holiday_guard ON public.construction_schedule_holidays;
CREATE TRIGGER construction_schedule_holiday_guard BEFORE INSERT OR UPDATE OR DELETE
 ON public.construction_schedule_holidays FOR EACH ROW
 EXECUTE FUNCTION public.guard_construction_schedule_holiday();

CREATE OR REPLACE FUNCTION public.admin_set_construction_schedule_holidays(p_schedule_id uuid,p_dates jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $save$
DECLARE v_schedule public.construction_schedules%ROWTYPE; v_text text; v_day date; v_count integer:=0;
BEGIN
 IF (SELECT auth.uid()) IS NULL OR NOT public.is_portal_admin() THEN
  RAISE EXCEPTION 'Acesso administrativo necessário'; END IF;
 SELECT * INTO v_schedule FROM public.construction_schedules WHERE id=p_schedule_id FOR UPDATE;
 IF v_schedule.id IS NULL OR v_schedule.activation_status IS DISTINCT FROM 'draft'
   OR v_schedule.planned_start IS NULL OR v_schedule.planned_finish IS NULL THEN
  RAISE EXCEPTION 'Defina o plano em rascunho antes de cadastrar os feriados'; END IF;
 IF jsonb_typeof(p_dates) IS DISTINCT FROM 'array' OR jsonb_array_length(p_dates)>366 THEN
  RAISE EXCEPTION 'Informe uma lista de até 366 datas de calendário'; END IF;
 DELETE FROM public.construction_schedule_holidays WHERE schedule_id=p_schedule_id;
 FOR v_text IN SELECT value FROM jsonb_array_elements_text(p_dates) LOOP
  IF v_text !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'Formato de feriado inválido'; END IF;
  v_day:=v_text::date;
  IF pg_catalog.to_char(v_day,'YYYY-MM-DD') IS DISTINCT FROM v_text THEN
   RAISE EXCEPTION 'Data de feriado inválida'; END IF;
  IF v_day NOT BETWEEN v_schedule.planned_start AND v_schedule.planned_finish THEN
   RAISE EXCEPTION 'Feriado fora do período planejado'; END IF;
  INSERT INTO public.construction_schedule_holidays(schedule_id,holiday_date,recorded_by)
  VALUES(p_schedule_id,v_day,(SELECT auth.uid()));
  v_count:=v_count+1;
 END LOOP;
 RETURN v_count;
END;
$save$;
REVOKE ALL ON FUNCTION public.admin_set_construction_schedule_holidays(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_construction_schedule_holidays(uuid,jsonb) TO authenticated;

-- Estende a RPC atômica existente SEM alterar o contrato da assinatura.
-- Se um feriado é inválido, o plano e o cabeçalho também são revertidos.
CREATE OR REPLACE FUNCTION public.admin_initialize_and_save_full_schedule(
 p_project_id uuid,p_quote_record_id uuid,p_contract_record_id uuid,p_plan jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $atomic$
DECLARE v_schedule_id uuid;
BEGIN
 IF NOT public.is_portal_admin() OR (SELECT auth.uid()) IS NULL THEN
  RAISE EXCEPTION 'Acesso administrativo necessário'; END IF;
 v_schedule_id := public.admin_initialize_construction_schedule(
   p_project_id,p_quote_record_id,p_contract_record_id);
 PERFORM public.admin_save_full_schedule_plan(v_schedule_id,p_plan);
 PERFORM public.admin_set_construction_schedule_holidays(
    v_schedule_id,coalesce(p_plan->'holidays','[]'::jsonb));
 RETURN v_schedule_id;
END;
$atomic$;
REVOKE ALL ON FUNCTION public.admin_initialize_and_save_full_schedule(uuid,uuid,uuid,jsonb)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_initialize_and_save_full_schedule(uuid,uuid,uuid,jsonb)
 TO authenticated;

-- Aprovação deve confirmar a duração real no calendário persistido.
-- Executa apenas na transição draft -> approved, jamais nos registros existentes.
CREATE OR REPLACE FUNCTION public.validate_construction_schedule_holidays_at_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $validate$
BEGIN
 IF NEW.activation_status IS DISTINCT FROM 'approved' OR
    OLD.activation_status='approved' THEN RETURN NEW; END IF;
 IF EXISTS (
  SELECT 1 FROM public.construction_schedule_items i
  WHERE i.schedule_id=NEW.id AND (
   i.planned_start IS NULL OR i.planned_finish IS NULL OR i.planned_duration_days IS NULL OR
   (NEW.work_calendar='calendar_days' AND i.planned_finish-i.planned_start+1<>i.planned_duration_days) OR
   (NEW.work_calendar='weekdays' AND (
      extract(isodow from i.planned_start)>5 OR extract(isodow from i.planned_finish)>5 OR
      EXISTS (SELECT 1 FROM public.construction_schedule_holidays h
       WHERE h.schedule_id=NEW.id AND h.holiday_date IN (i.planned_start,i.planned_finish)) OR
      (SELECT count(*) FROM pg_catalog.generate_series(i.planned_start::timestamp,i.planned_finish::timestamp,'1 day'::interval) d
       WHERE extract(isodow from d)<=5 AND NOT EXISTS (
        SELECT 1 FROM public.construction_schedule_holidays h
        WHERE h.schedule_id=NEW.id AND h.holiday_date=d::date))<>i.planned_duration_days
   ))
  )
 ) THEN RAISE EXCEPTION 'Duração ou datas não correspondem aos dias úteis/feriados conferidos'; END IF;
 RETURN NEW;
END;
$validate$;
DROP TRIGGER IF EXISTS zz_construction_schedule_holidays_approval ON public.construction_schedules;
CREATE TRIGGER zz_construction_schedule_holidays_approval BEFORE UPDATE OF activation_status
 ON public.construction_schedules FOR EACH ROW
 EXECUTE FUNCTION public.validate_construction_schedule_holidays_at_approval();

-- Feriados também são congelados no arquivo da linha de base, sem reescrever o
-- snapshot aprovado originalmente, nem presumir feriados para o legado.
ALTER TABLE public.construction_schedule_baseline_versions
 ADD COLUMN IF NOT EXISTS holiday_dates date[] NOT NULL DEFAULT '{}'::date[];
CREATE OR REPLACE FUNCTION public.guard_construction_baseline_archive()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $guard$
DECLARE v_header public.construction_schedules%ROWTYPE;
BEGIN
 IF TG_OP <> 'INSERT' THEN
  RAISE EXCEPTION 'Histórico de linhas de base é imutável; não edite nem apague versões'; END IF;
 IF (SELECT auth.uid()) IS NULL OR NOT public.is_portal_admin() THEN
  RAISE EXCEPTION 'Somente a administradora autenticada arquiva a linha de base'; END IF;
 SELECT * INTO v_header FROM public.construction_schedules WHERE id=NEW.schedule_id;
 IF v_header.id IS NULL OR v_header.activation_status IS DISTINCT FROM 'approved'
    OR v_header.baseline_version IS DISTINCT FROM NEW.baseline_version
    OR v_header.baseline_snapshot IS DISTINCT FROM NEW.baseline_snapshot
    OR v_header.source_scope_snapshot IS DISTINCT FROM NEW.source_scope_snapshot
    OR v_header.approved_at IS DISTINCT FROM NEW.approved_at
    OR v_header.approved_by IS DISTINCT FROM NEW.approved_by
    OR NEW.holiday_dates IS DISTINCT FROM ARRAY(
      SELECT h.holiday_date FROM public.construction_schedule_holidays h
      WHERE h.schedule_id=NEW.schedule_id ORDER BY h.holiday_date) THEN
  RAISE EXCEPTION 'O arquivo não corresponde integralmente à linha de base aprovada'; END IF;
 RETURN NEW;
END;
$guard$;
CREATE OR REPLACE FUNCTION public.archive_approved_construction_baseline()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $archive$
BEGIN
 IF NEW.activation_status='approved' AND NEW.baseline_version>=1
    AND NEW.baseline_snapshot IS NOT NULL
    AND (TG_OP='INSERT' OR OLD.activation_status IS DISTINCT FROM 'approved') THEN
   INSERT INTO public.construction_schedule_baseline_versions(
    schedule_id,baseline_version,baseline_snapshot,source_scope_snapshot,approved_at,approved_by,holiday_dates)
   VALUES(NEW.id,NEW.baseline_version,NEW.baseline_snapshot,NEW.source_scope_snapshot,
     NEW.approved_at,NEW.approved_by,
     ARRAY(SELECT h.holiday_date FROM public.construction_schedule_holidays h
       WHERE h.schedule_id=NEW.id ORDER BY h.holiday_date));
 END IF;
 RETURN NEW;
END;
$archive$;
REVOKE ALL ON FUNCTION public.guard_construction_schedule_holiday() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.validate_construction_schedule_holidays_at_approval() FROM PUBLIC,anon,authenticated;
