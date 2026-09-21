-- Preserve histórico: impede apenas atribuir número de contrato a proposta vinculada
-- a uma versão distinta da ativa. Não migra orçamentos aceitos automaticamente.
CREATE OR REPLACE FUNCTION public.admin_assign_commercial_contract_number(p_record_id uuid)
RETURNS text LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_number text; v_master integer; v_record_master integer;
BEGIN
  IF NOT public.is_portal_admin() THEN RAISE EXCEPTION 'Acesso administrativo necessário'; END IF;
  SELECT contract_number,contract_master_version INTO v_number,v_record_master
    FROM public.commercial_records WHERE id=p_record_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registro comercial não encontrado'; END IF;
  SELECT version INTO v_master FROM public.contract_master_versions WHERE active=true ORDER BY version DESC LIMIT 1;
  IF v_record_master IS DISTINCT FROM v_master THEN
    RAISE EXCEPTION 'O orçamento está vinculado ao Contrato Mestre v% e a versão ativa é v%. Revise o escopo e emita um novo orçamento vinculado à versão vigente antes de gerar o contrato. O documento histórico não foi alterado.',coalesce(v_record_master,0),coalesce(v_master,0);
  END IF;
  IF v_number IS NULL OR btrim(v_number)='' THEN
    v_number:=public.admin_next_commercial_number('CON');
    UPDATE public.commercial_records SET contract_number=v_number,updated_at=now() WHERE id=p_record_id;
  END IF;
  RETURN v_number;
END;
$function$;
