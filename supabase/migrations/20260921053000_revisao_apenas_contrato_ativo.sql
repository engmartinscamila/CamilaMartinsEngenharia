-- Corrige confirmação administrativa: uma revisão antiga NÃO pode rebaixar o
-- marcador de versão do catálogo. Preserva registros antigos para auditoria,
-- histórico e documentos congelados. Não aprova nenhuma revisão.
CREATE OR REPLACE FUNCTION public.admin_confirm_document_rule_review(p_review_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_review public.document_rule_reviews%rowtype;
  v_active_version integer;
  v_updated integer;
BEGIN
  IF NOT public.is_portal_admin() THEN
    RAISE EXCEPTION 'Acesso administrativo necessario';
  END IF;

  -- Bloqueia a versão ativa contra troca concorrente até o fim da confirmação.
  SELECT version INTO v_active_version
  FROM public.contract_master_versions
  WHERE active=true ORDER BY version DESC LIMIT 1 FOR SHARE;
  IF v_active_version IS NULL THEN
    RAISE EXCEPTION 'Contrato Mestre ativo não encontrado';
  END IF;

  SELECT * INTO v_review
  FROM public.document_rule_reviews
  WHERE id=p_review_id AND status='pending'
  FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  IF v_review.contract_master_version IS DISTINCT FROM v_active_version THEN
    RAISE EXCEPTION 'Revisão histórica v% não pode ser confirmada enquanto o Contrato Mestre ativo é v%. Consulte somente as pendências atuais.',
      v_review.contract_master_version,v_active_version;
  END IF;

  UPDATE public.document_rule_reviews
  SET status='resolved',resolved_at=now(),resolved_by=auth.uid()
  WHERE id=v_review.id AND status='pending';
  GET DIAGNOSTICS v_updated=ROW_COUNT;
  IF v_updated<>1 THEN RETURN false; END IF;

  IF v_review.source_type='service' THEN
    UPDATE public.service_catalog
    SET last_contract_master_version=v_active_version
    WHERE code=v_review.source_code AND active=true;
  ELSIF v_review.source_type='level' THEN
    UPDATE public.service_level_catalog
    SET last_contract_master_version=v_active_version
    WHERE code=v_review.source_code AND active=true;
  ELSIF v_review.source_type='text' THEN
    UPDATE public.document_text_catalog
    SET last_contract_master_version=v_active_version
    WHERE code=v_review.source_code AND active=true;
  ELSE
    v_updated:=1; -- revisão da cláusula contratual, sem marcador de catálogo
  END IF;

  -- Não confirmar revisão cujo item tenha sido excluído, evitando falso positivo.
  IF v_review.source_type IN ('service','level','text') THEN
    GET DIAGNOSTICS v_updated=ROW_COUNT;
    IF v_updated<>1 THEN
      RAISE EXCEPTION 'Item de revisão %:% não encontrado ou inativo; nenhuma aprovação foi registrada.',
        v_review.source_type,v_review.source_code;
    END IF;
  END IF;

  INSERT INTO public.audit_log(user_id,action,entity_type,entity_id,details)
  VALUES(auth.uid(),'confirm_document_rule_review','document_rule_reviews',v_review.id,
    jsonb_build_object('contract_master_version',v_active_version,
      'source_type',v_review.source_type,'source_code',v_review.source_code,
      'confirmed_without_change',true,'active_version_checked',true));
  RETURN true;
END;
$function$;
COMMENT ON FUNCTION public.admin_confirm_document_rule_review(uuid) IS
'Permite confirmação auditável apenas de revisões da versão ativa do Contrato Mestre e preserva pendências históricas.';
