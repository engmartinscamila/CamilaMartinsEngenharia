-- Nova emissão de contrato usa sempre o Contrato Mestre ativo e os textos vigentes
-- (aplicada em produção em 09/11/2026; registrada aqui para o repositório).
CREATE OR REPLACE FUNCTION public.admin_assign_commercial_contract_number(p_record_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_number text; v_master integer; v_master_id uuid; v_record_master integer; v_kind text;
BEGIN
  IF NOT public.is_portal_admin() THEN RAISE EXCEPTION 'Acesso administrativo necessário'; END IF;
  SELECT contract_number,contract_master_version,record_kind INTO v_number,v_record_master,v_kind
    FROM public.commercial_records WHERE id=p_record_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registro comercial não encontrado'; END IF;
  SELECT id,version INTO v_master_id,v_master FROM public.contract_master_versions WHERE active=true ORDER BY version DESC LIMIT 1;
  IF v_record_master IS DISTINCT FROM v_master THEN
    IF v_kind='contrato' THEN
      -- Documentos já emitidos permanecem congelados na versão de sua emissão (cláusula 21.7).
      UPDATE public.commercial_records
         SET contract_master_id=v_master_id, contract_master_version=v_master,
             smart_texts=public.current_document_text_snapshot_all(), updated_at=now()
       WHERE id=p_record_id;
      INSERT INTO public.audit_log(user_id,action,entity_type,entity_id,details)
      VALUES(auth.uid(),'align_contract_to_active_master','commercial_records',p_record_id,
             jsonb_build_object('from_version',v_record_master,'to_version',v_master));
    ELSE
      RAISE EXCEPTION 'O orçamento está vinculado ao Contrato Mestre v% e a versão ativa é v%. Revise o escopo e emita um novo orçamento vinculado à versão vigente antes de gerar o contrato. O documento histórico não foi alterado.',coalesce(v_record_master,0),coalesce(v_master,0);
    END IF;
  END IF;
  IF v_number IS NULL OR btrim(v_number)='' THEN
    v_number:=public.admin_next_commercial_number('CON');
    UPDATE public.commercial_records SET contract_number=v_number,updated_at=now() WHERE id=p_record_id;
  END IF;
  RETURN v_number;
END;
$function$;
