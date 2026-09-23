-- Contrato Mestre v4 aprovado pela titular em 23/09/2026.
-- Parte 1/3: cria a nova versão INATIVA para montagem atômica e auditável.
do $migration$
declare
  v_active integer;
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

  if exists(select 1 from public.contract_master_versions where version=4) then
    raise exception 'Contrato Mestre v4 já existe; não duplicar';
  end if;

  insert into public.contract_master_versions(version,label,body,notes,active,created_by)
  values(
    4,
    'Contrato Mestre v4 - aprovado',
    $v4$CLÁUSULA 1ª – DO OBJETO
1.1. O presente contrato tem por objeto a prestação, pelo(a) CONTRATADO(A) ao(à) CONTRATANTE, de serviços técnicos de engenharia relativos ao imóvel/empreendimento identificado no Anexo I. Integram o objeto somente os serviços, etapas, entregáveis, quantidades, formatos, níveis de prestação, valores e prazos expressamente indicados no Anexo I e no orçamento comercial vinculado. O cronograma físico-financeiro completo somente integra a contratação quando constar como serviço específico no orçamento e no Anexo I.
1.2. Consideram-se incluídos no objeto apenas os itens expressamente contratados. Qualquer serviço, projeto complementar, prancha adicional, detalhamento extra, compatibilização, visita, protocolo, aprovação, execução, fornecimento ou outra atividade não indicada no Anexo I será considerado SERVIÇO ADICIONAL e dependerá de orçamento prévio e aditivo ou aceite escrito antes de sua execução.
1.3. Os projetos e documentos serão entregues nos formatos especificados no Anexo I. O fornecimento de arquivo editável, arquivo-fonte, modelo, banco de dados ou outro formato não previsto no escopo dependerá de contratação expressa.
1.4. Quando o Anexo I incluir legalização, aprovação, regularização, obtenção de alvará, habite-se ou documento equivalente perante órgão público, o acompanhamento técnico e administrativo limitar-se-á às etapas expressamente contratadas. Taxas, emolumentos, certidões, despesas de terceiros e exigências supervenientes fora do escopo permanecem a cargo do(a) CONTRATANTE, salvo previsão diversa no orçamento.
1.5. Os serviços técnicos do catálogo poderão ser contratados nos níveis BRONZE, PRATA ou OURO, quando o nível for aplicável à natureza da atividade e estiver habilitado no catálogo vigente. Cada atividade poderá possuir nível próprio, inclusive em uma mesma contratação. O nível escolhido qualifica exclusivamente a prestação daquela atividade e não altera automaticamente o escopo de outra.
1.5.1. BRONZE: corresponde à prestação essencial da atividade contratada, limitada ao núcleo técnico e aos entregáveis expressamente previstos no Anexo I. Não inclui automaticamente recursos adicionais, formatos, visitas, aprovações ou produtos pertencentes a outro nível ou a outra atividade.
1.5.2. PRATA: inclui o conteúdo aplicável do BRONZE e os acréscimos de aprofundamento, apresentação, detalhamento ou suporte expressamente definidos para a atividade no Anexo I. Recursos visuais, plantas humanizadas, imagens estáticas ou outros produtos somente serão incluídos quando compatíveis com o serviço e descritos no respectivo escopo.
1.5.3. OURO: inclui o conteúdo aplicável dos níveis anteriores e os recursos avançados de aprofundamento, apresentação, detalhamento ou suporte expressamente definidos para a atividade no Anexo I. Vídeo, tour virtual, curadoria, visitas, aprovações, acompanhamento ou outros recursos não serão presumidos quando não forem compatíveis ou não estiverem discriminados.
1.6. O(A) CONTRATANTE declara ter recebido ou ter acesso, antes da assinatura, ao orçamento e ao Anexo I contendo os serviços selecionados, o nível de cada atividade, os entregáveis, exclusões, valores e demais condições específicas. Catálogos, guias ou materiais explicativos disponibilizados têm função informativa e não ampliam o escopo além do que foi efetivamente contratado.
1.7. A contratação avulsa corresponde à seleção independente de uma atividade e não afasta a possibilidade de escolha de nível. A escolha de BRONZE, PRATA ou OURO para um serviço não inclui automaticamente outro projeto, execução, gerenciamento, visita, levantamento, taxa, protocolo, aprovação, fornecimento ou atividade complementar.
1.8. A entrega realizada em conformidade com o nível e o escopo contratados não será considerada parcial ou incompleta apenas por não contemplar recursos pertencentes a nível superior ou a serviço não contratado.
1.9. A migração para nível superior será tratada como alteração de escopo e dependerá de orçamento e aceite prévios. Redução de nível após o início dependerá de acordo escrito e somente poderá repercutir sobre atividades ainda não executadas, preservados os valores correspondentes aos serviços já prestados ou comprovadamente mobilizados.
CLÁUSULA 2ª – DO PRAZO DE EXECUÇÃO
2.1. Cada atividade deverá possuir prazo ou marco de entrega definido no Anexo I. Quando não houver prazo específico para uma etapa de projeto, poderá ser adotado o prazo geral de referência de 45 (quarenta e cinco) dias úteis, contado da assinatura e do recebimento integral dos insumos necessários, o que ocorrer por último. Esse prazo geral não se aplica automaticamente a consultorias, vistorias, laudos, legalizações, serviços personalizados ou demais atividades de natureza distinta.
2.2. A contagem do prazo da etapa afetada ficará suspensa enquanto houver impedimento decorrente de atraso do(a) CONTRATANTE no fornecimento de documentos, informações, medidas, aprovações ou definições necessárias, de alteração de escopo ou de caso fortuito/força maior. Sempre que viável, o impedimento e seu impacto serão comunicados por escrito, e o cronograma será retomado após a regularização.
2.3. Solicitações de alteração de escopo, informações pendentes, suspensões e reprogramações relevantes deverão ser formalizadas pelos canais oficiais.
CLÁUSULA 3ª – DOS DOCUMENTOS E INFORMAÇÕES COMPLEMENTARES (BRIEFINGS)
3.1. O(A) CONTRATADO(A) poderá encaminhar questionários, briefings e listas de definição necessários ao desenvolvimento das etapas.
3.2. O(A) CONTRATANTE terá até 5 (cinco) dias úteis do recebimento para preencher e devolver cada documento complementar, salvo prazo diverso indicado no próprio documento ou no Anexo I.
3.3. Findo o prazo sem devolução, poderá ser enviado lembrete formal, concedendo novo prazo de 5 (cinco) dias úteis.
3.4. Persistindo a ausência de resposta, o(a) CONTRATADO(A) poderá suspender a etapa dependente. Somente poderão ser adotadas especificações técnicas padrão quando isso for tecnicamente seguro, reversível e não envolver decisão estrutural, legal, funcional ou de segurança que dependa de manifestação do(a) CONTRATANTE.
3.5. Alterações em definições já respondidas e incorporadas ao serviço serão tratadas conforme a Cláusula 6ª e poderão caracterizar alteração de escopo.
3.6. Atrasos na devolução de informações necessárias poderão repercutir no cronograma da etapa correspondente.
CLÁUSULA 4ª – DO LEVANTAMENTO, DAS INFORMAÇÕES E DOS MATERIAIS FORNECIDOS
4.1. O serviço será desenvolvido com base nos documentos, medidas, levantamentos, arquivos e dados técnicos fornecidos pelo(a) CONTRATANTE ou por terceiros por ele indicados, sem prejuízo do dever profissional de apontar inconsistências que sejam razoavelmente perceptíveis dentro do escopo contratado.
4.2. Vistoria técnica, levantamento de medidas, ensaio, inspeção especializada ou investigação adicional realizada pelo(a) CONTRATADO(A), quando não incluída no Anexo I, dependerá de orçamento prévio.
4.3. O(A) CONTRATADO(A) não responderá por consequências decorrentes de informações incorretas, incompletas, desatualizadas, ocultas ou materialmente divergentes fornecidas pelo(a) CONTRATANTE ou por terceiros, quando a inconsistência não puder ser razoavelmente identificada dentro do escopo e dos meios de verificação contratados. Se a inconsistência for identificada, deverá ser comunicada e o impacto técnico será avaliado antes da continuidade.
4.4. O(A) CONTRATANTE deverá informar, quando relevante à segurança ou à confiabilidade do serviço, a origem de plantas, croquis, layouts, cálculos, especificações, imagens, modelos, memoriais e demais documentos técnicos fornecidos para análise.
4.5. Materiais produzidos por software, plataforma digital, ferramenta automática ou Inteligência Artificial e fornecidos pelo(a) CONTRATANTE serão tratados como referência preliminar quando tecnicamente cabível. A origem automatizada não confere, por si só, validade técnica, conformidade normativa ou responsabilidade profissional.
4.6. O(A) CONTRATADO(A) não é obrigado(a) a reproduzir, copiar, assinar, emitir ART, validar ou assumir responsabilidade técnica sobre material de terceiro ou gerado automaticamente sem análise técnica compatível e sem que essa atividade esteja abrangida pelo escopo contratado e pelas atribuições profissionais aplicáveis.
4.7. O(A) CONTRATADO(A) poderá rejeitar ou exigir revisão de solução incompatível com normas técnicas, segurança, legislação, condições reais do imóvel/terreno, atribuições profissionais ou boas práticas de engenharia, apresentando justificativa técnica quando necessário.
4.8. Alterações realizadas posteriormente pelo(a) CONTRATANTE, por terceiro ou por ferramenta automatizada em documento técnico originalmente elaborado pelo(a) CONTRATADO(A) não serão automaticamente atribuídas à sua responsabilidade. Esta regra não exclui a responsabilidade legal por erro ou omissão efetivamente imputável ao próprio(a) CONTRATADO(A).
CLÁUSULA 5ª – DO VALOR E DAS CONDIÇÕES DE PAGAMENTO
5.1. Pela prestação dos serviços descritos no Anexo I, o(a) CONTRATANTE pagará ao(à) CONTRATADO(A) o valor total ali detalhado, conforme parcelas e etapas nele previstas.
5.2. Os pagamentos serão realizados nas datas, valores e condições pactuados. A quitação da parcela ocorrerá após a confirmação do respectivo pagamento.
5.3. Concluída a etapa ou atingido o marco de cobrança previsto, o(a) CONTRATADO(A) realizará a entrega formal e emitirá a cobrança. Na ausência de vencimento específico no Anexo I, o(a) CONTRATANTE terá até 30 (trinta) dias corridos da entrega/notificação para efetuar o pagamento correspondente.
5.3.1. O decurso do prazo de manifestação sobre a entrega não suspende nem elimina obrigação de pagamento regularmente vencida, sem prejuízo do direito de apontar inconsistências técnicas e solicitar correções nos termos deste contrato.
5.4. Em caso de atraso no pagamento, incidirão multa moratória de 2% (dois por cento) sobre a parcela vencida, juros simples de 1% (um por cento) ao mês calculados proporcionalmente aos dias de atraso e atualização monetária pelo INPC/IBGE, ou índice oficial que o substitua, desde o vencimento, observadas as limitações legais aplicáveis. A suspensão de serviços seguirá o item 12.1.
5.5. Os valores pactuados não incluem taxas, emolumentos, tarifas ou despesas cobradas por órgãos públicos, cartórios, concessionárias ou entidades de classe, inclusive taxa de ART, salvo quando o orçamento ou o Anexo I indicar expressamente sua inclusão no preço.
5.6. Nos serviços de legalização, aprovação, regularização, protocolo ou acompanhamento perante órgãos públicos, as taxas e custas de terceiros serão de responsabilidade do(a) CONTRATANTE, salvo previsão expressa em contrário.
CLÁUSULA 6ª – DAS REVISÕES, CORREÇÕES E ALTERAÇÕES DE ESCOPO
6.1. O Anexo I deverá indicar, por atividade, as revisões, visitas e formatos incluídos. BRONZE, PRATA ou OURO não geram, isoladamente, quantidade automática de revisões. A correção de erro, omissão ou vício técnico imputável ao(à) CONTRATADO(A) não consome rodada de preferência nem depende de contratação adicional.
6.2. Constituem serviços adicionais, quando não decorrentes de correção de falha do(a) CONTRATADO(A), as revisões excedentes, alterações de programa, metragem, layout, partido, materiais, premissas ou definições já aprovadas, mudanças após aceite de etapa e adequações decorrentes de informações incorretas ou incompletas fornecidas pelo(a) CONTRATANTE.
6.2.1. Adequações exigidas diretamente por órgão público no processo de legalização contratado integrarão o serviço apenas quando estiverem dentro do objeto originalmente contratado e não decorrerem de alteração de escopo, fato novo, exigência superveniente fora da contratação ou informação incorreta/incompleta fornecida pelo(a) CONTRATANTE.
6.3. Pedidos de ajustes de preferência deverão ser encaminhados por escrito, preferencialmente de forma consolidada, em até 10 (dez) dias corridos da entrega da etapa. O silêncio poderá ser utilizado para continuidade de prazos e cobrança quando isso estiver previsto no fluxo de aceite, mas não impede a correção de vícios técnicos ou o exercício de direitos legalmente assegurados.
6.4. Serviços adicionais e revisões extraordinárias somente serão iniciados após definição de preço, prazo e aceite escrito.
6.5. Ao final de cada etapa principal, o(a) CONTRATADO(A) poderá encaminhar Termo de Aceite de Etapa para registro do recebimento, das observações e das condições de continuidade.
CLÁUSULA 7ª – DOS EFEITOS DE ATRASOS, RETRABALHO E DESCUMPRIMENTO DE PRAZOS
7.1. A falta de informações, documentos, aprovações ou definições necessários à continuidade de uma etapa poderá suspender a contagem do prazo dessa etapa, mediante comunicação que identifique a pendência e, quando possível, seu impacto. Se houver necessidade de remobilização ou trabalho adicional, deverá ser apresentado orçamento prévio, sem cobrança automática pelo silêncio.
7.2. Alterações de escopo ou premissas após aprovação somente poderão gerar cobrança adicional se houver orçamento prévio aprovado por escrito. O orçamento poderá adotar hora técnica, preço fechado, percentual da etapa ou outro critério objetivo previamente informado, não se aplicando automaticamente valor ou percentual que não esteja no documento aprovado.
7.3. Alterações sucessivas de escopo poderão ensejar revisão do cronograma remanescente e aditivo com novos valores e prazos.
7.4. Em caso de atraso na entrega de uma etapa por culpa exclusiva do(a) CONTRATADO(A), não amparado por suspensão ou força maior comprovadas e superior a 10 (dez) dias corridos além do prazo pactuado para a etapa, será aplicado desconto de 1% (um por cento) do valor da etapa em atraso para cada período completo de 5 (cinco) dias corridos adicionais, limitado a 10% (dez por cento) do valor dessa etapa, sem afastar direitos legais por eventual inadimplemento ou vício do serviço.
7.5. O desconto do item 7.4 deverá constar de memória de cálculo e será compensado na cobrança da etapa ou restituído se já houver pagamento, sem duplicidade.$v4$,
    'Aprovado pela titular em 23/09/2026. Texto cliente sem metadados internos. Ativação somente após montagem integral e validações.',
    false,
    null
  );

  insert into public.audit_log(user_id,action,entity_type,details)
  values(null,'prepare_contract_master_v4_approved_part1','contract_master_versions',
    jsonb_build_object('source_version',3,'target_version',4,'active',false,'owner_approved',true));
end
$migration$;
