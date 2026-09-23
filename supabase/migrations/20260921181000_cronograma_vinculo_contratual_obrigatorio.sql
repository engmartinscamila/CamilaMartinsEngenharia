-- Etapa 2/7: vínculo explícito entre obra, orçamento ORC e contrato CON.
-- Os cronogramas já existentes são preservados como 'legacy', sem alterar suas etapas.
ALTER TABLE public.construction_schedules
  ADD COLUMN IF NOT EXISTS quote_record_id uuid REFERENCES public.commercial_records(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS contract_record_id uuid REFERENCES public.commercial_records(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS source_scope_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS activation_status text NOT NULL DEFAULT 'legacy';

ALTER TABLE public.construction_schedules
  DROP CONSTRAINT IF EXISTS construction_schedule_activation_valid;
ALTER TABLE public.construction_schedules
  ADD CONSTRAINT construction_schedule_activation_valid CHECK (
    activation_status IN ('legacy','draft','approved') AND
    (activation_status='legacy' OR (quote_record_id IS NOT NULL AND contract_record_id IS NOT NULL))
  );

CREATE INDEX IF NOT EXISTS construction_schedules_commercial_pair_idx
  ON public.construction_schedules(contract_record_id, quote_record_id);

-- Verificador de negócios: não é suficiente vincular pelo número exibido no projeto.
-- Um novo cronograma requer origem comercial formalizada, com serviço próprio,
-- escopo, pacote e preços verificáveis. Nenhum acesso público é autorizado.
CREATE OR REPLACE FUNCTION public.assert_full_schedule_commercial_link(
  p_project_id uuid, p_quote_id uuid, p_contract_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $fn$
DECLARE
  v_project public.projetos%ROWTYPE;
  v_quote public.commercial_records%ROWTYPE;
  v_contract public.commercial_records%ROWTYPE;
  v_quote_count integer;
  v_quote_total numeric;
  v_missing integer;
BEGIN
  IF NOT public.is_portal_admin() THEN
    RAISE EXCEPTION 'Acesso administrativo necessário';
  END IF;
  SELECT * INTO v_project FROM public.projetos WHERE id=p_project_id;
  SELECT * INTO v_quote FROM public.commercial_records WHERE id=p_quote_id AND record_kind='orcamento';
  SELECT * INTO v_contract FROM public.commercial_records WHERE id=p_contract_id AND record_kind='contrato';
  IF v_project.id IS NULL OR v_quote.id IS NULL OR v_contract.id IS NULL THEN
    RAISE EXCEPTION 'Selecione um projeto, orçamento ORC e contrato CON existentes';
  END IF;
  IF v_contract.status NOT IN ('contrato_gerado','convertido')
     OR v_quote.status NOT IN ('orcamento_gerado','orcamento_aceito','contrato_gerado','convertido')
     OR v_quote.quote_document_id IS NULL OR v_contract.contract_document_id IS NULL THEN
    RAISE EXCEPTION 'Orçamento e contrato devem ter sido gerados e não podem estar cancelados ou em rascunho';
  END IF;
  IF v_contract.linked_project_id IS DISTINCT FROM v_project.id
     OR v_contract.linked_client_id IS DISTINCT FROM v_project.cliente_id
     OR v_contract.linked_contract_id IS DISTINCT FROM v_project.contract_id
     OR v_project.contract_id IS NULL
     OR (v_quote.linked_client_id IS NOT NULL AND v_quote.linked_client_id<>v_project.cliente_id) THEN
    RAISE EXCEPTION 'Projeto, cliente e contrato não pertencem ao mesmo vínculo comercial';
  END IF;
  IF NOT EXISTS (
      SELECT 1 FROM public.commercial_contract_quote_links l
      WHERE l.contract_record_id=v_contract.id AND l.quote_record_id=v_quote.id
    ) THEN
    RAISE EXCEPTION 'O orçamento selecionado não está vinculado a este contrato';
  END IF;
  IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_quote.services) s
      WHERE s->>'code'='s' AND s->>'included'='true'
    ) OR NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_contract.services) s
      WHERE s->>'code'='s' AND s->>'included'='true'
    ) THEN
    RAISE EXCEPTION 'Cronograma completo não está expressamente contratado no orçamento E no contrato';
  END IF;
  -- Todo serviço contratado deve constar de algum dos orçamentos vinculados;
  -- não permite introduzir execução, entregáveis ou honorários fora da origem.
  IF EXISTS (
    SELECT s->>'code' FROM jsonb_array_elements(v_contract.services) s WHERE s->>'included'='true'
    EXCEPT
    SELECT s->>'code' FROM public.commercial_contract_quote_links l
      JOIN public.commercial_records q ON q.id=l.quote_record_id
      CROSS JOIN LATERAL jsonb_array_elements(q.services) s
      WHERE l.contract_record_id=v_contract.id AND s->>'included'='true'
  ) THEN
    RAISE EXCEPTION 'O contrato inclui atividades que não constam dos orçamentos vinculados';
  END IF;
  IF EXISTS (
    SELECT s->>'code' FROM jsonb_array_elements(v_quote.services) s WHERE s->>'included'='true'
    EXCEPT
    SELECT s->>'code' FROM jsonb_array_elements(v_contract.services) s WHERE s->>'included'='true'
  ) THEN
    RAISE EXCEPTION 'O orçamento possui atividades ausentes do contrato';
  END IF;
  -- A verificação financeira é sobre honorários comerciais, jamais sobre
  -- custo de construção. Valores de cada item precisam ser explícitos.
  SELECT count(*),sum(q.total_value) INTO v_quote_count,v_quote_total
  FROM public.commercial_contract_quote_links l
  JOIN public.commercial_records q ON q.id=l.quote_record_id
  WHERE l.contract_record_id=v_contract.id;
  IF v_quote_count=0 OR v_quote_total IS NULL OR v_contract.total_value IS NULL
     OR abs(v_quote_total-v_contract.total_value)>0.01 THEN
    RAISE EXCEPTION 'Total contratual diverge dos orçamentos vinculados; faça correção ou aditivo';
  END IF;
  SELECT count(*) INTO v_missing FROM (
    SELECT s->>'code' code, s->>'value' amount, s->'level'->>'code' level_code
      FROM jsonb_array_elements(v_quote.services) s WHERE s->>'included'='true'
  ) q
  LEFT JOIN LATERAL (
    SELECT s->>'value' amount, s->'level'->>'code' level_code
    FROM jsonb_array_elements(v_contract.services) s
    WHERE s->>'included'='true' AND s->>'code'=q.code
    LIMIT 1
  ) c ON true
  WHERE q.code IS NULL OR q.amount IS NULL OR c.amount IS NULL
     OR q.amount !~ '^[0-9]+(\.[0-9]{1,2})?$'
     OR c.amount !~ '^[0-9]+(\.[0-9]{1,2})?$'
     OR q.amount::numeric IS DISTINCT FROM c.amount::numeric
     OR q.level_code IS DISTINCT FROM c.level_code;
  IF v_missing>0 THEN
    RAISE EXCEPTION 'Valores por serviço ou níveis divergem entre orçamento e contrato ou não são verificáveis';
  END IF;
  RETURN jsonb_build_object(
    'quote_id',v_quote.id, 'quote_number',v_quote.quote_number,
    'contract_record_id',v_contract.id, 'contract_number',v_contract.contract_number,
    'services',(SELECT coalesce(jsonb_agg(s),'[]'::jsonb)
      FROM jsonb_array_elements(v_quote.services) s WHERE s->>'included'='true'),
    'commercial_total',v_contract.total_value,
    'contract_master_version',v_contract.contract_master_version
  );
