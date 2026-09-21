-- Etapa 1/7: cronograma completo é um SERVIÇO comercial opcional e explícito.
-- Não altera contratos, orçamentos, cronogramas ou documentos anteriores.
-- A etapa 2 fará a validação do vínculo entre orçamento, contrato e projeto ANTES de criar o cronograma.
INSERT INTO public.service_catalog (
  code, name, category, level_applicable, description, deliverables, exclusions,
  client_inputs, default_revisions, delivery_formats, acceptance_required,
  planning_reference, contract_clause_refs, version, active, last_contract_master_version
)
VALUES (
  's',
  'Cronograma físico-financeiro completo',
  'planejamento',
  true,
  'Serviço opcional contratado expressamente no orçamento e no Anexo I do contrato. Compreende a elaboração de cronograma estruturado somente com atividades efetivamente incluídas no escopo contratado, com pesos, durações, predecessoras e marcos submetidos à validação técnica. O acompanhamento e as atualizações periódicas, a medição de execução e o controle financeiro somente são incluídos quando descritos e precificados separadamente no orçamento e no Anexo I. A simples contratação de projeto, consultoria, acompanhamento técnico ou execução NÃO inclui automaticamente este serviço.',
  '["Cronograma inicial com atividades do escopo contratado, datas e dependências após levantamento de quantitativos e recursos", "Pesos por atividade com premissas declaradas e validação de soma de 100%", "Arquivo XLSX e marcos contratuais conforme orçamento e Anexo I"]'::jsonb,
  '["Execução da obra, fiscalização contínua e administração financeira, salvo se contratadas como itens próprios", "Atualização periódica, medição e replanejamento ilimitados sem previsão expressa", "Prazo padrão aplicável a toda obra independentemente de quantitativos e recursos", "Inclusão automática de atividades não contratadas"]'::jsonb,
  '["Orçamento e contrato vinculados com escopo e valores compatíveis", "Quantitativos, projetos, recursos disponíveis, calendário de trabalho e data de mobilização", "Definição contratual da periodicidade, revisões e responsável pelo acompanhamento"]'::jsonb,
  NULL,
  '["XLSX"]'::jsonb,
  true,
  'Prazo, revisões, número de atualizações e marcos definidos no orçamento e no Anexo I após levantamento técnico; modelos residenciais são apenas referências editáveis.',
  ARRAY['1.1','1.2','1.7','10.1']::text[],
  1,
  true,
  NULL
)
ON CONFLICT (code) DO NOTHING;

DO $check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.service_catalog
    WHERE code='s' AND active=true AND level_applicable=true
      AND name='Cronograma físico-financeiro completo'
      AND contract_clause_refs @> ARRAY['1.1','1.2']::text[]
  ) THEN
    RAISE EXCEPTION 'Catálogo do cronograma completo não confere; revisão manual necessária';
  END IF;
END
$check$;

COMMENT ON COLUMN public.service_catalog.planning_reference IS
  'Referência de planejamento, não prazo contratual universal. O cronograma completo é item opcional e depende de escopo, quantitativos e recursos.';
