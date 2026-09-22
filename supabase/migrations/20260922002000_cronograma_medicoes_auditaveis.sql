-- Etapa 5: o percentual ATUAL não constitui série histórica.
-- Novas medições não alteram nem substituem snapshots de linha de base.
-- Migração preparada na PR #19; não aplicar sobre produção antes da homologação.
CREATE TABLE IF NOT EXISTS public.construction_schedule_measurements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 schedule_id uuid NOT NULL REFERENCES public.construction_schedules(id) ON DELETE RESTRICT,
 item_id uuid NOT NULL REFERENCES public.construction_schedule_items(id) ON DELETE RESTRICT,
 measured_on date NOT NULL,
 actual_progress integer NOT NULL CHECK (actual_progress BETWEEN 0 AND 100),
 actual_construction_cost numeric(16,2) CHECK (actual_construction_cost>=0),
 actual_start date,
 actual_finish date,
 reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 10 AND 2000),
 recorded_at timestamptz NOT NULL DEFAULT now(),
 recorded_by uuid NOT NULL DEFAULT auth.uid(),
 CONSTRAINT construction_measurement_dates CHECK (
  (actual_start IS NULL OR actual_start<=measured_on) AND
  (actual_finish IS NULL OR actual_finish<=measured_on) AND
  (actual_start IS NULL OR actual_finish IS NULL OR actual_finish>=actual_start)
 )
);
CREATE INDEX IF NOT EXISTS construction_measurements_history_idx
 ON public.construction_schedule_measurements(schedule_id,item_id,measured_on DESC,recorded_at DESC,id DESC);
ALTER TABLE public.construction_schedule_measurements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.construction_schedule_measurements FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.construction_schedule_measurements TO authenticated;
DROP POLICY IF EXISTS construction_measurements_admin_select ON public.construction_schedule_measurements;
CREATE POLICY construction_measurements_admin_select ON public.construction_schedule_measurements
 FOR SELECT TO authenticated USING (public.is_portal_admin());
DROP POLICY IF EXISTS construction_measurements_admin_insert ON public.construction_schedule_measurements;
CREATE POLICY construction_measurements_admin_insert ON public.construction_schedule_measurements
 FOR INSERT TO authenticated WITH CHECK (public.is_portal_admin() AND recorded_by=(SELECT auth.uid()));
-- Nenhuma role de aplicativo possui UPDATE ou DELETE. Uma correção é uma NOVA
-- medição com sua própria data de registro e justificativa, nunca apagamento.
CREATE OR REPLACE FUNCTION public.guard_construction_measurement_event()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $measurement$
DECLARE v_state text;
BEGIN
 IF TG_OP<>'INSERT' THEN
  RAISE EXCEPTION 'Histórico de medição é imutável; registre outra medição com justificativa';
 END IF;
 IF NOT public.is_portal_admin() OR (SELECT auth.uid()) IS NULL OR NEW.recorded_by IS DISTINCT FROM (SELECT auth.uid()) THEN
  RAISE EXCEPTION 'Somente a administradora autenticada registra medições';
 END IF;
 SELECT activation_status INTO v_state FROM public.construction_schedules WHERE id=NEW.schedule_id;
 IF v_state IS DISTINCT FROM 'approved' OR NOT EXISTS(
  SELECT 1 FROM public.construction_schedule_items i WHERE i.id=NEW.item_id AND i.schedule_id=NEW.schedule_id
 ) THEN
  RAISE EXCEPTION 'Medição exige cronograma aprovado e atividade pertencente a ele';
 END IF;
 IF NEW.measured_on>current_date THEN
  RAISE EXCEPTION 'Medição futura não pode ser apresentada como realizada';
 END IF;
 RETURN NEW;
END;
$measurement$;
DROP TRIGGER IF EXISTS construction_measurement_immutable ON public.construction_schedule_measurements;
CREATE TRIGGER construction_measurement_immutable BEFORE INSERT OR UPDATE OR DELETE
 ON public.construction_schedule_measurements FOR EACH ROW
 EXECUTE FUNCTION public.guard_construction_measurement_event();
REVOKE ALL ON FUNCTION public.guard_construction_measurement_event() FROM PUBLIC,anon,authenticated;

