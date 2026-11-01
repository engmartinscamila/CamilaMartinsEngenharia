BEGIN;
DO $preflight$ BEGIN
  IF (SELECT version FROM public.contract_master_versions WHERE active=true LIMIT 1)<>5 THEN RAISE EXCEPTION 'O Contrato Mestre ativo já foi alterado'; END IF;
  IF EXISTS (SELECT 1 FROM public.contract_master_versions WHERE version=6) THEN RAISE EXCEPTION 'Versão 6 já existe'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.contract_master_versions WHERE version=5 AND position('2.1. Cada atividade deverá possuir prazo ou marco de entrega definido no Anexo I. Quando não houver prazo específico para uma etapa de projeto, poderá ser adotado o prazo geral de referência de 45 (quarenta e cinco) dias úteis, contado da assinatura e do recebimento integral dos insumos necessários, o que ocorrer por último. Esse prazo geral não se aplica automaticamente a consultorias, vistorias, laudos, legalizações, serviços personalizados ou demais atividades de natureza distinta.' in body)>0) THEN RAISE EXCEPTION 'Cláusula original 2.1 não foi encontrada'; END IF;
END $preflight$;
UPDATE public.contract_master_versions SET active=false WHERE version=5 AND active=true;
INSERT INTO public.contract_master_versions(version,label,body,notes,active,effective_at)
SELECT 6,'Contrato Mestre v6 — prazos específicos, ART, legalização e rescisão',replace(body,'2.1. Cada atividade deverá possuir prazo ou marco de entrega definido no Anexo I. Quando não houver prazo específico para uma etapa de projeto, poderá ser adotado o prazo geral de referência de 45 (quarenta e cinco) dias úteis, contado da assinatura e do recebimento integral dos insumos necessários, o que ocorrer por último. Esse prazo geral não se aplica automaticamente a consultorias, vistorias, laudos, legalizações, serviços personalizados ou demais atividades de natureza distinta.','2.1. Os prazos de execução não são fixos para todas as contratações. O prazo total será aquele expressamente preenchido e aprovado no quadro de condições comerciais e no Anexo I, com prazos por atividade e indicação de dias úteis ou corridos; não se presume prazo geral de 45 dias. A contagem terá início no evento estipulado pelas partes, observadas as condições contratuais sobre recebimento de insumos, pagamento, impedimentos e suspensões. Prazos de análise e deferimento por órgãos públicos não constituem prazo de execução técnica controlado pela CONTRATADA.'),
  'Prazo técnico sem limite-padrão de 45 dias; cronograma individualizado obrigatório. Mantidas as cláusulas de ART e documentação.',
  true,now() FROM public.contract_master_versions WHERE version=5;
UPDATE public.service_catalog SET last_contract_master_version=6 WHERE active AND last_contract_master_version IS DISTINCT FROM 6;
UPDATE public.service_level_catalog SET last_contract_master_version=6 WHERE active AND last_contract_master_version IS DISTINCT FROM 6;
UPDATE public.document_text_catalog SET last_contract_master_version=6 WHERE active AND last_contract_master_version IS DISTINCT FROM 6;
UPDATE public.commercial_records SET contract_master_id=(SELECT id FROM public.contract_master_versions WHERE version=6),
 contract_master_version=6,updated_at=now()
 WHERE contract_number='CON-2026-10-0002' AND contract_master_version=5;
UPDATE public.document_rule_reviews SET status='resolved',resolved_at=now(),
 reason=coalesce(reason,'')||' | Prazo técnico individualizado confirmado pelo contratante; revisão da cláusula 2.1 em 01/11/2026.'
 WHERE contract_master_version=6 AND status='pending';
DO $verify$ BEGIN
 IF (SELECT count(*) FROM public.contract_master_versions WHERE active=true)<>1 OR
 (SELECT version FROM public.contract_master_versions WHERE active=true)<>6 THEN RAISE EXCEPTION 'Falha na versão 6'; END IF;
 IF (SELECT count(*) FROM public.service_catalog WHERE active)<>41 OR
 (SELECT count(*) FROM public.service_level_scope_catalog WHERE active)<>123 THEN RAISE EXCEPTION 'Catálogo divergiu'; END IF;
 IF (SELECT count(*) FROM public.document_rule_reviews WHERE contract_master_version=6 AND status='pending')>0 THEN RAISE EXCEPTION 'Governança pendente';END IF;
 IF (SELECT count(*) FROM public.service_catalog WHERE active AND last_contract_master_version IS DISTINCT FROM 6)+
 (SELECT count(*) FROM public.service_level_catalog WHERE active AND last_contract_master_version IS DISTINCT FROM 6)+
 (SELECT count(*) FROM public.document_text_catalog WHERE active AND last_contract_master_version IS DISTINCT FROM 6)>0 THEN RAISE EXCEPTION 'Referências ao mestre estão desatualizadas'; END IF;
 IF (SELECT contract_master_version FROM public.commercial_records WHERE contract_number='CON-2026-10-0002')<>6 THEN RAISE EXCEPTION 'Vínculo Tributino não atualizado'; END IF;
 IF (SELECT count(*) FROM public.documentos WHERE id in
 ('cbf8ae43-72d6-4670-bcf3-1392e1a3ef0b'::uuid,'657ea8eb-4edc-4179-b8c3-b972f7bd835b'::uuid) AND versao IN ('1.0','2.0'))<>2 THEN
 RAISE EXCEPTION 'Emissões históricas alteradas'; END IF;
END $verify$;
COMMIT;
