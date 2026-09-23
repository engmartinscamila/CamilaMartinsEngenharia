-- Amplia o catálogo central de serviços de Engenharia Civil.
-- A lista é comercial/técnica e não substitui a conferência de atribuição profissional
-- aplicável a cada caso concreto. Novos textos entram como rascunho pendente.

alter table public.service_catalog
  add column if not exists professional_scope_check_required boolean not null default false;

insert into public.service_catalog (
  code,name,category,level_applicable,description,deliverables,exclusions,client_inputs,
  default_revisions,delivery_formats,acceptance_required,planning_reference,contract_clause_refs,
  version,active,updated_at,aliases,synonyms,keywords,professional_scope_check_required
) values
('u','Levantamento Técnico / Cadastral','levantamento',true,
 'Levantamento técnico e cadastral das condições existentes do imóvel, ambiente ou elemento abrangido, destinado a fornecer base confiável para estudos, projetos, regularizações ou demais serviços expressamente contratados.',
 '["Registro das condições e dimensões verificáveis no escopo","Peças gráficas, croquis, registros fotográficos ou tabelas compatíveis com a contratação","Consolidação das informações necessárias ao serviço subsequente, quando previsto"]'::jsonb,
 '["Ensaios destrutivos ou laboratoriais não contratados","Levantamentos topográficos ou geodésicos especializados não previstos","Garantia sobre elementos ocultos ou inacessíveis","Projeto ou execução não expressamente contratados"]'::jsonb,
 '["Acesso ao local","Documentos e projetos existentes quando disponíveis","Identificação clara do objeto e finalidade do levantamento"]'::jsonb,
 1,'["PDF"]'::jsonb,true,'Conforme área, acessibilidade e finalidade do levantamento.','{}'::text[],1,true,now(),
 array['levantamento tecnico','levantamento técnico','levantamento cadastral','cadastro de existente'],
 array['levantamento de campo','medicao cadastral','medição cadastral'],
 array['levantamento','cadastro','medidas','existente','vistoria'],true),

('v','Compatibilização de Projetos','coordenacao',true,
 'Análise coordenada das interfaces entre projetos e disciplinas expressamente incluídos, destinada a identificar incompatibilidades, interferências e necessidades de ajuste antes da execução.',
 '["Matriz ou registro de interferências identificadas","Indicações de compatibilização entre as disciplinas incluídas","Relatório ou conjunto de marcações para revisão dos responsáveis"]'::jsonb,
 '["Redimensionamento de projeto de terceiro sem contratação específica","Responsabilidade técnica por disciplina elaborada por terceiro","Execução das correções em obra","Disciplinas não fornecidas ou não contratadas"]'::jsonb,
 '["Projetos atualizados das disciplinas a compatibilizar","Definição dos responsáveis por cada disciplina","Critérios e prioridades de compatibilização"]'::jsonb,
 2,'["PDF"]'::jsonb,true,'Conforme quantidade de disciplinas, revisões e complexidade das interfaces.','{}'::text[],1,true,now(),
 array['compatibilizacao','compatibilização','compatibilizacao de projetos','coordenação de projetos'],
 array['coordenacao de projetos','coordenação de projetos','clash de projetos'],
 array['compatibilizacao','interferencia','coordenação','disciplinas','projetos'],true),

('w','Memorial Descritivo / Especificações Técnicas','documentacao',true,
 'Elaboração de memorial descritivo e especificações técnicas referentes ao objeto contratado, consolidando materiais, sistemas, critérios, procedimentos e informações necessárias à compreensão técnica do escopo.',
 '["Memorial descritivo do escopo contratado","Especificações técnicas compatíveis com o nível de definição disponível","Registro de premissas, materiais, sistemas e critérios aplicáveis"]'::jsonb,
 '["Projeto não contratado","Quantitativos e orçamento quando não previstos","Garantia de disponibilidade comercial de marcas ou produtos","Execução e fiscalização da obra"]'::jsonb,
 '["Projetos e definições técnicas aprovadas","Referências de materiais e sistemas quando necessárias","Dados do empreendimento e finalidade do documento"]'::jsonb,
 2,'["PDF"]'::jsonb,true,'Conforme extensão do escopo e grau de detalhamento requerido.','{}'::text[],1,true,now(),
 array['memorial descritivo','especificacoes tecnicas','especificações técnicas','caderno de especificacoes'],
 array['memorial tecnico','memorial técnico','especificacao de materiais','especificação de materiais'],
 array['memorial','especificacoes','materiais','sistemas','documentacao'],true),

