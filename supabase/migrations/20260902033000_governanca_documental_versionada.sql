
create table if not exists public.contract_master_versions (
  id uuid primary key default gen_random_uuid(),
  version integer not null unique,
  label text not null,
  body text not null,
  notes text,
  active boolean not null default false,
  effective_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create unique index if not exists contract_master_one_active_idx
on public.contract_master_versions ((active))
where active=true;

create table if not exists public.service_catalog_versions (
  id uuid primary key default gen_random_uuid(),
  service_code text not null,
  version integer not null,
  snapshot jsonb not null,
  contract_master_version integer,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique(service_code,version)
);

create table if not exists public.service_level_catalog_versions (
  id uuid primary key default gen_random_uuid(),
  level_code text not null,
  version integer not null,
  snapshot jsonb not null,
  contract_master_version integer,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique(level_code,version)
);

create table if not exists public.document_text_catalog (
  code text primary key,
  document_kind text not null,
  title text not null,
  body text not null,
  contract_clause_refs text[] not null default '{}'::text[],
  version integer not null default 1,
  active boolean not null default true,
  last_contract_master_version integer,
  updated_at timestamptz not null default now()
);

create table if not exists public.document_text_catalog_versions (
  id uuid primary key default gen_random_uuid(),
  text_code text not null,
  version integer not null,
  snapshot jsonb not null,
  contract_master_version integer,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique(text_code,version)
);

create table if not exists public.document_rule_reviews (
  id uuid primary key default gen_random_uuid(),
  contract_master_version integer not null,
  source_type text not null check (source_type in ('service','level','text')),
  source_code text not null,
  clause_refs text[] not null default '{}'::text[],
  reason text not null,
  status text not null default 'pending' check (status in ('pending','resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid,
  unique(contract_master_version,source_type,source_code)
);

alter table public.service_catalog add column if not exists last_contract_master_version integer;
alter table public.service_level_catalog add column if not exists last_contract_master_version integer;
alter table public.commercial_records add column if not exists contract_master_id uuid references public.contract_master_versions(id);
alter table public.commercial_records add column if not exists contract_master_version integer;

alter table public.contract_master_versions enable row level security;
alter table public.service_catalog_versions enable row level security;
alter table public.service_level_catalog_versions enable row level security;
alter table public.document_text_catalog enable row level security;
alter table public.document_text_catalog_versions enable row level security;
alter table public.document_rule_reviews enable row level security;

drop policy if exists contract_master_admin_read on public.contract_master_versions;
create policy contract_master_admin_read on public.contract_master_versions
for select to authenticated using (public.is_portal_admin());

drop policy if exists service_catalog_versions_admin_read on public.service_catalog_versions;
create policy service_catalog_versions_admin_read on public.service_catalog_versions
for select to authenticated using (public.is_portal_admin());

drop policy if exists service_level_versions_admin_read on public.service_level_catalog_versions;
create policy service_level_versions_admin_read on public.service_level_catalog_versions
for select to authenticated using (public.is_portal_admin());

drop policy if exists document_text_catalog_admin_read on public.document_text_catalog;
create policy document_text_catalog_admin_read on public.document_text_catalog
for select to authenticated using (public.is_portal_admin());

drop policy if exists document_text_versions_admin_read on public.document_text_catalog_versions;
create policy document_text_versions_admin_read on public.document_text_catalog_versions
for select to authenticated using (public.is_portal_admin());

drop policy if exists document_rule_reviews_admin_read on public.document_rule_reviews;
create policy document_rule_reviews_admin_read on public.document_rule_reviews
for select to authenticated using (public.is_portal_admin());

grant select on public.contract_master_versions,public.service_catalog_versions,
  public.service_level_catalog_versions,public.document_text_catalog,
  public.document_text_catalog_versions,public.document_rule_reviews to authenticated;

insert into public.contract_master_versions(version,label,body,notes,active)
select 1,'Contrato Mestre v1',$contract$
CLÁUSULA 1ª – DO OBJETO
1.1. O presente contrato tem por objeto a prestação, pelo(a) CONTRATADO(A) ao(à) CONTRATANTE, de serviços técnicos de engenharia relativos ao imóvel/empreendimento identificado no Anexo I, compreendendo os projetos, serviços, etapas, entregáveis, formato de entrega e valores integralmente descritos no Anexo I (Escopo de Serviços, Proposta Comercial e Cronograma), parte integrante e indissociável deste instrumento, o qual prevalece como fonte única e definitiva para a delimitação do escopo contratado.
1.2. Consideram-se incluídos no objeto apenas os itens expressamente descritos no Anexo I. Qualquer serviço, projeto complementar, prancha adicional, detalhamento extra ou compatibilização não listada no Anexo I será considerado SERVIÇO ADICIONAL, sujeito a orçamento e cobrança à parte, mediante aditivo contratual prévio.
1.3. Os projetos serão entregues no(s) formato(s) especificado(s) no Anexo I (ex.: PDF, DWG, IFC, RVT). O fornecimento de arquivos em formato editável não previsto no Anexo I será considerado SERVIÇO ADICIONAL.
1.4. Quando o Anexo I incluir serviços de legalização, aprovação, regularização e/ou obtenção de Alvará de Construção, Habite-se ou documentos equivalentes perante órgãos públicos, o acompanhamento técnico e administrativo do respectivo processo integra o objeto contratado, sem prejuízo das taxas e despesas, que permanecem de responsabilidade exclusiva do(a) CONTRATANTE.
1.5. Os serviços de projeto poderão ser contratados em um dos níveis de experiência — BRONZE (Essencial), PRATA (Visual) ou OURO (Imersivo) —, prevalecendo o Anexo I como fonte única do escopo e condições efetivamente contratadas.
1.5.1. BRONZE (Essencial): documentação técnica objetiva do projeto, sem plantas humanizadas, renderização 3D, vídeo ou tour virtual.
1.5.2. PRATA (Visual): inclui os conteúdos do nível BRONZE, acrescidos de plantas humanizadas e renderização 3D em imagens estáticas.
1.5.3. OURO (Imersivo): inclui os conteúdos dos níveis anteriores, acrescidos de renderização 3D em vídeo, tour virtual 360° e curadoria integral dos catálogos de materiais, mobiliário e acabamentos.
1.6. O(A) CONTRATANTE declara ter recebido e analisado o Catálogo de Serviços previamente à assinatura, estando ciente das características e exclusões do nível escolhido.
1.7. Os níveis de experiência aplicam-se exclusivamente aos serviços de projeto. Execução de obra, gerenciamento, visitas técnicas, projetos complementares, levantamentos, taxas e aprovações somente integrarão o objeto se expressamente descritos no Anexo I.
1.8. A entrega realizada em conformidade com o nível e o escopo contratados não será considerada parcial ou incompleta por não contemplar recursos de nível superior não contratado.
1.9. Migração para nível superior será tratada como alteração de escopo, sujeita a orçamento prévio e aditivo contratual. Downgrade após o início depende de concordância do(a) CONTRATADO(A) e não gera reembolso por serviços já executados ou em execução.
CLÁUSULA 2ª – DO PRAZO DE EXECUÇÃO
2.1. O prazo para elaboração e entrega dos projetos é de 45 (quarenta e cinco) dias úteis, podendo ser ajustado no Anexo I, contados da assinatura deste instrumento E do recebimento de todas as informações, documentos, levantamentos e definições necessárias, o que ocorrer por último.
2.2. O prazo ficará automaticamente suspenso em caso de atraso do(a) CONTRATANTE no fornecimento de informações, documentos, medidas, aprovações ou definições; alteração de escopo após o início; ou caso fortuito/força maior. O prazo será retomado após a regularização, acrescido, se necessário, de prazo proporcional ao impacto.
2.3. Solicitações de alteração de escopo, informação pendente ou suspensão deverão ser formalizadas por escrito nos canais oficiais.
CLÁUSULA 3ª – DOS DOCUMENTOS E INFORMAÇÕES COMPLEMENTARES (BRIEFINGS)
3.1. O(A) CONTRATADO(A) poderá encaminhar questionários, briefings e listas de definição necessários ao desenvolvimento das etapas.
3.2. O(A) CONTRATANTE terá até [5 (cinco)] dias úteis do recebimento para preencher e devolver cada documento complementar.
3.3. Findo o prazo sem devolução, será enviado lembrete formal, concedendo novo prazo de [5 (cinco)] dias úteis.
3.4. Persistindo a ausência de resposta, o(a) CONTRATADO(A) poderá comunicar sua intenção de adotar especificações técnicas padrão e/ou suspender a etapa dependente, concedendo prazo adicional de [3 (três)] dias úteis para manifestação em contrário.
3.5. Alterações em definições já respondidas e incorporadas ao projeto serão tratadas como alteração de escopo.
3.6. Atrasos na devolução equivalem a atraso no fornecimento de informações necessárias à continuidade dos trabalhos.
CLÁUSULA 4ª – DO LEVANTAMENTO TÉCNICO E DA VISTORIA PRÉVIA
4.1. O projeto será desenvolvido com base nas medidas, plantas, levantamentos e dados técnicos fornecidos pelo(a) CONTRATANTE ou por profissional/empresa por ele(a) indicado(a), presumindo-se sua exatidão.
4.2. Vistoria técnica e/ou levantamento de medidas realizado pelo(a) CONTRATADO(A), quando não incluído no Anexo I, será cobrado à parte mediante orçamento prévio aprovado por escrito.
4.3. Divergências entre a realidade física do imóvel e os dados fornecidos pelo(a) CONTRATANTE ou terceiro não geram responsabilidade ao(à) CONTRATADO(A); ajustes decorrentes serão tratados como serviço adicional.
CLÁUSULA 5ª – DO VALOR E DAS CONDIÇÕES DE PAGAMENTO
5.1. Pela prestação dos serviços descritos no Anexo I, o(a) CONTRATANTE pagará ao(à) CONTRATADO(A) o valor total ali detalhado, conforme parcelas e etapas nele previstas.
5.2. Os pagamentos serão realizados nas datas e condições pactuadas pelos meios informados pelo(a) CONTRATADO(A), sendo o comprovante suficiente para quitação da respectiva parcela.
5.3. Concluída cada etapa ou correção/ajuste solicitado, o(a) CONTRATADO(A) fará a entrega formal e emitirá a cobrança. O(A) CONTRATANTE terá até 30 (trinta) dias corridos da entrega/notificação para efetuar o pagamento correspondente.
5.3.1. O decurso do prazo de 30 dias sem manifestação não suspende nem exime a obrigação de pagamento, sem prejuízo do direito de solicitar ajustes técnicos nos termos da Cláusula 6ª.
5.4. Em caso de atraso no pagamento, incidirão multa moratória de 2%, juros de 1% ao mês pro rata die e correção monetária pelo índice indicado no instrumento definitivo, sem prejuízo da suspensão dos serviços.
5.5. Os valores pactuados não incluem taxas, emolumentos, tarifas ou despesas cobradas por órgãos públicos, cartórios, concessionárias ou entidades de classe, inclusive ART/RRT, de responsabilidade exclusiva do(a) CONTRATANTE.
5.6. Nos serviços de legalização, aprovação, regularização, protocolo ou acompanhamento perante órgãos públicos, todas as taxas e custas são de responsabilidade exclusiva do(a) CONTRATANTE.
CLÁUSULA 6ª – DAS REVISÕES E CORREÇÕES DO PROJETO
6.1. Estão incluídas as rodadas de revisão/correção especificadas no Anexo I ou, na ausência de indicação, até 2 (duas) rodadas, destinadas a ajustes dentro do escopo original.
6.2. São serviços adicionais as revisões excedentes, alterações de programa, metragem, layout, partido ou premissas já aprovadas, mudanças após aprovação formal de etapa e adequações decorrentes de informações incorretas ou incompletas fornecidas pelo(a) CONTRATANTE.
6.2.1. Adequações exigidas diretamente por órgão público no processo de legalização contratado integram o serviço, exceto quando decorrentes de alteração de escopo ou de informações incorretas/incompletas fornecidas pelo(a) CONTRATANTE.
6.3. Cada pedido de correção deverá ser encaminhado por escrito e de forma consolidada em até 10 (dez) dias corridos da entrega. Passado esse prazo sem manifestação, presume-se, exclusivamente para contagem de prazos e cobrança, que não foram identificadas pendências na etapa, sem prejuízo do direito de correção de vícios técnicos.
6.4. Serviços adicionais e revisões extraordinárias seguirão o prazo de cobrança previsto no item 5.3.
6.5. Ao final de cada etapa principal, o(a) CONTRATADO(A) encaminhará Termo de Aceite de Etapa, sem prejuízo da presunção prevista no item 6.3 em caso de não devolução.
CLÁUSULA 7ª – DOS HONORÁRIOS ADICIONAIS POR ATRASO, RETRABALHO E DESCUMPRIMENTO DE PRAZOS
7.1. O atraso do(a) CONTRATANTE no fornecimento de informações, documentos, medidas, aprovações ou definições, quando ultrapassar [10 (dez)] dias corridos da solicitação formal, poderá sujeitá-lo à compensação financeira indicada no instrumento definitivo, sem prejuízo da suspensão dos prazos.
7.2. Alterações de escopo ou premissas após aprovação poderão ser cobradas a R$ 180,00 por hora técnica ou 20% sobre o valor da etapa afetada, conforme critério indicado em orçamento prévio aprovado por escrito antes do início do trabalho adicional.
7.3. Três ou mais alterações de escopo poderão ensejar revisão do cronograma remanescente e/ou aditivo com novos valores e prazos.
7.4. Em caso de atraso por culpa exclusiva do(a) CONTRATADO(A), superior a [10 (dez)] dias além do prazo pactuado, poderá ser concedido desconto de [1%] sobre a etapa em atraso a cada [5] dias adicionais, limitado a [10%] do valor total do contrato, sem limitação de direitos legais.
7.5. Os valores desta cláusula seguem o prazo de cobrança do item 5.3 e serão comunicados por escrito com memória de cálculo.
CLÁUSULA 8ª – DO CARÁTER ILUSTRATIVO DE IMAGENS E RENDERS 3D
8.1. Imagens, renders, maquetes, perspectivas e simulações visuais têm caráter ilustrativo e não constituem garantia de resultado exato quanto a cores, texturas, brilho, iluminação, sombreamento ou aspecto final dos materiais e acabamentos.
8.2. Ajustes de leiaute, dimensões ou disposição necessários à realidade construtiva não serão considerados vício do projeto, aplicando-se, quando cabível, a Cláusula 6ª.
CLÁUSULA 9ª – DAS ALTERAÇÕES NO LOCAL E DO PROJETO AS BUILT
9.1. Alterações físicas executadas no imóvel em desacordo com o projeto tornam eventual atualização as built um serviço adicional, sujeito a orçamento prévio aprovado por escrito.
9.2. O(A) CONTRATADO(A) não é responsável por manter o projeto atualizado em relação a alterações executadas sem sua ciência e aprovação prévia e por escrito.
9.3. O levantamento e a elaboração do as built seguem os prazos de cobrança aplicáveis e podem exigir nova vistoria técnica.
CLÁUSULA 10ª – DAS OBRIGAÇÕES DO(A) CONTRATADO(A)
10.1. Executar os serviços com zelo, diligência e observância das normas técnicas e legislação aplicável ao local do imóvel.
10.2. Emitir ART/RRT referente aos serviços prestados, cujo custo será suportado pelo(a) CONTRATANTE.
10.3. Entregar os projetos completos e com as informações técnicas necessárias ao escopo contratado.
10.4. Manter o(a) CONTRATANTE informado(a) e cumprir os prazos e marcos, ressalvadas as hipóteses de suspensão.
10.5. Responsabilizar-se tecnicamente pelos serviços que efetivamente executar, não respondendo por falhas de execução de terceiros fora de sua supervisão contratual.
10.6. Responder, nos termos legais, pela solidez e segurança dos serviços estruturais que eventualmente prestar, desde que a execução observe fielmente o projeto e as especificações técnicas.
CLÁUSULA 11ª – DAS OBRIGAÇÕES DO(A) CONTRATANTE
11.1. Fornecer em tempo hábil todas as informações, documentos, levantamentos, medidas e definições necessárias.
11.2. Efetuar os pagamentos nas datas e condições pactuadas.
11.3. Analisar e se manifestar sobre os materiais entregues nos prazos estabelecidos.
11.4. Não utilizar, reproduzir ou repassar a terceiros os projetos e informações técnicas antes da quitação integral dos valores devidos.
11.5. Comunicar por escrito qualquer alteração de escopo e formalizar o respectivo aditivo quando necessário.
11.6. Comunicar previamente qualquer alteração física executada no imóvel em desacordo com o projeto entregue.
11.7. Em serviços perante órgãos públicos, fornecer tempestivamente todos os documentos e informações exigidos e assinar os requerimentos necessários.
CLÁUSULA 12ª – DA SUSPENSÃO DOS SERVIÇOS POR INADIMPLÊNCIA
12.1. O(A) CONTRATADO(A) poderá suspender a execução e/ou entrega de novas etapas em caso de atraso de pagamento superior a 15 (quinze) dias, mediante notificação, sem que isso configure quebra contratual.
CLÁUSULA 13ª – DA PROPRIEDADE INTELECTUAL E USO DO PROJETO
13.1. Os direitos autorais sobre projetos, desenhos, memoriais e documentos técnicos permanecem com o(a) CONTRATADO(A), sendo cedido ao(à) CONTRATANTE o direito de uso para a finalidade e o imóvel contratados, condicionado à quitação integral.
13.2. É vedada a reprodução, alteração ou utilização dos projetos em outras obras/imóveis ou por terceiros sem autorização expressa e por escrito do(a) CONTRATADO(A).
13.3. A divulgação do projeto pelo(a) CONTRATANTE deve manter os devidos créditos de autoria.
13.4. Reprodução, adaptação ou utilização não autorizada em outra obra configura violação de direitos autorais, sujeita às medidas legais cabíveis.
CLÁUSULA 14ª – DA CONFIDENCIALIDADE E PROTEÇÃO DE DADOS
14.1. As partes manterão sigilo sobre informações técnicas, comerciais e pessoais trocadas em razão do contrato pelo prazo de [2 (dois)] anos após seu término.
14.1.1. Recomendações, avaliações ou depoimentos públicos não constituem quebra de sigilo desde que não revelem dados pessoais de terceiros, valores pactuados ou detalhes técnicos sigilosos.
14.2. Para fins da LGPD, os dados pessoais necessários à execução contratual serão tratados para essa finalidade e mantidos pelo período necessário ao cumprimento de obrigações contratuais, fiscais e legais.
14.3. O(A) CONTRATANTE poderá exercer os direitos previstos na LGPD mediante solicitação pelos canais oficiais.
CLÁUSULA 15ª – DO DIREITO DE ARREPENDIMENTO
15.1. Quando aplicável o Código de Defesa do Consumidor e a contratação ocorrer fora do estabelecimento comercial, poderá ser exercido o direito de arrependimento no prazo legal de 7 (sete) dias corridos.
15.2. O exercício do arrependimento deverá ser comunicado por escrito, com devolução dos valores cabíveis nos termos da legislação aplicável.
15.3. Se os serviços já tiverem sido iniciados a pedido expresso do(a) CONTRATANTE dentro do prazo de reflexão, será devido o pagamento proporcional aos serviços efetivamente prestados.
15.4. Superado o prazo legal sem manifestação, aplicam-se as regras de rescisão contratual.
CLÁUSULA 16ª – DA RESCISÃO
16.1. O contrato poderá ser rescindido por mútuo acordo mediante aviso prévio por escrito de [15 (quinze)] dias.
16.2. Na rescisão sem justa causa por iniciativa do(a) CONTRATANTE, serão devidos os valores proporcionais aos serviços executados e eventual multa de [10%] sobre o saldo remanescente, nos termos do instrumento definitivo.
16.3. Na rescisão sem justa causa por iniciativa do(a) CONTRATADO(A), o(a) CONTRATANTE terá direito à devolução dos valores referentes às etapas não iniciadas ou não concluídas, sem prejuízo do pagamento das etapas concluídas.
16.4. Em caso de rescisão por inadimplemento, a parte infratora arcará com multa equivalente a 10% do valor total do contrato, sem prejuízo de perdas e danos comprovados.
16.5. Não constitui motivo de rescisão pelo(a) CONTRATANTE o atraso decorrente das hipóteses de suspensão quando a mora for do próprio CONTRATANTE.
CLÁUSULA 17ª – DA LIMITAÇÃO DE RESPONSABILIDADE
17.1. O(A) CONTRATADO(A) não se responsabiliza por erros de execução de terceiros fora de sua supervisão, alterações não autorizadas, informações incorretas fornecidas pelo(a) CONTRATANTE, força maior, taxas de órgãos públicos ou condições comerciais de fornecedores indicados em materiais de curadoria.
17.2. A responsabilidade civil do(a) CONTRATADO(A), quando aplicável, limita-se aos serviços efetivamente por ele(a) prestados, nos termos legais.
CLÁUSULA 18ª – DA SOLIDARIEDADE ENTRE CONTRATANTES
18.1. Havendo mais de uma pessoa como CONTRATANTE, todas responderão solidariamente pelas obrigações assumidas, especialmente quanto ao pagamento integral.
CLÁUSULA 19ª – DA FORÇA MAIOR
19.1. Nenhuma parte responderá por descumprimento decorrente de caso fortuito ou força maior, nos termos do art. 393 do Código Civil.
19.2. A parte impossibilitada deverá comunicar a outra por escrito em até 5 (cinco) dias corridos, descrevendo a natureza e o impacto estimado.
19.3. Cessada a causa impeditiva, os prazos serão retomados, prorrogados pelo período correspondente à duração comprovada do evento.
CLÁUSULA 20ª – DAS NOTIFICAÇÕES E COMUNICAÇÕES OFICIAIS
20.1. São canais oficiais os e-mails e telefones/WhatsApp indicados pelas partes, o Portal do Cliente e o e-mail profissional do(a) CONTRATADO(A).
20.1.1. Comunicações, entregas e cobranças realizadas pelo Portal do Cliente ficam registradas com data e hora e servem como prova para contagem dos prazos contratuais.
20.2. Notificações e comunicações serão consideradas válidas quando enviadas pelos canais oficiais, presumindo-se recebidas em até 2 (dois) dias úteis após o envio, salvo prova de indisponibilidade.
20.3. Alterações dos canais de contato deverão ser comunicadas por escrito.
CLÁUSULA 21ª – DISPOSIÇÕES GERAIS
21.1. Este contrato, juntamente com o Anexo I, constitui o acordo integral entre as partes.
21.2. Toda comunicação relevante deverá ser feita por escrito nos canais oficiais, servindo como meio de prova.
21.3. A tolerância quanto a eventual descumprimento não implica novação ou renúncia de direitos.
21.4. Alterações a este contrato somente serão válidas se formalizadas por escrito e assinadas por ambas as partes.
CLÁUSULA 22ª – DA MEDIAÇÃO PRÉVIA
22.1. Antes da via judicial, as partes envidarão esforços razoáveis para negociação direta ou mediação extrajudicial, sem prejuízo do acesso à tutela jurisdicional.
CLÁUSULA 23ª – DO FORO
23.1. Fica eleito o foro da Comarca de [cidade/UF] para dirimir dúvidas ou controvérsias oriundas deste contrato, sem prejuízo do direito do consumidor ao foro de seu domicílio quando aplicável.
$contract$,'Versão inicial congelada a partir do contrato de produção vigente em 02/09/2026.',true
where not exists (select 1 from public.contract_master_versions);

update public.service_catalog set last_contract_master_version=coalesce(last_contract_master_version,1);
update public.service_level_catalog set last_contract_master_version=coalesce(last_contract_master_version,1);

insert into public.service_catalog_versions(service_code,version,snapshot,contract_master_version)
select s.code,s.version,to_jsonb(s),coalesce(s.last_contract_master_version,1)
from public.service_catalog s
on conflict(service_code,version) do nothing;

insert into public.service_level_catalog_versions(level_code,version,snapshot,contract_master_version)
select l.code,l.version,to_jsonb(l),coalesce(l.last_contract_master_version,1)
from public.service_level_catalog l
on conflict(level_code,version) do nothing;

insert into public.document_text_catalog(code,document_kind,title,body,contract_clause_refs,version,last_contract_master_version)
values
('proposal_scope_governance','orcamento','Coerência entre proposta, contrato e Anexo I',
 'Esta proposta organiza o escopo e as condições comerciais sem ampliar, por si só, as obrigações contratuais. Após a formalização, o Contrato e o Anexo I passam a reger definitivamente a relação entre as partes.',
 array['1.1','1.2'],1,1),
('proposal_revision_rule','orcamento','Revisões da proposta',
 'Na ausência de indicação específica no Anexo I, aplicam-se até 2 (duas) rodadas de revisão por etapa para ajustes dentro do escopo original. Alterações de programa, metragem, layout, partido ou premissas já aprovadas podem caracterizar alteração de escopo.',
 array['2.1','2.2'],1,1),
('proposal_timeline_rule','orcamento','Prazo de referência',
 'O prazo geral de referência é de 45 (quarenta e cinco) dias úteis, contado conforme as condições previstas no Contrato, podendo ser ajustado no Anexo I em função do escopo efetivamente contratado. Prazos de análise de órgãos públicos e terceiros não se confundem com o prazo técnico de elaboração.',
 array['3.1','3.2'],1,1),
('anexo_scope_governance','anexo_i','Função do Anexo I',
 'Este Anexo I integra o Contrato e constitui a referência específica para o escopo, entregáveis, revisões, formatos, valores e planejamento da contratação. Somente os itens expressamente indicados como incluídos integram o objeto.',
 array['1.1','1.2'],1,1),
('anexo_revision_rule','anexo_i','Revisões e alterações',
 'Na ausência de indicação diversa em item específico, aplicam-se até 2 (duas) rodadas de revisão por etapa para ajustes dentro do escopo original. Pedidos que alterem programa, metragem, layout, partido, premissas aprovadas ou serviços não listados poderão exigir orçamento e aditivo.',
 array['2.1','2.2'],1,1),
('acceptance_rule','termo_aceite','Regra de aceite',
 'O(A) CONTRATANTE poderá apontar por escrito eventuais inconsistências dentro do prazo contratual de manifestação. O aceite desta etapa não amplia o escopo originalmente contratado e não impede a correção de vícios técnicos.',
 array['6.3'],1,1),
('additional_service_rule','servico_adicional','Serviço adicional',
 'O serviço adicional somente será iniciado após aprovação por escrito. Valores, horas ou percentuais devem respeitar o Contrato e o orçamento específico aprovado para esta alteração.',
 array['1.2','2.2'],1,1),
('notification_rule','notificacao_formal','Notificação por pendência',
 'A contagem dos prazos de execução pode permanecer suspensa quando a falta de manifestação impedir tecnicamente a continuidade dos serviços. Eventuais efeitos financeiros ou serviços adicionais somente serão aplicados quando houver fundamento no Contrato, no Anexo I e comunicação correspondente.',
 array['3.1','6.3'],1,1),
('study_prelim_limit','estudo_preliminar','Limites do Estudo Preliminar',
 'O Estudo Preliminar não substitui Projeto Legal, Projeto Executivo ou projetos complementares. Após sua validação, seguem somente as etapas efetivamente contratadas no Anexo I. Alterações posteriores de premissas já aprovadas podem caracterizar alteração de escopo.',
 array['1.1','1.2','2.1'],1,1),
('survey_limit','levantamento_tecnico','Limites da vistoria',
 'O registro limita-se às condições acessíveis e observáveis no momento da visita e não substitui ensaios, investigações destrutivas ou serviços especializados não contratados.',
 array['4.1','4.2','4.3'],1,1),
('image_authorization_conditions','autorizacao_imagem','Condições de uso de imagem',
 'A autorização é gratuita e não exclusiva, limitada aos materiais e canais assinalados. A divulgação deverá respeitar as restrições indicadas, a legislação aplicável e os direitos autorais técnicos.',
 array['8.1','8.2'],1,1),
('closing_release_rule','quitacao_encerramento','Limites da quitação',
 'A quitação, quando assinalada, refere-se às obrigações identificadas neste instrumento e não representa renúncia a direitos irrenunciáveis ou exclusão de responsabilidades legais.',
 array['12.1','12.2'],1,1)
on conflict(code) do nothing;

insert into public.document_text_catalog_versions(text_code,version,snapshot,contract_master_version)
select t.code,t.version,to_jsonb(t),coalesce(t.last_contract_master_version,1)
from public.document_text_catalog t
on conflict(text_code,version) do nothing;

create or replace function public.admin_document_governance_status()
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare v_contract jsonb;
begin
  if not public.is_portal_admin() then raise exception 'Acesso administrativo necessário'; end if;

  select to_jsonb(c) - 'body' into v_contract
  from public.contract_master_versions c
  where c.active=true order by c.version desc limit 1;

  return jsonb_build_object(
    'contract',coalesce(v_contract,'{}'::jsonb),
    'pending_reviews',coalesce((
      select jsonb_agg(to_jsonb(r) order by r.source_type,r.source_code)
      from public.document_rule_reviews r
      where r.status='pending'
        and r.contract_master_version=coalesce((v_contract->>'version')::int,1)
    ),'[]'::jsonb),
    'services',coalesce((select jsonb_agg(to_jsonb(s) order by s.code) from public.service_catalog s where s.active=true),'[]'::jsonb),
    'levels',coalesce((select jsonb_agg(to_jsonb(l) order by l.code) from public.service_level_catalog l where l.active=true),'[]'::jsonb),
    'texts',coalesce((select jsonb_agg(to_jsonb(t) order by t.document_kind,t.code) from public.document_text_catalog t where t.active=true),'[]'::jsonb)
  );
end
$function$;

create or replace function public.admin_contract_master_current()
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare v_row public.contract_master_versions%rowtype;
begin
  if not public.is_portal_admin() then raise exception 'Acesso administrativo necessário'; end if;
  select * into v_row from public.contract_master_versions where active=true order by version desc limit 1;
  return coalesce(to_jsonb(v_row),'{}'::jsonb);
end
$function$;

create or replace function public.admin_publish_contract_master(
  p_body text,
  p_label text,
  p_notes text default null,
  p_changed_clause_refs text[] default '{}'::text[]
)
returns uuid
language plpgsql
security definer
set search_path=public
as $function$
declare v_id uuid; v_version integer; v_refs text[];
begin
  if not public.is_portal_admin() then raise exception 'Acesso administrativo necessário'; end if;
  if nullif(btrim(p_body),'') is null then raise exception 'O texto do contrato mestre é obrigatório'; end if;
  if nullif(btrim(p_label),'') is null then raise exception 'Informe um nome para a nova versão'; end if;

  select coalesce(max(version),0)+1 into v_version from public.contract_master_versions;
  update public.contract_master_versions set active=false where active=true;

  insert into public.contract_master_versions(version,label,body,notes,active,created_by)
  values(v_version,btrim(p_label),p_body,nullif(btrim(p_notes),''),true,auth.uid())
  returning id into v_id;

  v_refs := coalesce(p_changed_clause_refs,'{}'::text[]);

  insert into public.document_rule_reviews(contract_master_version,source_type,source_code,clause_refs,reason)
  select v_version,'service',s.code,s.contract_clause_refs,
    case when cardinality(v_refs)=0 then 'Nova versão do contrato publicada; revisar coerência do serviço.'
         else 'Cláusula contratual relacionada ao serviço foi alterada.' end
  from public.service_catalog s
  where s.active=true and (cardinality(v_refs)=0 or s.contract_clause_refs && v_refs)
  on conflict(contract_master_version,source_type,source_code) do nothing;

  insert into public.document_rule_reviews(contract_master_version,source_type,source_code,clause_refs,reason)
  select v_version,'level',l.code,l.contract_clause_refs,
    case when cardinality(v_refs)=0 then 'Nova versão do contrato publicada; revisar coerência do nível.'
         else 'Cláusula contratual relacionada ao nível foi alterada.' end
  from public.service_level_catalog l
  where l.active=true and (cardinality(v_refs)=0 or l.contract_clause_refs && v_refs)
  on conflict(contract_master_version,source_type,source_code) do nothing;

  insert into public.document_rule_reviews(contract_master_version,source_type,source_code,clause_refs,reason)
  select v_version,'text',t.code,t.contract_clause_refs,
    case when cardinality(v_refs)=0 then 'Nova versão do contrato publicada; revisar coerência do texto padrão.'
         else 'Cláusula contratual relacionada ao texto padrão foi alterada.' end
  from public.document_text_catalog t
  where t.active=true and (cardinality(v_refs)=0 or t.contract_clause_refs && v_refs)
  on conflict(contract_master_version,source_type,source_code) do nothing;

  insert into public.audit_log(user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'publish_contract_master','contract_master_versions',v_id,
    jsonb_build_object('version',v_version,'label',p_label,'changed_clause_refs',to_jsonb(v_refs)));

  return v_id;
end
$function$;

create or replace function public.admin_upsert_service_catalog(p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_code text := lower(nullif(btrim(p_data->>'code'),''));
  v_old public.service_catalog%rowtype;
  v_version integer;
  v_master integer;
  v_row public.service_catalog%rowtype;
begin
  if not public.is_portal_admin() then raise exception 'Acesso administrativo necessário'; end if;
  if v_code is null or v_code !~ '^[a-z0-9_-]+$' then raise exception 'Código de serviço inválido'; end if;
  if nullif(btrim(p_data->>'name'),'') is null then raise exception 'Nome do serviço é obrigatório'; end if;
  if nullif(btrim(p_data->>'description'),'') is null then raise exception 'Descrição do serviço é obrigatória'; end if;

  select version into v_master from public.contract_master_versions where active=true order by version desc limit 1;
  select * into v_old from public.service_catalog where code=v_code;
  v_version := case when found then v_old.version+1 else 1 end;

  if v_old.code is not null then
    insert into public.service_catalog_versions(service_code,version,snapshot,contract_master_version,created_by)
    values(v_old.code,v_old.version,to_jsonb(v_old),v_old.last_contract_master_version,auth.uid())
    on conflict(service_code,version) do nothing;
  end if;

  insert into public.service_catalog(
    code,name,category,level_applicable,description,deliverables,exclusions,client_inputs,
    default_revisions,delivery_formats,acceptance_required,planning_reference,
    contract_clause_refs,version,active,updated_at,last_contract_master_version
  ) values (
    v_code,btrim(p_data->>'name'),coalesce(nullif(btrim(p_data->>'category'),''),'projeto'),
    coalesce((p_data->>'level_applicable')::boolean,false),btrim(p_data->>'description'),
    coalesce(p_data->'deliverables','[]'::jsonb),coalesce(p_data->'exclusions','[]'::jsonb),
    coalesce(p_data->'client_inputs','[]'::jsonb),nullif(p_data->>'default_revisions','')::integer,
    coalesce(p_data->'delivery_formats','["PDF"]'::jsonb),
    coalesce((p_data->>'acceptance_required')::boolean,true),
    nullif(btrim(p_data->>'planning_reference'),''),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_data->'contract_clause_refs','[]'::jsonb))),'{}'::text[]),
    v_version,true,now(),v_master
  )
  on conflict(code) do update set
    name=excluded.name,category=excluded.category,level_applicable=excluded.level_applicable,
    description=excluded.description,deliverables=excluded.deliverables,exclusions=excluded.exclusions,
    client_inputs=excluded.client_inputs,default_revisions=excluded.default_revisions,
    delivery_formats=excluded.delivery_formats,acceptance_required=excluded.acceptance_required,
    planning_reference=excluded.planning_reference,contract_clause_refs=excluded.contract_clause_refs,
    version=excluded.version,active=true,updated_at=now(),last_contract_master_version=v_master
  returning * into v_row;

  insert into public.service_catalog_versions(service_code,version,snapshot,contract_master_version,created_by)
  values(v_row.code,v_row.version,to_jsonb(v_row),v_master,auth.uid())
  on conflict(service_code,version) do nothing;

  update public.document_rule_reviews
  set status='resolved',resolved_at=now(),resolved_by=auth.uid()
  where status='pending' and source_type='service' and source_code=v_code and contract_master_version=v_master;

  return to_jsonb(v_row);