END;
$fn$;

-- Impede inserções diretas pelo cliente web e mantém o snapshot imutável.
CREATE OR REPLACE FUNCTION public.guard_construction_schedule_creation()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $guard$
DECLARE v_snapshot jsonb;
BEGIN
  IF TG_OP='UPDATE' THEN
    IF NEW.source_scope_snapshot IS DISTINCT FROM OLD.source_scope_snapshot THEN
      RAISE EXCEPTION 'Escopo congelado. Alterações exigem nova versão/aditivo';
    END IF;
    IF OLD.activation_status='legacy' THEN RETURN NEW; END IF;
  ELSIF NEW.activation_status='legacy' THEN
    RAISE EXCEPTION 'Novos cronogramas exigem orçamento e contrato expressos';
  END IF;
  v_snapshot := public.assert_full_schedule_commercial_link(
    NEW.project_id,NEW.quote_record_id,NEW.contract_record_id);
  IF NEW.client_id IS DISTINCT FROM (SELECT cliente_id FROM public.projetos WHERE id=NEW.project_id)
     OR NEW.contract_id IS DISTINCT FROM (SELECT contract_id FROM public.projetos WHERE id=NEW.project_id) THEN
    RAISE EXCEPTION 'Cliente/contrato do cabeçalho divergente do projeto';
  END IF;
  IF TG_OP='INSERT' THEN NEW.source_scope_snapshot := v_snapshot; END IF;
  RETURN NEW;
