-- Contrato Mestre v2. Os números marcados como provisórios foram encontrados no
-- Contrato_Prestacao_Servicos_Engenharia_atualizado_v2.docx arquivado pela titular.
-- Respeita CDC 49/51, CC 413, CPC 63 (Lei 14.879/2024) e LGPD 15/16.
-- Versão v1 e documentos emitidos são preservados. Revisões NÃO são aprovadas.
DO $migration$
DECLARE
  v_old public.contract_master_versions%rowtype;
  v_body text;
  v_version integer;
  v_id uuid;
  v_changed text[];
  v_unresolved integer;
BEGIN
  SELECT * INTO v_old FROM public.contract_master_versions WHERE active=true ORDER BY version DESC LIMIT 1 FOR UPDATE;
  IF v_old.version <> 1 THEN RAISE EXCEPTION 'Contrato Mestre mudou; abortar migração e revisar diferenças'; END IF;
  v_body := v_old.body;
  -- Prazo de resposta, tolerância, descontos, sigilo e rescisão já sugeridos no DOCX original.
  v_body := replace(v_body,'[5 (cinco)]','5 (cinco)');
  v_body := replace(v_body,'[3 (três)]','3 (três)');
  v_body := replace(v_body,'[10 (dez)]','10 (dez)');
  v_body := replace(v_body,'[1%]','1% (um por cento)');
  v_body := replace(v_body,'[5]','5 (cinco)');
  v_body := replace(v_body,'[10%]','10% (dez por cento)');
  v_body := replace(v_body,'[2 (dois)]','2 (dois)');
  v_body := replace(v_body,'[15 (quinze)]','15 (quinze)');

  -- Evitar prometer imagens em projetos técnicos onde render e tour não têm pertinência.
  v_body := replace(v_body,
    '1.5.2. PRATA (Visual): inclui os conteúdos do nível BRONZE, acrescidos de plantas humanizadas e renderização 3D em imagens estáticas.',
    '1.5.2. PRATA (Visual): nos projetos arquitetônicos e de interiores em que tais recursos são tecnicamente aplicáveis, inclui os conteúdos do nível BRONZE, acrescidos de plantas humanizadas e renderização 3D em imagens estáticas, nos ambientes e quantidades descritos no Anexo I. Em outros projetos técnicos, os recursos visuais somente integrarão o escopo se expressamente descritos no Anexo I.');
  v_body := replace(v_body,
    '1.5.3. OURO (Imersivo): inclui os conteúdos dos níveis anteriores, acrescidos de renderização 3D em vídeo, tour virtual 360° e curadoria integral dos catálogos de materiais, mobiliário e acabamentos.',
    '1.5.3. OURO (Imersivo): nos projetos arquitetônicos e de interiores tecnicamente compatíveis, inclui os conteúdos dos níveis anteriores e os recursos de renderização 3D em vídeo, tour virtual 360° e curadoria dos catálogos de materiais, mobiliário e acabamentos, nos limites, ambientes e quantidades definidos no Anexo I. Não acrescenta serviços complementares, aprovação, execução, taxas ou formatos não contratados.');

  -- Definir o índice antes da contratação, sem referência a instrumento inexistente.
  v_body := replace(v_body,
    '5.4. Em caso de atraso no pagamento, incidirão multa moratória de 2%, juros de 1% ao mês pro rata die e correção monetária pelo índice indicado no instrumento definitivo, sem prejuízo da suspensão dos serviços.',
    '5.4. Em caso de atraso no pagamento, incidirão multa moratória de 2% (dois por cento) sobre a parcela vencida, juros simples de 1% (um por cento) ao mês calculados proporcionalmente aos dias de atraso e atualização monetária pelo INPC/IBGE, ou índice oficial que o substitua, desde o vencimento, observadas as limitações legais aplicáveis. A suspensão de serviços seguirá o procedimento de notificação e prazo do item 12.1.');

  -- A cobrança por atraso do cliente não pode depender de preço futuro indeterminado.
  v_body := replace(v_body,
    '7.1. O atraso do(a) CONTRATANTE no fornecimento de informações, documentos, medidas, aprovações ou definições, quando ultrapassar 10 (dez) dias corridos da solicitação formal, poderá sujeitá-lo à compensação financeira indicada no instrumento definitivo, sem prejuízo da suspensão dos prazos.',
    '7.1. A falta de informações, documentos, aprovações ou definições necessários à continuidade de uma etapa poderá suspender exclusivamente a contagem do prazo dessa etapa, mediante comunicação escrita que identifique a pendência e seu impacto. Transcorridos 10 (dez) dias corridos após o vencimento do prazo de resposta aplicável, poderá ser proposta remobilização ou serviço adicional, com preço, justificativa e novo cronograma apresentados previamente e sujeitos à aprovação expressa do(a) CONTRATANTE. Não haverá cobrança automática pelo silêncio nem penalidade de valor indefinido.');

  -- Compensação transparente por atraso imputável exclusivamente ao profissional.
  v_body := replace(v_body,
    '7.4. Em caso de atraso por culpa exclusiva do(a) CONTRATADO(A), superior a 10 (dez) dias além do prazo pactuado, poderá ser concedido desconto de 1% (um por cento) sobre a etapa em atraso a cada 5 (cinco) dias adicionais, limitado a 10% (dez por cento) do valor total do contrato, sem limitação de direitos legais.',
    '7.4. Em caso de atraso na entrega de uma etapa por culpa exclusiva do(a) CONTRATADO(A), não amparado por suspensão ou força maior comprovadas e superior a 10 (dez) dias corridos além do prazo pactuado para essa etapa, será aplicado desconto de 1% (um por cento) do valor da etapa em atraso para cada período completo de 5 (cinco) dias corridos adicionais, limitado a 10% (dez por cento) do valor dessa etapa. O desconto será discriminado na cobrança ou restituído se já houver pagamento, sem afastar direitos legais por eventual inadimplemento ou vício do serviço.');
  v_body := replace(v_body,
    '7.5. Os valores desta cláusula seguem o prazo de cobrança do item 5.3 e serão comunicados por escrito com memória de cálculo.',
    '7.5. Serviços adicionais exigem orçamento prévio e aprovação escrita; eventuais cobranças seguem o prazo contratual aplicável. O desconto do item 7.4 deverá constar de memória de cálculo e será compensado na cobrança da etapa ou restituído em até 30 (trinta) dias corridos após apuração, sem duplicidade.');

  -- Regra de revisões somente para projeto; direito de sanar vícios técnicos permanece.
  v_body := replace(v_body,
    '6.1. Estão incluídas as rodadas de revisão/correção especificadas no Anexo I ou, na ausência de indicação, até 2 (duas) rodadas, destinadas a ajustes dentro do escopo original.',
    '6.1. Nos serviços de projeto, incluem-se as rodadas de ajustes de preferência dentro do escopo original previstas no Anexo I ou, se não especificadas, até 2 (duas) rodadas por etapa. Para consultorias, vistorias, laudos, legalizações e outros serviços não projetuais, quantidades e formatos de revisão somente se aplicam quando expressamente contratados. A correção de erros ou vícios técnicos imputáveis ao(à) CONTRATADO(A) não consome rodadas de preferência nem depende de contratação adicional, respeitados os direitos legais.');

  -- Prazo de confidencialidade comercial não equivale a prazo de conservação LGPD.
  v_body := replace(v_body,
    '14.1. As partes manterão sigilo sobre informações técnicas, comerciais e pessoais trocadas em razão do contrato pelo prazo de 2 (dois) anos após seu término.',
    '14.1. As partes manterão sigilo sobre informações técnicas e comerciais confidenciais trocadas em razão do contrato durante sua vigência e por 2 (dois) anos após o término. Segredos não divulgados legitimamente permanecem protegidos enquanto conservarem essa natureza. Dados pessoais serão protegidos e conservados ou eliminados conforme bases legais, finalidade e prazos exigidos pela LGPD e demais obrigações legais, independentemente do prazo de sigilo comercial.');

  -- Não cobrar serviços ao consumidor por exercer o direito legal de arrependimento.
  v_body := replace(v_body,
    '15.3. Se os serviços já tiverem sido iniciados a pedido expresso do(a) CONTRATANTE dentro do prazo de reflexão, será devido o pagamento proporcional aos serviços efetivamente prestados.',
    '15.3. Quando aplicável o direito legal de arrependimento do consumidor, seu exercício não implicará multa ou cobrança proporcional pelos serviços iniciados no período de reflexão; os valores pagos serão restituídos na forma do art. 49 do CDC. Situações que não constituam exercício desse direito serão regidas pelas demais cláusulas, observada a legislação aplicável.');

  -- Distrato consensual não necessita aviso prévio compulsório; 15 dias nas comunicações imotivadas.
  v_body := replace(v_body,
    '16.1. O contrato poderá ser rescindido por mútuo acordo mediante aviso prévio por escrito de 15 (quinze) dias.',
    '16.1. O contrato poderá ser encerrado por mútuo acordo escrito na data ajustada entre as partes. A comunicação de intenção de rescisão unilateral sem justa causa observará aviso prévio de 15 (quinze) dias corridos, salvo acordo de prazo diverso ou hipótese legal de resolução imediata, sem restringir direito de arrependimento ou outros direitos legais.');
  v_body := replace(v_body,
    '16.2. Na rescisão sem justa causa por iniciativa do(a) CONTRATANTE, serão devidos os valores proporcionais aos serviços executados e eventual multa de 10% (dez por cento) sobre o saldo remanescente, nos termos do instrumento definitivo.',
    '16.2. Na rescisão unilateral sem justa causa por iniciativa do(a) CONTRATANTE, fora do prazo legal de arrependimento, serão devidos os valores proporcionais aos serviços comprovadamente executados, com abatimento de valores já pagos. Poderá incidir compensação de até 10% (dez por cento) sobre o saldo dos serviços não executados, conforme custos comprovados e impacto efetivo, sem cumulação de penalidades pelo mesmo fato e observadas a proporcionalidade, a possibilidade de redução equitativa e as normas de proteção do consumidor.');
  v_body := replace(v_body,
    '16.3. Na rescisão sem justa causa por iniciativa do(a) CONTRATADO(A), o(a) CONTRATANTE terá direito à devolução dos valores referentes às etapas não iniciadas ou não concluídas, sem prejuízo do pagamento das etapas concluídas.',
    '16.3. Na rescisão unilateral sem justa causa por iniciativa do(a) CONTRATADO(A), os valores pagos por serviços não executados serão restituídos ao(à) CONTRATANTE, descontados somente os serviços efetivamente prestados e comprovados, sem prejuízo de eventual compensação de até 10% (dez por cento) sobre o valor não executado quando cabível, proporcional ao impacto e sem afastar direitos legais. O cronograma de restituição será registrado por escrito.');
  v_body := replace(v_body,
    '16.4. Em caso de rescisão por inadimplemento, a parte infratora arcará com multa equivalente a 10% do valor total do contrato, sem prejuízo de perdas e danos comprovados.',
    '16.4. Na rescisão por inadimplemento contratual comprovado, poderá incidir multa compensatória de até 10% (dez por cento) sobre o valor da obrigação inadimplida, observadas proporcionalidade e possibilidade de redução legal. É vedada a cobrança cumulativa de multas pelo mesmo fato; eventual indenização adicional dependerá de fundamento legal, comprovação do prejuízo e ausência de duplicidade.');

  -- Foro legal competente em vez de inventar cidade; CDC e CPC prevalecem.
  v_body := replace(v_body,
    '23.1. Fica eleito o foro da Comarca de [cidade/UF] para dirimir dúvidas ou controvérsias oriundas deste contrato, sem prejuízo do direito do consumidor ao foro de seu domicílio quando aplicável.',
    '23.1. Eventuais controvérsias serão submetidas ao foro competente segundo a legislação processual aplicável, preservado o direito do(a) CONTRATANTE consumidor(a) ao foro de seu domicílio quando cabível. Eventual eleição expressa de foro em instrumento específico somente será válida quando guardar pertinência com o domicílio ou residência de uma das partes ou com o local da obrigação, e, em relações de consumo, quando favorável ao consumidor.');

  IF position('instrumento definitivo' IN v_body)>0 THEN RAISE EXCEPTION 'Persistiu remissão a condições não definidas'; END IF;
  IF position('cobrança automática pelo silêncio' IN v_body)=0 OR position('foro competente' IN v_body)=0 THEN RAISE EXCEPTION 'Substituições essenciais não ocorreram'; END IF;
  SELECT count(*) INTO v_unresolved FROM regexp_matches(v_body,'\[[^]]+\]','g') AS m;
  IF v_unresolved<>0 THEN RAISE EXCEPTION 'Contrato v2 ainda possui % campos provisórios',v_unresolved; END IF;
  IF array_length(public.document_changed_clause_refs(v_old.body,v_body),1) IS NULL THEN RAISE EXCEPTION 'Nenhuma cláusula alterada'; END IF;
  v_changed := public.document_changed_clause_refs(v_old.body,v_body);
  SELECT coalesce(max(version),0)+1 INTO v_version FROM public.contract_master_versions;
  UPDATE public.contract_master_versions SET active=false WHERE id=v_old.id;
  INSERT INTO public.contract_master_versions(version,label,body,notes,active,created_by)
    VALUES(v_version,'Contrato Mestre v'||v_version||' - condições revisadas',v_body,
      'Edição autorizada pela titular em 21/09/2026. Fonte: contrato v2 anteriormente arquivado e legislação brasileira. Revisões de coerência permanecem pendentes até homologação.',true,NULL)
    RETURNING id INTO v_id;
  INSERT INTO public.document_rule_reviews(contract_master_version,source_type,source_code,clause_refs,reason)
    SELECT v_version,'service',s.code,s.contract_clause_refs,'Versão contratual alterada: conferir serviço e cláusulas correspondentes.'
    FROM public.service_catalog s WHERE s.active AND s.contract_clause_refs && v_changed
    ON CONFLICT (contract_master_version,source_type,source_code) DO NOTHING;
  INSERT INTO public.document_rule_reviews(contract_master_version,source_type,source_code,clause_refs,reason)
    SELECT v_version,'level',l.code,l.contract_clause_refs,'Versão contratual alterada: conferir entregáveis e limites do nível.'
    FROM public.service_level_catalog l WHERE l.active AND l.contract_clause_refs && v_changed
    ON CONFLICT (contract_master_version,source_type,source_code) DO NOTHING;
  INSERT INTO public.document_rule_reviews(contract_master_version,source_type,source_code,clause_refs,reason)
    SELECT v_version,'text',t.code,t.contract_clause_refs,'Versão contratual alterada: conferir o texto inteligente.'
    FROM public.document_text_catalog t WHERE t.active AND t.contract_clause_refs && v_changed
    ON CONFLICT (contract_master_version,source_type,source_code) DO NOTHING;
  UPDATE public.service_catalog SET last_contract_master_version=v_version
    WHERE active AND NOT (contract_clause_refs && v_changed);
  UPDATE public.service_level_catalog SET last_contract_master_version=v_version
    WHERE active AND NOT (contract_clause_refs && v_changed);
  UPDATE public.document_text_catalog SET last_contract_master_version=v_version
    WHERE active AND NOT (contract_clause_refs && v_changed);
  INSERT INTO public.audit_log(user_id,action,entity_type,entity_id,details)
    VALUES(NULL,'publish_contract_master_authorized_revision','contract_master_versions',v_id,
      jsonb_build_object('source_version',v_old.version,'new_version',v_version,'changed_clause_refs',v_changed,
      'actor_context','authorized conversation, no authenticated browser session','revisions_auto_approved',false));
END;
$migration$;