('x','Quantitativos / Levantamento de Materiais','orcamento',true,
 'Levantamento de quantidades de serviços, materiais ou elementos a partir dos documentos e critérios expressamente definidos, para apoio a orçamento, planejamento ou contratação.',
 '["Planilha de quantitativos do escopo contratado","Unidades e critérios de medição identificados","Memória ou referência de origem dos quantitativos quando prevista"]'::jsonb,
 '["Preço de mercado ou orçamento financeiro quando não contratado","Garantia de perdas reais de execução","Itens não representados nos documentos de origem","Compra ou fornecimento de materiais"]'::jsonb,
 '["Projetos e documentos de referência suficientes","Critérios de medição","Definição das disciplinas e itens incluídos"]'::jsonb,
 1,'["XLSX","PDF"]'::jsonb,true,'Conforme quantidade de disciplinas, itens e qualidade dos documentos de origem.','{}'::text[],1,true,now(),
 array['quantitativos','levantamento de materiais','levantamento quantitativo','quantificacao'],
 array['quantificação','takeoff','lista de materiais'],
 array['quantitativos','materiais','medicao','medição','planilha'],true),

('y','Orçamento Executivo de Obra','orcamento',true,
 'Elaboração de orçamento de execução baseado em quantitativos, composições, preços, fontes e premissas compatíveis com o escopo e a data-base definidos para a contratação.',
 '["Planilha orçamentária do escopo contratado","Quantidades, unidades e preços unitários quando aplicáveis","Fontes, data-base e premissas de preços registradas","Resumo de custos conforme estrutura contratada"]'::jsonb,
 '["Garantia de preço futuro ou proposta de fornecedor","Honorários profissionais confundidos com custo de execução","Itens sem documentação ou quantitativo suficiente","Aquisição, contratação ou execução da obra"]'::jsonb,
 '["Projetos e quantitativos compatíveis","Data-base e localidade","Critérios de composição e fontes acordadas","Escopo de execução claramente definido"]'::jsonb,
 1,'["XLSX","PDF"]'::jsonb,true,'Conforme nível de detalhamento, fontes e quantidade de itens.','{}'::text[],1,true,now(),
 array['orcamento executivo','orçamento executivo','orcamento de obra','orçamento de obra','planilha orcamentaria'],
 array['estimativa de custo de obra','custo de execucao','custo de execução'],
 array['orcamento','custos','precos','preços','quantitativos','obra'],true),

('z','Estudo de Viabilidade Técnico-Econômica','estudo',true,
 'Estudo destinado a avaliar, dentro das premissas e dados disponíveis, alternativas, condicionantes, capacidade técnica e aspectos econômicos do empreendimento ou intervenção contratada.',
 '["Premissas e condicionantes analisados","Alternativas ou cenários compatíveis com o estudo","Síntese técnica e econômica dentro do escopo","Conclusões e recomendações condicionadas aos dados disponíveis"]'::jsonb,
 '["Garantia de aprovação, retorno financeiro ou resultado futuro","Avaliação mercadológica especializada não contratada","Projetos executivos ou complementares","Dados, estudos ou ensaios de terceiros não previstos"]'::jsonb,
 '["Objetivo do estudo","Dados do imóvel e empreendimento","Restrições conhecidas","Parâmetros econômicos e técnicos disponibilizados"]'::jsonb,
 2,'["PDF"]'::jsonb,true,'Conforme número de cenários, dados disponíveis e condicionantes.','{}'::text[],1,true,now(),
 array['viabilidade','estudo de viabilidade','viabilidade tecnico economica','viabilidade técnico-econômica'],
 array['estudo tecnico economico','estudo técnico econômico','analise de viabilidade','análise de viabilidade'],
 array['viabilidade','cenarios','cenários','custos','condicionantes'],true),

('aa','Parecer Técnico','laudo',true,
 'Elaboração de parecer técnico fundamentado na análise do objeto e das informações disponibilizadas, com conclusão restrita à questão técnica expressamente formulada.',
 '["Identificação da questão técnica analisada","Fundamentação técnica compatível com os dados disponíveis","Conclusão e recomendações dentro do escopo"]'::jsonb,
 '["Perícia judicial não contratada","Ensaios e inspeções adicionais não previstos","Conclusões sobre fatos não verificáveis com os dados disponíveis","Projeto ou execução de correção não contratados"]'::jsonb,
 '["Questão técnica claramente definida","Documentos e registros disponíveis","Acesso ao objeto quando necessário e previsto"]'::jsonb,
 1,'["PDF"]'::jsonb,true,'Conforme complexidade da questão e necessidade de diligências.','{}'::text[],1,true,now(),
 array['parecer','parecer tecnico','parecer técnico'],
 array['opiniao tecnica','opinião técnica','analise conclusiva','análise conclusiva'],
 array['parecer','analise','análise','conclusao','conclusão'],true),

