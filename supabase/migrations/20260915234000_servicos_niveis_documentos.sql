-- Camila Martins Engenharia — catálogo comercial 2026-09-15
-- Mantém a governança atual e apenas amplia o catálogo/semântica de nível.

begin;

update public.service_catalog
set level_applicable = true,
    version = case when level_applicable is distinct from true then version + 1 else version end,
    updated_at = now()
where active = true;

update public.service_catalog
set name = 'Outro',
    category = 'outro',
    level_applicable = true,
    description = 'Prestação de serviço técnico conforme escopo específico descrito nesta proposta e no Anexo I, compreendendo somente as atividades, entregáveis, premissas, limites e condições expressamente indicados no orçamento. Qualquer atividade, formato, visita, aprovação, execução ou entrega adicional dependerá de contratação e aprovação prévias.',
    deliverables = '["Entregáveis expressamente descritos no orçamento e no Anexo I"]'::jsonb,
    exclusions = '["Atividades e entregas não expressamente previstas no escopo contratado","Taxas, aprovações, execução, fornecimentos e serviços de terceiros não discriminados"]'::jsonb,
    client_inputs = '["Documentos, informações e autorizações necessários ao serviço específico"]'::jsonb,
    default_revisions = null,
    delivery_formats = '["PDF"]'::jsonb,
    planning_reference = 'Conforme descrição específica aprovada no orçamento e no Anexo I.',
    version = version + 1,
    updated_at = now()
where code = 'p';

insert into public.service_catalog (
  code,name,category,level_applicable,description,deliverables,exclusions,client_inputs,
  default_revisions,delivery_formats,acceptance_required,planning_reference,contract_clause_refs,version,active,updated_at
) values
(
  'q','Consultoria Técnica','consultoria',true,
  'Prestação de consultoria técnica de engenharia destinada à análise, orientação e suporte técnico sobre o objeto contratado, com recomendações e esclarecimentos compatíveis com o escopo definido. Não inclui elaboração de projetos, execução, acompanhamento contínuo, aprovações, taxas ou serviços complementares, salvo quando expressamente contratados.',
  '["Análise técnica do objeto e das informações disponibilizadas","Orientações e recomendações técnicas compatíveis com a finalidade contratada","Registro escrito das conclusões, quando previsto no orçamento"]'::jsonb,
  '["Elaboração de projetos não expressamente contratados","Execução, gerenciamento ou acompanhamento contínuo de obra","Aprovações, protocolos, taxas e serviços de terceiros não previstos"]'::jsonb,
  '["Documentos e informações disponíveis sobre o objeto da consulta","Descrição da finalidade e das dúvidas técnicas a serem analisadas","Acesso a registros, projetos ou local quando necessários e expressamente previstos"]'::jsonb,
  2,'["PDF"]'::jsonb,true,
  'Conforme complexidade, informações disponíveis e finalidade definida no orçamento.',
  '{}'::text[],1,true,now()
),
(
  'r','Projeto de Combate a Incêndio','complementar',true,
  'Elaboração do Projeto de Segurança e Combate a Incêndio conforme as características da edificação e os requisitos aplicáveis ao escopo contratado, contemplando as peças técnicas e a documentação expressamente previstas. Protocolos, taxas, aprovações, execução ou instalação, laudos, testes, inspeções e adequações físicas somente integrarão o serviço quando expressamente contratados.',
  '["Peças gráficas e indicações técnicas previstas para o sistema de segurança e combate a incêndio contratado","Dimensionamentos e especificações compatíveis com o escopo e com os dados fornecidos","Organização da documentação técnica prevista no orçamento","Ajustes dentro das rodadas de revisão contratadas"]'::jsonb,
  '["Taxas, emolumentos e despesas de órgãos públicos","Execução, fornecimento ou instalação de equipamentos e sistemas","Vistorias, testes, laudos, AVCB/CLCB ou aprovações não expressamente contratados","Adequações físicas e serviços de terceiros não previstos"]'::jsonb,
  '["Projetos e documentos disponíveis da edificação","Dados de uso, ocupação, áreas e características relevantes","Informações sobre sistemas existentes, quando houver","Documentação exigida para a finalidade contratada"]'::jsonb,
  2,'["PDF"]'::jsonb,true,
  'Integrado ao cronograma do projeto e sujeito a prazos de órgãos públicos quando houver etapa de aprovação expressamente contratada.',
  '{}'::text[],1,true,now()
)
on conflict (code) do update set
  name = excluded.name,
  category = excluded.category,
  level_applicable = true,
  description = excluded.description,
  deliverables = excluded.deliverables,
  exclusions = excluded.exclusions,
  client_inputs = excluded.client_inputs,
  default_revisions = excluded.default_revisions,
  delivery_formats = excluded.delivery_formats,
  acceptance_required = excluded.acceptance_required,
  planning_reference = excluded.planning_reference,
  active = true,
  version = public.service_catalog.version + 1,
  updated_at = now();

update public.service_level_catalog
set description = 'Nível essencial de prestação, com desenvolvimento técnico objetivo e compatível com o serviço contratado, limitado aos entregáveis, revisões e condições expressamente previstos no escopo.',
    features = '["Desenvolvimento técnico essencial dentro do serviço contratado","Entregáveis e revisões previstos no escopo aprovado","Comunicação e registros técnicos necessários à prestação contratada"]'::jsonb,
    exclusions = '["Serviços, visitas, aprovações, execução, taxas, fornecimentos ou formatos não expressamente contratados"]'::jsonb,
    version = version + 1,
    updated_at = now()
where code='bronze';

update public.service_level_catalog
set description = 'Nível ampliado de prestação. Inclui o conteúdo aplicável do BRONZE e acrescenta maior aprofundamento, detalhamento, apresentação e suporte dentro do mesmo serviço, sempre conforme sua natureza e o escopo expressamente contratado.',
    features = '["Conteúdos aplicáveis do BRONZE","Maior grau de detalhamento e apresentação dentro do serviço contratado","Recursos adicionais de explicação ou apresentação quando tecnicamente compatíveis e previstos no orçamento","Nos serviços de projeto, recursos visuais podem integrar o nível quando expressamente previstos na proposta"]'::jsonb,
    exclusions = '["Serviços de outra categoria, execução, aprovações, taxas ou entregáveis não previstos no escopo","Recursos visuais, visitas ou formatos adicionais quando incompatíveis ou não expressamente contratados"]'::jsonb,
    version = version + 1,
    updated_at = now()
where code='prata';

update public.service_level_catalog
set description = 'Nível mais abrangente de prestação dentro do serviço contratado. Inclui os conteúdos aplicáveis dos níveis anteriores e amplia profundidade técnica, apresentação e suporte, sem criar automaticamente serviços ou entregáveis de outra categoria.',
    features = '["Conteúdos aplicáveis do BRONZE e PRATA","Maior aprofundamento técnico, detalhamento e suporte dentro do serviço contratado","Recursos avançados de apresentação, curadoria ou imersão quando tecnicamente compatíveis e expressamente previstos","Tratamento mais completo dos entregáveis definidos no orçamento, sem ampliação automática de escopo"]'::jsonb,
    exclusions = '["Serviços de outra categoria, execução, aprovações, taxas, fornecimentos ou entregáveis não expressamente contratados"]'::jsonb,
    version = version + 1,
    updated_at = now()
where code='ouro';

commit;
