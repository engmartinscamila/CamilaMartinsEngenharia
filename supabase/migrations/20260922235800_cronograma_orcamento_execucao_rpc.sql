-- Orçamento de execução por atividade, independente de honorários.
-- Somente rascunhos podem ser alterados. A lista deve cobrir exatamente as atividades existentes.

CREATE OR REPLACE FUNCTION public.admin_set_full_schedule_execution_budget(
  p_schedule_id uuid,
  p_items jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $budget$
DECLARE
  v_schedule public.construction_schedules%ROWTYPE;
  v_item jsonb;
  v_count integer;
  v_existing integer;
  v_unique integer;
  v_total numeric := 0;
  v_last_code text;
  v_running numeric := 0;
  v_cost numeric;
  v_quantity numeric;
  v_unit_cost numeric;
  v_has_composition boolean;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT public.is_portal_admin() THEN
    RAISE EXCEPTION 'Acesso administrativo necessário';
  END IF;

  SELECT * INTO v_schedule
    FROM public.construction_schedules
   WHERE id = p_schedule_id
   FOR UPDATE;
  IF v_schedule.id IS NULL OR v_schedule.activation_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'Orçamento executivo só pode alterar cronograma em rascunho';
  END IF;

  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Informe os itens do orçamento de execução';
  END IF;

  SELECT count(*), count(DISTINCT value->>'code')
    INTO v_count, v_unique
    FROM jsonb_array_elements(p_items);
  SELECT count(*) INTO v_existing
    FROM public.construction_schedule_items
   WHERE schedule_id = p_schedule_id;

  IF v_count IS DISTINCT FROM v_unique OR v_count IS DISTINCT FROM v_existing THEN
    RAISE EXCEPTION 'O orçamento deve conter exatamente uma linha para cada atividade do cronograma';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(p_items) entry
     WHERE NOT EXISTS (
       SELECT 1 FROM public.construction_schedule_items i
        WHERE i.schedule_id = p_schedule_id AND i.code = entry.value->>'code'
     )
  ) THEN
    RAISE EXCEPTION 'O orçamento contém código de atividade inexistente';
  END IF;

  -- Primeira passagem: valida e soma custos.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF nullif(btrim(coalesce(v_item->>'cost_source','')),'') IS NULL THEN
      RAISE EXCEPTION 'Informe a fonte do custo da atividade %',coalesce(v_item->>'code','sem código');
    END IF;

    v_has_composition := nullif(v_item->>'quantity','') IS NOT NULL
      OR nullif(v_item->>'unit_cost','') IS NOT NULL
      OR nullif(btrim(coalesce(v_item->>'unit','')),'') IS NOT NULL;

    IF v_has_composition THEN
      IF nullif(v_item->>'quantity','') IS NULL OR nullif(v_item->>'unit_cost','') IS NULL OR
         nullif(btrim(coalesce(v_item->>'unit','')),'') IS NULL THEN
        RAISE EXCEPTION 'Composição incompleta na atividade %',coalesce(v_item->>'code','sem código');
      END IF;
      v_quantity := (v_item->>'quantity')::numeric;
      v_unit_cost := (v_item->>'unit_cost')::numeric;
      IF v_quantity <= 0 OR v_unit_cost < 0 THEN
        RAISE EXCEPTION 'Quantidade/preço unitário inválidos na atividade %',coalesce(v_item->>'code','sem código');
      END IF;
      v_cost := round(v_quantity * v_unit_cost, 2);
    ELSE
      IF nullif(v_item->>'planned_cost','') IS NULL THEN
        RAISE EXCEPTION 'Informe custo total ou composição unitária na atividade %',coalesce(v_item->>'code','sem código');
      END IF;
      v_cost := round((v_item->>'planned_cost')::numeric, 2);
      IF v_cost < 0 THEN
        RAISE EXCEPTION 'Custo inválido na atividade %',coalesce(v_item->>'code','sem código');
      END IF;
    END IF;
    v_total := v_total + v_cost;
  END LOOP;

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Custo total da execução deve ser positivo';
  END IF;

  SELECT i.code INTO v_last_code
    FROM public.construction_schedule_items i
   WHERE i.schedule_id = p_schedule_id
   ORDER BY i.display_order DESC, i.code DESC
   LIMIT 1;

  -- Segunda passagem: grava composição e deriva o peso financeiro do custo.
  FOR v_item IN
    SELECT entry.value
      FROM jsonb_array_elements(p_items) entry
      JOIN public.construction_schedule_items i
        ON i.schedule_id = p_schedule_id AND i.code = entry.value->>'code'
     ORDER BY i.display_order, i.code
  LOOP
    v_has_composition := nullif(v_item->>'quantity','') IS NOT NULL
      OR nullif(v_item->>'unit_cost','') IS NOT NULL
      OR nullif(btrim(coalesce(v_item->>'unit','')),'') IS NOT NULL;
    IF v_has_composition THEN
      v_quantity := (v_item->>'quantity')::numeric;
      v_unit_cost := (v_item->>'unit_cost')::numeric;
      v_cost := round(v_quantity * v_unit_cost, 2);
    ELSE
      v_quantity := NULL;
      v_unit_cost := NULL;
      v_cost := round((v_item->>'planned_cost')::numeric, 2);
    END IF;

    UPDATE public.construction_schedule_items
       SET quantity = v_quantity,
           unit = CASE WHEN v_has_composition THEN nullif(btrim(v_item->>'unit'),'') ELSE NULL END,
           unit_cost = v_unit_cost,
           planned_cost = v_cost,
           cost_source = btrim(v_item->>'cost_source'),
           weight_source = 'construction_costs',
           weight_percent = CASE
             WHEN v_item->>'code' = v_last_code THEN round(100 - v_running, 2)
             ELSE round(v_cost * 100 / v_total, 2)
           END,
           updated_at = now()
     WHERE schedule_id = p_schedule_id
       AND code = v_item->>'code';

    IF v_item->>'code' <> v_last_code THEN
      v_running := v_running + round(v_cost * 100 / v_total, 2);
    END IF;
  END LOOP;

  UPDATE public.construction_schedules
     SET weight_source = 'construction_costs', updated_at = now()
   WHERE id = p_schedule_id;

  INSERT INTO public.audit_log(user_id, action, entity_type, entity_id, details)
  VALUES (
    (SELECT auth.uid()),
    'set_construction_schedule_execution_budget',
    'construction_schedules',
    p_schedule_id,
    jsonb_build_object('item_count',v_count,'total_construction_cost',round(v_total,2))
  );

  RETURN jsonb_build_object(
    'schedule_id', p_schedule_id,
    'item_count', v_count,
    'total_construction_cost', round(v_total,2),
    'weight_source','construction_costs'
  );
END;
$budget$;

REVOKE ALL ON FUNCTION public.admin_set_full_schedule_execution_budget(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_full_schedule_execution_budget(uuid,jsonb) TO authenticated;
