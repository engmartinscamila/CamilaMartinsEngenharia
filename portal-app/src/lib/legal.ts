export const CURRENT_TERMS_VERSION = '2026.08.12-2';
export const CURRENT_PRIVACY_VERSION = '2026.08.12-2';
export const LEGAL_EFFECTIVE_DATE = '12 de agosto de 2026';
export const PRIVACY_CONTACT_EMAIL = 'eng.martins.camila@gmail.com';

export interface LegalSection {
  title: string;
  paragraphs: string[];
}

export const privacySections: LegalSection[] = [
  {
    title: '1. Controladora e alcance',
    paragraphs: [
      'A Camila Martins Engenharia, qualificada no contrato de prestação de serviços firmado com o cliente, atua como controladora dos dados pessoais tratados para administrar a relação profissional, o Portal do Cliente e este aplicativo.',
      `Dúvidas e solicitações sobre privacidade podem ser encaminhadas pelo recurso de solicitações do aplicativo ou pelo e-mail ${PRIVACY_CONTACT_EMAIL}.`,
    ],
  },
  {
    title: '2. Dados tratados',
    paragraphs: [
      'Podem ser tratados nome, e-mail, telefone, identificação da conta, vínculos com clientes, contratos e projetos, solicitações, respostas, aprovações, notificações, compromissos, registros de acesso e segurança, plataforma e versão do aplicativo.',
      'Também podem ser tratados documentos, imagens e outras informações fornecidas pelo cliente ou disponibilizadas durante a execução dos serviços. O aplicativo não solicita dados pessoais sensíveis que não sejam necessários à finalidade contratada.',
    ],
  },
  {
    title: '3. Finalidades',
    paragraphs: [
      'Os dados são utilizados para confirmar a identidade e o vínculo autorizado; executar e acompanhar contratos e projetos; disponibilizar documentos e comunicações; organizar solicitações, aprovações e agenda; prestar suporte; prevenir fraudes e acessos indevidos; cumprir obrigações; e constituir, exercer ou defender direitos.',
      'Os dados não são utilizados para publicidade de terceiros nem vendidos.',
    ],
  },
  {
    title: '4. Bases legais',
    paragraphs: [
      'O tratamento observa a Lei Geral de Proteção de Dados Pessoais e pode se basear na execução de contrato e de procedimentos relacionados, no cumprimento de obrigação legal ou regulatória, no exercício regular de direitos e no legítimo interesse, quando aplicável e precedido da avaliação necessária.',
      'O consentimento será solicitado de modo específico quando for a base adequada. A ciência desta Política comprova sua apresentação e não transforma todas as atividades de tratamento em consentimento.',
    ],
  },
  {
    title: '5. Operadores e compartilhamento',
    paragraphs: [
      'O acesso é limitado à equipe autorizada, ao próprio titular e às pessoas vinculadas ao projeto conforme suas permissões. Fornecedores de tecnologia, armazenamento, autenticação, comunicação e suporte podem atuar como operadores somente na medida necessária à prestação do serviço e sujeitos a deveres de proteção e confidencialidade.',
      'Dados poderão ser fornecidos a autoridades ou terceiros quando houver obrigação legal, ordem válida, exercício de direitos ou necessidade de proteger o titular, a controladora ou outras pessoas, sempre nos limites aplicáveis.',
    ],
  },
  {
    title: '6. Tratamento internacional',
    paragraphs: [
      'Determinados fornecedores de infraestrutura tecnológica podem processar ou armazenar dados em outros países. Quando isso ocorrer, serão observados os requisitos da LGPD e mecanismos compatíveis de proteção, segurança e respeito aos direitos dos titulares.',
    ],
  },
  {
    title: '7. Segurança e controle de acesso',
    paragraphs: [
      'São adotadas medidas técnicas e administrativas proporcionais às atividades, incluindo autenticação individual, permissões por usuário e projeto, proteção de arquivos, registros de operações relevantes e revisão de acesso. O usuário deve manter senha e aparelho protegidos e encerrar a sessão em dispositivos que não estejam sob seu controle.',
      'Suspeitas comunicadas serão analisadas e documentadas. Se um incidente com dados pessoais for confirmado e puder causar risco ou dano relevante, serão adotadas medidas de contenção e as comunicações exigidas à Autoridade Nacional de Proteção de Dados e aos titulares afetados, conforme a legislação.',
    ],
  },
  {
    title: '8. Apuração e responsabilidade',
    paragraphs: [
      'A origem, o alcance e os efeitos de qualquer evento serão apurados com base em registros, evidências técnicas e demais elementos disponíveis. A atribuição de responsabilidade observará a legislação aplicável, a conduta de cada agente e o nexo causal entre o fato apurado e eventual dano.',
      'O relato de suspeita não implica reconhecimento automático de falha, vazamento ou responsabilidade, sem prejuízo do dever de investigar, cooperar e adotar as providências legalmente exigidas.',
    ],
  },
  {
    title: '9. Conservação e eliminação',
    paragraphs: [
      'Os dados são conservados durante a relação contratual e pelos prazos necessários a obrigações legais, regulatórias, técnicas, contábeis e de segurança, bem como ao exercício de direitos. Informações sujeitas a litígio, investigação ou obrigação de preservação poderão ser mantidas enquanto necessário.',
      'Encerrados os prazos e inexistindo fundamento para manutenção, os dados serão eliminados ou anonimizados de forma compatível com os ciclos de cópia de segurança e os requisitos técnicos aplicáveis.',
    ],
  },
  {
    title: '10. Direitos do titular',
    paragraphs: [
      'Nos casos previstos na LGPD, o titular pode solicitar confirmação e acesso, correção, informações sobre compartilhamento, anonimização, bloqueio ou eliminação, portabilidade, oposição, revogação de consentimento e revisão de decisões tomadas unicamente com base em tratamento automatizado.',
      `A solicitação pode ser aberta no aplicativo ou enviada para ${PRIVACY_CONTACT_EMAIL}. A identidade e a legitimidade do solicitante poderão ser verificadas para impedir acesso indevido. Limitações ou recusas serão justificadas quando decorrerem da lei, de direitos de terceiros ou da necessidade de preservação de provas.`,
    ],
  },
  {
    title: '11. Deveres sobre dados de terceiros',
    paragraphs: [
      'Quem enviar documentos ou dados de terceiros declara possuir autorização ou outra base legítima para fazê-lo, deve limitar o conteúdo ao necessário e responde pela exatidão e licitude das informações que fornecer. Conteúdos excessivos, ilícitos ou alheios ao projeto poderão ser restringidos ou removidos, preservadas as evidências exigidas por lei.',
    ],
  },
  {
    title: '12. Vigência e atualizações',
    paragraphs: [
      `Esta Política entra em vigor em ${LEGAL_EFFECTIVE_DATE} e deve ser interpretada conforme a LGPD, o Marco Civil da Internet e as demais normas aplicáveis. Alterações relevantes serão apresentadas no aplicativo e poderão exigir nova ciência. Esta Política não limita direitos assegurados por lei.`,
    ],
  },
];

