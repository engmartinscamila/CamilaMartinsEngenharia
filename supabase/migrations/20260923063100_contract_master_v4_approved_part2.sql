-- Contrato Mestre v4 aprovado pela titular em 23/09/2026.
-- Parte 2/3: acrescenta cláusulas 8 a 17 mantendo a v4 INATIVA.
do $migration$
declare
  v_active integer;
  v_v4_active boolean;
begin
  select version into v_active
  from public.contract_master_versions
  where active=true
  order by version desc
  limit 1
  for update;

  if v_active is distinct from 3 then
    raise exception 'Contrato Mestre ativo diferente da v3 esperada; parte 2 cancelada';
  end if;

  select active into v_v4_active from public.contract_master_versions where version=4 for update;
  if not found or v_v4_active then
    raise exception 'Contrato Mestre v4 não está no estado intermediário esperado';
  end if;

  update public.contract_master_versions
  set body = body || E'\n' || $v4$CLÁUSULA 8ª – DO CARÁTER ILUSTRATIVO DE IMAGENS E RENDERS 3D
8.1. Imagens, renders, maquetes, perspectivas e simulações visuais têm caráter ilustrativo e não constituem garantia de reprodução exata de cores, texturas, brilho, iluminação, sombreamento ou aparência final de materiais e acabamentos.
8.2. Ajustes de leiaute, dimensões ou disposição decorrentes de condições reais não identificáveis previamente, compatibilizações necessárias ou tolerâncias construtivas poderão exigir revisão do material. Esta previsão não afasta o dever de corrigir erro técnico efetivamente imputável ao(à) CONTRATADO(A).
CLÁUSULA 9ª – DAS ALTERAÇÕES NO LOCAL E DO PROJETO AS BUILT
9.1. Alterações físicas executadas no imóvel em desacordo ou em divergência com o projeto tornam eventual atualização as built um serviço adicional, salvo se a atualização já estiver incluída no Anexo I.
9.2. O(A) CONTRATADO(A) não é responsável por manter o projeto atualizado em relação a alterações realizadas sem sua ciência e sem contratação de revisão correspondente.
9.3. O levantamento e a elaboração do as built seguirão o escopo e os prazos contratados e poderão exigir nova vistoria.
CLÁUSULA 10ª – DAS OBRIGAÇÕES E DA RESPONSABILIDADE TÉCNICA DO(A) CONTRATADO(A)
10.1. Executar os serviços com zelo, diligência e observância das normas técnicas, da legislação aplicável, das condições reais conhecidas e das atribuições profissionais pertinentes.
10.2. Registrar a(s) ART(s) correspondente(s) aos serviços técnicos efetivamente assumidos, quando legalmente exigível, observando o Sistema Confea/Crea, o escopo contratado e as atribuições profissionais. A taxa de ART seguirá a responsabilidade financeira definida no orçamento ou no Anexo I.
10.3. Entregar os documentos técnicos com as informações necessárias ao escopo contratado e dentro do nível de detalhamento expressamente definido.
10.4. Manter o(a) CONTRATANTE informado(a) sobre fatos relevantes e cumprir os prazos e marcos, ressalvadas as hipóteses de suspensão, alteração de escopo e eventos não imputáveis ao(à) CONTRATADO(A).
10.5. Responsabilizar-se tecnicamente pelos serviços que efetivamente elaborar, revisar, aprovar ou executar sob sua responsabilidade, não assumindo automaticamente responsabilidade por serviços de terceiros fora da supervisão ou do escopo contratado.
10.6. Quando o(a) CONTRATADO(A) assumir a execução de obra ou serviço cuja natureza atraia responsabilidade legal específica por solidez e segurança, essa responsabilidade observará os limites e prazos previstos na legislação aplicável. A presente cláusula não amplia responsabilidade técnica para serviços que não tenham sido efetivamente contratados e assumidos.
CLÁUSULA 11ª – DAS OBRIGAÇÕES DO(A) CONTRATANTE
11.1. Fornecer em tempo hábil informações, documentos, levantamentos, medidas, autorizações e definições necessárias, indicando a origem de materiais técnicos relevantes quando solicitado.
11.2. Efetuar os pagamentos nas datas e condições pactuadas.
11.3. Analisar e se manifestar sobre os materiais entregues nos prazos estabelecidos, consolidando solicitações quando possível.
11.4. Utilizar os documentos técnicos dentro da finalidade, do imóvel e das condições contratadas. O direito de uso definitivo do entregável observará a quitação dos valores correspondentes, sem impedir que o(a) CONTRATANTE mantenha cópias necessárias à comprovação da relação contratual ou ao exercício de seus direitos.
11.5. Comunicar por escrito qualquer alteração de escopo e formalizar o respectivo aditivo quando necessário.
11.6. Comunicar alterações físicas ou técnicas executadas no imóvel que possam impactar documentos elaborados pelo(a) CONTRATADO(A).
11.7. Em serviços perante órgãos públicos, fornecer tempestivamente documentos e informações exigidos e assinar requerimentos ou autorizações que dependam do(a) CONTRATANTE.
CLÁUSULA 12ª – DA SUSPENSÃO DOS SERVIÇOS POR INADIMPLÊNCIA
12.1. O(A) CONTRATADO(A) poderá suspender a execução e/ou entrega de novas etapas em caso de atraso de pagamento superior a 15 (quinze) dias, mediante notificação, preservadas as obrigações já vencidas e os direitos legalmente assegurados às partes.
CLÁUSULA 13ª – DA PROPRIEDADE INTELECTUAL E DO DIREITO DE USO
13.1. Os direitos autorais sobre projetos, desenhos, memoriais e demais criações técnicas protegíveis permanecem com seus respectivos autores. Após a quitação dos valores correspondentes, o(a) CONTRATANTE recebe licença de uso não exclusiva, limitada ao imóvel, empreendimento e finalidade contratados, salvo cessão expressa em sentido diverso.
13.2. A reutilização do projeto em outro imóvel, a comercialização, a reprodução para finalidade diversa ou a atribuição ao(à) CONTRATADO(A) de versão modificada por terceiro dependem de autorização quando exigida pela legislação ou pelo contrato. Alterações realizadas por terceiros não integram automaticamente a responsabilidade técnica do autor original, salvo posterior análise e assunção formal.
13.3. Quando houver divulgação pública do projeto original pelo(a) CONTRATANTE, serão preservados os créditos de autoria na medida aplicável, sem prejuízo de eventual autorização específica de imagem ou divulgação.
13.4. Utilização não autorizada que viole direitos de autor poderá sujeitar o responsável às medidas legais cabíveis, sem prejuízo dos direitos do(a) CONTRATANTE decorrentes da finalidade contratada.
CLÁUSULA 14ª – DA CONFIDENCIALIDADE E PROTEÇÃO DE DADOS
14.1. As partes manterão sigilo sobre informações técnicas e comerciais confidenciais trocadas em razão do contrato durante sua vigência e por 2 (dois) anos após o término. Segredos não divulgados legitimamente permanecem protegidos enquanto conservarem essa natureza. Dados pessoais serão tratados segundo as bases legais, finalidades e prazos aplicáveis, independentemente do prazo de sigilo comercial.
14.1.1. Recomendações, avaliações ou depoimentos públicos não constituem quebra de sigilo desde que não revelem dados pessoais de terceiros, valores pactuados ou detalhes técnicos sigilosos sem autorização.
14.2. Os dados pessoais necessários à execução contratual, atendimento, emissão de documentos, obrigações profissionais, fiscais, legais e exercício regular de direitos serão tratados apenas na medida necessária às respectivas finalidades.
14.3. O(A) CONTRATANTE poderá exercer os direitos previstos na legislação de proteção de dados pelos canais oficiais, observadas as hipóteses legais de conservação e restrição.
14.4. Poderão ser utilizados provedores de tecnologia, armazenamento, assinatura, comunicação ou processamento necessários à execução do serviço, desde que sujeitos a medidas adequadas de segurança e ao tratamento compatível com a finalidade contratual. Dados sigilosos não deverão ser compartilhados com ferramenta de terceiros sem necessidade, base jurídica ou proteção adequada.
14.5. Ao celebrar este contrato, o(a) CONTRATANTE declara ciência e concordância com a criação de cadastro individual no Portal do Cliente, quando necessário à execução da contratação. O cadastro poderá utilizar dados mínimos de identificação, contato, autenticação, vínculo com projeto e contrato, bem como outros dados estritamente necessários à prestação dos serviços. O tratamento relacionado à execução do contrato observará a Lei nº 13.709/2018 (LGPD), inclusive a hipótese do art. 7º, V, sem prejuízo de outras bases legais aplicáveis.
14.6. O Portal do Cliente poderá ser utilizado para disponibilização e organização de documentos e informações da contratação, inclusive contrato, orçamento, Anexo I, ART, projetos, documentos técnicos, imagens, cronogramas publicados, solicitações, comunicações, avisos, arquivos autorizados, registros de aceite e demais itens vinculados ao projeto. O portal também poderá ser utilizado para solicitação e agendamento de reuniões e para outras interações diretamente relacionadas à execução do contrato.
14.7. O acesso do(a) CONTRATANTE ao Portal do Cliente é pessoal, vinculado à relação contratual e de duração limitada. Encerrado o contrato e concluídas as providências de fechamento, o acesso poderá ser desativado e os dados operacionais que deixarem de ser necessários serão eliminados, bloqueados ou anonimizados conforme a finalidade e os limites técnicos aplicáveis. A desativação do portal não obriga a eliminação de documentos ou registros cuja conservação seja necessária ao cumprimento de obrigação legal ou regulatória, à responsabilidade profissional, a deveres fiscais ou contábeis ou ao exercício regular de direitos, observados os arts. 15 e 16 da LGPD.
14.8. Sempre que possível, antes da desativação definitiva do acesso, o(a) CONTRATANTE poderá obter cópia dos documentos finais disponibilizados no portal. A indisponibilidade futura do acesso não altera a validade, a autoria, a integridade nem o histórico dos documentos e registros que tenham sido legitimamente produzidos durante a vigência contratual.
CLÁUSULA 15ª – DO DIREITO DE ARREPENDIMENTO
15.1. Quando aplicável o Código de Defesa do Consumidor e a contratação ocorrer fora do estabelecimento comercial, o direito de arrependimento poderá ser exercido no prazo legal de 7 (sete) dias corridos.
15.2. O exercício do arrependimento deverá ser comunicado por escrito, e a restituição dos valores seguirá a legislação aplicável.
15.3. Quando aplicável o direito legal de arrependimento do consumidor, seu exercício não implicará multa ou cobrança incompatível com o art. 49 do CDC. Situações que não caracterizem exercício desse direito serão regidas pelas demais cláusulas, observada a legislação aplicável.
15.4. Superado o prazo legal sem manifestação, aplicam-se as regras de rescisão contratual.
CLÁUSULA 16ª – DA RESCISÃO
16.1. O contrato poderá ser encerrado por mútuo acordo escrito na data ajustada entre as partes. A comunicação de intenção de rescisão unilateral sem justa causa observará aviso prévio de 15 (quinze) dias corridos, salvo acordo de prazo diverso ou hipótese legal de resolução imediata, sem restringir direito de arrependimento ou outros direitos legais.
16.2. Na rescisão unilateral sem justa causa por iniciativa do(a) CONTRATANTE, fora do prazo legal de arrependimento e sem inadimplemento imputável ao(à) CONTRATADO(A), serão devidos: (a) os valores correspondentes aos serviços, etapas e atividades efetivamente executados ou iniciados até a data do encerramento, apurados conforme o escopo contratado; (b) as despesas de terceiros previamente aprovadas e comprovadamente não recuperáveis, quando existentes e desde que não representem cobrança em duplicidade; e (c) multa compensatória equivalente a 25% (vinte e cinco por cento) sobre o saldo financeiro correspondente aos serviços ainda não executados. A multa tem por finalidade compensar desmobilização, reserva de agenda e capacidade técnica, planejamento, custos administrativos e perda de oportunidade decorrentes da ruptura antecipada do vínculo.
16.2.1. A multa do item 16.2 incidirá somente sobre o saldo dos serviços não executados, não sobre o valor total do contrato, e não substituirá o pagamento dos serviços já efetivamente prestados. A aplicação da penalidade observará os arts. 412 e 413 do Código Civil, inclusive quanto ao limite da obrigação principal e à possibilidade de redução equitativa se houver cumprimento parcial relevante ou se, diante das circunstâncias concretas, o montante se revelar manifestamente excessivo.
16.2.2. A incidência da multa pressupõe rescisão imotivada por iniciativa do(a) CONTRATANTE. Não será aplicada quando a resolução decorrer de inadimplemento relevante do(a) CONTRATADO(A), de exercício válido do direito legal de arrependimento ou de outra hipótese legal que afaste a penalidade.
16.3. Na rescisão unilateral sem justa causa por iniciativa do(a) CONTRATADO(A), os valores pagos por serviços não executados serão restituídos, descontados somente os serviços efetivamente prestados e comprovados, sem prejuízo dos demais direitos legalmente aplicáveis ao(à) CONTRATANTE.
16.4. Na rescisão por inadimplemento contratual comprovado, poderá incidir multa compensatória de até 10% (dez por cento) sobre o valor da obrigação inadimplida, observadas proporcionalidade, redução legal e vedação de duplicidade pelo mesmo fato. Eventual indenização adicional dependerá de fundamento jurídico e comprovação do prejuízo.
16.5. Não constitui atraso imputável ao(à) CONTRATADO(A) o período em que o cronograma estiver validamente suspenso por fato atribuível ao(à) CONTRATANTE, a terceiro, a órgão público ou a evento de força maior.
CLÁUSULA 17ª – DOS LIMITES DE RESPONSABILIDADE
17.1. O(A) CONTRATADO(A) não responde por erro de execução de terceiro fora de sua supervisão contratada, alteração não autorizada, informação incorreta cuja inconsistência não fosse razoavelmente detectável dentro do escopo, evento de força maior, decisão de órgão público ou condição comercial de fornecedor sobre a qual não tenha controle.
17.2. A responsabilidade técnica do(a) CONTRATADO(A) limita-se às atividades efetivamente elaboradas, analisadas, aprovadas, executadas ou formalmente assumidas dentro de suas atribuições e do escopo contratado.
17.3. Nenhuma disposição deste contrato exclui ou reduz responsabilidade legal do(a) CONTRATADO(A) por erro, culpa, vício, omissão ou obrigação que lhe seja efetivamente imputável, nem afasta direitos irrenunciáveis do consumidor quando aplicáveis.$v4$
  where version=4 and active=false;

  if not found then
    raise exception 'Contrato Mestre v4 intermediário não encontrado';
  end if;

  insert into public.audit_log(user_id,action,entity_type,details)
  values(null,'prepare_contract_master_v4_approved_part2','contract_master_versions',
    jsonb_build_object('source_version',3,'target_version',4,'active',false,'owner_approved',true));
end
$migration$;