('ab','Inspeção Predial / Diagnóstico Construtivo','inspecao',true,
 'Inspeção técnica das condições aparentes e acessíveis da edificação ou de sistemas abrangidos, destinada a registrar anomalias, manifestações, riscos ou necessidades de investigação e manutenção conforme o escopo.',
 '["Registro das condições inspecionadas","Identificação e classificação técnica das ocorrências dentro do escopo","Recomendações de investigação, manutenção ou correção quando cabíveis"]'::jsonb,
 '["Elementos ocultos ou inacessíveis","Ensaios laboratoriais ou destrutivos não contratados","Projeto de reparo ou execução de correção","Garantia de identificação de vícios não aparentes"]'::jsonb,
 '["Acesso às áreas previstas","Histórico e documentos disponíveis","Informação sobre ocorrências e intervenções anteriores"]'::jsonb,
 1,'["PDF"]'::jsonb,true,'Conforme porte da edificação, áreas acessíveis e extensão da inspeção.','{}'::text[],1,true,now(),
 array['inspecao predial','inspeção predial','diagnostico construtivo','diagnóstico construtivo','patologias'],
 array['diagnostico de patologias','diagnóstico de patologias','inspecao de edificacao','inspeção de edificação'],
 array['inspecao','patologia','anomalia','edificacao','manutencao'],true),

('ac','Perícia Técnica / Engenharia Legal','pericia',true,
 'Serviço técnico de análise pericial ou de engenharia legal limitado ao objeto, quesitos, documentos, diligências e finalidade expressamente contratados.',
 '["Delimitação do objeto pericial","Análise técnica das evidências disponibilizadas","Relatório, laudo ou parecer conforme finalidade contratada","Respostas a quesitos quando previstas"]'::jsonb,
 '["Atuação judicial não expressamente contratada","Honorários de assistentes, laboratórios ou terceiros","Ensaios e diligências adicionais não previstos","Garantia de resultado processual ou decisão de autoridade"]'::jsonb,
 '["Objeto e finalidade da perícia","Documentos, quesitos e registros disponíveis","Acesso para diligência quando necessário","Identificação das partes e contexto quando aplicável"]'::jsonb,
 1,'["PDF"]'::jsonb,true,'Conforme complexidade, diligências, documentos e quesitos.','{}'::text[],1,true,now(),
 array['pericia','perícia','engenharia legal','assistencia tecnica pericial','assistência técnica pericial'],
 array['pericia tecnica','perícia técnica','analise pericial','análise pericial'],
 array['pericia','engenharia legal','quesitos','diligencia','laudo'],true),

('ad','Fiscalização de Obra','obra',true,
 'Fiscalização técnica da execução dentro da frequência, disciplinas e limites contratados, destinada a verificar conformidade aparente com projetos, especificações e critérios aplicáveis sem assumir a execução de terceiros.',
 '["Visitas e registros na frequência contratada","Apontamentos de conformidade e não conformidade observáveis","Relatórios ou comunicações técnicas previstos no escopo"]'::jsonb,
 '["Responsabilidade pela execução da construtora ou mão de obra","Presença permanente quando não contratada","Controle financeiro e administrativo integral","Ensaios e inspeções especializadas não previstos"]'::jsonb,
 '["Projetos e especificações vigentes","Cronograma de execução","Acesso à obra","Comunicação das etapas a fiscalizar"]'::jsonb,
 null,'["PDF"]'::jsonb,false,'Conforme frequência de visitas e duração da obra.','{}'::text[],1,true,now(),
 array['fiscalizacao de obra','fiscalização de obra','fiscalizacao','fiscalização'],
 array['controle tecnico de obra','controle técnico de obra','inspecao de execucao','inspeção de execução'],
 array['fiscalizacao','obra','conformidade','visita','relatorio'],true),

