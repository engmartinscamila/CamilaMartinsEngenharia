-- Etapas 4 e 5: regras de aprovação. Não atualiza cronogramas históricos.
ALTER TABLE public.construction_schedules
 ADD COLUMN IF NOT EXISTS work_calendar text,
 ADD COLUMN IF NOT EXISTS weight_source text,
 ADD COLUMN IF NOT EXISTS baseline_version integer NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS baseline_snapshot jsonb,
 ADD COLUMN IF NOT EXISTS approved_at timestamptz,
 ADD COLUMN IF NOT EXISTS approved_by uuid;
ALTER TABLE public.construction_schedules
 DROP CONSTRAINT IF EXISTS construction_schedule_calendar_valid;
ALTER TABLE public.construction_schedules
 ADD CONSTRAINT construction_schedule_calendar_valid CHECK(
  work_calendar IS NULL OR work_calendar IN ('weekdays','calendar_days'));
ALTER TABLE public.construction_schedules
 DROP CONSTRAINT IF EXISTS construction_schedule_weight_source_valid;
ALTER TABLE public.construction_schedules
 ADD CONSTRAINT construction_schedule_weight_source_valid CHECK(
  weight_source IS NULL OR weight_source IN ('construction_costs','confirmed_manual'));

ALTER TABLE public.construction_schedule_items
 ADD COLUMN IF NOT EXISTS source_service_code text,
 ADD COLUMN IF NOT EXISTS quantity numeric,
 ADD COLUMN IF NOT EXISTS unit text,
 ADD COLUMN IF NOT EXISTS unit_cost numeric,
 ADD COLUMN IF NOT EXISTS cost_source text,
 ADD COLUMN IF NOT EXISTS weight_source text;
ALTER TABLE public.construction_schedule_items
 DROP CONSTRAINT IF EXISTS construction_item_quantities_valid;
ALTER TABLE public.construction_schedule_items
 ADD CONSTRAINT construction_item_quantities_valid CHECK(
  (quantity IS NULL OR quantity>=0) AND (unit_cost IS NULL OR unit_cost>=0));

-- O administrador pode atualizar avanço real depois da aprovação, mas não
-- trocar escopo, datas, orçamento de obra ou pesos da linha de base sem revisão.
CREATE OR REPLACE FUNCTION public.guard_full_schedule_item()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $item$
DECLARE v_schedule public.construction_schedules%ROWTYPE;
DECLARE v_code text;
BEGIN
 SELECT * INTO v_schedule FROM public.construction_schedules
 WHERE id=coalesce(NEW.schedule_id,OLD.schedule_id);
 IF v_schedule.id IS NULL THEN RAISE EXCEPTION 'Cronograma inexistente'; END IF;
 IF v_schedule.activation_status='legacy' THEN RETURN coalesce(NEW,OLD); END IF;
 IF TG_OP='DELETE' THEN
  IF v_schedule.activation_status='approved' THEN RAISE EXCEPTION 'Etapa aprovada é imutável; registre revisão ou aditivo'; END IF;
  RETURN OLD;
 END IF;
 IF v_schedule.activation_status='approved' AND TG_OP='INSERT' THEN
  RAISE EXCEPTION 'Não é possível incluir etapa na linha de base aprovada';
 END IF;
 IF v_schedule.activation_status='approved' AND TG_OP='UPDATE' AND (
   NEW.schedule_id IS DISTINCT FROM OLD.schedule_id OR NEW.code IS DISTINCT FROM OLD.code OR
   NEW.category IS DISTINCT FROM OLD.category OR NEW.activity IS DISTINCT FROM OLD.activity OR
   NEW.display_order IS DISTINCT FROM OLD.display_order OR NEW.weight_percent IS DISTINCT FROM OLD.weight_percent OR
   NEW.planned_duration_days IS DISTINCT FROM OLD.planned_duration_days OR NEW.predecessor_code IS DISTINCT FROM OLD.predecessor_code OR
   NEW.planned_start IS DISTINCT FROM OLD.planned_start OR NEW.planned_finish IS DISTINCT FROM OLD.planned_finish OR
   NEW.planned_cost IS DISTINCT FROM OLD.planned_cost OR NEW.source_service_code IS DISTINCT FROM OLD.source_service_code OR
   NEW.quantity IS DISTINCT FROM OLD.quantity OR NEW.unit IS DISTINCT FROM OLD.unit OR
   NEW.unit_cost IS DISTINCT FROM OLD.unit_cost OR NEW.cost_source IS DISTINCT FROM OLD.cost_source OR
   NEW.weight_source IS DISTINCT FROM OLD.weight_source OR NEW.is_default IS DISTINCT FROM OLD.is_default
 ) THEN RAISE EXCEPTION 'Linha de base imutável; alteração de planejamento exige nova versão aprovada';
 END IF;
 v_code:=nullif(btrim(NEW.source_service_code),'');
 IF v_code IS NULL OR NOT EXISTS(
   SELECT 1 FROM jsonb_array_elements(coalesce(v_schedule.source_scope_snapshot->'services','[]'::jsonb)) s
   WHERE s->>'code'=v_code AND s->>'included'='true'
 ) THEN RAISE EXCEPTION 'Atividade sem serviço expresso no orçamento e contrato de origem'; END IF;
 IF NEW.planned_start IS NOT NULL AND NEW.planned_finish IS NOT NULL
    AND NEW.planned_finish<NEW.planned_start THEN
  RAISE EXCEPTION 'Término da atividade anterior ao início'; END IF;
 RETURN NEW;
