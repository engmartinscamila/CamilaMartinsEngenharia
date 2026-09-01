BEGIN;

CREATE OR REPLACE FUNCTION public.admin_prepare_contract_document(
  p_project_id uuid,
  p_document_kind text,
  p_approval_id uuid DEFAULT NULL,
  p_extra_data jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_project record;
  v_approval record;
  v_document_id uuid;
  v_title text;
  v_optional boolean := true;
  v_scope_ok boolean := true;
  v_data jsonb;
BEGIN
  IF NOT public.is_portal_admin() THEN RAISE EXCEPTION 'Acesso administrativo necessário'; END IF;
  IF p_document_kind NOT IN (
    'anexo_i','termo_aceite','estudo_preliminar','levantamento_tecnico',
    'servico_adicional','autorizacao_imagem','quitacao_encerramento'
  ) THEN RAISE EXCEPTION 'Tipo de documento não suportado'; END IF;

  SELECT p.id, p.cliente_id, p.contract_id, p.nome AS project_name, p.tipo AS project_type,
         p.area_construida_m2, p.area_terreno_m2, p.endereco_obra, p.numero_obra,
         p.complemento_obra, p.bairro_obra, p.cidade_obra, p.estado_obra,
         c.contract_number, c.signed_at, c.contract_value, c.currency,
         cl.nome AS client_name
    INTO v_project
  FROM public.projetos p
  JOIN public.contratos c ON c.id = p.contract_id
  LEFT JOIN public.clientes cl ON cl.id = p.cliente_id
  WHERE p.id = p_project_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto/contrato não encontrado'; END IF;

  IF p_document_kind = 'estudo_preliminar' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.contract_scope_items s
      WHERE s.contract_id = v_project.contract_id AND s.service_code = 'a' AND s.included = true
    ) INTO v_scope_ok;
    IF NOT v_scope_ok THEN RAISE EXCEPTION 'Estudo Preliminar não consta como contratado no Anexo I'; END IF;
  END IF;

  IF p_document_kind = 'termo_aceite' THEN
    IF p_approval_id IS NULL THEN RAISE EXCEPTION 'Selecione uma aprovação para gerar o Termo de Aceite'; END IF;
    SELECT * INTO v_approval FROM public.aprovacoes WHERE id = p_approval_id AND projeto_id = p_project_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Aprovação não encontrada para este projeto'; END IF;
  END IF;

  v_title := CASE p_document_kind
    WHEN 'anexo_i' THEN 'Anexo I — Escopo de Serviços, Proposta Comercial e Cronograma'
    WHEN 'termo_aceite' THEN 'Termo de Aceite de Etapa — ' || COALESCE(v_approval.titulo, 'Etapa')
    WHEN 'estudo_preliminar' THEN 'Estudo Preliminar'
    WHEN 'levantamento_tecnico' THEN 'Ficha de Levantamento Técnico / Vistoria'
    WHEN 'servico_adicional' THEN 'Termo de Aprovação de Orçamento — Serviço Adicional'
    WHEN 'autorizacao_imagem' THEN 'Autorização de Uso de Imagem e Divulgação do Projeto'
    WHEN 'quitacao_encerramento' THEN 'Termo de Quitação e Encerramento de Contrato'
  END;

  v_optional := p_document_kind NOT IN ('anexo_i','termo_aceite');
  v_data := jsonb_build_object(
    'contract_number', v_project.contract_number,
    'contract_signed_at', v_project.signed_at,
    'contract_value', v_project.contract_value,
    'currency', v_project.currency,
    'client_name', v_project.client_name,
    'project_name', v_project.project_name,
    'project_type', v_project.project_type,
    'area_construida_m2', v_project.area_construida_m2,
    'area_terreno_m2', v_project.area_terreno_m2,
    'property_address', concat_ws(', ', nullif(v_project.endereco_obra,''), nullif(v_project.numero_obra,''), nullif(v_project.complemento_obra,''), nullif(v_project.bairro_obra,''), nullif(v_project.cidade_obra,''), nullif(v_project.estado_obra,''))
  ) || COALESCE(p_extra_data, '{}'::jsonb);

  IF p_document_kind = 'termo_aceite' THEN
    v_data := v_data || jsonb_build_object(
      'approval_id', v_approval.id,
      'approval_type', v_approval.tipo,
      'approval_title', v_approval.titulo,
      'approval_description', v_approval.descricao,
      'delivered_at', v_approval.delivered_at,
      'approval_due_at', v_approval.approval_due_at,
      'approval_status', v_approval.status
    );
  END IF;

  IF p_document_kind = 'anexo_i' THEN
    v_data := v_data || jsonb_build_object(
      'scope_items', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'code', s.service_code, 'name', s.service_name, 'included', s.included,
        'acceptance_required', s.acceptance_required, 'notes', s.notes
      ) ORDER BY s.display_order) FROM public.contract_scope_items s WHERE s.contract_id = v_project.contract_id), '[]'::jsonb)
    );
  END IF;

  INSERT INTO public.documentos (
    cliente_id, projeto_id, contract_id, approval_id, nome, tipo, categoria, versao,
    storage_bucket, permitir_download, protection_mode, document_kind, workflow_status,
    generated_data, optional_document
  ) VALUES (
    v_project.cliente_id, v_project.id, v_project.contract_id, p_approval_id, v_title,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Contratual', '1.0',
    'documentos', true, 'administrative', p_document_kind, 'rascunho', v_data, v_optional
  ) RETURNING id INTO v_document_id;

  INSERT INTO public.audit_log(user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'prepare_contract_document', 'documentos', v_document_id,
          jsonb_build_object('document_kind', p_document_kind, 'project_id', p_project_id));
  RETURN v_document_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_prepare_contract_document(uuid,text,uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_prepare_contract_document(uuid,text,uuid,jsonb) TO authenticated;

CREATE INDEX IF NOT EXISTS documentos_project_kind_status_idx
  ON public.documentos(projeto_id, document_kind, workflow_status, created_at DESC)
  WHERE document_kind IS NOT NULL;

COMMIT;
