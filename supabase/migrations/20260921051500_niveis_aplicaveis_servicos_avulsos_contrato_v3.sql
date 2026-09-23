-- Revisão autorizada: os níveis Bronze, Prata e Ouro podem ser contratados em serviços avulsos.
-- A escolha do nível não adiciona outras atividades nem entregáveis sem descrição expressa.
-- Não atualiza snapshots nem documentos comerciais emitidos; mantém revisões de governança pendentes.
DO $migration$
DECLARE
  v_old public.contract_master_versions%rowtype;
  v_body text;
  v_version integer;
  v_id uuid;
  v_changed text[];
  v_rows integer;
  v_old_15 text := '1.5. Os serviços de projeto poderão ser contratados em um dos níveis de experiência — BRONZE (Essencial), PRATA (Visual) ou OURO (Imersivo) —, prevalecendo o Anexo I como fonte única do escopo e condições efetivamente contratadas.';
  v_old_151 text := '1.5.1. BRONZE (Essencial): documentação técnica objetiva do projeto, sem plantas humanizadas, renderização 3D, vídeo ou tour virtual.';
  v_old_152 text := '1.5.2. PRATA (Visual): nos projetos arquitetônicos e de interiores em que tais recursos são tecnicamente aplicáveis, inclui os conteúdos do nível BRONZE, acrescidos de plantas humanizadas e renderização 3D em imagens estáticas, nos ambientes e quantidades descritos no Anexo I. Em outros projetos técnicos, os recursos visuais somente integrarão o escopo se expressamente descritos no Anexo I.';
  v_old_153 text := '1.5.3. OURO (Imersivo): nos projetos arquitetônicos e de interiores tecnicamente compatíveis, inclui os conteúdos dos níveis anteriores e os recursos de renderização 3D em vídeo, tour virtual 360° e curadoria dos catálogos de materiais, mobiliário e acabamentos, nos limites, ambientes e quantidades definidos no Anexo I. Não acrescenta serviços complementares, aprovação, execução, taxas ou formatos não contratados.';
  v_old_17 text := '1.7. Os níveis de experiência aplicam-se exclusivamente aos serviços de projeto. Execução de obra, gerenciamento, visitas técnicas, projetos complementares, levantamentos, taxas e aprovações somente integrarão o objeto se expressamente descritos no Anexo I.';
  v_old_61 text := '6.1. Nos serviços de projeto, incluem-se as rodadas de ajustes de preferência dentro do escopo original previstas no Anexo I ou, se não especificadas, até 2 (duas) rodadas por etapa. Para consultorias, vistorias, laudos, legalizações e outros serviços não projetuais, quantidades e formatos de revisão somente se aplicam quando expressamente contratados. A correção de erros ou vícios técnicos imputáveis ao(à) CONTRATADO(A) não consome rodadas de preferência nem depende de contratação adicional, respeitados os direitos legais.';
