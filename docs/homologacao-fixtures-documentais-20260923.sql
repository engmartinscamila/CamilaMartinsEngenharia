-- Somente HOMOLOGAÇÃO Supabase: nvhjcoxnzigwwbdbhkhq.
-- Executar manualmente no projeto de homologação, NUNCA em produção.
-- Cria 1 cliente, 1 contrato cadastral em rascunho, 1 projeto e 4 registros
-- comerciais (3 orçamentos + 1 contrato comercial em RASCUNHO).
-- Não cria contas Auth, não emite/assina Word, não cria documentos no Storage,
-- não publica para cliente e NÃO contorna a validação de emissão.
-- Os dados usam @example.invalid e não possuem CPF/CNPJ de pessoas reais.
-- Idempotente por marcadores TESTE-ORC-/TESTE-CON- e e-mail fictício.
BEGIN;
DO $fixture$
DECLARE
  v_client uuid;
  v_contract uuid;
  v_project uuid;
  v_quote uuid;
  v_contract_record uuid;
  v_scope jsonb;
  v_other_scope jsonb;
  v_project_scope jsonb;
  v_actor uuid := '00000000-0000-0000-0000-000000000000'::uuid;
  v_client_email text := 'qa-fixture-documentos-20260923@example.invalid';
  v_notes text := 'DADOS FICTÍCIOS / SOMENTE HOMOLOGAÇÃO / NÃO EMITIR, ENVIAR OU ASSINAR. Sem validade contratual.';