export const termsSections: LegalSection[] = [
  {
    title: '1. Objeto e documentos aplicáveis',
    paragraphs: [
      'Estes Termos regulam o uso da área autenticada da Camila Martins Engenharia, qualificada no contrato firmado com o cliente. O aplicativo complementa o contrato de prestação de serviços e não altera sozinho escopo, preço, prazo ou responsabilidade técnica nele definidos.',
      'Em caso de conflito, prevalecem a legislação obrigatória e, nas matérias comerciais e técnicas específicas, o contrato firmado, sem afastar os direitos que não possam ser renunciados.',
    ],
  },
  {
    title: '2. Conta e acesso',
    paragraphs: [
      'Não há cadastro público. O acesso é individual, liberado pela equipe e vinculado aos clientes e projetos autorizados. O usuário deve manter seus dados atualizados, proteger a senha e o aparelho, não compartilhar a conta e comunicar imediatamente qualquer suspeita de uso indevido.',
      'Até a comunicação e a adoção das medidas de bloqueio cabíveis, ações realizadas por uma conta autenticada poderão ser vinculadas ao respectivo usuário, sem impedir a apuração de fraude, erro ou acesso indevido.',
    ],
  },
  {
    title: '3. Uso permitido e boa-fé',
    paragraphs: [
      'O aplicativo deve ser usado para acompanhar serviços, consultar informações, enviar solicitações, responder aprovações e acessar materiais relacionados ao vínculo profissional existente.',
      'É proibido tentar acessar dados de terceiros, contornar controles, explorar ou divulgar falhas, introduzir código malicioso, automatizar consultas abusivas, falsificar registros ou evidências, fornecer declaração sabidamente falsa, violar direitos autorais ou utilizar o ambiente para finalidade ilegal. A proibição não restringe reclamações ou comunicações legítimas feitas de boa-fé.',
    ],
  },
  {
    title: '4. Registros, comunicações e aprovações',
    paragraphs: [
      'Solicitações, respostas, aprovações e demais ações realizadas em conta autenticada podem integrar o histórico do projeto e produzir os efeitos previstos no contrato. O usuário deve conferir o conteúdo antes de confirmar uma ação e comunicar prontamente eventual erro.',
      'Registros do aplicativo podem ser utilizados como elementos de prova em conjunto com documentos, contratos, comunicações e evidências técnicas. Eles não tornam irrefutável uma informação nem dispensam a apuração exigida pela legislação.',
    ],
  },
  {
    title: '5. Informações e sincronização',
    paragraphs: [
      'O aplicativo apresenta informações autorizadas da relação contratual. A sincronização atualiza o conteúdo disponível, e atrasos de rede ou processamento podem adiar temporariamente sua visualização. O usuário deve comunicar divergências e, em decisões críticas, conferir o contrato, o documento assinado ou a confirmação emitida pela equipe.',
    ],
  },
  {
    title: '6. Documentos e propriedade intelectual',
    paragraphs: [
      'ART/RRT, contratos, orçamentos e documentos administrativos classificados como baixáveis podem ser obtidos pelo cliente vinculado. Projetos, desenhos, memoriais, imagens, fotografias, marcas e demais materiais técnicos ou autorais permanecem protegidos e seguem a permissão definida para cada arquivo.',
      'O acesso concede somente autorização limitada de consulta ou uso para a finalidade contratada. Não transfere autoria ou titularidade nem autoriza reprodução, edição, distribuição, cessão, exploração comercial ou uso em outro projeto sem autorização escrita. Identificação e marca d’água podem ser aplicadas aos materiais protegidos.',
    ],
  },
  {
    title: '7. Disponibilidade e alterações operacionais',
    paragraphs: [
      'A equipe adota medidas razoáveis para manter o serviço disponível, mas poderá realizar manutenções, correções e atualizações. Interrupções decorrentes de rede do usuário, aparelho, serviços de terceiros, lojas de aplicativos, caso fortuito, força maior ou medidas urgentes de segurança serão tratadas conforme sua causa e a legislação aplicável.',
      'Recursos podem ser ajustados sem reduzir direitos já constituídos nem alterar unilateralmente o contrato. Mudanças que afetem de modo relevante o uso serão comunicadas quando necessário.',
    ],
  },
  {
    title: '8. Segurança e cooperação',
    paragraphs: [
      'O usuário deve usar aparelho atualizado e protegido, evitar redes ou programas não confiáveis, encerrar a sessão quando necessário e colaborar com pedidos razoáveis de verificação. A equipe poderá bloquear preventivamente uma sessão ou solicitar troca de senha diante de indícios de comprometimento.',
      `Suspeitas devem ser comunicadas pelo aplicativo ou pelo e-mail ${PRIVACY_CONTACT_EMAIL}, com as informações disponíveis e sem alterar possíveis evidências. A comunicação será analisada e não deve ser usada para divulgar publicamente dados pessoais, credenciais ou detalhes que ampliem o risco.`,
    ],
  },
  {
    title: '9. Responsabilidade',
    paragraphs: [
      'Cada parte responde por seus próprios atos e omissões na medida prevista em lei e no contrato. A responsabilidade por eventual incidente ou dano será apurada considerando as evidências técnicas, o nexo causal, as medidas adotadas e a participação de cada agente.',
      'A Camila Martins Engenharia não responde por prejuízo causado exclusivamente por compartilhamento de senha, aparelho comprometido ou utilizado por terceiro, informação ilícita ou incorreta fornecida pelo usuário, uso contrário a estes Termos, serviço externo fora de seu controle razoável ou caso fortuito e força maior, desde que tenha cumprido os deveres que a lei lhe atribui. Esta cláusula não exclui responsabilidade que venha a ser comprovada nem limita direitos obrigatórios do consumidor ou do titular de dados.',
    ],
  },
  {
    title: '10. Suspensão e encerramento',
    paragraphs: [
      'O acesso poderá ser suspenso ou encerrado por solicitação legítima, término do vínculo, inadimplência quando prevista no contrato, determinação legal, risco à segurança ou violação destes Termos, observados os direitos aplicáveis. Medidas urgentes podem ser imediatas; nos demais casos, será dada comunicação razoável quando cabível.',
      'O encerramento do acesso não elimina obrigações anteriores, direitos autorais, deveres de confidencialidade nem registros que devam ser preservados por lei ou para exercício regular de direitos.',
    ],
  },
  {
    title: '11. Privacidade',
    paragraphs: [
      'O tratamento de dados pessoais é explicado na Política de Privacidade, que deve ser lida em conjunto com estes Termos. O aceite dos Termos e a ciência da Política são registrados separadamente, com as respectivas versões.',
    ],
  },
  {
    title: '12. Lei aplicável, vigência e alterações',
    paragraphs: [
      `Estes Termos entram em vigor em ${LEGAL_EFFECTIVE_DATE} e são regidos pela legislação brasileira, incluindo a LGPD, o Marco Civil da Internet, o Código Civil e o Código de Defesa do Consumidor quando aplicável. Eventual controvérsia será submetida ao foro competente definido pela legislação, após tentativa de solução de boa-fé quando possível.`,
      'Alterações relevantes serão informadas e uma nova versão poderá exigir novo aceite. Nenhuma disposição destes Termos representa renúncia a direito assegurado por norma obrigatória.',
    ],
  },
];
