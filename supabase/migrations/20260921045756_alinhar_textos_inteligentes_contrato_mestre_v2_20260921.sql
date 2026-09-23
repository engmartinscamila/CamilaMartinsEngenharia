-- Mesma migração já executada na produção, preservando revisão administrativa.
DO $migration$
DECLARE n integer;
BEGIN
 IF (SELECT version FROM public.contract_master_versions WHERE active ORDER BY version DESC LIMIT 1) IS DISTINCT FROM 2 THEN
  RAISE EXCEPTION 'Contrato Mestre não é v2; reavaliar textos'; END IF;
 UPDATE public.document_text_catalog
 SET body=CASE code
  WHEN 'proposal_revision_rule' THEN 'Para cada serviço de projeto, aplicam-se as rodadas de ajustes de preferência dentro do escopo original expressamente indicadas no orçamento e no Anexo I ou, se não indicadas, até 2 (duas) rodadas por etapa de projeto. Consultorias, laudos, vistorias, legalizações e demais serviços não projetuais somente terão revisões e formatos adicionais quando expressamente definidos para cada atividade. A correção de erros e vícios técnicos imputáveis à CONTRATADA não consome essas rodadas nem constitui serviço adicional. Alterações de escopo dependem de orçamento e aprovação prévios.'
  WHEN 'anexo_revision_rule' THEN 'Nos itens de projeto, registre as rodadas de ajustes de preferência contratadas por etapa; na ausência de indicação, aplicam-se até 2 (duas) rodadas por etapa de projeto dentro do escopo original. Para consultorias, laudos, vistorias, legalizações e serviços personalizados, revisões, visitas e formatos somente integram o objeto quando indicados expressamente no respectivo item deste Anexo. Correções de erros e vícios técnicos imputáveis à CONTRATADA não consomem rodadas; alteração de escopo exige orçamento e aprovação prévios.'
  WHEN 'proposal_timeline_rule' THEN 'Para serviços de projeto, o prazo de referência é de 45 (quarenta e cinco) dias úteis, sujeito ao cronograma específico aprovado no Anexo I e contado conforme as condições do Contrato Mestre. Em propostas exclusivamente de consultoria, vistoria, laudo, legalização ou serviço personalizado, o prazo será exclusivamente o definido para cada atividade no orçamento e no Anexo I, sem aplicação automática dos 45 dias. Em propostas mistas, o prazo de projeto não é presumido para os demais serviços. Prazos de análise de órgãos públicos e terceiros não são prazos de elaboração técnica.'
  WHEN 'anexo_timeline_rule' THEN 'Este Anexo I deve informar o prazo e o marco inicial de cada atividade contratada. O prazo de referência de 45 (quarenta e cinco) dias úteis aplica-se somente aos serviços de projeto abrangidos pela cláusula 2.1 do Contrato Mestre, quando não houver prazo específico aprovado. Para consultorias, vistorias, laudos, legalizações e serviços personalizados, a duração e eventuais visitas dependerão de previsão expressa para a atividade. A contagem observará o recebimento dos insumos necessários e suspensões formalmente comunicadas. Prazos de órgãos públicos e terceiros não integram automaticamente o prazo técnico.'
  ELSE body END,
  version=version+1,last_contract_master_version=NULL,updated_at=now()
 WHERE active AND code IN ('proposal_revision_rule','anexo_revision_rule','proposal_timeline_rule','anexo_timeline_rule');
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>4 THEN RAISE EXCEPTION 'Quatro textos esperados, % atualizados. Reverter.',n; END IF;
 INSERT INTO public.audit_log(user_id,action,entity_type,details)
 VALUES(NULL,'align_document_texts_master_v2','document_text_catalog',
 jsonb_build_object('codes',jsonb_build_array('proposal_revision_rule','anexo_revision_rule','proposal_timeline_rule','anexo_timeline_rule'),
 'prior_documents_modified',false,'governance_approved',false,'contract_master_version',2));
END;
$migration$;
