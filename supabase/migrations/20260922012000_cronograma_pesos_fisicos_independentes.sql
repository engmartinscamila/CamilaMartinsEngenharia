-- O peso FÍSICO não deriva automaticamente do preço da obra nem dos honorários.
-- A administradora deve conferir e justificar cada critério físico.
ALTER TABLE public.construction_schedule_items
 ADD COLUMN IF NOT EXISTS physical_weight_percent numeric,
 ADD COLUMN IF NOT EXISTS physical_weight_basis text;
ALTER TABLE public.construction_schedule_items
 DROP CONSTRAINT IF EXISTS construction_item_physical_weight_range;
ALTER TABLE public.construction_schedule_items
 ADD CONSTRAINT construction_item_physical_weight_range CHECK (
 physical_weight_percent IS NULL OR physical_weight_percent BETWEEN 0 AND 100);

CREATE OR REPLACE FUNCTION public.guard_construction_physical_weight_change()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $guard$
DECLARE v_state text;
BEGIN
 IF NEW.physical_weight_percent IS NOT DISTINCT FROM OLD.physical_weight_percent
    AND NEW.physical_weight_basis IS NOT DISTINCT FROM OLD.physical_weight_basis THEN
    RETURN NEW;
 END IF;
 SELECT activation_status INTO v_state FROM public.construction_schedules WHERE id=OLD.schedule_id;
 IF v_state='approved' THEN
  RAISE EXCEPTION 'Peso físico aprovado exige aditivo e nova linha de base';
 END IF;
 RETURN NEW;
END;
$guard$;
DROP TRIGGER IF EXISTS construction_physical_weight_change_guard ON public.construction_schedule_items;
CREATE TRIGGER construction_physical_weight_change_guard BEFORE UPDATE OF physical_weight_percent,physical_weight_basis
 ON public.construction_schedule_items FOR EACH ROW EXECUTE FUNCTION public.guard_construction_physical_weight_change();