BEGIN
  SELECT * INTO v_old FROM public.contract_master_versions WHERE active=true ORDER BY version DESC LIMIT 1 FOR UPDATE;
  IF v_old.version IS DISTINCT FROM 2 THEN RAISE EXCEPTION 'Versão do Contrato Mestre diferente da v2: abortada a alteração'; END IF;
  v_body := v_old.body;
  IF position(v_old_15 in v_body)=0 OR position(v_old_151 in v_body)=0 OR position(v_old_152 in v_body)=0 OR position(v_old_153 in v_body)=0 OR position(v_old_17 in v_body)=0 OR position(v_old_61 in v_body)=0 THEN
    RAISE EXCEPTION 'Uma ou mais cláusulas não correspondem à versão revisada: migração cancelada';
  END IF;
  v_body := replace(v_body,v_old_15,
    '1.5. Todos os serviços técnicos do catálogo, inclusive serviços avulsos, complementares, consultorias, vistorias, legalizações e atividades personalizadas, poderão ser contratados nos níveis BRONZE (Essencial), PRATA (Ampliado) ou OURO (Completo). O nível escolhido qualifica exclusivamente a prestação de cada serviço expressamente incluído; escopo, entregáveis, quantidades, formatos, visitas, revisões, preço e prazo dependem das condições específicas aprovadas no orçamento e no Anexo I.');
  v_body := replace(v_body,v_old_151,
    '1.5.1. BRONZE (Essencial): execução do objeto técnico fundamental da atividade selecionada e entrega dos itens essenciais expressamente previstos no Anexo I. Em projetos arquitetônicos ou de interiores não inclui, por si só, planta humanizada, renders extras, vídeo ou tour. Quando o próprio serviço avulso contratado for renderização ou outra atividade visual, o produto visual descrito no respectivo escopo permanece incluído; não são presumidos produtos adicionais.');
  v_body := replace(v_body,v_old_152,
    '1.5.2. PRATA (Ampliado): inclui as obrigações aplicáveis do BRONZE e os recursos de aprofundamento, apresentação, suporte ou detalhamento especificados para a atividade no Anexo I. Em projetos arquitetônicos e de interiores tecnicamente compatíveis, contempla plantas humanizadas e imagens estáticas de renderização nas quantidades e ambientes definidos no Anexo I. Nos demais serviços avulsos, benefícios específicos devem estar expressos no Anexo I; nenhum recurso incompatível com o serviço será presumido.');
  v_body := replace(v_body,v_old_153,
    '1.5.3. OURO (Completo): inclui as obrigações aplicáveis dos níveis anteriores e os recursos avançados de aprofundamento, apresentação ou suporte expressamente previstos para o serviço no Anexo I. Em projetos arquitetônicos e de interiores compatíveis, pode contemplar vídeo, tour virtual e curadoria de materiais, mobiliário e acabamentos conforme itens e quantidades do Anexo I. Para consultorias, legalizações, laudos, projetos complementares e outros serviços avulsos, o nível OURO amplia somente as prestações específicas discriminadas, sem promessa automática de render, vídeo, visitas, aprovações ou outras atividades.');
  v_body := replace(v_body,v_old_17,
    '1.7. A contratação avulsa significa seleção independente de uma atividade, e não exclusão dos níveis BRONZE, PRATA e OURO. Os níveis poderão ser atribuídos a qualquer serviço do catálogo, respeitada sua natureza técnica e o objeto descrito no orçamento e no Anexo I. A escolha de pacote para um serviço não inclui automaticamente outro projeto, execução, gerenciamento, visita, levantamento, taxa, protocolo, aprovação ou fornecimento; cada atividade e seus adicionais exigem discriminação expressa.');
  v_body := replace(v_body,v_old_61,
    '6.1. As rodadas de ajustes de preferência estão incluídas exclusivamente nas quantidades e condições discriminadas por serviço no Anexo I. Para etapas de projeto, na ausência de estipulação específica, podem ser consideradas até 2 (duas) rodadas por etapa dentro do escopo original. Nos serviços avulsos de consultoria, vistoria, laudo, legalização ou outras naturezas, a denominação BRONZE, PRATA ou OURO não cria automaticamente rodadas de revisão: a quantidade deverá estar expressamente definida por atividade no Anexo I. A correção de erros ou vícios técnicos imputáveis ao(à) CONTRATADO(A) não consome rodadas de preferência nem depende de contratação adicional, preservados os direitos legais.');
  IF position('exclusivamente aos serviços de projeto' in v_body)>0 THEN RAISE EXCEPTION 'Persistiu exclusão indevida de serviço avulso'; END IF;
  IF EXISTS (SELECT 1 FROM regexp_matches(v_body,'\[[^]]+\]','g')) THEN RAISE EXCEPTION 'Contrato v3 contém campos provisórios'; END IF;
  v_changed := public.document_changed_clause_refs(v_old.body,v_body);
  IF NOT (v_changed @> ARRAY['1.5','1.5.1','1.5.2','1.5.3','1.7','6.1']::text[]) THEN RAISE EXCEPTION 'Mapa de cláusulas não detectou todas as alterações'; END IF;
  SELECT coalesce(max(version),0)+1 INTO v_version FROM public.contract_master_versions;
  UPDATE public.contract_master_versions SET active=false WHERE id=v_old.id;
  INSERT INTO public.contract_master_versions(version,label,body,notes,active,created_by)
    VALUES(v_version,'Contrato Mestre v'||v_version||' - pacotes para serviços avulsos',v_body,
      'Reclassificação autorizada pela titular. Abrange serviços avulsos sem presumir entregáveis e preserva versões anteriores. Revisões exigem validação.',true,NULL)
    RETURNING id INTO v_id;
  UPDATE public.service_catalog SET level_applicable=true, version=version+1, last_contract_master_version=NULL, updated_at=now()
    WHERE active=true AND level_applicable=false;
  GET DIAGNOSTICS v_rows=ROW_COUNT;
  IF v_rows<>12 THEN RAISE EXCEPTION 'Esperados 12 serviços avulsos a reclassificar, encontrados %; transação revertida',v_rows; END IF;
  UPDATE public.document_text_catalog SET body='Os níveis BRONZE, PRATA e OURO também podem ser selecionados em serviços avulsos. O nível escolhido aplica-se somente a cada atividade incluída, conforme seus entregáveis, quantidades, formatos, prazos, visitas e revisões expressamente definidos no orçamento e no Anexo I. O nível não acrescenta automaticamente outras atividades ou benefícios incompatíveis com a natureza do serviço.',version=version+1,last_contract_master_version=NULL,updated_at=now()
    WHERE code='level_scope_rule' AND active=true;
  INSERT INTO public.document_rule_reviews(contract_master_version,source_type,source_code,clause_refs,reason)
    SELECT v_version,'service',s.code,s.contract_clause_refs,'Contrato v3: conferir compatibilidade de pacote e entregáveis deste serviço.'
    FROM public.service_catalog s WHERE s.active=true AND s.contract_clause_refs && v_changed
    ON CONFLICT(contract_master_version,source_type,source_code) DO NOTHING;
  INSERT INTO public.document_rule_reviews(contract_master_version,source_type,source_code,clause_refs,reason)
    SELECT v_version,'level',l.code,l.contract_clause_refs,'Contrato v3: conferir benefícios do nível aplicáveis a serviços avulsos.'
    FROM public.service_level_catalog l WHERE l.active=true AND l.contract_clause_refs && v_changed
    ON CONFLICT(contract_master_version,source_type,source_code) DO NOTHING;
  INSERT INTO public.document_rule_reviews(contract_master_version,source_type,source_code,clause_refs,reason)
    SELECT v_version,'text',t.code,t.contract_clause_refs,'Contrato v3: conferir redação do texto inteligente e suas condições.'
    FROM public.document_text_catalog t WHERE t.active=true AND t.contract_clause_refs && v_changed
    ON CONFLICT(contract_master_version,source_type,source_code) DO NOTHING;
  UPDATE public.service_catalog SET last_contract_master_version=v_version
    WHERE active=true AND last_contract_master_version=v_old.version AND NOT (contract_clause_refs && v_changed);
  UPDATE public.service_level_catalog SET last_contract_master_version=v_version
    WHERE active=true AND last_contract_master_version=v_old.version AND NOT (contract_clause_refs && v_changed);
  UPDATE public.document_text_catalog SET last_contract_master_version=v_version
    WHERE active=true AND last_contract_master_version=v_old.version AND NOT (contract_clause_refs && v_changed);
  INSERT INTO public.audit_log(user_id,action,entity_type,entity_id,details)
    VALUES(NULL,'publish_contract_master_avulsos_tiers','contract_master_versions',v_id,
      jsonb_build_object('source_version',v_old.version,'new_version',v_version,'catalog_rows_reclassified',v_rows,'changed_clause_refs',v_changed,'existing_document_snapshots_modified',false,'reviews_auto_approved',false));
END;
$migration$;