end
$function$;

create or replace function public.admin_upsert_service_level(p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_code text := lower(nullif(btrim(p_data->>'code'),''));
  v_old public.service_level_catalog%rowtype;
  v_version integer;
  v_master integer;
  v_row public.service_level_catalog%rowtype;
begin
  if not public.is_portal_admin() then raise exception 'Acesso administrativo necessário'; end if;
  if v_code is null or v_code !~ '^[a-z0-9_-]+$' then raise exception 'Código do nível inválido'; end if;
  if nullif(btrim(p_data->>'label'),'') is null then raise exception 'Nome do nível é obrigatório'; end if;
  if nullif(btrim(p_data->>'description'),'') is null then raise exception 'Descrição do nível é obrigatória'; end if;

  select version into v_master from public.contract_master_versions where active=true order by version desc limit 1;
  select * into v_old from public.service_level_catalog where code=v_code;
  v_version := case when found then v_old.version+1 else 1 end;

  if v_old.code is not null then
    insert into public.service_level_catalog_versions(level_code,version,snapshot,contract_master_version,created_by)
    values(v_old.code,v_old.version,to_jsonb(v_old),v_old.last_contract_master_version,auth.uid())
    on conflict(level_code,version) do nothing;
  end if;

  insert into public.service_level_catalog(
    code,label,subtitle,description,features,exclusions,contract_clause_refs,
    version,active,updated_at,last_contract_master_version
  ) values (
    v_code,upper(btrim(p_data->>'label')),coalesce(nullif(btrim(p_data->>'subtitle'),''),'Personalizado'),
    btrim(p_data->>'description'),coalesce(p_data->'features','[]'::jsonb),
    coalesce(p_data->'exclusions','[]'::jsonb),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_data->'contract_clause_refs','[]'::jsonb))),'{}'::text[]),
    v_version,true,now(),v_master
  )
  on conflict(code) do update set
    label=excluded.label,subtitle=excluded.subtitle,description=excluded.description,
    features=excluded.features,exclusions=excluded.exclusions,
    contract_clause_refs=excluded.contract_clause_refs,version=excluded.version,
    active=true,updated_at=now(),last_contract_master_version=v_master
  returning * into v_row;

  insert into public.service_level_catalog_versions(level_code,version,snapshot,contract_master_version,created_by)
  values(v_row.code,v_row.version,to_jsonb(v_row),v_master,auth.uid())
  on conflict(level_code,version) do nothing;

  update public.document_rule_reviews
  set status='resolved',resolved_at=now(),resolved_by=auth.uid()
  where status='pending' and source_type='level' and source_code=v_code and contract_master_version=v_master;

  return to_jsonb(v_row);
