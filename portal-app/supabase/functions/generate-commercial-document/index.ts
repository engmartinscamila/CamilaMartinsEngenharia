import { createClient } from 'supabase';
import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } });

async function requireAdmin(req: Request) {
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) throw new Error('Sessão administrativa ausente.');
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) throw new Error('Configuração segura ausente.');
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) throw new Error('Sessão administrativa inválida.');
  const { data: isAdmin, error: adminError } = await caller.rpc('is_portal_admin');
  if (adminError || isAdmin !== true) throw new Error('Acesso administrativo necessário.');
  return { caller, service: createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }), user: userData.user };
}

type CommercialRecord = {
  id: string; quote_number: string; contract_number: string | null; status: string; prospect_name: string;
  cpf_cnpj: string | null; email: string | null; phone: string | null; cep: string | null; address: string | null;
  city: string | null; state: string | null; property_address: string | null; property_type: string | null;
  area_terreno_m2: number | null; area_construida_m2: number | null; construction_standard: string | null;
  experience_level: string | null; services: unknown; custom_service: string | null; total_value: number | null;
  payment_terms: unknown; valid_until: string | null; notes: string | null; quote_document_id: string | null; contract_document_id: string | null;
};

const p = (text: string, bold = false) => new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text, bold, font: 'Century Gothic', size: 20 })] });
const h = (text: string) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 220, after: 100 }, children: [new TextRun({ text, bold: true, font: 'Century Gothic', size: 22 })] });
const title = (text: string, subtitle?: string) => [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text, bold: true, font: 'Century Gothic', size: 28 })] }), ...(subtitle ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 220 }, children: [new TextRun({ text: subtitle, font: 'Century Gothic', size: 18 })] })] : [])];
const doc = (children: Paragraph[]) => new Document({ sections: [{ properties: {}, children }] });
const text = (value: unknown, fallback = '_______________________________________________') => typeof value === 'string' && value.trim() ? value.trim() : fallback;
const money = (value: number | null) => value === null ? '__________________' : new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
const datePt = (raw: string | null) => raw ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${raw}T12:00:00-03:00`)) : '_____/_____/________';
const services = (record: CommercialRecord) => Array.isArray(record.services) ? record.services.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object')) : [];

function quoteDocument(record: CommercialRecord) {
  const selected = services(record).filter((item) => item.included !== false);
  return doc([
    ...title(`PROPOSTA COMERCIAL — ${record.quote_number}`, 'Serviços de Engenharia / Arquitetura'),
    p('Camila Martins Engenharia Civil', true),
    p('Preparada para: ' + record.prospect_name),
    p('Imóvel/obra: ' + text(record.property_address)),
    p(`Data da proposta: ${new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date())}   |   Validade: até ${datePt(record.valid_until)}`),
    p('Documento de caráter comercial. Ao ser aceita, esta proposta dará origem ao Contrato de Prestação de Serviços e ao Anexo I, que passam a reger a relação entre as partes.'),
    h('1. APRESENTAÇÃO'),
    p('Agradecemos o interesse em nossos serviços. Esta proposta comercial detalha o escopo, os prazos, o investimento e as condições de pagamento para a prestação de serviços técnicos de engenharia/arquitetura referentes ao imóvel identificado abaixo, com base nas informações fornecidas até a presente data.'),
    p('O conteúdo deste documento é espelhado, em sua versão contratual definitiva, pelo Anexo I do contrato — em caso de divergência após a assinatura, prevalece o Anexo I.'),
    h('2. DADOS DO CLIENTE E DO IMÓVEL'),
    p(`Cliente: ${record.prospect_name}`), p(`CPF/CNPJ: ${text(record.cpf_cnpj)}`), p(`E-mail: ${text(record.email)}   |   Telefone: ${text(record.phone)}`),
    p(`Endereço do imóvel/obra: ${text(record.property_address)}`), p(`Tipo de imóvel: ${text(record.property_type)}`),
    p(`Área do terreno (m²): ${record.area_terreno_m2 ?? '________'}   |   Área construída prevista (m²): ${record.area_construida_m2 ?? '________'}`),
    p(`Padrão construtivo: ${text(record.construction_standard)}   |   Experiência: ${text(record.experience_level)}`),
    h('3. ESCOPO DE SERVIÇOS PROPOSTO'),
    p('Serviços não assinalados não integram o escopo e, se solicitados posteriormente, serão tratados como serviço adicional, com orçamento próprio.'),
    ...(selected.length ? selected.map((item) => p(`☒ ${String(item.name ?? item.serviceName ?? 'Serviço')}${item.notes ? ` — ${String(item.notes)}` : ''}`)) : [p('Nenhum serviço selecionado — revisar antes do envio.')]),
    ...(record.custom_service ? [p(`☒ Outro: ${record.custom_service}`)] : []),
    h('4. O QUE NÃO ESTÁ INCLUÍDO NESTA PROPOSTA'),
    p('Não integram esta proposta, podendo ser orçados separadamente caso desejados: mobiliário sob medida, projeto luminotécnico especial, projeto de automação predial, obtenção de financiamento, taxas e emolumentos de órgãos públicos e cartórios, custo de ART/RRT, e entrega de arquivos em formato editável (DWG/IFC/RVT), salvo indicação expressa em contrário.'),
    h('5. FORMATO E CONDIÇÕES DE ENTREGA'), p('Formato padrão de entrega: PDF.'), p('Rodadas de revisão incluídas por etapa: 2 (duas), salvo indicação diversa nesta proposta/Anexo I.'), p('Meio de comunicação oficial: e-mail / WhatsApp indicados no contrato e Portal do Cliente após a contratação.'), p('Prazo de manifestação por etapa: 10 (dez) dias corridos após a entrega.'),
    h('6. INVESTIMENTO'), p('Os valores abaixo referem-se exclusivamente aos honorários técnicos, não incluindo taxas, emolumentos, ART/RRT e demais despesas de órgãos públicos ou cartórios, de responsabilidade do(a) cliente.'),
    ...selected.map((item) => p(`${String(item.name ?? 'Serviço')}: R$ ${item.value ? money(Number(item.value)) : '__________________'}`)),
    p(`VALOR TOTAL DOS HONORÁRIOS: R$ ${money(record.total_value)}`, true),
    h('6.1 Forma de pagamento'), p('1 (entrada) | Assinatura do contrato | R$ __________ | Na assinatura'), p('2 | __________________ | R$ __________ | __________________'), p('3 | __________________ | R$ __________ | __________________'), p('4 | __________________ | R$ __________ | __________________'),
    h('7. PRAZO ESTIMADO'), p('O prazo médio para elaboração e entrega dos serviços listados é de 45 (quarenta e cinco) dias úteis, contados a partir da assinatura do contrato e do recebimento de todas as informações necessárias, podendo variar conforme a complexidade e a quantidade de serviços efetivamente contratados. O detalhamento por etapa constará do Anexo I.'),
    h('8. SERVIÇOS ADICIONAIS'), p('Solicitações fora do escopo original dependerão de orçamento prévio aprovado por escrito. Revisões excedentes seguem a tabela de honorários vigente; alteração de escopo/premissas já aprovadas poderá ser cobrada por hora técnica ou por percentual da etapa afetada; vistoria/levantamento não incluído será objeto de orçamento próprio.'),
    h('9. PRÓXIMOS PASSOS'), p('• Aprovação desta proposta pelo(a) cliente, por escrito.'), p('• Formalização do Contrato de Prestação de Serviços de Engenharia e do respectivo Anexo I.'), p('• Pagamento da parcela de entrada e agendamento do levantamento técnico/vistoria, quando aplicável.'), p('• Início dos trabalhos com o envio do briefing inicial.'),
    h('10. VALIDADE E ACEITE DA PROPOSTA'), p('Esta proposta é válida por 15 (quinze) dias corridos a contar da data de emissão. Após esse prazo, os valores e condições poderão ser revistos.'), p('Local e data: _______________________________, _____/_____/________'), p('_______________________________________________'), p('Camila Martins Engenharia Civil — proponente'), p('_______________________________________________'), p('Aceite do(a) cliente'),
  ]);
}

const contractClauses = [
  'CLÁUSULA 1ª – DO OBJETO',
  '1.1. O presente contrato tem por objeto a prestação, pelo(a) CONTRATADO(A) ao(à) CONTRATANTE, de serviços técnicos de engenharia relativos ao imóvel/empreendimento identificado no Anexo I, compreendendo os projetos, serviços, etapas, entregáveis, formato de entrega e valores integralmente descritos no Anexo I (Escopo de Serviços, Proposta Comercial e Cronograma), parte integrante e indissociável deste instrumento, o qual prevalece como fonte única e definitiva para a delimitação do escopo contratado.',
  '1.2. Consideram-se incluídos no objeto apenas os itens expressamente descritos no Anexo I. Qualquer serviço, projeto complementar, prancha adicional, detalhamento extra ou compatibilização não listada no Anexo I será considerado SERVIÇO ADICIONAL, sujeito a orçamento e cobrança à parte, mediante aditivo contratual prévio.',
  '1.3. Os projetos serão entregues no(s) formato(s) especificado(s) no Anexo I. O fornecimento de arquivos em formato editável não previsto no Anexo I será considerado SERVIÇO ADICIONAL, sujeito a orçamento e cobrança à parte.',
  '1.4. Quando o Anexo I incluir serviços de legalização, aprovação, regularização e/ou obtenção de Alvará de Construção, Habite-se ou documentos equivalentes perante órgãos públicos, o acompanhamento técnico e administrativo do respectivo processo integra o objeto contratado, sem prejuízo das taxas e despesas do órgão público, que permanecem de responsabilidade exclusiva do(a) CONTRATANTE.',
  '1.5. Os serviços de projeto poderão ser contratados nos níveis BRONZE (Essencial), PRATA (Visual) ou OURO (Imersivo), prevalecendo o Anexo I como fonte única do escopo, das quantidades e das condições efetivamente contratadas.',
  '1.5.1. BRONZE (Essencial): documentação técnica objetiva do projeto, sem plantas humanizadas, renderização 3D, vídeo ou tour virtual.',
  '1.5.2. PRATA (Visual): inclui os conteúdos do nível BRONZE, acrescidos de plantas humanizadas e renderização 3D em imagens estáticas.',
  '1.5.3. OURO (Imersivo): inclui os conteúdos dos níveis anteriores, acrescidos de renderização 3D em vídeo, tour virtual 360° e curadoria integral dos catálogos de materiais, mobiliário e acabamentos disponibilizados pelo(a) CONTRATADO(A).',
  '1.6. O(A) CONTRATANTE declara ter recebido e analisado o Catálogo de Serviços previamente à assinatura deste contrato, estando ciente das características e exclusões do nível escolhido.',
  '1.7. Os níveis de experiência aplicam-se exclusivamente aos serviços de projeto. Execução de obra, gerenciamento, visitas técnicas, projetos complementares, levantamentos, taxas e aprovações somente integrarão o objeto se expressamente descritos no Anexo I.',
  '1.8. A entrega realizada em conformidade com o nível de experiência e o escopo efetivamente contratados no Anexo I não será considerada parcial ou incompleta por não contemplar recursos de nível superior não contratado.',
  '1.9. Migração para nível de experiência superior será tratada como alteração de escopo, sujeita a orçamento prévio e aditivo contratual. Downgrade após o início dos trabalhos depende de concordância do(a) CONTRATADO(A) e não gera reembolso pelos serviços já executados ou em execução.',
  'CLÁUSULA 2ª – DO PRAZO DE EXECUÇÃO',
  '2.1. O prazo para elaboração e entrega dos projetos é de 45 (quarenta e cinco) dias úteis, podendo ser ajustado no Anexo I conforme a complexidade e os serviços efetivamente contratados, contado da assinatura deste instrumento e do recebimento de todas as informações necessárias, o que ocorrer por último.',
  '2.2. O prazo ficará automaticamente suspenso em caso de atraso do(a) CONTRATANTE no fornecimento de informações, documentos, medidas, aprovações ou definições; alteração de escopo após o início; ou caso fortuito/força maior. O prazo será retomado após a regularização, acrescido, se necessário, de prazo proporcional ao impacto.',
  '2.3. Solicitações de alteração de escopo, informação pendente ou suspensão deverão ser formalizadas por escrito nos canais oficiais.',
  'CLÁUSULA 3ª – DOS DOCUMENTOS E INFORMAÇÕES COMPLEMENTARES (BRIEFINGS)',
  '3.1. O(A) CONTRATADO(A) poderá encaminhar questionários, briefings e listas de definição indispensáveis ao desenvolvimento de determinadas etapas ou projetos complementares.',
  '3.2. O(A) CONTRATANTE terá até 5 (cinco) dias úteis do recebimento para preencher e devolver cada documento complementar.',
  '3.3. Findo o prazo sem devolução, será enviado lembrete formal, com novo prazo de 5 (cinco) dias úteis.',
  '3.4. Persistindo a ausência de resposta, o(a) CONTRATADO(A) poderá comunicar sua intenção de adotar especificações técnicas padrão e/ou suspender a etapa dependente, concedendo prazo adicional de 3 (três) dias úteis para manifestação em contrário.',
  '3.5. Alterações em definições já respondidas e incorporadas ao projeto serão tratadas como alteração de escopo.',
  '3.6. Atrasos na devolução de documentos complementares equivalem a atraso no fornecimento de informações necessárias à continuidade dos trabalhos.',
  'CLÁUSULA 4ª – DO LEVANTAMENTO TÉCNICO E DA VISTORIA PRÉVIA',
  '4.1. O projeto será desenvolvido com base nas medidas, plantas, levantamentos e dados técnicos fornecidos pelo(a) CONTRATANTE ou por profissional/empresa por ele(a) indicado(a), presumindo-se sua exatidão.',
  '4.2. Vistoria técnica e/ou levantamento de medidas realizado pelo(a) CONTRATADO(A), quando não incluído no Anexo I, será cobrado à parte mediante orçamento prévio aprovado por escrito.',
  '4.3. Divergências entre a realidade física do imóvel e os dados fornecidos pelo(a) CONTRATANTE ou terceiro não geram responsabilidade ao(à) CONTRATADO(A); ajustes decorrentes serão tratados como serviço adicional.',
  'CLÁUSULA 5ª – DO VALOR E DAS CONDIÇÕES DE PAGAMENTO',
  '5.1. Pela prestação dos serviços descritos no Anexo I, o(a) CONTRATANTE pagará ao(à) CONTRATADO(A) o valor total ali detalhado, conforme parcelas e etapas nele previstas.',
  '5.2. Os pagamentos serão realizados nas datas e condições pactuadas pelos meios informados pelo(a) CONTRATADO(A), sendo o comprovante suficiente para quitação da respectiva parcela.',
  '5.3. Concluída cada etapa ou correção/ajuste solicitado, o(a) CONTRATADO(A) fará a entrega formal e emitirá a cobrança. O(A) CONTRATANTE terá até 30 (trinta) dias corridos da entrega/notificação para efetuar o pagamento correspondente.',
  '5.3.1. O decurso do prazo de 30 dias sem manifestação não suspende nem exime a obrigação de pagamento, sem prejuízo do direito de solicitar ajustes técnicos nos termos da Cláusula 6ª.',
  '5.4. Em caso de atraso no pagamento, incidirão multa moratória de 2%, juros de 1% ao mês pro rata die e correção monetária pelo índice indicado no Anexo I/condições comerciais, sem prejuízo da suspensão dos serviços.',
  '5.5. Os valores pactuados não incluem taxas, emolumentos, tarifas ou despesas cobradas por órgãos públicos, cartórios, concessionárias ou entidades de classe, inclusive ART/RRT, que são de responsabilidade exclusiva do(a) CONTRATANTE.',
  '5.6. Em serviços de legalização, aprovação, regularização, protocolo ou acompanhamento perante órgãos públicos, todas as taxas, emolumentos e custas são de responsabilidade exclusiva do(a) CONTRATANTE.',
  'CLÁUSULA 6ª – DAS REVISÕES E CORREÇÕES DO PROJETO',
  '6.1. Estão incluídas as rodadas de revisão/correção especificadas no Anexo I ou, na ausência de indicação, até 2 (duas) rodadas, destinadas a ajustes dentro do escopo original.',
  '6.2. São serviços adicionais as revisões excedentes, alterações de programa, metragem, layout, partido ou premissas já aprovadas, mudanças após aprovação formal de etapa e adequações decorrentes de informações incorretas ou incompletas fornecidas pelo(a) CONTRATANTE.',
  '6.2.1. Adequações exigidas diretamente por órgão público no processo de legalização contratado integram o serviço, exceto quando decorrentes de alteração de escopo ou de informações incorretas/incompletas fornecidas pelo(a) CONTRATANTE.',
  '6.3. Cada pedido de correção deverá ser encaminhado por escrito e de forma consolidada em até 10 (dez) dias corridos da entrega. Passado esse prazo sem manifestação, presume-se, exclusivamente para contagem de prazos e cobrança, que não foram identificadas pendências na etapa, sem prejuízo do direito de correção de vícios técnicos.',
  '6.4. Serviços adicionais e revisões extraordinárias seguirão o prazo de cobrança previsto no item 5.3.',
  '6.5. Ao final de cada etapa principal, o(a) CONTRATADO(A) encaminhará Termo de Aceite de Etapa, sem prejuízo da presunção prevista no item 6.3 em caso de não devolução.',
  'CLÁUSULA 7ª – DOS HONORÁRIOS ADICIONAIS POR ATRASO, RETRABALHO E DESCUMPRIMENTO DE PRAZOS',
  '7.1. O atraso do(a) CONTRATANTE no fornecimento de informações, documentos, medidas, aprovações ou definições, quando ultrapassar 10 (dez) dias corridos da solicitação formal, poderá sujeitá-lo à compensação financeira indicada no Anexo I/aditivo ou orçamento aplicável, sem prejuízo da suspensão dos prazos.',
  '7.2. Alterações de escopo ou premissas após aprovação poderão ser cobradas a R$ 180,00 por hora técnica ou 20% sobre o valor da etapa afetada, conforme critério indicado em orçamento prévio aprovado por escrito antes do início do trabalho adicional.',
  '7.3. Três ou mais alterações de escopo poderão ensejar revisão do cronograma remanescente e/ou aditivo com novos valores e prazos.',
  '7.4. Em caso de atraso por culpa exclusiva do(a) CONTRATADO(A), superior a 10 (dez) dias além do prazo pactuado, poderá ser concedido desconto de 1% sobre a etapa em atraso a cada 5 (cinco) dias adicionais, limitado a 10% do valor total do contrato, sem limitação de direitos legais.',
  '7.5. Os valores desta cláusula seguem o prazo de cobrança do item 5.3 e serão comunicados por escrito com memória de cálculo.',
  'CLÁUSULA 8ª – DO CARÁTER ILUSTRATIVO DE IMAGENS E RENDERS 3D',
  '8.1. Imagens, renders, maquetes, perspectivas e simulações visuais têm caráter ilustrativo e não constituem garantia de resultado exato quanto a cores, texturas, brilho, iluminação, sombreamento ou aspecto final dos materiais e acabamentos.',
  '8.2. Ajustes de leiaute, dimensões ou disposição necessários à realidade construtiva não serão considerados vício do projeto, aplicando-se, quando cabível, a Cláusula 6ª.',
  'CLÁUSULA 9ª – DAS ALTERAÇÕES NO LOCAL E DO PROJETO AS BUILT',
  '9.1. Alterações físicas executadas no imóvel em desacordo com o projeto tornam eventual atualização as built um serviço adicional, sujeito a orçamento prévio aprovado por escrito.',
  '9.2. O(A) CONTRATADO(A) não é responsável por manter o projeto atualizado em relação a alterações executadas sem sua ciência e aprovação prévia e por escrito.',
  '9.3. O levantamento e a elaboração do as built seguem os prazos de cobrança aplicáveis e podem exigir nova vistoria técnica.',
  'CLÁUSULA 10ª – DAS OBRIGAÇÕES DO(A) CONTRATADO(A)',
  '10.1. Executar os serviços com zelo, diligência e observância das normas técnicas e legislação aplicável ao local do imóvel.',
  '10.2. Emitir ART/RRT referente aos serviços prestados, cujo custo será suportado pelo(a) CONTRATANTE.',
  '10.3. Entregar os projetos completos e com as informações técnicas necessárias ao escopo contratado.',
  '10.4. Manter o(a) CONTRATANTE informado(a) e cumprir os prazos e marcos, ressalvadas as hipóteses de suspensão.',
  '10.5. Responsabilizar-se tecnicamente pelos serviços que efetivamente executar, não respondendo por falhas de execução de terceiros fora de sua supervisão contratual.',
  '10.6. Responder, nos termos legais, pela solidez e segurança dos serviços estruturais que eventualmente prestar, desde que a execução observe fielmente o projeto e as especificações técnicas.',
  'CLÁUSULA 11ª – DAS OBRIGAÇÕES DO(A) CONTRATANTE',
  '11.1. Fornecer em tempo hábil todas as informações, documentos, levantamentos, medidas e definições necessárias.',
  '11.2. Efetuar os pagamentos nas datas e condições pactuadas.',
  '11.3. Analisar e se manifestar sobre os materiais entregues nos prazos estabelecidos.',
  '11.4. Não utilizar, reproduzir ou repassar a terceiros os projetos e informações técnicas antes da quitação integral dos valores devidos.',
  '11.5. Comunicar por escrito qualquer alteração de escopo e formalizar o respectivo aditivo quando necessário.',
  '11.6. Comunicar previamente qualquer alteração física executada no imóvel em desacordo com o projeto entregue.',
  '11.7. Em serviços perante órgãos públicos, fornecer tempestivamente todos os documentos e informações exigidos e assinar os requerimentos necessários.',
  'CLÁUSULA 12ª – DA SUSPENSÃO DOS SERVIÇOS POR INADIMPLÊNCIA',
  '12.1. O(A) CONTRATADO(A) poderá suspender a execução e/ou entrega de novas etapas em caso de atraso de pagamento superior a 15 (quinze) dias, mediante notificação, sem que isso configure quebra contratual.',
  'CLÁUSULA 13ª – DA PROPRIEDADE INTELECTUAL E USO DO PROJETO',
  '13.1. Os direitos autorais sobre projetos, desenhos, memoriais e documentos técnicos permanecem com o(a) CONTRATADO(A), sendo cedido ao(à) CONTRATANTE o direito de uso para a finalidade e o imóvel contratados, condicionado à quitação integral.',
  '13.2. É vedada a reprodução, alteração ou utilização dos projetos em outras obras/imóveis ou por terceiros sem autorização expressa e por escrito do(a) CONTRATADO(A).',
  '13.3. A divulgação do projeto pelo(a) CONTRATANTE deve manter os devidos créditos de autoria.',
  '13.4. Reprodução, adaptação ou utilização não autorizada em outra obra configura violação de direitos autorais, sujeita às medidas legais cabíveis.',
  'CLÁUSULA 14ª – DA CONFIDENCIALIDADE E PROTEÇÃO DE DADOS',
  '14.1. As partes manterão sigilo sobre informações técnicas, comerciais e pessoais trocadas em razão do contrato pelo prazo indicado no instrumento definitivo.',
  '14.1.1. Recomendações, avaliações ou depoimentos públicos não constituem quebra de sigilo desde que não revelem dados pessoais de terceiros, valores pactuados ou detalhes técnicos sigilosos.',
  '14.2. Para fins da LGPD, os dados pessoais necessários à execução contratual serão tratados para essa finalidade e mantidos pelo período necessário ao cumprimento de obrigações contratuais, fiscais e legais.',
  '14.3. O(A) CONTRATANTE poderá exercer os direitos previstos na LGPD mediante solicitação pelos canais oficiais.',
  'CLÁUSULA 15ª – DO DIREITO DE ARREPENDIMENTO',
  '15.1. Quando aplicável o Código de Defesa do Consumidor e a contratação ocorrer fora do estabelecimento comercial, poderá ser exercido o direito de arrependimento no prazo legal de 7 (sete) dias corridos.',
  '15.2. O exercício do arrependimento deverá ser comunicado por escrito, com devolução dos valores cabíveis nos termos da legislação aplicável.',
  '15.3. Se os serviços já tiverem sido iniciados a pedido expresso do(a) CONTRATANTE dentro do prazo de reflexão, será devido o pagamento proporcional aos serviços efetivamente prestados.',
  '15.4. Superado o prazo legal sem manifestação, aplicam-se as regras de rescisão contratual.',
  'CLÁUSULA 16ª – DA RESCISÃO',
  '16.1. O contrato poderá ser rescindido por mútuo acordo mediante aviso prévio por escrito de 15 (quinze) dias.',
  '16.2. Na rescisão sem justa causa por iniciativa do(a) CONTRATANTE, serão devidos os valores proporcionais aos serviços executados e eventual multa indicada no instrumento definitivo.',
  '16.3. Na rescisão sem justa causa por iniciativa do(a) CONTRATADO(A), o(a) CONTRATANTE terá direito à devolução dos valores referentes às etapas não iniciadas ou não concluídas, sem prejuízo do pagamento das etapas concluídas.',
  '16.4. Em caso de rescisão por inadimplemento, a parte infratora arcará com multa equivalente a 10% do valor total do contrato, sem prejuízo de perdas e danos comprovados.',
  '16.5. Não constitui motivo de rescisão pelo(a) CONTRATANTE o atraso decorrente das hipóteses de suspensão quando a mora for do próprio CONTRATANTE.',
  'CLÁUSULA 17ª – DA LIMITAÇÃO DE RESPONSABILIDADE',
  '17.1. O(A) CONTRATADO(A) não se responsabiliza por erros de execução de terceiros fora de sua supervisão, alterações não autorizadas, informações incorretas fornecidas pelo(a) CONTRATANTE, força maior, taxas de órgãos públicos ou condições comerciais de fornecedores indicados em materiais de curadoria.',
  '17.2. A responsabilidade civil do(a) CONTRATADO(A), quando aplicável, limita-se aos serviços efetivamente por ele(a) prestados, nos termos legais.',
  'CLÁUSULA 18ª – DA SOLIDARIEDADE ENTRE CONTRATANTES',
  '18.1. Havendo mais de uma pessoa como CONTRATANTE, todas responderão solidariamente pelas obrigações assumidas, especialmente quanto ao pagamento integral.',
  'CLÁUSULA 19ª – DA FORÇA MAIOR',
  '19.1. Nenhuma parte responderá por descumprimento decorrente de caso fortuito ou força maior, nos termos do art. 393 do Código Civil.',
  '19.2. A parte impossibilitada deverá comunicar a outra por escrito em até 5 (cinco) dias corridos, descrevendo a natureza e o impacto estimado.',
  '19.3. Cessada a causa impeditiva, os prazos serão retomados, prorrogados pelo período correspondente à duração comprovada do evento.',
  'CLÁUSULA 20ª – DAS NOTIFICAÇÕES E COMUNICAÇÕES OFICIAIS',
  '20.1. São canais oficiais os e-mails e telefones/WhatsApp indicados pelas partes, o Portal do Cliente e o e-mail profissional do(a) CONTRATADO(A).',
  '20.1.1. Comunicações, entregas e cobranças realizadas pelo Portal do Cliente ficam registradas com data e hora e servem como prova para contagem dos prazos contratuais.',
  '20.2. Notificações e comunicações serão consideradas válidas quando enviadas pelos canais oficiais, ressalvada prova de indisponibilidade.',
  '20.3. Alterações dos canais de contato deverão ser comunicadas por escrito.',
  'CLÁUSULA 21ª – DISPOSIÇÕES GERAIS',
  '21.1. Este contrato, juntamente com o Anexo I, constitui o acordo integral entre as partes.',
  '21.2. Toda comunicação relevante deverá ser feita por escrito nos canais oficiais, servindo como meio de prova.',
  '21.3. A tolerância quanto a eventual descumprimento não implica novação ou renúncia de direitos.',
  '21.4. Alterações a este contrato somente serão válidas se formalizadas por escrito e assinadas por ambas as partes.',
  'CLÁUSULA 22ª – DA MEDIAÇÃO PRÉVIA',
  '22.1. Antes da via judicial, as partes envidarão esforços razoáveis para negociação direta ou mediação extrajudicial, sem prejuízo do acesso à tutela jurisdicional.',
  'CLÁUSULA 23ª – DO FORO',
  '23.1. Fica eleito o foro da comarca indicada no instrumento definitivo, sem prejuízo do direito do consumidor ao foro de seu domicílio quando aplicável.',
];

function contractDocument(record: CommercialRecord) {
  const contractNumber = text(record.contract_number, 'CONTRATO SEM NUMERAÇÃO — NÃO EMITIR');
  return doc([
    ...title(`CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE ENGENHARIA — ${contractNumber}`),
    p('Pelo presente instrumento particular de Contrato de Prestação de Serviços de Engenharia, de um lado:'),
    p('CONTRATADO(A): Camila Martins Engenharia Civil, engenheira civil, inscrita no CREA sob o nº [PREENCHER], com endereço profissional [PREENCHER], e-mail eng.martins.camila@gmail.com e telefone/WhatsApp [PREENCHER], doravante denominada simplesmente CONTRATADO(A);'),
    p(`CONTRATANTE: ${record.prospect_name}, CPF/CNPJ ${text(record.cpf_cnpj)}, com endereço em ${text(record.address)}, e-mail ${text(record.email)} e telefone/WhatsApp ${text(record.phone)}, doravante denominado(a) simplesmente CONTRATANTE.`),
    p('Têm entre si, justo e acertado, o presente Contrato de Prestação de Serviços de Engenharia, que se regerá pelas cláusulas e condições a seguir:'),
    ...contractClauses.map((line) => line.startsWith('CLÁUSULA') ? h(line) : p(line)),
    p(`Valor comercial de referência: R$ ${money(record.total_value)}. O detalhamento de escopo, valores, pagamentos e cronograma será consolidado no Anexo I.`),
    p(`Nível de experiência informado: ${text(record.experience_level)}.`),
    p(`Foro/local de referência: ${text(record.city)}/${text(record.state)}.`),
    p('E por estarem assim justas e contratadas, as partes assinam o presente instrumento em 2 (duas) vias de igual teor e forma, na presença das testemunhas abaixo.'),
    p(`${text(record.city, '[Cidade]')}, _____ de __________________ de ______.`), p('_____________________________________________'), p('CONTRATADO(A)'), p('_____________________________________________'), p('CONTRATANTE'), p('Testemunhas:'), p('1) ______________________________  CPF: ______________________'), p('2) ______________________________  CPF: ______________________'),
  ]);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
  try {
    const { caller, service, user } = await requireAdmin(req);
    const body = await req.json();
    const recordId = typeof body.recordId === 'string' ? body.recordId : '';
    const kind = body.kind === 'contrato' ? 'contrato' : 'orcamento';
    if (!/^[0-9a-f-]{36}$/i.test(recordId)) return json({ error: 'Registro comercial inválido.' }, 400);
    const { error: rateError } = await caller.rpc('consume_admin_rate_limit', { p_action: `commercial-document-${kind}` });
    if (rateError) return json({ error: 'Muitas tentativas. Aguarde antes de repetir.' }, 429);
    if (kind === 'contrato') {
      const assigned = await caller.rpc('admin_assign_commercial_contract_number', { p_record_id: recordId });
      if (assigned.error) throw assigned.error;
    }
    const { data: record, error: recordError } = await service.from('commercial_records').select('*').eq('id', recordId).maybeSingle();
    if (recordError) throw recordError;
    if (!record) return json({ error: 'Registro comercial não encontrado.' }, 404);
    const r = record as CommercialRecord;
    const existingDocumentId = kind === 'orcamento' ? r.quote_document_id : r.contract_document_id;
    let documentId = existingDocumentId;
    if (!documentId) {
      const inserted = await service.from('documentos').insert({
        nome: kind === 'orcamento' ? `Orçamento ${r.quote_number} — ${r.prospect_name}` : `Contrato ${r.contract_number} — ${r.prospect_name}`,
        tipo: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', categoria: 'Comercial', versao: '1.0', storage_bucket: 'documentos',
        permitir_download: true, protection_mode: 'administrative', autoral: false, workflow_status: 'rascunho', optional_document: false,
        generated_data: { commercial_record_id: r.id, quote_number: r.quote_number, contract_number: r.contract_number, prospect_name: r.prospect_name },
      }).select('id').single();
      if (inserted.error) throw inserted.error;
      documentId = inserted.data.id;
      const updateLink = kind === 'orcamento' ? { quote_document_id: documentId } : { contract_document_id: documentId };
      const linked = await service.from('commercial_records').update(updateLink).eq('id', r.id);
      if (linked.error) throw linked.error;
    }
    const word = kind === 'orcamento' ? quoteDocument(r) : contractDocument(r);
    const buffer = await Packer.toBuffer(word);
    const base = kind === 'orcamento' ? r.quote_number : r.contract_number ?? 'contrato';
    const path = `comercial/${r.id}/${kind}-${base}-v1.0.docx`;
    const uploaded = await service.storage.from('documentos').upload(path, buffer, { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', upsert: true });
    if (uploaded.error) throw uploaded.error;
    const updatedDocument = await service.from('documentos').update({ arquivo: path, workflow_status: 'gerado', generated_at: new Date().toISOString() }).eq('id', documentId);
    if (updatedDocument.error) throw updatedDocument.error;
    const nextStatus = kind === 'orcamento' ? 'orcamento_gerado' : 'contrato_gerado';
    const updatedRecord = await service.from('commercial_records').update({ status: nextStatus, updated_at: new Date().toISOString() }).eq('id', r.id);
    if (updatedRecord.error) throw updatedRecord.error;
    await service.from('audit_log').insert({ user_id: user.id, action: `generate_commercial_${kind}_docx`, entity_type: 'commercial_records', entity_id: r.id, details: { document_id: documentId, path, quote_number: r.quote_number, contract_number: r.contract_number } });
    return json({ generated: true, documentId, path, quoteNumber: r.quote_number, contractNumber: r.contract_number });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível gerar o documento comercial.';
    return json({ error: message }, message.includes('Acesso') ? 403 : message.includes('Sessão') ? 401 : 500);
  }
});
