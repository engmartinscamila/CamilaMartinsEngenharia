-- Orçamento executivo / quantitativos do cronograma.
-- Reforça que custo financeiro decorre da execução da obra, nunca de honorários.
-- Quando quantidade/preço unitário forem informados, a composição precisa ser completa e coerente.

CREATE OR REPLACE FUNCTION public.guard_full_schedule_item()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $item$
DECLARE v_schedule public.construction_schedules%ROWTYPE;
DECLARE v_code text;
DECLARE v_composed_cost numeric;
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

 IF NEW.planned_cost IS NULL OR NEW.planned_cost < 0 THEN
   RAISE EXCEPTION 'Custo da execução deve ser informado e não negativo';
 END IF;
 IF nullif(btrim(coalesce(NEW.cost_source,'')),'') IS NULL THEN
   RAISE EXCEPTION 'Fonte do custo da execução é obrigatória';
 END IF;

 -- Composição unitária é opcional, mas jamais parcial.
 IF NEW.quantity IS NOT NULL OR NEW.unit_cost IS NOT NULL OR nullif(btrim(coalesce(NEW.unit,'')),'') IS NOT NULL THEN
   IF NEW.quantity IS NULL OR NEW.quantity <= 0 OR
      NEW.unit_cost IS NULL OR NEW.unit_cost < 0 OR
      nullif(btrim(coalesce(NEW.unit,'')),'') IS NULL THEN
     RAISE EXCEPTION 'Quantitativo incompleto: informe unidade, quantidade positiva e preço unitário';
   END IF;
   v_composed_cost := round(NEW.quantity * NEW.unit_cost, 2);
   IF abs(round(NEW.planned_cost,2) - v_composed_cost) > 0.01 THEN
     RAISE EXCEPTION 'Custo total da atividade deve corresponder a quantidade × preço unitário';
   END IF;
 END IF;
 RETURN NEW;
END;
$item$;

DROP TRIGGER IF EXISTS full_schedule_item_guard ON public.construction_schedule_items;
CREATE TRIGGER full_schedule_item_guard BEFORE INSERT OR UPDATE OR DELETE
ON public.construction_schedule_items FOR EACH ROW
EXECUTE FUNCTION public.guard_full_schedule_item();

-- Valida a composição ainda no JSON antes de substituir os itens do rascunho.
CREATE OR REPLACE FUNCTION public.assert_full_schedule_quantities(p_items jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $quant$
DECLARE v_item jsonb; v_quantity numeric; v_unit_cost numeric; v_planned numeric;
BEGIN
 IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
   RAISE EXCEPTION 'Lista de atividades inválida';
 END IF;
 FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
   IF nullif(btrim(coalesce(v_item->>'cost_source','')),'') IS NULL THEN
     RAISE EXCEPTION 'Atividade % sem fonte auditável do custo',coalesce(v_item->>'code','sem código');
   END IF;
   IF v_item->>'planned_cost' IS NULL OR (v_item->>'planned_cost')::numeric < 0 THEN
     RAISE EXCEPTION 'Atividade % sem custo de execução válido',coalesce(v_item->>'code','sem código');
   END IF;

   IF v_item ? 'quantity' OR v_item ? 'unit_cost' OR v_item ? 'unit' THEN
     IF nullif(v_item->>'quantity','') IS NULL OR nullif(v_item->>'unit_cost','') IS NULL OR
        nullif(btrim(coalesce(v_item->>'unit','')),'') IS NULL THEN
       RAISE EXCEPTION 'Quantitativo incompleto na atividade %',coalesce(v_item->>'code','sem código');
     END IF;
     v_quantity := (v_item->>'quantity')::numeric;
     v_unit_cost := (v_item->>'unit_cost')::numeric;
     v_planned := (v_item->>'planned_cost')::numeric;
     IF v_quantity <= 0 OR v_unit_cost < 0 THEN
       RAISE EXCEPTION 'Quantidade/preço unitário inválidos na atividade %',coalesce(v_item->>'code','sem código');
     END IF;
     IF abs(round(v_planned,2)-round(v_quantity*v_unit_cost,2)) > 0.01 THEN
       RAISE EXCEPTION 'Custo composto inconsistente na atividade %',coalesce(v_item->>'code','sem código');
     END IF;
   END IF;
 END LOOP;
 RETURN true;
END;
$quant$;

-- Envolve a versão atual do salvamento para incluir validação de composição.
-- O corpo principal continua na migration anterior; a chamada desta função será
-- incorporada ao RPC canônico numa migration posterior se outros campos surgirem.
REVOKE ALL ON FUNCTION public.assert_full_schedule_quantities(jsonb) FROM PUBLIC,anon,authenticated;