end
$function$;

create or replace function public.admin_upsert_document_text(p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_code text := lower(nullif(btrim(p_data->>'code'),''));
  v_old public.document_text_catalog%rowtype;
  v_version integer;
  v_master integer;
  v_row public.document_text_catalog%rowtype;
begin
  if not public.is_portal_admin() then raise exception 'Acesso administrativo necessário'; end if;
  if v_code is null or v_code !~ '^[a-z0-9_-]+$' then raise exception 'Código do texto inválido'; end if;
  if nullif(btrim(p_data->>'body'),'') is null then raise exception 'Texto padrão é obrigatório'; end if;

  select version into v_master from public.contract_master_versions where active=true order by version desc limit 1;
  select * into v_old from public.document_text_catalog where code=v_code;
  v_version := case when found then v_old.version+1 else 1 end;

  if v_old.code is not null then
    insert into public.document_text_catalog_versions(text_code,version,snapshot,contract_master_version,created_by)
    values(v_old.code,v_old.version,to_jsonb(v_old),v_old.last_contract_master_version,auth.uid())
    on conflict(text_code,version) do nothing;
  end if;

  insert into public.document_text_catalog(
    code,document_kind,title,body,contract_clause_refs,version,active,last_contract_master_version,updated_at
  ) values (
    v_code,coalesce(nullif(btrim(p_data->>'document_kind'),''),'geral'),
    coalesce(nullif(btrim(p_data->>'title'),''),v_code),btrim(p_data->>'body'),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_data->'contract_clause_refs','[]'::jsonb))),'{}'::text[]),
    v_version,true,v_master,now()
  )
  on conflict(code) do update set
    document_kind=excluded.document_kind,title=excluded.title,body=excluded.body,
    contract_clause_refs=excluded.contract_clause_refs,version=excluded.version,
    active=true,last_contract_master_version=v_master,updated_at=now()
  returning * into v_row;

  insert into public.document_text_catalog_versions(text_code,version,snapshot,contract_master_version,created_by)
  values(v_row.code,v_row.version,to_jsonb(v_row),v_master,auth.uid())
  on conflict(text_code,version) do nothing;

  update public.document_rule_reviews
  set status='resolved',resolved_at=now(),resolved_by=auth.uid()
  where status='pending' and source_type='text' and source_code=v_code and contract_master_version=v_master;

  return to_jsonb(v_row);