END;
$guard$;

DROP TRIGGER IF EXISTS construction_schedule_commercial_guard ON public.construction_schedules;
CREATE TRIGGER construction_schedule_commercial_guard
BEFORE INSERT OR UPDATE OF project_id, client_id, contract_id, quote_record_id, contract_record_id, source_scope_snapshot
ON public.construction_schedules FOR EACH ROW
EXECUTE FUNCTION public.guard_construction_schedule_creation();

-- Assinatura legada mantida para LEITURA/EXPORTAÇÃO de cronogramas existentes.
-- Nunca mais cria 20 atividades residenciais para todo projeto indiscriminadamente.
CREATE OR REPLACE FUNCTION public.admin_initialize_construction_schedule(p_project_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $legacy$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_portal_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  SELECT id INTO v_id FROM public.construction_schedules WHERE project_id=p_project_id;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Cronograma completo não contratado ou não inicializado. Selecione orçamento e contrato vinculados.';
  END IF;
  RETURN v_id;
END;
$legacy$;

-- Novos cronogramas começam sem atividades até a etapa 3 gerar APENAS
-- o modelo aplicável ao escopo. Não sobrepõe cronogramas anteriores.
CREATE OR REPLACE FUNCTION public.admin_initialize_construction_schedule(
  p_project_id uuid, p_quote_record_id uuid, p_contract_record_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $verified$
DECLARE v_id uuid; v_project public.projetos%ROWTYPE;
BEGIN
  IF NOT public.is_portal_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  PERFORM public.assert_full_schedule_commercial_link(
    p_project_id,p_quote_record_id,p_contract_record_id);
  SELECT * INTO v_project FROM public.projetos WHERE id=p_project_id;
  SELECT id INTO v_id FROM public.construction_schedules WHERE project_id=p_project_id FOR UPDATE;
  IF v_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.construction_schedules WHERE id=v_id
      AND quote_record_id=p_quote_record_id AND contract_record_id=p_contract_record_id) THEN
      RAISE EXCEPTION 'Projeto já possui cronograma anterior; não sobrescreva o histórico. Faça revisão contratual.';
    END IF;
    RETURN v_id;
  END IF;
  INSERT INTO public.construction_schedules(
    project_id,client_id,contract_id,quote_record_id,contract_record_id,
    title,planned_start,planned_finish,reference_date,activation_status)
  VALUES (v_project.id,v_project.cliente_id,v_project.contract_id,
    p_quote_record_id,p_contract_record_id,
    'Cronograma físico-financeiro — '||coalesce(v_project.nome,'Obra'),
    NULL,NULL,current_date,'draft')
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$verified$;

REVOKE ALL ON FUNCTION public.assert_full_schedule_commercial_link(uuid,uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_initialize_construction_schedule(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_initialize_construction_schedule(uuid,uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.guard_construction_schedule_creation() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.assert_full_schedule_commercial_link(uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_initialize_construction_schedule(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_initialize_construction_schedule(uuid,uuid,uuid) TO authenticated;