('ae','Gerenciamento / Coordenação de Obra','obra',true,
 'Gerenciamento e coordenação técnica das atividades de obra expressamente incluídas, com organização de informações, interfaces, decisões, prazos e controles definidos na contratação.',
 '["Rotina de coordenação prevista no escopo","Acompanhamento de marcos e pendências","Registros de decisões e interfaces","Relatórios e controles contratados"]'::jsonb,
 '["Execução direta quando não contratada","Responsabilidade trabalhista ou empresarial de terceiros","Garantia de prazo ou custo quando dependente de terceiros","Compras e pagamentos não expressamente incluídos"]'::jsonb,
 '["Projetos e contratos aplicáveis","Cronograma e responsáveis","Acesso às informações da obra","Definição dos limites de autoridade e comunicação"]'::jsonb,
 null,'["PDF","XLSX"]'::jsonb,false,'Conforme duração, frequência e complexidade da obra.','{}'::text[],1,true,now(),
 array['gerenciamento de obra','gestao de obra','gestão de obra','coordenacao de obra','coordenação de obra'],
 array['administracao de obra','administração de obra','gestao tecnica de obra','gestão técnica de obra'],
 array['gerenciamento','gestao','coordenação','obra','prazo','controle'],true),

('af','Execução de Obra / Serviço Técnico','execucao',true,
 'Execução de obra ou serviço técnico restrita aos itens, quantidades, materiais, condições, responsabilidades e critérios expressamente contratados e compatíveis com a responsabilidade técnica assumida.',
 '["Execução dos itens expressamente contratados","Registros e controles previstos para o serviço","Entrega conforme critérios definidos no escopo"]'::jsonb,
 '["Itens não previstos no orçamento e no Anexo I","Serviços de terceiros fora da responsabilidade contratada","Alterações de projeto sem aprovação","Fornecimentos e taxas não discriminados"]'::jsonb,
 '["Projetos e especificações aprovados","Acesso e condições de execução","Definição de materiais e responsabilidades","Cronograma e critérios de aceite"]'::jsonb,
 null,'["PDF"]'::jsonb,true,'Conforme quantitativos, recursos, condições do local e cronograma aprovado.','{}'::text[],1,true,now(),
 array['execucao de obra','execução de obra','execucao','execução','servico tecnico','serviço técnico'],
 array['construcao','construção','execucao de servico','execução de serviço'],
 array['execucao','obra','construcao','servico','mão de obra'],true),

('ag','As Built / Cadastro Final da Edificação','documentacao',true,
 'Elaboração ou consolidação de cadastro final com base nas condições executadas e informações verificáveis disponibilizadas, registrando as alterações abrangidas pelo escopo contratado.',
 '["Peças gráficas ou registros atualizados conforme executado","Identificação das alterações verificáveis abrangidas","Arquivo final nos formatos contratados"]'::jsonb,
 '["Certificação de elementos ocultos não verificáveis","Levantamento de disciplinas não contratadas","Regularização ou aprovação perante órgão público","Responsabilidade por informações de terceiros não verificadas"]'::jsonb,
 '["Acesso ao imóvel","Projetos originais e revisões disponíveis","Registros de alterações executadas","Informações das disciplinas incluídas"]'::jsonb,
 1,'["PDF"]'::jsonb,true,'Conforme quantidade de disciplinas, alterações e verificações necessárias.','{}'::text[],1,true,now(),
 array['as built','as-built','cadastro final','projeto conforme construido','projeto conforme construído'],
 array['levantamento pos obra','levantamento pós-obra','cadastro conforme executado'],
 array['as built','cadastro','executado','obra','atualizacao'],true),

('ah','Projeto de Drenagem','complementar',true,
 'Projeto de drenagem das áreas, sistemas ou redes abrangidos, desenvolvido a partir das condições do local, contribuições, cotas e premissas disponíveis para o escopo contratado.',
 '["Plantas e esquemas de drenagem previstos","Dimensionamentos e indicações compatíveis com o escopo","Detalhes e especificações necessários ao sistema contratado"]'::jsonb,
 '["Levantamento topográfico especializado não contratado","Obras e redes externas não previstas","Execução e fornecimento","Licenciamentos e aprovações não contratados"]'::jsonb,
 '["Levantamentos e cotas disponíveis","Projeto de implantação","Dados de redes e pontos de lançamento quando aplicáveis","Premissas de uso e ocupação"]'::jsonb,
 2,'["PDF"]'::jsonb,true,'Conforme área, topografia e complexidade do sistema.','{}'::text[],1,true,now(),
 array['projeto de drenagem','drenagem pluvial','aguas pluviais','águas pluviais'],
 array['drenagem','projeto pluvial','rede pluvial'],
 array['drenagem','pluvial','chuva','rede','escoamento'],true),