end
$function$;

create or replace function public.admin_confirm_document_rule_review(p_review_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public
as $function$
declare v_review public.document_rule_reviews%rowtype;
begin
  if not public.is_portal_admin() then raise exception 'Acesso administrativo necessário'; end if;
  select * into v_review from public.document_rule_reviews where id=p_review_id and status='pending';
  if not found then return false; end if;

  update public.document_rule_reviews
  set status='resolved',resolved_at=now(),resolved_by=auth.uid()
  where id=p_review_id;

  if v_review.source_type='service' then
    update public.service_catalog set last_contract_master_version=v_review.contract_master_version where code=v_review.source_code;
  elsif v_review.source_type='level' then
    update public.service_level_catalog set last_contract_master_version=v_review.contract_master_version where code=v_review.source_code;
  elsif v_review.source_type='text' then
    update public.document_text_catalog set last_contract_master_version=v_review.contract_master_version where code=v_review.source_code;
  end if;

  return true;
end
$function$;

create or replace function public.assert_document_governance_ready()
returns void
language plpgsql
security definer
set search_path=public
as $function$
declare v_master integer; v_pending integer;
begin
  select version into v_master from public.contract_master_versions where active=true order by version desc limit 1;
  select count(*) into v_pending
  from public.document_rule_reviews
  where contract_master_version=v_master and status='pending';

  if v_pending > 0 then
    raise exception 'Existem % textos/regras inteligentes pendentes de revisão para o Contrato Mestre v%. Revise em Configurações antes de criar novos documentos comerciais.',v_pending,v_master;
  end if;
end
$function$;

revoke all on function public.admin_document_governance_status() from public,anon;
revoke all on function public.admin_contract_master_current() from public,anon;
revoke all on function public.admin_publish_contract_master(text,text,text,text[]) from public,anon;
revoke all on function public.admin_upsert_service_catalog(jsonb) from public,anon;
revoke all on function public.admin_upsert_service_level(jsonb) from public,anon;
revoke all on function public.admin_upsert_document_text(jsonb) from public,anon;
revoke all on function public.admin_confirm_document_rule_review(uuid) from public,anon;
revoke all on function public.assert_document_governance_ready() from public,anon,authenticated;

grant execute on function public.admin_document_governance_status() to authenticated;
grant execute on function public.admin_contract_master_current() to authenticated;
grant execute on function public.admin_publish_contract_master(text,text,text,text[]) to authenticated;
grant execute on function public.admin_upsert_service_catalog(jsonb) to authenticated;
grant execute on function public.admin_upsert_service_level(jsonb) to authenticated;
grant execute on function public.admin_upsert_document_text(jsonb) to authenticated;
grant execute on function public.admin_confirm_document_rule_review(uuid) to authenticated;
grant execute on function public.assert_document_governance_ready() to service_role;