CREATE OR REPLACE FUNCTION public.admin_set_full_schedule_physical_weights(p_schedule_id uuid,p_weights jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $save$
DECLARE v_header public.construction_schedules%ROWTYPE;
DECLARE v_count integer;v_input integer;v_distinct integer;v_sum numeric;
DECLARE v_entry jsonb;v_code text;v_basis text;v_weight numeric;v_affected integer;
BEGIN
 IF (SELECT auth.uid()) IS NULL OR NOT public.is_portal_admin() THEN
  RAISE EXCEPTION 'Acesso administrativo necessário'; END IF;
 SELECT * INTO v_header FROM public.construction_schedules WHERE id=p_schedule_id FOR UPDATE;
 IF v_header.id IS NULL OR v_header.activation_status IS DISTINCT FROM 'draft' THEN
  RAISE EXCEPTION 'Pesos físicos só podem ser conferidos em rascunho'; END IF;
 IF jsonb_typeof(p_weights) IS DISTINCT FROM 'array' OR jsonb_array_length(p_weights)>200 THEN
  RAISE EXCEPTION 'Informe no máximo 200 critérios físicos'; END IF;
 SELECT count(*) INTO v_count FROM public.construction_schedule_items WHERE schedule_id=p_schedule_id;
 IF jsonb_array_length(p_weights)=0 THEN
  UPDATE public.construction_schedule_items SET physical_weight_percent=NULL,physical_weight_basis=NULL
  WHERE schedule_id=p_schedule_id;
  RETURN 0;
 END IF;
 SELECT count(*),count(DISTINCT entry->>'code'),sum((entry->>'percent')::numeric)
 INTO v_input,v_distinct,v_sum FROM jsonb_array_elements(p_weights) entry;
 IF v_input IS DISTINCT FROM v_count OR v_distinct IS DISTINCT FROM v_count
    OR abs(coalesce(v_sum,0)-100)>0.01 THEN
  RAISE EXCEPTION 'Pesos físicos devem cobrir todas as atividades e somar 100%%';
 END IF;
 FOR v_entry IN SELECT value FROM jsonb_array_elements(p_weights) LOOP
  v_code:=nullif(btrim(v_entry->>'code'),'');
  v_basis:=nullif(btrim(v_entry->>'basis'),'');
  v_weight:=(v_entry->>'percent')::numeric;
  IF v_code IS NULL OR v_weight IS NULL OR v_weight NOT BETWEEN 0 AND 100
     OR v_basis IS NULL OR length(v_basis)<10 THEN
    RAISE EXCEPTION 'Peso físico exige código, percentual e critério conferido (mínimo de 10 caracteres)';
  END IF;
  UPDATE public.construction_schedule_items SET physical_weight_percent=v_weight,physical_weight_basis=v_basis
  WHERE schedule_id=p_schedule_id AND code=v_code;
  GET DIAGNOSTICS v_affected=ROW_COUNT;
  IF v_affected<>1 THEN RAISE EXCEPTION 'Código físico não corresponde à atividade do plano'; END IF;
 END LOOP;
 RETURN v_count;
END;
$save$;
REVOKE ALL ON FUNCTION public.admin_set_full_schedule_physical_weights(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_full_schedule_physical_weights(uuid,jsonb) TO authenticated;

-- O plano, feriados e pesos físicos são gravados numa ÚNICA transação SQL.
CREATE OR REPLACE FUNCTION public.admin_initialize_and_save_full_schedule(
 p_project_id uuid,p_quote_record_id uuid,p_contract_record_id uuid,p_plan jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $atomic$
DECLARE v_schedule_id uuid;
BEGIN
 IF (SELECT auth.uid()) IS NULL OR NOT public.is_portal_admin() THEN
  RAISE EXCEPTION 'Acesso administrativo necessário'; END IF;
 v_schedule_id:=public.admin_initialize_construction_schedule(p_project_id,p_quote_record_id,p_contract_record_id);
 PERFORM public.admin_save_full_schedule_plan(v_schedule_id,p_plan);
 PERFORM public.admin_set_construction_schedule_holidays(v_schedule_id,coalesce(p_plan->'holidays','[]'::jsonb));
 PERFORM public.admin_set_full_schedule_physical_weights(v_schedule_id,coalesce(p_plan->'physical_weights','[]'::jsonb));
 RETURN v_schedule_id;
END;
$atomic$;
REVOKE ALL ON FUNCTION public.admin_initialize_and_save_full_schedule(uuid,uuid,uuid,jsonb)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_initialize_and_save_full_schedule(uuid,uuid,uuid,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.validate_construction_physical_weights_at_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $validate$
DECLARE v_total integer;v_reported integer;v_sum numeric;v_unjustified integer;
BEGIN
 IF NEW.activation_status IS DISTINCT FROM 'approved' OR OLD.activation_status='approved' THEN RETURN NEW; END IF;
 SELECT count(*),count(physical_weight_percent),sum(physical_weight_percent),
 count(*) FILTER(WHERE physical_weight_percent IS NOT NULL AND (physical_weight_basis IS NULL OR length(btrim(physical_weight_basis))<10))
 INTO v_total,v_reported,v_sum,v_unjustified
 FROM public.construction_schedule_items WHERE schedule_id=NEW.id;
 -- Todos em branco = informação física ainda desconhecida, nunca igualar ao peso financeiro.
 IF v_reported>0 AND (v_reported<>v_total OR abs(coalesce(v_sum,0)-100)>0.01 OR v_unjustified>0) THEN
  RAISE EXCEPTION 'Peso físico parcial, sem fundamento ou diferente de 100%% impede aprovação';
 END IF;
 RETURN NEW;
END;
$validate$;
DROP TRIGGER IF EXISTS zz_construction_physical_weight_approval ON public.construction_schedules;
CREATE TRIGGER zz_construction_physical_weight_approval BEFORE UPDATE OF activation_status
 ON public.construction_schedules FOR EACH ROW
 EXECUTE FUNCTION public.validate_construction_physical_weights_at_approval();
REVOKE ALL ON FUNCTION public.guard_construction_physical_weight_change() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.validate_construction_physical_weights_at_approval() FROM PUBLIC,anon,authenticated;