('ai','Projeto de Pavimentação','infraestrutura',true,
 'Projeto de pavimentação para as áreas e sistemas expressamente contratados, considerando dados de tráfego, suporte, drenagem, geometria e demais premissas disponíveis.',
 '["Plantas e seções previstas no escopo","Especificações de camadas e materiais compatíveis com os dados disponíveis","Detalhes e critérios técnicos contratados"]'::jsonb,
 '["Sondagens e ensaios não contratados","Projeto de drenagem ou sinalização não incluído","Execução da pavimentação","Licenciamentos e aprovações não contratados"]'::jsonb,
 '["Levantamentos e dados geométricos","Informações de tráfego e uso quando aplicáveis","Dados geotécnicos disponíveis","Premissas de drenagem e implantação"]'::jsonb,
 2,'["PDF"]'::jsonb,true,'Conforme área, dados de suporte e complexidade do sistema.','{}'::text[],1,true,now(),
 array['projeto de pavimentacao','projeto de pavimentação','pavimentacao','pavimentação'],
 array['piso externo viario','piso externo viário','pavimento'],
 array['pavimentacao','pavimento','vias','estacionamento','infraestrutura'],true),

('aj','Projeto de Saneamento / Redes de Água e Esgoto','complementar',true,
 'Projeto de sistemas de abastecimento, distribuição, coleta ou condução de água e esgoto abrangidos pelo escopo, em escala compatível com os dados e interfaces contratados.',
 '["Plantas e esquemas das redes contratadas","Dimensionamentos compatíveis com as premissas disponíveis","Detalhes e especificações previstos no escopo"]'::jsonb,
 '["Estudos ambientais ou licenças não contratados","Redes externas ou concessionárias fora do escopo","Execução, testes e comissionamento não previstos","Levantamentos especializados não contratados"]'::jsonb,
 '["Dados de demanda e uso","Levantamentos e cotas disponíveis","Pontos de conexão e redes existentes","Projetos de referência"]'::jsonb,
 2,'["PDF"]'::jsonb,true,'Conforme extensão das redes, dados disponíveis e interfaces externas.','{}'::text[],1,true,now(),
 array['projeto de saneamento','rede de agua','rede de água','rede de esgoto','saneamento'],
 array['abastecimento de agua','abastecimento de água','esgotamento sanitario','esgotamento sanitário'],
 array['saneamento','agua','água','esgoto','rede'],true),

('ak','Plano de Manutenção / Manual Técnico','manutencao',true,
 'Elaboração de plano, manual ou diretrizes de manutenção para os sistemas e elementos abrangidos, estruturando rotinas, periodicidades, registros e responsabilidades dentro do escopo disponível.',
 '["Plano ou manual de manutenção do escopo contratado","Rotinas e periodicidades de referência","Critérios de registro e acompanhamento quando previstos"]'::jsonb,
 '["Execução de manutenção","Garantia de vida útil sem observância das condições de uso","Sistemas não inspecionados ou não documentados","Laudos e ensaios especializados não contratados"]'::jsonb,
 '["Projetos, manuais e informações disponíveis","Identificação dos sistemas abrangidos","Histórico de manutenção quando existente"]'::jsonb,
 1,'["PDF","XLSX"]'::jsonb,true,'Conforme quantidade de sistemas e nível de informação disponível.','{}'::text[],1,true,now(),
 array['plano de manutencao','plano de manutenção','manual de manutencao','manual de manutenção','manual tecnico'],
 array['rotina de manutencao','rotina de manutenção','plano preventivo'],
 array['manutencao','manual','rotina','periodicidade','edificacao'],true),

('al','Projeto de Impermeabilização','complementar',true,
 'Projeto e detalhamento de soluções de impermeabilização para áreas e sistemas expressamente contratados, compatíveis com as condições, interfaces e materiais definidos.',
 '["Plantas e detalhes das áreas abrangidas","Especificações de sistemas e materiais previstas","Indicações de preparação, interfaces e arremates contratados"]'::jsonb,
 '["Diagnóstico de infiltrações sem inspeção contratada","Execução e fornecimento","Garantia de desempenho de produto aplicado por terceiros","Áreas não incluídas no levantamento ou projeto"]'::jsonb,
 '["Levantamento e condições existentes","Projetos de referência","Informações de uso e exposição","Definições de materiais quando aplicáveis"]'::jsonb,
 2,'["PDF"]'::jsonb,true,'Conforme quantidade de áreas, interfaces e condições existentes.','{}'::text[],1,true,now(),
 array['projeto de impermeabilizacao','projeto de impermeabilização','impermeabilizacao','impermeabilização'],
 array['detalhamento de impermeabilizacao','detalhamento de impermeabilização'],
 array['impermeabilizacao','infiltracao','infiltração','areas molhadas','cobertura'],true)
