-- Etapas 4-6: gravação atômica do plano selecionado; rollback integral se falhar.
-- Não reescreve documentos e jamais altera cronogramas históricos.
CREATE OR REPLACE FUNCTION public.guard_full_schedule_status_transition()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $status$
BEGIN
 IF TG_OP='UPDATE' AND OLD.activation_status='approved' AND NEW.activation_status<>'approved' THEN
  RAISE EXCEPTION 'Cronograma aprovado não pode voltar a rascunho; registre nova versão';
 END IF;
 IF TG_OP='UPDATE' AND OLD.activation_status='legacy' AND NEW.activation_status<>'legacy' THEN
  RAISE EXCEPTION 'Cronograma legado exige migração formal com novo registro/versionamento';
 END IF;
 RETURN NEW;
END;
$status$;
DROP TRIGGER IF EXISTS full_schedule_status_transition_guard ON public.construction_schedules;
CREATE TRIGGER full_schedule_status_transition_guard BEFORE UPDATE OF activation_status
ON public.construction_schedules FOR EACH ROW
EXECUTE FUNCTION public.guard_full_schedule_status_transition();

CREATE OR REPLACE FUNCTION public.admin_save_full_schedule_plan(p_schedule_id uuid,p_plan jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $save$
DECLARE v_header public.construction_schedules%ROWTYPE;
DECLARE v_scope jsonb;v_items jsonb;v_item jsonb;
DECLARE v_count integer;v_unique integer;v_weight numeric;v_min date;v_max date;
DECLARE v_pred text;v_source text;v_code text;v_day_start date;v_day_finish date;
BEGIN
 IF NOT public.is_portal_admin() THEN RAISE EXCEPTION 'Acesso administrativo necessário'; END IF;
 SELECT * INTO v_header FROM public.construction_schedules WHERE id=p_schedule_id FOR UPDATE;
 IF v_header.id IS NULL OR v_header.activation_status IS DISTINCT FROM 'draft' THEN
   RAISE EXCEPTION 'Somente cronogramas novos em rascunho podem receber um plano'; END IF;
 v_scope:=public.assert_full_schedule_commercial_link(
    v_header.project_id,v_header.quote_record_id,v_header.contract_record_id);
 IF v_scope IS DISTINCT FROM v_header.source_scope_snapshot THEN
   RAISE EXCEPTION 'Vínculo comercial mudou; não usar escopo desatualizado'; END IF;
 IF p_plan->>'scope_confirmed' IS DISTINCT FROM 'true' THEN
   RAISE EXCEPTION 'Confirme individualmente as atividades do escopo antes de salvar'; END IF;
 IF p_plan->>'calendar' IS NULL OR p_plan->>'calendar' NOT IN ('weekdays','calendar_days') OR
    p_plan->>'weight_source' IS NULL OR p_plan->>'weight_source' NOT IN ('construction_costs','confirmed_manual') THEN
   RAISE EXCEPTION 'Selecione calendário e origem dos pesos'; END IF;
 v_items:=p_plan->'items';
 IF jsonb_typeof(v_items) IS DISTINCT FROM 'array' THEN
   RAISE EXCEPTION 'Atividades não informadas'; END IF;
 IF jsonb_array_length(v_items)=0 OR jsonb_array_length(v_items)>200 THEN
   RAISE EXCEPTION 'Informe de 1 a 200 atividades confirmadas'; END IF;
 SELECT count(*),count(DISTINCT i->>'code'),sum((i->>'weight_percent')::numeric),
 min((i->>'planned_start')::date),max((i->>'planned_finish')::date)
 INTO v_count,v_unique,v_weight,v_min,v_max
 FROM jsonb_array_elements(v_items) i;
 IF v_count IS DISTINCT FROM v_unique OR abs(coalesce(v_weight,0)-100)>0.01 OR v_min IS NULL OR v_max IS NULL THEN
  RAISE EXCEPTION 'Códigos únicos, datas e pesos totalizando 100%% são obrigatórios'; END IF;
 IF p_plan->>'planned_start' IS DISTINCT FROM v_min::text OR
    p_plan->>'planned_finish' IS DISTINCT FROM v_max::text THEN
  RAISE EXCEPTION 'Início e término geral devem vir das atividades calculadas'; END IF;
 FOR v_item IN SELECT value FROM jsonb_array_elements(v_items) LOOP
   v_code:=nullif(btrim(v_item->>'code'),'');
   v_source:=nullif(btrim(v_item->>'source_service_code'),'');
   v_pred:=nullif(btrim(v_item->>'predecessor_code'),'');
   v_day_start:=(v_item->>'planned_start')::date;
   v_day_finish:=(v_item->>'planned_finish')::date;
   IF v_code IS NULL OR nullif(btrim(v_item->>'activity'),'') IS NULL OR
      v_day_start IS NULL OR v_day_finish IS NULL OR v_day_finish<v_day_start OR
      v_item->>'planned_duration_days' IS NULL OR (v_item->>'planned_duration_days')::integer<1 OR
      v_item->>'weight_percent' IS NULL OR
      (v_item->>'weight_percent')::numeric NOT BETWEEN 0 AND 100 THEN
      RAISE EXCEPTION 'Atividade inválida: %',coalesce(v_code,'sem código'); END IF;
   IF v_source IS NULL OR NOT EXISTS(
     SELECT 1 FROM jsonb_array_elements(v_scope->'services') s
     WHERE s->>'code'=v_source AND s->>'included'='true') THEN
     RAISE EXCEPTION 'Etapa % não pertence ao serviço contratado',v_code; END IF;
   IF v_pred IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM jsonb_array_elements(v_items) p
      WHERE p->>'code'=v_pred AND (p->>'planned_finish')::date<v_day_start) THEN
      RAISE EXCEPTION 'Predecessora inexistente ou data conflitante para %',v_code; END IF;
   IF (v_item->>'planned_cost') IS NOT NULL AND (v_item->>'planned_cost')::numeric<0 THEN
      RAISE EXCEPTION 'Custo de obra inválido para %',v_code; END IF;
 END LOOP;
 -- Os registros são substituídos somente depois de todas as validações;
 -- qualquer erro de insert faz ROLLBACK da instrução SQL inteira.
 DELETE FROM public.construction_schedule_items WHERE schedule_id=p_schedule_id;
 INSERT INTO public.construction_schedule_items(
  schedule_id,code,category,activity,display_order,weight_percent,
  planned_duration_days,predecessor_code,planned_start,planned_finish,
  planned_cost,actual_progress,status,is_default,source_service_code,
  weight_source,cost_source,quantity,unit,unit_cost)
 SELECT p_schedule_id,i->>'code',coalesce(i->>'category','Obra'),i->>'activity',
  coalesce((i->>'display_order')::integer,ord::integer),
  (i->>'weight_percent')::numeric,(i->>'planned_duration_days')::integer,
  nullif(i->>'predecessor_code',''),(i->>'planned_start')::date,(i->>'planned_finish')::date,
  (i->>'planned_cost')::numeric,0,'Pendente',false,i->>'source_service_code',
  p_plan->>'weight_source',nullif(i->>'cost_source',''),
  (i->>'quantity')::numeric,nullif(i->>'unit',''),(i->>'unit_cost')::numeric
 FROM jsonb_array_elements(v_items) WITH ORDINALITY AS entry(i,ord);
 UPDATE public.construction_schedules SET
   work_calendar=p_plan->>'calendar', weight_source=p_plan->>'weight_source',
   planned_start=v_min,planned_finish=v_max,
   notes=coalesce(nullif(p_plan->>'notes',''),notes),updated_at=now()
 WHERE id=p_schedule_id;
 RETURN p_schedule_id;
END;
$save$;
REVOKE ALL ON FUNCTION public.guard_full_schedule_status_transition() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.admin_save_full_schedule_plan(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_save_full_schedule_plan(uuid,jsonb) TO authenticated;
