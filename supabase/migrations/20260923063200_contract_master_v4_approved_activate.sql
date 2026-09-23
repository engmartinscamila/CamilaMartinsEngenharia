-- Contrato Mestre v4 aprovado pela titular em 23/09/2026.
-- Parte 3/3: conclui o texto, alinha o catálogo e ativa a v4 preservando v1-v3.
do $migration$
declare
  v_active integer;
  v_body text;
  v_clause_count integer;
  v_placeholder_count integer;
begin
  select version into v_active
  from public.contract_master_versions
  where active=true
  order by version desc
  limit 1
  for update;

  if v_active is distinct from 3 then
    raise exception 'Contrato Mestre ativo diferente da v3 esperada; ativação da v4 cancelada';
  end if;

  update public.contract_master_versions
  set body = body || E'\n' || $v4$CLÁUSULA 18ª – DA COOBRIGAÇÃO, DO CÔNJUGE/COMPANHEIRO E DA PESSOA JURÍDICA
18.1. Havendo mais de uma pessoa identificada e signatária como CONTRATANTE ou COOBRIGADO(A) SOLIDÁRIO(A), cada uma responderá pela integralidade das obrigações assumidas neste instrumento, inclusive pagamento, sem prejuízo do direito de regresso entre os coobrigados. A solidariedade decorre da vontade expressa das partes, na forma dos arts. 264 e 265 do Código Civil.
18.2. Quando o(a) CONTRATANTE pessoa física for casado(a) ou mantiver união estável e o serviço tiver por objeto imóvel de titularidade comum, residência familiar, bem integrante do patrimônio comum ou contratação em benefício direto de ambos, o estado civil, o regime de bens e a identificação do cônjuge ou companheiro(a) deverão ser informados. Para reduzir incertezas de cobrança e responsabilidade, o(a) CONTRATADO(A) poderá exigir, antes da ordem de início, que o cônjuge ou companheiro(a) assine este instrumento como INTERVENIENTE ANUENTE E COOBRIGADO(A) SOLIDÁRIO(A).
18.3. A assinatura do cônjuge ou companheiro(a) como coobrigado(a) gera responsabilidade solidária contratual nos termos do art. 265 do Código Civil. A ausência de assinatura não cria, por este contrato, solidariedade automática além das hipóteses em que a própria lei a estabeleça. Permanecem ressalvadas, quando efetivamente aplicáveis ao caso concreto, as regras dos arts. 1.643 e 1.644 do Código Civil sobre obrigações contraídas para necessidades da economia doméstica e em benefício da entidade familiar.
18.4. Quando o(a) CONTRATANTE for pessoa jurídica, a devedora principal será a própria pessoa jurídica, cujo patrimônio não se confunde com o de seus sócios ou administradores, nos termos do art. 49-A do Código Civil. Na sociedade limitada, a responsabilidade ordinária dos sócios observa o art. 1.052 do Código Civil. Portanto, a mera condição de sócio majoritário, minoritário ou administrador não cria responsabilidade pessoal automática pelas obrigações deste contrato.
18.5. Se a contratação exigir garantia pessoal adicional, o(s) sócio(s), administrador(es) ou outra(s) pessoa(s) indicada(s) deverá(ão) ser identificado(s) e assinar, em nome próprio, como COOBRIGADO(S) SOLIDÁRIO(S). Uma vez assinada a coobrigação, cada signatário responderá perante o(a) CONTRATADO(A) pela integralidade da obrigação garantida, conforme os arts. 264 e 265 do Código Civil, independentemente do percentual de participação societária, preservado eventual direito de regresso entre os coobrigados.
18.6. Quando a assinatura do cônjuge, companheiro(a), sócio, administrador ou outro coobrigado tiver sido definida como condição de segurança da contratação antes da ordem de início, a ausência dessa assinatura autoriza o(a) CONTRATADO(A) a postergar o início dos serviços até a formalização da coobrigação ou de outra garantia expressamente aceita, sem que o período de espera seja considerado atraso do(a) CONTRATADO(A).
CLÁUSULA 19ª – DA FORÇA MAIOR
19.1. Nenhuma parte responderá por descumprimento decorrente de caso fortuito ou força maior, nos termos da legislação civil aplicável.
19.2. A parte impossibilitada deverá comunicar a outra por escrito em prazo razoável, preferencialmente em até 5 (cinco) dias corridos do conhecimento do evento, descrevendo sua natureza e o impacto estimado quando possível.
19.3. Cessada a causa impeditiva, os prazos serão retomados e reprogramados de modo proporcional ao impacto comprovado.
CLÁUSULA 20ª – DAS NOTIFICAÇÕES E COMUNICAÇÕES OFICIAIS
20.1. São canais oficiais os e-mails e telefones/WhatsApp indicados pelas partes, o Portal do Cliente e o e-mail profissional do(a) CONTRATADO(A).
20.1.1. Comunicações, entregas, solicitações, agendamentos, disponibilizações de documentos e registros de aceite realizados pelo Portal do Cliente constituirão registros eletrônicos do fluxo contratual e poderão comprovar data, hora, conteúdo, versão e manifestação realizada, sem prejuízo da possibilidade de prova em contrário em caso de erro, fraude, comprometimento de credenciais ou indisponibilidade técnica comprovada.
20.2. Notificações enviadas pelos canais oficiais serão consideradas válidas quando houver registro de envio, ressalvada falha técnica comprovada, mensagem devolvida ou outra circunstância que demonstre ausência de disponibilização ao destinatário.
20.3. Alterações dos canais de contato deverão ser comunicadas por escrito.
20.4. O(A) CONTRATANTE reconhece o Portal do Cliente como canal oficial para o acompanhamento da contratação e concorda que, conforme as funcionalidades disponibilizadas, poderá receber e consultar documentos, projetos, ART, imagens, cronogramas, solicitações e comunicados; solicitar ou confirmar reuniões; e realizar manifestações de ciência, aprovação ou aceite.
20.5. O acesso ao portal será realizado por conta individual e autenticada. O(A) CONTRATANTE deverá manter suas credenciais sob sua guarda e comunicar prontamente eventual perda, compartilhamento indevido ou suspeita de comprometimento. Enquanto não houver comunicação de comprometimento, os atos realizados em sessão autenticada poderão ser atribuídos à conta correspondente, sem prejuízo da análise de evidências técnicas em caso de contestação.
20.6. Para os atos privados entre as partes que não dependam de forma especial exigida por lei, autoridade pública ou entidade profissional, o acionamento consciente de comandos como “ACEITAR”, “APROVAR”, “CONCORDO”, “AUTORIZAR” ou equivalentes, após a disponibilização do respectivo conteúdo ao usuário autenticado, constituirá manifestação eletrônica expressa de vontade e produzirá os efeitos contratuais próprios do ato realizado. As partes admitem esse mecanismo como meio de comprovação de autoria e integridade de documentos e manifestações eletrônicas, nos termos do art. 10, § 2º, da Medida Provisória nº 2.200-2/2001 e do art. 107 do Código Civil.
20.7. Para fins de rastreabilidade, o sistema poderá registrar, conforme o tipo de evento, identificador da conta autenticada, cliente e projeto vinculados, documento e respectiva versão, hash ou snapshot do conteúdo, decisão tomada, origem do evento, contexto técnico do cliente e data e hora do aceite. Esses registros poderão integrar a comprovação do histórico contratual e documental.
20.8. O mecanismo de aceite eletrônico poderá ser utilizado, entre outros atos compatíveis, para Termo de Aceite de Etapa, aprovação de entrega ou conclusão de serviço, autorização de uso de imagem, confirmação de encerramento ou quitação específica e outros documentos expressamente disponibilizados para essa finalidade. Eventual revogação posterior, quando juridicamente cabível, produzirá efeitos conforme a natureza do ato e a legislação aplicável, mas não apagará nem tornará inexistente o registro histórico de uma manifestação validamente realizada.
20.9. O aceite realizado no portal não será apresentado como assinatura eletrônica qualificada ICP-Brasil quando não utilizar certificado qualificado e não substituirá assinatura qualificada, reconhecimento, autenticação ou formalidade específica quando exigidos por lei, órgão público, Prefeitura, Sistema Confea/Crea ou outro destinatário. Nessas hipóteses será utilizado o nível de assinatura ou formalidade exigido para o documento específico.
CLÁUSULA 21ª – DISPOSIÇÕES GERAIS, VERSIONAMENTO E ASSINATURA
21.1. Este contrato, o Anexo I, o orçamento comercial vinculado e os aditivos posteriores constituem o conjunto documental da contratação, cada qual com a função definida neste instrumento.
21.2. Toda comunicação relevante deverá ser feita por escrito nos canais oficiais, podendo servir como meio de prova conforme seu conteúdo e rastreabilidade.
21.3. A tolerância quanto a eventual descumprimento não implica novação ou renúncia de direitos.
21.4. Alterações deste contrato ou do escopo somente serão válidas quando formalizadas por escrito pelas partes, inclusive por meio eletrônico admitido pela legislação e pelo fluxo contratual.
21.5. Em caso de conflito documental, o aditivo posterior prevalecerá sobre os documentos anteriores naquilo que alterar expressamente. Para escopo, quantidades, nível, entregáveis, preço e prazo específicos, prevalecerá o Anexo I e o respectivo orçamento vinculado; para condições jurídicas gerais, prevalecerá o Contrato Mestre, sem interpretação que amplie automaticamente o objeto contratado.
21.6. As partes poderão utilizar assinatura física, assinatura eletrônica ou manifestação eletrônica de vontade pelo Portal do Cliente, conforme a natureza do ato e os requisitos legais aplicáveis. Quando a lei, órgão público, entidade de classe ou destinatário exigir assinatura qualificada, certificado digital, reconhecimento ou outra formalidade específica, deverá ser adotado o nível exigido, não sendo o aceite simples do portal suficiente para substituí-lo.
21.7. Cada documento emitido permanecerá vinculado à versão do Contrato Mestre, do catálogo de serviços, do nível e do escopo vigente no momento de sua emissão. Atualizações futuras não alterarão retroativamente documentos históricos.
CLÁUSULA 22ª – DA MEDIAÇÃO PRÉVIA
22.1. Antes da via judicial, as partes envidarão esforços razoáveis para negociação direta ou mediação extrajudicial, sem prejuízo do acesso à tutela jurisdicional e de medidas urgentes quando cabíveis.
CLÁUSULA 23ª – DO FORO
23.1. Eventuais controvérsias serão submetidas ao foro competente segundo a legislação processual aplicável, preservado o direito do(a) CONTRATANTE consumidor(a) ao foro de seu domicílio quando cabível. Eventual eleição expressa de foro em instrumento específico somente será válida quando legalmente admissível e não reduzir proteção obrigatória do consumidor.$v4$
  where version=4 and active=false;

  if not found then
    raise exception 'Contrato Mestre v4 intermediário não encontrado';
  end if;

  select body into v_body from public.contract_master_versions where version=4 for update;
  select count(*) into v_clause_count from regexp_matches(v_body,'CLÁUSULA [0-9]+ª','g');
  select count(*) into v_placeholder_count from regexp_matches(v_body,'\[[^]]+\]','g');

  if v_clause_count <> 23 then
    raise exception 'Contrato Mestre v4 incompleto: esperadas 23 cláusulas, encontradas %',v_clause_count;
  end if;
  if v_placeholder_count <> 0 then
    raise exception 'Contrato Mestre v4 contém % placeholder(s) interno(s)',v_placeholder_count;
  end if;
  if length(v_body) < 35000 then
    raise exception 'Contrato Mestre v4 menor que o texto aprovado: % caracteres',length(v_body);
  end if;
  if position('25% (vinte e cinco por cento)' in v_body)=0
     or position('Portal do Cliente' in v_body)=0
     or position('COOBRIGADO(A) SOLIDÁRIO(A)' in v_body)=0
     or position('Inteligência Artificial' in v_body)=0
     or position('BRONZE, PRATA ou OURO' in v_body)=0 then
    raise exception 'Contrato Mestre v4 não contém todos os blocos aprovados';
  end if;

  -- Vínculos contratuais dos serviços acrescentados ao catálogo.
  update public.service_catalog
  set contract_clause_refs = case code
    when 't' then array['1.1','1.2','4.1','6.1','7.2','10.1']
    when 'u' then array['4.1','4.2','4.3','10.1']
    when 'v' then array['1.2','2.1','6.1','7.2','10.1']
    when 'w' then array['1.1','1.3','6.1','10.3','13.1']
    when 'x' then array['1.1','1.2','4.1','10.1']
    when 'y' then array['1.1','1.2','5.1','7.2','10.1']
    when 'z' then array['1.1','2.1','4.1','10.1']
    when 'aa' then array['4.1','4.2','4.3','10.1']
    when 'ab' then array['4.1','4.2','4.3','10.1']
    when 'ac' then array['1.1','4.1','4.2','10.1','20.1']
    when 'ad' then array['1.2','2.1','10.1','10.5','17.1']
    when 'ae' then array['1.2','2.1','10.1','10.5','17.1']
    when 'af' then array['1.1','2.1','10.1','10.2','10.6','17.1']
    when 'ag' then array['1.1','4.1','9.1','9.2','9.3']
    when 'ah' then array['1.2','1.7','2.1','4.1','6.1']
    when 'ai' then array['1.2','1.7','2.1','4.1','6.1']
    when 'aj' then array['1.2','1.7','2.1','4.1','6.1']
    when 'ak' then array['1.1','2.1','4.1','10.3']
    when 'al' then array['1.2','1.7','2.1','4.1','6.1']
    else contract_clause_refs
  end,
  last_contract_master_version=4,
  updated_at=now()
  where active=true;

  update public.service_level_catalog
  set last_contract_master_version=4,updated_at=now()
  where active=true;

  update public.document_text_catalog
  set last_contract_master_version=4,updated_at=now()
  where active=true;

  -- A v4 foi aprovada expressamente pela titular; revisões antigas da v3 são
  -- preservadas como histórico, mas não são transportadas para a v4.
  update public.contract_master_versions set active=false where active=true;
  update public.contract_master_versions
  set active=true,
      effective_at=now(),
      notes='Contrato Mestre v4 aprovado expressamente pela titular em 23/09/2026. Inclui Portal do Cliente, aceites eletrônicos, rescisão de 25% sobre saldo não executado, coobrigação expressa, materiais/IA, LGPD, propriedade intelectual, assinaturas e versionamento. Documento cliente sem metadados internos.'
  where version=4;

  insert into public.audit_log(user_id,action,entity_type,details)
  values(null,'activate_contract_master_v4_owner_approved','contract_master_versions',
    jsonb_build_object(
      'source_version',3,
      'new_version',4,
      'owner_approved',true,
      'approval_date','2026-09-23',
      'historical_versions_modified',false,
      'client_internal_metadata_removed',true,
      'portal_clause',true,
      'electronic_acceptance_clause',true,
      'termination_penalty_percent',25,
      'coobligation_clause',true,
      'ai_materials_clause',true
    ));
end
$migration$;