BEGIN
  -- Sentinela específica deste ambiente: tabela da PR ainda ausente na produção.
  IF to_regclass('public.construction_schedule_templates') IS NULL
     OR to_regclass('public.clientes_camila') IS NOT NULL THEN
    RAISE EXCEPTION 'Ambiente incompatível: os dados de teste só podem ser inseridos na homologação isolada.';
  END IF;
  IF (SELECT count(*) FROM public.service_level_catalog
      WHERE active=true AND code IN ('bronze','prata','ouro')) <> 3
     OR NOT EXISTS (SELECT 1 FROM public.service_catalog WHERE active=true AND code='s')
     OR NOT EXISTS (SELECT 1 FROM public.service_catalog WHERE active=true AND code='p') THEN
    RAISE EXCEPTION 'Catálogo de homologação não corresponde aos três níveis e serviços existentes.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.clientes WHERE lower(email)=v_client_email
             AND nome <> '[TESTE] Cliente Fictício Documental') THEN
    RAISE EXCEPTION 'E-mail de fixture ocupado por cadastro divergente.';
  END IF;

  SELECT id INTO v_client FROM public.clientes
   WHERE lower(email)=v_client_email AND nome='[TESTE] Cliente Fictício Documental';
  IF v_client IS NULL THEN
    INSERT INTO public.clientes(nome,email,endereco,cidade,estado,status,observacoes,parceria)
    VALUES ('[TESTE] Cliente Fictício Documental',v_client_email,
      'Endereço inventado, sem número - uso exclusivo de QA','Cidade Fictícia','RJ','ativo',v_notes,false)
    RETURNING id INTO v_client;
  END IF;

  SELECT id INTO v_contract FROM public.contratos WHERE contract_number='TESTE-CON-20260923-BASE';
  IF v_contract IS NULL THEN
    INSERT INTO public.contratos(cliente_id,contract_number,service_type,status,contract_value,currency,notes)
    VALUES (v_client,'TESTE-CON-20260923-BASE','Planejamento e projeto legal - somente simulação',
      'rascunho',2000,'BRL',v_notes)
    RETURNING id INTO v_contract;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contratos WHERE id=v_contract AND cliente_id=v_client) THEN
    RAISE EXCEPTION 'Contrato com marcador de fixture pertence a outro cliente.';
  END IF;

  SELECT id INTO v_project FROM public.projetos WHERE nome='[TESTE] Projeto Residencial Documental';
  IF v_project IS NULL THEN
    INSERT INTO public.projetos(cliente_id,contract_id,nome,tipo,status,descricao,
      numero_contrato,numero_orcamento,area_construida_m2,area_terreno_m2,
      endereco_obra,cidade_obra,estado_obra,parceria)
    VALUES (v_client,v_contract,'[TESTE] Projeto Residencial Documental','residencial','rascunho',
      v_notes,'TESTE-CON-20260923-BASE','TESTE-ORC-20260923-CRONO',80,140,
      'Imóvel inteiramente fictício - rua inventada, sem número','Cidade Fictícia','RJ',false)
    RETURNING id INTO v_project;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.projetos
     WHERE id=v_project AND cliente_id=v_client AND contract_id=v_contract) THEN
    RAISE EXCEPTION 'Projeto com marcador de fixture possui vínculo divergente.';
  END IF;

  -- Honorários fictícios para os SERVIÇOS contratados, nunca custos da obra.
  v_scope := public.enrich_commercial_services(
    '[{"code":"s","included":true,"value":500,"displayOrder":1},
      {"code":"c","included":true,"value":1500,"displayOrder":2}]'::jsonb,'bronze');
  v_other_scope := public.enrich_commercial_services(
    '[{"code":"p","included":true,"value":720,"displayOrder":1}]'::jsonb,'prata');
  v_project_scope := public.enrich_commercial_services(
    '[{"code":"r","included":true,"value":990,"displayOrder":1}]'::jsonb,'ouro');

  IF NOT EXISTS (SELECT 1 FROM public.commercial_records
    WHERE quote_number='TESTE-ORC-20260923-CRONO') THEN
    INSERT INTO public.commercial_records(quote_number,record_kind,status,prospect_name,
      email,address,city,state,property_address,property_type,experience_level,
      services,total_value,linked_client_id,linked_contract_id,linked_project_id,created_by,notes)
    VALUES ('TESTE-ORC-20260923-CRONO','orcamento','rascunho_orcamento',
      '[TESTE] Cliente Fictício Documental',v_client_email,
      'Endereço inventado, sem número - uso exclusivo de QA','Cidade Fictícia','RJ',
      'Imóvel inteiramente fictício - rua inventada, sem número','residencial','bronze',
      v_scope,2000,v_client,v_contract,v_project,v_actor,v_notes);
  END IF;
  SELECT id INTO v_quote FROM public.commercial_records
    WHERE quote_number='TESTE-ORC-20260923-CRONO';

  IF NOT EXISTS (SELECT 1 FROM public.commercial_records
    WHERE quote_number='TESTE-ORC-20260923-BASE-CON') THEN
    INSERT INTO public.commercial_records(quote_number,contract_number,record_kind,status,
      prospect_name,email,address,city,state,property_address,property_type,experience_level,
      services,total_value,linked_client_id,linked_contract_id,linked_project_id,created_by,notes)
    VALUES ('TESTE-ORC-20260923-BASE-CON','TESTE-CON-20260923-DOCUMENTO','contrato',
      'rascunho_orcamento','[TESTE] Cliente Fictício Documental',v_client_email,
      'Endereço inventado, sem número - uso exclusivo de QA','Cidade Fictícia','RJ',
      'Imóvel inteiramente fictício - rua inventada, sem número','residencial','bronze',
      v_scope,2000,v_client,v_contract,v_project,v_actor,v_notes);
  END IF;
  SELECT id INTO v_contract_record FROM public.commercial_records
    WHERE quote_number='TESTE-ORC-20260923-BASE-CON';
  IF NOT EXISTS (SELECT 1 FROM public.commercial_records
    WHERE id=v_contract_record AND record_kind='contrato'
      AND contract_number='TESTE-CON-20260923-DOCUMENTO'
      AND linked_client_id=v_client AND linked_contract_id=v_contract AND linked_project_id=v_project) THEN
    RAISE EXCEPTION 'Contrato comercial de fixture existe, mas não corresponde aos vínculos fictícios.';
  END IF;
  INSERT INTO public.commercial_contract_quote_links(contract_record_id,quote_record_id,created_by)
  VALUES(v_contract_record,v_quote,v_actor)
  ON CONFLICT (contract_record_id,quote_record_id) DO NOTHING;

  -- Mesmo cliente, outra contratação, categoria "Outros" com escopo identificável.
  IF NOT EXISTS (SELECT 1 FROM public.commercial_records
    WHERE quote_number='TESTE-ORC-20260923-OUTROS') THEN
    INSERT INTO public.commercial_records(quote_number,record_kind,status,prospect_name,
      email,address,city,state,property_address,property_type,experience_level,
      services,custom_service,total_value,linked_client_id,created_by,notes)
    VALUES ('TESTE-ORC-20260923-OUTROS','orcamento','rascunho_orcamento',
      '[TESTE] Cliente Fictício Documental',v_client_email,
      'Endereço inventado, sem número - uso exclusivo de QA','Cidade Fictícia','RJ',
      'Outro imóvel fictício - endereço distinto sem número','residencial','prata',
      v_other_scope,'Consultoria para revisão de memorial descritivo fictício',720,
      v_client,v_actor,v_notes);
  END IF;

  -- Prospect novo: deliberadamente SEM cliente cadastrado e sem projeto vinculado.
  IF NOT EXISTS (SELECT 1 FROM public.commercial_records
    WHERE quote_number='TESTE-ORC-20260923-NOVO') THEN
    INSERT INTO public.commercial_records(quote_number,record_kind,status,prospect_name,
      email,address,city,state,property_address,property_type,experience_level,
      services,total_value,created_by,notes)
    VALUES ('TESTE-ORC-20260923-NOVO','orcamento','rascunho_orcamento',
      '[TESTE] Prospect Novo Sem Cadastro','qa-prospect-20260923@example.invalid',
      'Endereço inventado do prospect','Cidade Fictícia','RJ',
      'Imóvel fictício distinto do endereço cadastral','residencial','ouro',
      v_project_scope,990,v_actor,v_notes);
  END IF;

  -- Nenhuma linha é marcada como emitida: quote_document_id/contract_document_id
  -- continuam NULL. A RPC oficial de emissão deve validar governança e sessão.
  IF EXISTS (SELECT 1 FROM public.commercial_records
    WHERE quote_number LIKE 'TESTE-ORC-20260923-%'
      AND (quote_document_id IS NOT NULL OR contract_document_id IS NOT NULL
           OR status <> 'rascunho_orcamento')) THEN
    RAISE EXCEPTION 'Fixture possui documento emitido ou status inesperado: abortando.';
  END IF;
  INSERT INTO public.audit_log(user_id,action,entity_type,entity_id,details)
  VALUES (null,'seed_fictitious_staging_documents','clientes',v_client,
    jsonb_build_object('environment','homologacao','fixture','2026-09-23',
      'document_generation_tested',false,'emission_guard_preserved',true,
      'linked_project',v_project,'quote',v_quote,'contract_record',v_contract_record));
END
$fixture$;
COMMIT;

-- Conferir após executar: 1 cliente, 1 contrato cadastral, 1 projeto,
-- 3 orçamentos comerciais, 1 contrato comercial, 1 vínculo, ZERO Word emitido.
-- SELECT record_kind,status,quote_number,contract_number,
--        quote_document_id,contract_document_id FROM public.commercial_records
-- WHERE quote_number LIKE 'TESTE-ORC-20260923-%' ORDER BY quote_number;