END;
$item$;
DROP TRIGGER IF EXISTS full_schedule_item_guard ON public.construction_schedule_items;
CREATE TRIGGER full_schedule_item_guard BEFORE INSERT OR UPDATE OR DELETE
ON public.construction_schedule_items FOR EACH ROW
EXECUTE FUNCTION public.guard_full_schedule_item();

CREATE OR REPLACE FUNCTION public.guard_full_schedule_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $approve$
DECLARE v_count integer;v_sum numeric;v_missing integer;v_min date;v_max date;v_snapshot jsonb;
BEGIN
 IF TG_OP='INSERT' AND NEW.activation_status='approved' THEN
  RAISE EXCEPTION 'Novo cronograma deve começar como rascunho'; END IF;
 IF TG_OP='UPDATE' AND OLD.activation_status='approved' AND (
    NEW.project_id IS DISTINCT FROM OLD.project_id OR NEW.client_id IS DISTINCT FROM OLD.client_id OR
    NEW.contract_id IS DISTINCT FROM OLD.contract_id OR NEW.quote_record_id IS DISTINCT FROM OLD.quote_record_id OR
    NEW.contract_record_id IS DISTINCT FROM OLD.contract_record_id OR NEW.source_scope_snapshot IS DISTINCT FROM OLD.source_scope_snapshot OR
    NEW.work_calendar IS DISTINCT FROM OLD.work_calendar OR NEW.weight_source IS DISTINCT FROM OLD.weight_source OR
    NEW.planned_start IS DISTINCT FROM OLD.planned_start OR NEW.planned_finish IS DISTINCT FROM OLD.planned_finish OR
    NEW.baseline_snapshot IS DISTINCT FROM OLD.baseline_snapshot OR NEW.baseline_version IS DISTINCT FROM OLD.baseline_version
 ) THEN RAISE EXCEPTION 'Linha de base aprovada não pode ser modificada; gere nova versão'; END IF;
 IF NEW.activation_status IS DISTINCT FROM 'approved' THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.activation_status='approved' THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.activation_status='legacy' THEN
   RAISE EXCEPTION 'Não converter cronogramas legados sem revisão formal'; END IF;
 v_snapshot:=public.assert_full_schedule_commercial_link(NEW.project_id,NEW.quote_record_id,NEW.contract_record_id);
 IF NEW.source_scope_snapshot IS DISTINCT FROM v_snapshot THEN
   RAISE EXCEPTION 'Orçamento ou contrato mudou: gere nova linha de base a partir dos documentos aprovados'; END IF;
 IF NEW.work_calendar NOT IN ('weekdays','calendar_days') OR NEW.weight_source IS NULL THEN
   RAISE EXCEPTION 'Defina calendário e origem dos pesos antes de aprovar'; END IF;
 SELECT count(*),sum(weight_percent),min(planned_start),max(planned_finish),
 count(*) FILTER (WHERE planned_cost IS NULL OR source_service_code IS NULL OR
    planned_start IS NULL OR planned_finish IS NULL OR planned_duration_days<=0 OR
    planned_finish<planned_start OR weight_percent<0 OR weight_percent>100)
 INTO v_count,v_sum,v_min,v_max,v_missing
 FROM public.construction_schedule_items WHERE schedule_id=NEW.id;
 IF v_count=0 OR v_missing>0 OR abs(coalesce(v_sum,0)-100)>0.01 THEN
  RAISE EXCEPTION 'Cronograma incompleto: conferir atividades, custos de obra, datas e pesos totalizando 100%%'; END IF;
 IF NEW.planned_start IS DISTINCT FROM v_min OR NEW.planned_finish IS DISTINCT FROM v_max THEN
  RAISE EXCEPTION 'Datas do cabeçalho não coincidem com as atividades calculadas'; END IF;
 IF EXISTS(
  SELECT 1 FROM public.construction_schedule_items current_item
  LEFT JOIN public.construction_schedule_items predecessor
    ON predecessor.schedule_id=current_item.schedule_id AND predecessor.code=current_item.predecessor_code
  WHERE current_item.schedule_id=NEW.id AND current_item.predecessor_code IS NOT NULL
   AND (predecessor.id IS NULL OR predecessor.planned_finish>=current_item.planned_start)
 ) THEN RAISE EXCEPTION 'Predecessoras ausentes ou conflito de datas'; END IF;
 IF NEW.planned_finish>(SELECT data_fim FROM public.projetos WHERE id=NEW.project_id)
    AND (SELECT data_fim FROM public.projetos WHERE id=NEW.project_id) IS NOT NULL THEN
   RAISE EXCEPTION 'Término excede a data vinculada ao projeto; revisar prazo com o contrato'; END IF;
 NEW.baseline_version:=coalesce(OLD.baseline_version,0)+1;
 NEW.approved_at:=now();NEW.approved_by:=auth.uid();
 NEW.baseline_snapshot:=jsonb_build_object('scope',NEW.source_scope_snapshot,
  'calendar',NEW.work_calendar,'weight_source',NEW.weight_source,
  'planned_start',NEW.planned_start,'planned_finish',NEW.planned_finish,
  'activities',(SELECT jsonb_agg(to_jsonb(i) ORDER BY i.display_order)
    FROM public.construction_schedule_items i WHERE i.schedule_id=NEW.id));
 RETURN NEW;
END;
$approve$;
DROP TRIGGER IF EXISTS full_schedule_approval_guard ON public.construction_schedules;
CREATE TRIGGER full_schedule_approval_guard BEFORE INSERT OR UPDATE OF
 activation_status, project_id, client_id, contract_id, quote_record_id, contract_record_id,
 source_scope_snapshot, work_calendar, weight_source, planned_start, planned_finish,
 baseline_snapshot, baseline_version
ON public.construction_schedules FOR EACH ROW
EXECUTE FUNCTION public.guard_full_schedule_approval();

-- A revisão de dados reais pode ser executada sem quebrar cronogramas antigos;
-- somente novas aprovações recebem linha de base versionada.
REVOKE ALL ON FUNCTION public.guard_full_schedule_item() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.guard_full_schedule_approval() FROM PUBLIC,anon,authenticated;
