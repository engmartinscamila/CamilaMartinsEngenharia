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
  id: string;
  quote_number: string;
  contract_number: string | null;
  status: string;
  prospect_name: string;
  cpf_cnpj: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  property_address: string | null;
  property_type: string | null;
  area_terreno_m2: number | null;
  area_construida_m2: number | null;
  construction_standard: string | null;
  experience_level: string | null;
  services: unknown;
  custom_service: string | null;
  total_value: number | null;
  valid_until: string | null;
  quote_document_id: string | null;
  contract_document_id: string | null;
};

type ServiceItem = Record<string, unknown>;
const p = (text: string, bold = false) => new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text, bold, font: 'Century Gothic', size: 20 })] });
const h = (text: string) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 220, after: 100 }, children: [new TextRun({ text, bold: true, font: 'Century Gothic', size: 22 })] });
const title = (text: string, subtitle?: string) => [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text, bold: true, font: 'Century Gothic', size: 28 })] }), ...(subtitle ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 220 }, children: [new TextRun({ text: subtitle, font: 'Century Gothic', size: 18 })] })] : [])];
const makeDoc = (children: Paragraph[]) => new Document({ sections: [{ properties: {}, children }] });
const text = (value: unknown, fallback = '_______________________________________________') => typeof value === 'string' && value.trim() ? value.trim() : fallback;
const money = (value: number | null) => value === null ? '__________________' : new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
const datePt = (raw: string | null) => raw ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${raw}T12:00:00-03:00`)) : '_____/_____/________';
const selectedServices = (record: CommercialRecord) => Array.isArray(record.services) ? record.services.filter((item): item is ServiceItem => Boolean(item && typeof item === 'object' && (item as ServiceItem).included !== false)) : [];

function quoteDocument(record: CommercialRecord) {
  const selected = selectedServices(record);
  return makeDoc([
    ...title(`PROPOSTA COMERCIAL — ${record.quote_number}`, 'Serviços de Engenharia / Arquitetura'),
    p('Camila Martins Engenharia Civil', true),
    p(`Preparada para: ${record.prospect_name}`),
    p(`Imóvel/obra: ${text(record.property_address)}`),
    p(`Data da proposta: ${new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date())}   |   Validade: até ${datePt(record.valid_until)}`),
    p('Documento de caráter comercial. Ao ser aceita, esta proposta dará origem ao Contrato de Prestação de Serviços e ao Anexo I, que passam a reger a relação entre as partes.'),
    h('1. APRESENTAÇÃO'),
    p('Agradecemos o interesse em nossos serviços. Esta proposta comercial detalha o escopo, os prazos, o investimento e as condições de pagamento para a prestação de serviços técnicos de engenharia/arquitetura referentes ao imóvel identificado abaixo, com base nas informações fornecidas até a presente data.'),
    p('O conteúdo deste documento é espelhado, em sua versão contratual definitiva, pelo Anexo I do contrato — em caso de divergência após a assinatura, prevalece o Anexo I.'),
    h('2. DADOS DO CLIENTE E DO IMÓVEL'),
    p(`Cliente: ${record.prospect_name}`),
    p(`CPF/CNPJ: ${text(record.cpf_cnpj)}`),
    p(`E-mail: ${text(record.email)}   |   Telefone: ${text(record.phone)}`),
    p(`Endereço do imóvel/obra: ${text(record.property_address)}`),
    p(`Tipo de imóvel: ${text(record.property_type)}`),
    p(`Área do terreno (m²): ${record.area_terreno_m2 ?? '________'}   |   Área construída prevista (m²): ${record.area_construida_m2 ?? '________'}`),
    p(`Padrão construtivo: ${text(record.construction_standard)}   |   Experiência: ${text(record.experience_level)}`),
    h('3. ESCOPO DE SERVIÇOS PROPOSTO'),
    p('Selecione abaixo os serviços incluídos nesta proposta. Serviços não assinalados não integram o escopo e, se solicitados posteriormente, serão tratados como serviço adicional, com orçamento próprio.'),
    ...(selected.length ? selected.map((item) => p(`☒ ${String(item.name ?? 'Serviço')}${item.notes ? ` — ${String(item.notes)}` : ''}`)) : [p('Nenhum serviço selecionado — revisar antes do envio.')]),
    ...(record.custom_service ? [p(`☒ Outro: ${record.custom_service}`)] : []),
    h('4. O QUE NÃO ESTÁ INCLUÍDO NESTA PROPOSTA'),
    p('Não integram esta proposta, podendo ser orçados separadamente caso desejados: mobiliário sob medida, projeto luminotécnico especial, projeto de automação predial, obtenção de financiamento, taxas e emolumentos de órgãos públicos e cartórios, custo de ART/RRT, e entrega de arquivos em formato editável (DWG/IFC/RVT), salvo indicação em contrário.'),
    h('5. FORMATO E CONDIÇÕES DE ENTREGA'),
    p('Formato de entrega: PDF.'),
    p('Rodadas de revisão incluídas por etapa: 2 (duas), salvo indicação diversa nesta proposta.'),
    p('Meio de comunicação oficial: e-mail / WhatsApp indicados no contrato.'),
    p('Prazo de manifestação do cliente por etapa: 10 (dez) dias corridos após a entrega.'),
    h('6. INVESTIMENTO'),
    p('Os valores abaixo referem-se exclusivamente aos honorários técnicos, não incluindo taxas, emolumentos, ART/RRT e demais despesas de órgãos públicos ou cartórios, de responsabilidade do(a) cliente.'),
    ...selected.map((item) => p(`${String(item.name ?? 'Serviço')}: R$ ${item.value ? money(Number(item.value)) : '__________________'}`)),
    p(`VALOR TOTAL DOS HONORÁRIOS: R$ ${money(record.total_value)}`, true),
    h('6.1 Forma de pagamento'),
    p('1 (entrada) | Assinatura do contrato | R$ __________ | Na assinatura'),
    p('2 | __________________ | R$ __________ | __________________'),
    p('3 | __________________ | R$ __________ | __________________'),
    p('4 | __________________ | R$ __________ | __________________'),
    h('7. PRAZO ESTIMADO'),
    p('O prazo médio de mercado para elaboração e entrega dos serviços listados é de 45 (quarenta e cinco) dias úteis, contados a partir da assinatura do contrato e do recebimento de todas as informações necessárias, podendo variar conforme a complexidade do projeto e a quantidade de serviços efetivamente contratados. O detalhamento por etapa consta do Anexo I do contrato.'),
    h('8. SERVIÇOS ADICIONAIS (TABELA DE REFERÊNCIA)'),
    p('Caso, ao longo do projeto, surjam solicitações fora do escopo original, aplicam-se os valores de referência mediante orçamento prévio aprovado por escrito.'),
    p('Revisões além das incluídas por etapa: conforme tabela de honorários vigente.'),
    p('Alteração de escopo/premissas já aprovadas: 20% sobre o valor da etapa afetada, ou valor por hora técnica.'),
    p('Atraso do cliente no fornecimento de informações: compensação por dia útil de atraso, conforme contrato.'),
    p('Vistoria/levantamento não incluído no escopo original: mediante orçamento prévio aprovado.'),
    h('9. PRÓXIMOS PASSOS'),
    p('• Aprovação desta proposta pelo(a) cliente, por escrito.'),
    p('• Formalização do Contrato de Prestação de Serviços de Engenharia/Arquitetura e do respectivo Anexo I.'),
    p('• Pagamento da parcela de entrada e agendamento do levantamento técnico/vistoria, quando aplicável.'),
    p('• Início dos trabalhos com o envio do briefing inicial.'),
    h('10. VALIDADE E ACEITE DA PROPOSTA'),
    p('Esta proposta é válida por 15 (quinze) dias corridos a contar da data de emissão indicada na capa. Após esse prazo, os valores e condições poderão ser revistos.'),
    p('Local e data: _______________________________, _____/_____/________'),
    p('_______________________________________________'),
    p('Camila Martins Engenharia Civil — proponente'),
    p('_______________________________________________'),
    p('Aceite do(a) cliente'),
  ]);
}

const CONTRACT_BODY = `CLÁUSULA 1ª – DO OBJETO
1.1. O presente contrato tem por objeto a prestação, pelo(a) CONTRATADO(A) ao(à) CONTRATANTE, de serviços técnicos de engenharia relativos ao imóvel/empreendimento identificado no Anexo I, compreendendo os projetos, serviços, etapas, entregáveis, formato de entrega e valores integralmente descritos no Anexo I (Escopo de Serviços, Proposta Comercial e Cronograma), parte integrante e indissociável deste instrumento, o qual prevalece como fonte única e definitiva para a delimitação do escopo contratado, de modo a evitar divergência com qualquer descrição sumária eventualmente feita alhures.
1.2. Consideram-se incluídos no objeto apenas os itens expressamente descritos no Anexo I. Qualquer serviço, projeto complementar, prancha adicional, detalhamento extra ou compatibilização não listada no Anexo I será considerado SERVIÇO ADICIONAL, sujeito a orçamento e cobrança à parte, mediante aditivo contratual prévio.
1.3. Os projetos serão entregues no(s) formato(s) especificado(s) no Anexo I (ex.: PDF, DWG, IFC, RVT), correspondente ao padrão usual de mercado para a fase contratada. O fornecimento de arquivos em formato editável não previsto no Anexo I será considerado SERVIÇO ADICIONAL, sujeito a orçamento e cobrança à parte.
1.4. Quando o Anexo I incluir serviços de legalização, aprovação, regularização e/ou obtenção de Alvará de Construção, Habite-se ou documentos equivalentes perante a Prefeitura Municipal e/ou outros órgãos públicos, o acompanhamento técnico e administrativo do respectivo processo integra o objeto contratado, sem prejuízo das taxas e despesas do órgão público, que permanecem de responsabilidade exclusiva do(a) CONTRATANTE.
1.5. Os serviços de projeto poderão ser contratados em um dos níveis de experiência oferecidos pelo(a) CONTRATADO(A) — BRONZE (Essencial), PRATA (Visual) ou OURO (Imersivo) —, prevalecendo, em qualquer caso, o Anexo I como fonte única e definitiva do escopo, das quantidades e das condições efetivamente contratadas.
1.5.1. BRONZE (Essencial): documentação técnica objetiva do projeto (plantas, cortes, fachadas e demais elementos necessários à construção ou legalização), sem plantas humanizadas, renderização 3D, vídeo ou tour virtual.
1.5.2. PRATA (Visual): inclui os conteúdos do nível BRONZE, acrescidos de plantas humanizadas e renderização 3D em imagens estáticas, destinadas a facilitar a compreensão dos ambientes antes da execução.
1.5.3. OURO (Imersivo): inclui os conteúdos dos níveis anteriores, acrescidos de renderização 3D em vídeo, tour virtual 360° e curadoria integral dos catálogos de materiais, mobiliário e acabamentos disponibilizados pelo(a) CONTRATADO(A).
1.6. O(A) CONTRATANTE declara ter recebido e analisado o Catálogo de Serviços previamente à assinatura deste contrato, estando ciente das características e exclusões do nível por ele(a) escolhido.
1.7. Os níveis de experiência aplicam-se exclusivamente aos serviços de projeto. Execução de obra, gerenciamento, visitas técnicas de acompanhamento, projetos complementares, levantamentos, taxas e aprovações constituem serviços autônomos e complementares, que somente integrarão o objeto se expressamente descritos no Anexo I.
1.8. A entrega realizada em conformidade com o nível de experiência e o escopo efetivamente contratados no Anexo I não será considerada parcial, incompleta ou insuficiente ainda que não contemple recursos previstos em nível superior não contratado.
1.9. Eventual migração a nível de experiência superior será tratada como alteração de escopo, sujeita a orçamento prévio e aditivo contratual. Eventual downgrade após o início dos trabalhos depende de concordância do(a) CONTRATADO(A) e não gera direito a reembolso pelos serviços já executados ou em execução.
CLÁUSULA 2ª – DO PRAZO DE EXECUÇÃO
2.1. O prazo para elaboração e entrega dos projetos é de 45 (quarenta e cinco) dias úteis, podendo ser ajustado no Anexo I conforme a complexidade e a quantidade de projetos efetivamente contratados, contados a partir da assinatura deste instrumento E do recebimento de todas as informações, documentos, levantamentos e definições necessárias fornecidas pelo(a) CONTRATANTE (o que ocorrer por último).
2.2. O prazo ficará automaticamente suspenso em caso de atraso do(a) CONTRATANTE no fornecimento de informações, documentos, medidas, aprovações ou definições; alteração de escopo, programa ou premissas após o início dos trabalhos; ou caso fortuito ou força maior. O prazo será retomado após a regularização, acrescido, se necessário, de prazo proporcional ao impacto causado.
2.3. Cada solicitação de alteração de escopo, informação pendente ou pedido de suspensão deverá ser formalizado por escrito nos canais oficiais, servindo o registro como prova para fins de contagem e suspensão de prazos.
CLÁUSULA 3ª – DOS DOCUMENTOS E INFORMAÇÕES COMPLEMENTARES (BRIEFINGS)
3.1. Para a correta elaboração de determinadas etapas ou projetos complementares, o(a) CONTRATADO(A) encaminhará questionários, briefings e/ou listas de definição necessários ao desenvolvimento do projeto.
3.2. O(A) CONTRATANTE terá o prazo de até [5 (cinco)] dias úteis, contados do recebimento de cada documento complementar, para preenchê-lo e devolvê-lo ao(à) CONTRATADO(A), pelos canais oficiais.
3.3. Findo o prazo sem devolução, o(a) CONTRATADO(A) enviará lembrete formal, concedendo novo prazo de [5 (cinco)] dias úteis para resposta.
3.4. Persistindo a ausência de resposta após o lembrete, o(a) CONTRATADO(A) comunicará sua intenção de adotar uma das medidas contratuais cabíveis, concedendo prazo adicional de [3 (três)] dias úteis para manifestação em contrário, podendo prosseguir com especificações técnicas padrão e/ou suspender a etapa dependente.
3.5. Alterações de definições já respondidas e incorporadas ao projeto serão tratadas como alteração de escopo.
3.6. Atrasos na devolução dos documentos complementares equivalem a atraso no fornecimento de informações necessárias à continuidade dos trabalhos.
CLÁUSULA 4ª – DO LEVANTAMENTO TÉCNICO E DA VISTORIA PRÉVIA
4.1. O projeto será desenvolvido com base nas medidas, plantas, levantamento topográfico/cadastral e demais dados técnicos fornecidos pelo(a) CONTRATANTE ou por profissional/empresa por ele(a) indicado(a), presumindo-se a exatidão de tais informações.
4.2. Caso o(a) CONTRATADO(A) realize vistoria técnica e/ou levantamento de medidas no local, tal serviço, quando não incluído no escopo original (Anexo I), será cobrado à parte, mediante orçamento prévio aprovado por escrito antes de sua execução.
4.3. Eventuais divergências entre a realidade física do imóvel e os dados fornecidos pelo(a) CONTRATANTE, somente constatadas durante ou após a execução, não geram responsabilidade ao(à) CONTRATADO(A), sendo os ajustes decorrentes tratados como serviço adicional.
CLÁUSULA 5ª – DO VALOR E DAS CONDIÇÕES DE PAGAMENTO
5.1. Pela prestação dos serviços descritos na Cláusula 1ª, o(a) CONTRATANTE pagará ao(à) CONTRATADO(A) o valor total indicado no Anexo I, conforme detalhamento de parcelas e etapas nele previsto.
5.2. Os pagamentos deverão ser realizados nas datas e condições pactuadas, mediante o meio informado pelo(a) CONTRATADO(A), sendo o comprovante suficiente para quitação da respectiva parcela.
5.3. Concluída a elaboração de cada etapa do projeto ou de correções/ajustes solicitados, o(a) CONTRATADO(A) fará a entrega formal e emitirá a respectiva cobrança. O(A) CONTRATANTE terá o prazo de até 30 (trinta) dias corridos, contados da entrega/notificação, para efetuar o pagamento correspondente.
5.3.1. O decurso do prazo de 30 (trinta) dias sem manifestação não suspende nem exime a obrigação de pagamento, sem prejuízo do direito do(a) CONTRATANTE de solicitar ajustes técnicos nos termos da Cláusula 6ª.
5.4. Em caso de atraso no pagamento de qualquer parcela, incidirão a partir do vencimento: multa moratória de 2% (dois por cento), juros de mora de 1% (um por cento) ao mês calculados pro rata die e correção monetária pelo índice indicado no instrumento definitivo, sem prejuízo da suspensão dos serviços.
5.5. Os valores pactuados não incluem taxas, emolumentos, tarifas ou despesas cobradas por órgãos públicos, cartórios, concessionárias ou entidades de classe, incluindo ART/RRT, que são de responsabilidade exclusiva do(a) CONTRATANTE.
5.6. Nos serviços de legalização, aprovação, regularização, protocolo ou acompanhamento perante órgãos públicos, todas as taxas, emolumentos, tarifas e custas são de responsabilidade exclusiva do(a) CONTRATANTE.
CLÁUSULA 6ª – DAS REVISÕES E CORREÇÕES DO PROJETO
6.1. Estão incluídas no valor contratado as rodadas de revisão/correção especificadas no Anexo I ou, na ausência de indicação expressa, até 2 (duas) rodadas destinadas a ajustes dentro do escopo original.
6.2. Consideram-se SERVIÇO ADICIONAL as revisões excedentes, alterações de programa, metragem, layout, partido arquitetônico/técnico ou premissas já aprovadas, mudanças solicitadas após aprovação formal de etapa e adequações decorrentes de informações incorretas ou incompletas fornecidas pelo(a) CONTRATANTE.
6.2.1. Não se enquadram no limite de revisões, nem são consideradas serviço adicional, as adequações exigidas diretamente por órgão público ao longo de processo de legalização contratado, exceto quando decorrentes de alteração de escopo ou de informações incorretas/incompletas fornecidas pelo(a) CONTRATANTE.
6.3. Cada pedido de correção deverá ser encaminhado por escrito, de forma objetiva e consolidada, no prazo de até 10 (dez) dias corridos a contar da entrega da respectiva etapa. Passado esse prazo sem manifestação, presume-se, para fins exclusivamente de contagem de prazos e de cobrança, que o(a) CONTRATANTE não identificou pendências na etapa entregue, sem prejuízo do direito de solicitar correção de vícios técnicos.
6.4. Os valores referentes a serviços adicionais e revisões extraordinárias seguirão o mesmo prazo de cobrança de 30 (trinta) dias previsto no item 5.3.
6.5. Ao final de cada etapa principal do cronograma, o(a) CONTRATADO(A) encaminhará Termo de Aceite de Etapa, a ser assinado ou confirmado por escrito no prazo do item 6.3, sem prejuízo da presunção de aceite prevista no mesmo item em caso de não devolução.
CLÁUSULA 7ª – DOS HONORÁRIOS ADICIONAIS POR ATRASO, RETRABALHO E DESCUMPRIMENTO DE PRAZOS
7.1. O atraso do(a) CONTRATANTE no fornecimento de informações, documentos, medidas, aprovações ou definições necessárias à continuidade dos trabalhos, quando ultrapassar [10 (dez)] dias corridos contados da solicitação formal, sujeitará o(a) CONTRATANTE à compensação financeira indicada no instrumento definitivo, sem prejuízo do direito de suspensão previsto no contrato.
7.2. Alterações de escopo ou premissas após aprovação formal poderão ser cobradas a R$ 180,00 (cento e oitenta reais) por hora técnica, ou 20% (vinte por cento) sobre o valor da etapa afetada, cabendo ao(à) CONTRATADO(A) indicar no orçamento prévio qual critério será aplicado, sendo o orçamento eficaz somente após aprovação por escrito e anterior ao início do trabalho adicional.
7.3. Caso o(a) CONTRATANTE solicite 3 (três) ou mais alterações de escopo ao longo da execução, o(a) CONTRATADO(A) poderá revisar o cronograma remanescente e/ou condicionar a continuidade à assinatura de aditivo com novos valores e prazos.
7.4. Em caso de atraso na entrega por culpa exclusiva do(a) CONTRATADO(A), não amparado pelas hipóteses de suspensão, superior a [10 (dez)] dias além do prazo pactuado, será concedido desconto de [1%] sobre o valor da etapa em atraso a cada [5] dias adicionais, limitado a [10%] do valor total do contrato, sem limitação ou renúncia de responsabilidade legal.
7.5. Os valores desta cláusula seguem o prazo de cobrança do item 5.3 e serão apurados e comunicados por escrito com memória de cálculo.
CLÁUSULA 8ª – DO CARÁTER ILUSTRATIVO DE IMAGENS E RENDERS 3D
8.1. Eventuais imagens, renderizações tridimensionais, maquetes eletrônicas, perspectivas ou simulações visuais têm caráter exclusivamente ilustrativo, não constituindo garantia de resultado exato quanto a cores, texturas, brilho, iluminação, sombreamento ou aspecto final dos materiais e acabamentos.
8.2. Eventuais ajustes de leiaute, dimensões ou disposição necessários à realidade construtiva do imóvel não serão considerados vício do projeto, aplicando-se, quando for o caso, o disposto na Cláusula 6ª.
CLÁUSULA 9ª – DAS ALTERAÇÕES NO LOCAL E DO PROJETO AS BUILT
9.1. Caso, após a entrega do projeto, sejam realizadas alterações físicas no imóvel ou obra por iniciativa do(a) CONTRATANTE ou de terceiros em desacordo com o projeto entregue, eventual atualização as built será considerada SERVIÇO ADICIONAL, cobrada à parte mediante orçamento prévio aprovado por escrito.
9.2. O(A) CONTRATADO(A) não é responsável por manter o projeto atualizado em relação a alterações executadas sem sua ciência e aprovação prévia e por escrito.
9.3. O levantamento e a elaboração do as built seguirão os prazos de cobrança previstos no contrato, podendo estar sujeitos a nova vistoria técnica.
CLÁUSULA 10ª – DAS OBRIGAÇÕES DO(A) CONTRATADO(A)
10.1. Executar os serviços com zelo, diligência e observância das normas técnicas da ABNT, do Código de Obras e da legislação aplicável ao município/estado onde se situa o imóvel.
10.2. Emitir a(s) Anotação(ões)/Registro(s) de Responsabilidade Técnica (ART/RRT) referente(s) aos serviços prestados, cujo custo será suportado pelo(a) CONTRATANTE.
10.3. Entregar os projetos completos e com todas as informações técnicas necessárias à sua implementação, pertinentes ao escopo contratado.
10.4. Manter o(a) CONTRATANTE informado(a) sobre o andamento e cumprir os prazos e marcos, ressalvadas as hipóteses de suspensão.
10.5. Responsabilizar-se tecnicamente pelos serviços que efetivamente executar, não respondendo por falhas de execução de obra ou de terceiros que não estejam sob sua supervisão contratual.
10.6. Sem prejuízo das demais disposições, responder nos termos legais pela solidez e segurança dos serviços de natureza estrutural que eventualmente prestar, desde que a execução observe fielmente o projeto e as especificações técnicas entregues.
CLÁUSULA 11ª – DAS OBRIGAÇÕES DO(A) CONTRATANTE
11.1. Fornecer, em tempo hábil e de forma completa, todas as informações, documentos, levantamentos, medidas e definições necessárias à elaboração dos projetos.
11.2. Efetuar os pagamentos nas datas e condições pactuadas.
11.3. Analisar e se manifestar sobre os materiais entregues dentro dos prazos estabelecidos.
11.4. Não utilizar, reproduzir ou repassar a terceiros os projetos e informações técnicas antes da quitação integral dos valores devidos.
11.5. Comunicar por escrito qualquer solicitação de alteração de escopo, formalizando aditivo quando cabível.
11.6. Comunicar previamente e por escrito qualquer alteração física executada no imóvel em desacordo com o projeto entregue.
11.7. Nos serviços perante órgãos públicos, fornecer em tempo hábil todos os documentos e informações exigidos e assinar os requerimentos necessários.
CLÁUSULA 12ª – DA SUSPENSÃO DOS SERVIÇOS POR INADIMPLÊNCIA
12.1. O(A) CONTRATADO(A) poderá suspender a execução e/ou a entrega de novas etapas em caso de atraso no pagamento de qualquer parcela por prazo superior a 15 (quinze) dias, mediante notificação, sem que isso configure quebra contratual, sem prejuízo da cobrança dos valores em aberto e encargos aplicáveis.
CLÁUSULA 13ª – DA PROPRIEDADE INTELECTUAL E USO DO PROJETO
13.1. Os direitos autorais sobre os projetos, desenhos, memoriais e demais documentos técnicos permanecem com o(a) CONTRATADO(A), sendo cedido ao(à) CONTRATANTE apenas o direito de uso para a finalidade e o imóvel especificados, condicionado à quitação integral dos valores devidos.
13.2. É vedada a reprodução, alteração ou utilização dos projetos em outras obras/imóveis, ou por terceiros, sem autorização expressa e por escrito do(a) CONTRATADO(A).
13.3. O(A) CONTRATANTE poderá divulgar o projeto e sua execução, sendo obrigatório atribuir e manter os devidos créditos de autoria ao(à) CONTRATADO(A).
13.4. A cópia, reprodução, adaptação ou utilização dos elementos autorais em outra obra ou imóvel, sem autorização expressa e por escrito, configura violação de direitos autorais, sujeitando o responsável às medidas legais cabíveis.
CLÁUSULA 14ª – DA CONFIDENCIALIDADE E PROTEÇÃO DE DADOS
14.1. As partes se comprometem a manter sigilo sobre informações técnicas, comerciais e pessoais trocadas em razão deste contrato, obrigação que permanece válida por [2 (dois)] anos após seu término.
14.1.1. Não constitui quebra de sigilo o simples fato de o(a) CONTRATANTE mencionar, recomendar ou indicar o(a) CONTRATADO(A) a terceiros ou fazer avaliações/depoimentos públicos, desde que não divulgue dados pessoais de terceiros, valores especificamente pactuados ou detalhes técnicos sigilosos.
14.2. Para os fins da Lei Geral de Proteção de Dados, o(a) CONTRATADO(A) atuará como controlador(a) dos dados pessoais do(a) CONTRATANTE estritamente necessários à execução deste contrato, tratando-os para essa finalidade e mantendo-os pelo prazo necessário ao cumprimento de obrigações contratuais, fiscais e legais.
14.3. O(A) CONTRATANTE poderá exercer seus direitos de titular de dados pessoais mediante solicitação por escrito ao canal de contato oficial.
CLÁUSULA 15ª – DO DIREITO DE ARREPENDIMENTO
15.1. Caso a contratação tenha sido realizada fora do estabelecimento comercial do(a) CONTRATADO(A), o(a) CONTRATANTE, quando enquadrado(a) como consumidor(a), poderá exercer o direito de arrependimento previsto no art. 49 da Lei nº 8.078/1990, no prazo de 7 (sete) dias corridos contados da assinatura deste contrato ou do recebimento do respectivo instrumento, o que ocorrer por último.
15.2. O exercício do direito de arrependimento deverá ser comunicado por escrito, ensejando a devolução integral e imediata de eventuais valores já pagos, monetariamente atualizados, sem ônus ao(à) CONTRATANTE.
15.3. Caso o(a) CONTRATADO(A) já tenha iniciado a execução dos serviços a pedido expresso do(a) CONTRATANTE dentro do prazo de reflexão, será devido o pagamento proporcional aos serviços efetivamente prestados até a data da desistência.
15.4. Superado o prazo de 7 (sete) dias sem manifestação, aplicam-se as regras de rescisão previstas na Cláusula 16ª.
CLÁUSULA 16ª – DA RESCISÃO
16.1. O presente contrato poderá ser rescindido a qualquer tempo, por mútuo acordo, mediante aviso prévio por escrito de no mínimo [15 (quinze)] dias.
16.2. Em caso de rescisão por iniciativa do(a) CONTRATANTE sem justa causa, serão devidos os valores proporcionais aos serviços já executados, além de eventual multa de [10%] sobre o saldo remanescente, nos termos do instrumento definitivo.
16.3. Em caso de rescisão por iniciativa do(a) CONTRATADO(A) sem justa causa, o(a) CONTRATANTE terá direito à devolução dos valores referentes a etapas ainda não iniciadas ou não concluídas, além da compensação prevista no instrumento definitivo, sem prejuízo do pagamento devido pelas etapas concluídas e entregues.
16.4. Em caso de rescisão por inadimplemento contratual, a parte infratora arcará com multa equivalente a 10% (dez por cento) do valor total do contrato, sem prejuízo de perdas e danos comprovados.
16.5. Não constitui motivo de rescisão por parte do(a) CONTRATANTE o mero atraso decorrente das hipóteses de suspensão quando a mora for do próprio CONTRATANTE.
CLÁUSULA 17ª – DA LIMITAÇÃO DE RESPONSABILIDADE
17.1. O(A) CONTRATADO(A) não se responsabiliza por erros de execução de obra por terceiros não sob sua supervisão contratual; alterações realizadas no projeto sem autorização; informações, medidas ou dados incorretos fornecidos pelo(a) CONTRATANTE; caso fortuito ou força maior; taxas e valores cobrados por órgãos públicos; ou disponibilidade, preço e condições comerciais de produtos e fornecedores indicados em materiais de curadoria.
17.2. A responsabilidade civil do(a) CONTRATADO(A), quando aplicável, limita-se aos serviços efetivamente por ele(a) prestados, não se estendendo a atos de terceiros contratados diretamente pelo(a) CONTRATANTE.
CLÁUSULA 18ª – DA SOLIDARIEDADE ENTRE CONTRATANTES
18.1. Caso o contrato seja firmado por mais de uma pessoa na qualidade de CONTRATANTE, todas responderão solidariamente pelas obrigações assumidas, especialmente quanto ao pagamento integral dos valores devidos.
CLÁUSULA 19ª – DA FORÇA MAIOR
19.1. Nenhuma das partes responderá por descumprimento decorrente de caso fortuito ou força maior, nos termos do art. 393 do Código Civil.
19.2. A parte impossibilitada de cumprir suas obrigações deverá comunicar a outra por escrito no prazo de até 5 (cinco) dias corridos, descrevendo a natureza e o impacto estimado nos prazos.
19.3. Cessada a causa impeditiva, os prazos serão retomados, prorrogados pelo período correspondente à duração comprovada do evento.
CLÁUSULA 20ª – DAS NOTIFICAÇÕES E COMUNICAÇÕES OFICIAIS
20.1. Consideram-se canais oficiais o e-mail e telefone/WhatsApp das partes indicados no preâmbulo, o Portal do Cliente e o e-mail profissional do(a) CONTRATADO(A).
20.1.1. Comunicações, entregas e cobranças realizadas pelo Portal do Cliente ficam registradas com data e hora, valendo como prova de envio e ciência para contagem dos prazos contratuais.
20.2. Qualquer notificação, aviso, solicitação ou comunicação será considerada válida e eficaz quando enviada por um dos canais oficiais, presumindo-se recebida em até 2 (dois) dias úteis após o envio, salvo prova de indisponibilidade do canal.
20.3. A alteração dos canais de contato deverá ser comunicada por escrito à outra parte.
CLÁUSULA 21ª – DISPOSIÇÕES GERAIS
21.1. Este contrato, juntamente com seus anexos (Anexo I – Escopo de Serviços, Proposta Comercial e Cronograma), constitui o acordo integral entre as partes, substituindo entendimentos verbais ou escritos anteriores.
21.2. Toda comunicação relevante entre as partes deverá ser feita por escrito nos canais oficiais, servindo tais registros como meio de prova.
21.3. A tolerância de uma parte quanto ao eventual descumprimento de qualquer cláusula pela outra não implicará novação ou renúncia de direitos.
21.4. Alterações a este contrato somente serão válidas se formalizadas por escrito e assinadas por ambas as partes.
CLÁUSULA 22ª – DA MEDIAÇÃO PRÉVIA
22.1. Antes de recorrerem à via judicial, as partes se comprometem a envidar esforços razoáveis para solucionar eventuais controvérsias por negociação direta ou mediação extrajudicial, sem prejuízo do direito de buscar a tutela jurisdicional a qualquer tempo.
CLÁUSULA 23ª – DO FORO
23.1. Fica eleito o foro da Comarca de [cidade/UF] para dirimir dúvidas ou controvérsias oriundas deste contrato, sem prejuízo, caso o(a) CONTRATANTE seja considerado(a) consumidor(a), do seu direito de propor ação no foro de seu domicílio.`;

function contractDocument(record: CommercialRecord) {
  const contractNumber = text(record.contract_number, 'CONTRATO SEM NUMERAÇÃO — NÃO EMITIR');
  const body = CONTRACT_BODY.split('\n').filter(Boolean).map((line) => line.startsWith('CLÁUSULA') ? h(line) : p(line));
  return makeDoc([
    ...title(`CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE ENGENHARIA — ${contractNumber}`),
    p('Pelo presente instrumento particular de Contrato de Prestação de Serviços de Engenharia, de um lado:'),
    p('CONTRATADO(A): Camila Martins Engenharia Civil, engenheira civil, inscrita no CREA sob o nº [PREENCHER], com endereço profissional [PREENCHER], e-mail eng.martins.camila@gmail.com e telefone/WhatsApp [PREENCHER], doravante denominada simplesmente CONTRATADO(A);'),
    p(`CONTRATANTE: ${record.prospect_name}, CPF/CNPJ ${text(record.cpf_cnpj)}, com endereço em ${text(record.address)}, e-mail ${text(record.email)} e telefone/WhatsApp ${text(record.phone)}, doravante denominado(a) simplesmente CONTRATANTE.`),
    p('Têm entre si, justo e acertado, o presente Contrato de Prestação de Serviços de Engenharia, que se regerá pelas cláusulas e condições a seguir:'),
    ...body,
    p(`Valor total dos honorários para este contrato: R$ ${money(record.total_value)}. O detalhamento por etapa, serviços, entregáveis, pagamento e cronograma consta do Anexo I.`),
    p(`Nível de experiência informado: ${text(record.experience_level)}.`),
    p('E por estarem assim justas e contratadas, as partes assinam o presente instrumento em 2 (duas) vias de igual teor e forma, na presença das testemunhas abaixo.'),
    p(`${text(record.city, '[Cidade]')}, _____ de __________________ de ______.`),
    p('_____________________________________________'), p('CONTRATADO(A)'),
    p('_____________________________________________'), p('CONTRATANTE'),
    p('Testemunhas:'), p('1) ______________________________  CPF: ______________________'), p('2) ______________________________  CPF: ______________________'),
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

    const firstRead = await service.from('commercial_records').select('*').eq('id', recordId).maybeSingle();
    if (firstRead.error) throw firstRead.error;
    if (!firstRead.data) return json({ error: 'Registro comercial não encontrado.' }, 404);
    if (firstRead.data.status === 'convertido' && kind === 'contrato') return json({ error: 'O registro já foi convertido. O contrato histórico não pode ser substituído.' }, 409);

    if (kind === 'contrato') {
      const assigned = await caller.rpc('admin_assign_commercial_contract_number', { p_record_id: recordId });
      if (assigned.error) throw assigned.error;
    }

    const refreshed = await service.from('commercial_records').select('*').eq('id', recordId).single();
    if (refreshed.error) throw refreshed.error;
    const record = refreshed.data as CommercialRecord;
    let documentId = kind === 'orcamento' ? record.quote_document_id : record.contract_document_id;

    if (!documentId) {
      const inserted = await service.from('documentos').insert({
        nome: kind === 'orcamento' ? `Orçamento ${record.quote_number} — ${record.prospect_name}` : `Contrato ${record.contract_number} — ${record.prospect_name}`,
        tipo: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        categoria: 'Comercial',
        versao: '1.0',
        storage_bucket: 'documentos',
        permitir_download: true,
        protection_mode: 'administrative',
        autoral: false,
        workflow_status: 'rascunho',
        optional_document: false,
        generated_data: { commercial_record_id: record.id, quote_number: record.quote_number, contract_number: record.contract_number, prospect_name: record.prospect_name },
      }).select('id').single();
      if (inserted.error) throw inserted.error;
      documentId = inserted.data.id;
      const linked = await service.from('commercial_records').update(kind === 'orcamento' ? { quote_document_id: documentId } : { contract_document_id: documentId }).eq('id', record.id);
      if (linked.error) throw linked.error;
    }

    const word = kind === 'orcamento' ? quoteDocument(record) : contractDocument(record);
    const buffer = await Packer.toBuffer(word);
    const number = kind === 'orcamento' ? record.quote_number : record.contract_number ?? 'contrato';
    const path = `comercial/${record.id}/${kind}-${number}-v1.0.docx`;
    const uploaded = await service.storage.from('documentos').upload(path, buffer, { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', upsert: true });
    if (uploaded.error) throw uploaded.error;
    const updatedDocument = await service.from('documentos').update({ arquivo: path, workflow_status: 'gerado', generated_at: new Date().toISOString() }).eq('id', documentId);
    if (updatedDocument.error) throw updatedDocument.error;

    const nextStatus = record.status === 'convertido' ? 'convertido' : kind === 'contrato' ? 'contrato_gerado' : record.contract_document_id ? 'contrato_gerado' : 'orcamento_gerado';
    const updatedRecord = await service.from('commercial_records').update({ status: nextStatus, updated_at: new Date().toISOString() }).eq('id', record.id);
    if (updatedRecord.error) throw updatedRecord.error;
    await service.from('audit_log').insert({ user_id: user.id, action: `generate_commercial_${kind}_docx`, entity_type: 'commercial_records', entity_id: record.id, details: { document_id: documentId, path, quote_number: record.quote_number, contract_number: record.contract_number } });
    return json({ generated: true, documentId, path, quoteNumber: record.quote_number, contractNumber: record.contract_number });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível gerar o documento comercial.';
    return json({ error: message }, message.includes('Acesso') ? 403 : message.includes('Sessão') ? 401 : 500);
  }
});