-- Uma chamada HTTP / transação. Falha em qualquer atividade cancela todas as
-- inserções e as atualizações de avanço corrente. Datas retroativas são
-- preservadas no histórico e não sobrescrevem o estado mais recente.
CREATE OR REPLACE FUNCTION public.admin_record_full_schedule_measurement(
 p_schedule_id uuid,p_measured_on date,p_entries jsonb,p_reason text
) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $record$
DECLARE v_schedule public.construction_schedules%ROWTYPE;
DECLARE v_entry jsonb;v_item public.construction_schedule_items%ROWTYPE;
DECLARE v_total integer;v_distinct integer;v_code text;v_cost numeric;
DECLARE v_progress integer;v_start date;v_finish date;v_last_date date;
BEGIN
 IF NOT public.is_portal_admin() OR (SELECT auth.uid()) IS NULL THEN
  RAISE EXCEPTION 'Acesso administrativo necessário';
 END IF;
 SELECT * INTO v_schedule FROM public.construction_schedules WHERE id=p_schedule_id FOR UPDATE;
 IF v_schedule.id IS NULL OR v_schedule.activation_status IS DISTINCT FROM 'approved' OR
    v_schedule.baseline_version<1 OR v_schedule.baseline_snapshot IS NULL THEN
  RAISE EXCEPTION 'Uma linha de base aprovada é obrigatória para medição';
 END IF;
 IF p_measured_on IS NULL OR p_measured_on>current_date THEN
  RAISE EXCEPTION 'Data de medição inválida ou futura';
 END IF;
 IF char_length(btrim(coalesce(p_reason,''))) NOT BETWEEN 10 AND 2000 THEN
  RAISE EXCEPTION 'Informe uma justificativa auditável de 10 a 2000 caracteres';
 END IF;
 IF jsonb_typeof(p_entries) IS DISTINCT FROM 'array' THEN
  RAISE EXCEPTION 'Selecione as atividades efetivamente medidas';
 END IF;
 IF jsonb_array_length(p_entries) NOT BETWEEN 1 AND 200 THEN
  RAISE EXCEPTION 'Informe entre 1 e 200 atividades medidas';
 END IF;
 SELECT count(*),count(DISTINCT e->>'code') INTO v_total,v_distinct
 FROM jsonb_array_elements(p_entries) e;
 IF v_total<>v_distinct THEN
  RAISE EXCEPTION 'A mesma atividade foi medida duas vezes na mesma solicitação';
 END IF;
 FOR v_entry IN SELECT value FROM jsonb_array_elements(p_entries) LOOP
  v_code:=nullif(btrim(v_entry->>'code'),'');
  IF v_code IS NULL OR coalesce(v_entry->>'progress','') !~ '^(100|[1-9]?[0-9])$' THEN
   RAISE EXCEPTION 'Informe código e progresso inteiro de 0 a 100';
  END IF;
  v_progress:=(v_entry->>'progress')::integer;
  IF v_entry->>'actual_cost' IS NOT NULL AND (
    (v_entry->>'actual_cost') !~ '^[0-9]+(\.[0-9]{1,2})?$') THEN
   RAISE EXCEPTION 'Custo realizado inválido para %',v_code;
  END IF;
  v_cost:=(v_entry->>'actual_cost')::numeric;
  v_start:=(v_entry->>'actual_start')::date;
  v_finish:=(v_entry->>'actual_finish')::date;
  SELECT * INTO v_item FROM public.construction_schedule_items
   WHERE schedule_id=p_schedule_id AND code=v_code FOR UPDATE;
  IF v_item.id IS NULL THEN RAISE EXCEPTION 'Atividade medida não pertence ao cronograma: %',v_code; END IF;
  IF (v_start IS NOT NULL AND v_start>p_measured_on) OR
     (v_finish IS NOT NULL AND v_finish>p_measured_on) OR
     (v_finish IS NOT NULL AND v_finish<coalesce(v_start,v_item.actual_start,v_finish)) THEN
   RAISE EXCEPTION 'Datas reais inconsistentes para %',v_code;
  END IF;
  SELECT max(measured_on) INTO v_last_date FROM public.construction_schedule_measurements
   WHERE schedule_id=p_schedule_id AND item_id=v_item.id;
  INSERT INTO public.construction_schedule_measurements(
   schedule_id,item_id,measured_on,actual_progress,actual_construction_cost,
   actual_start,actual_finish,reason,recorded_by)
  VALUES(p_schedule_id,v_item.id,p_measured_on,v_progress,v_cost,v_start,v_finish,btrim(p_reason),(SELECT auth.uid()));
  IF v_last_date IS NULL OR p_measured_on>=v_last_date THEN
   UPDATE public.construction_schedule_items SET
    actual_progress=v_progress,
    actual_cost=coalesce(v_cost,actual_cost),
    actual_start=coalesce(v_start,actual_start),
    actual_finish=coalesce(v_finish,actual_finish),
    updated_at=now()
   WHERE id=v_item.id;
  END IF;
 END LOOP;
 RETURN v_total;
END;
$record$;
REVOKE ALL ON FUNCTION public.admin_record_full_schedule_measurement(uuid,date,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_record_full_schedule_measurement(uuid,date,jsonb,text) TO authenticated;