on conflict (code) do update set
 name=excluded.name,category=excluded.category,level_applicable=excluded.level_applicable,
 description=excluded.description,deliverables=excluded.deliverables,exclusions=excluded.exclusions,
 client_inputs=excluded.client_inputs,default_revisions=excluded.default_revisions,
 delivery_formats=excluded.delivery_formats,acceptance_required=excluded.acceptance_required,
 planning_reference=excluded.planning_reference,aliases=excluded.aliases,synonyms=excluded.synonyms,
 keywords=excluded.keywords,professional_scope_check_required=excluded.professional_scope_check_required,
 active=true,updated_at=now();

insert into public.service_level_scope_catalog (
 service_code,level_code,applicable,included_deliverables,excluded_deliverables,parameters,
 revisions_included,visits_included,detail_level,delivery_formats,inherit_legacy_catalog,
 review_status,source_service_version,source_level_version,version,active,updated_at
)
select s.code,l.code,true,s.deliverables,(s.exclusions||l.exclusions),'[]'::jsonb,
 s.default_revisions,null,
 case l.code when 'bronze' then 'essencial' when 'prata' then 'ampliado' else 'completo' end,
 s.delivery_formats,true,'pending',s.version,l.version,1,true,now()
from public.service_catalog s
cross join public.service_level_catalog l
where s.code in ('u','v','w','x','y','z','aa','ab','ac','ad','ae','af','ag','ah','ai','aj','ak','al')
  and s.active and l.active
on conflict (service_code,level_code) do nothing;

update public.service_level_scope_catalog m
set budget_description=concat(
 s.name,' — ',
 case m.level_code
  when 'bronze' then 'nível Bronze: prestação essencial e objetiva, concentrada no núcleo técnico da atividade contratada. '
  when 'prata' then 'nível Prata: prestação ampliada, com maior detalhamento, organização e suporte dentro da mesma atividade. '
  else 'nível Ouro: prestação mais abrangente, com aprofundamento técnico, detalhamento e suporte avançado compatíveis com a atividade. ' end,
 s.description,' Permanecem excluídos os serviços e entregáveis não expressamente indicados no orçamento.'
),
contract_scope=concat(
 'A CONTRATADA prestará o serviço de ',s.name,' no nível ',upper(m.level_code),
 ', limitado ao objeto, etapas, quantidades, formatos, visitas, revisões, prazos e entregáveis expressamente descritos no orçamento e no Anexo I. ',
 s.description,' A classificação do nível não inclui automaticamente outra atividade, execução, aprovação, taxa, fornecimento ou serviço de terceiro.'
),
annex_scope=concat(
 'Escopo do serviço: ',s.name,'. Descrição técnica: ',s.description,' ',
 case m.level_code
  when 'bronze' then 'No nível Bronze, devem constar apenas os entregáveis essenciais necessários ao objeto contratado.'
  when 'prata' then 'No nível Prata, o escopo incorpora os entregáveis essenciais e os acréscimos de detalhamento, apresentação ou suporte que forem compatíveis e expressamente selecionados.'
  else 'No nível Ouro, o escopo incorpora os entregáveis dos níveis anteriores e os acréscimos avançados de detalhamento, apresentação ou suporte que forem compatíveis e expressamente selecionados.' end,
 ' Entregáveis de referência: ',
 coalesce((select string_agg(value,'; ') from jsonb_array_elements_text(s.deliverables)),'conforme orçamento'),
 '. Exclusões de referência: ',
 coalesce((select string_agg(value,'; ') from jsonb_array_elements_text(s.exclusions)),'itens não contratados'),
 '. Os parâmetros particulares da contratação prevalecem sobre esta referência.'
),
review_status='pending',inherit_legacy_catalog=false,updated_at=now()
from public.service_catalog s
where s.code=m.service_code
 and s.code in ('u','v','w','x','y','z','aa','ab','ac','ad','ae','af','ag','ah','ai','aj','ak','al')
 and m.active=true;
