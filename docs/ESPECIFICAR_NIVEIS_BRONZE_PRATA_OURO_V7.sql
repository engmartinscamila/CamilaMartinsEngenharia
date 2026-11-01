BEGIN;
DO $pre$ BEGIN IF (SELECT version FROM public.contract_master_versions WHERE active)<>7 THEN RAISE EXCEPTION 'Contrato Mestre inesperado';END IF;END $pre$;
INSERT INTO public.service_level_catalog_versions(level_code,version,snapshot,contract_master_version,created_by)
SELECT code,version,to_jsonb(s),last_contract_master_version,null FROM public.service_level_catalog s WHERE active
ON CONFLICT(level_code,version) DO NOTHING;
UPDATE public.service_level_catalog SET
 description=CASE code
  WHEN 'bronze' THEN 'BRONZE: primeiro conjunto de entregas nomeadas na ficha técnica da atividade. Exemplos: no Estudo Preliminar, programa de necessidades e implantação preliminar; no Projeto Elétrico, planta de pontos e previsão de circuitos; em Alvará, formulários e comprovante de protocolo.'
  WHEN 'prata' THEN 'PRATA: inclui os produtos listados em BRONZE e o segundo conjunto nomeado na atividade. Exemplos: no Projeto Elétrico, diagrama unifilar e dimensionamento de condutores; no Projeto Legal, conferência do quadro de áreas e parâmetros urbanísticos; no Alvará, consultas de andamento e encaminhamento de exigências.'
  ELSE 'OURO: inclui os produtos de BRONZE, PRATA e o terceiro conjunto nomeado na atividade. Exemplos: no Projeto Elétrico, detalhes de quadros e interfaces; no Projeto Executivo, detalhamento de escadas e acabamentos; no Alvará, histórico de exigências e pendências. O nível não promete deferimento nem execução de obra.' END,
 features=CASE code
  WHEN 'bronze' THEN '["Primeiro conjunto de produtos concretos da atividade selecionada, identificado no catálogo técnico","Quantidade de cada documento, imagem, planta ou visita especificada no orçamento e Anexo I"]'::jsonb
  WHEN 'prata' THEN '["Produtos de BRONZE e segundo conjunto técnico da atividade — ver lista própria do serviço","Exemplos: elétrico acrescenta unifilar; projeto legal acrescenta parâmetros urbanísticos; alvará acrescenta acompanhamento de exigências"]'::jsonb
  ELSE '["Produtos de BRONZE e PRATA e terceiro conjunto de documentos próprio da atividade","Exemplos: executivo acrescenta detalhes de encontros; elétrico acrescenta detalhes dos quadros; tramitação municipal acrescenta relatório de acompanhamento"]'::jsonb END,
 version=version+1,last_contract_master_version=7,updated_at=now()
 WHERE active;
INSERT INTO public.service_level_catalog_versions(level_code,version,snapshot,contract_master_version,created_by)
SELECT code,version,to_jsonb(s),last_contract_master_version,null FROM public.service_level_catalog s WHERE active
ON CONFLICT(level_code,version) DO NOTHING;
UPDATE public.service_level_scope_catalog sc SET
 source_level_version=(SELECT version FROM public.service_level_catalog l WHERE l.code=sc.level_code),version=sc.version+1,review_status='approved',updated_at=now()
 WHERE sc.active;
INSERT INTO public.service_level_scope_versions(service_code,level_code,version,snapshot,created_by)
SELECT service_code,level_code,version,to_jsonb(s),null FROM public.service_level_scope_catalog s WHERE active
ON CONFLICT(service_code,level_code,version) DO NOTHING;
UPDATE public.document_rule_reviews SET status='resolved',resolved_at=now() WHERE contract_master_version=7 AND status='pending';
DO $v$ BEGIN
 IF (SELECT count(*) FROM public.service_level_scope_catalog WHERE active AND review_status='approved')<>123 THEN RAISE EXCEPTION 'Níveis desatualizados';END IF;
 IF EXISTS(SELECT 1 FROM public.service_level_scope_catalog sc JOIN public.service_level_catalog l ON l.code=sc.level_code WHERE sc.active AND sc.source_level_version<>l.version) THEN RAISE EXCEPTION 'Níveis divergentes';END IF;
END $v$;
COMMIT;