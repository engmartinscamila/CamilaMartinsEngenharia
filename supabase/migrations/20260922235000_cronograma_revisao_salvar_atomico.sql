-- Criação de revisão + novo planejamento em UMA transação.
-- Se qualquer custo, data, feriado, peso ou vínculo falhar, o rascunho de revisão também é revertido.
CREATE OR REPLACE FUNCTION public.admin_begin_and_save_full_schedule_revision(
  p_previous_schedule_id uuid,
  p_quote_record_id uuid,
  p_contract_record_id uuid,
  p_reason text,
  p_plan jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $atomic_revision$
DECLARE v_schedule_id uuid;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT public.is_portal_admin() THEN
    RAISE EXCEPTION 'Acesso administrativo necessário';
  END IF;

  v_schedule_id := public.admin_begin_full_schedule_revision(
    p_previous_schedule_id,
    p_quote_record_id,
    p_contract_record_id,
    p_reason
  );

  PERFORM public.admin_save_full_schedule_plan(v_schedule_id, p_plan);
  PERFORM public.admin_set_construction_schedule_holidays(
    v_schedule_id, coalesce(p_plan->'holidays', '[]'::jsonb)
  );
  PERFORM public.admin_set_full_schedule_physical_weights(
    v_schedule_id, coalesce(p_plan->'physical_weights', '[]'::jsonb)
  );

  RETURN v_schedule_id;
END;
$atomic_revision$;

REVOKE ALL ON FUNCTION public.admin_begin_and_save_full_schedule_revision(uuid,uuid,uuid,text,jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_begin_and_save_full_schedule_revision(uuid,uuid,uuid,text,jsonb)
  TO authenticated;
