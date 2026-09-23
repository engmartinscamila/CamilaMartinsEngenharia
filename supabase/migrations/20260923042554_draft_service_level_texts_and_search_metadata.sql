-- Rascunhos técnicos da matriz serviço x nível e metadados de busca.
-- Homologado primeiro em camila-martins-homologacao.
-- Mantém review_status='pending': nenhum texto é publicado ou autoaprovado.

insert into public.service_catalog (
  code,name,category,level_applicable,description,deliverables,exclusions,client_inputs,
  default_revisions,delivery_formats,acceptance_required,planning_reference,
  contract_clause_refs,version,active,updated_at,aliases,synonyms,keywords
) values (
  't','Reforma / adequação de edificação','reforma',true,
  'Serviço de engenharia voltado ao planejamento e à definição técnica de reforma ou adequação de edificação existente. O escopo pode abranger levantamento, definição de intervenções, compatibilização, detalhamento, orientação técnica e demais etapas expressamente previstas no orçamento e no Anexo I. Execução da obra, gerenciamento contínuo, aprovações, projetos complementares, laudos, ensaios, taxas e fornecimentos somente integram a contratação quando discriminados separadamente.',
  '["Definição técnica das intervenções abrangidas pelo escopo","Peças gráficas, memoriais ou orientações compatíveis com as etapas contratadas","Indicação das premissas, restrições e interfaces relevantes da reforma","Entregáveis específicos definidos no orçamento e no Anexo I"]'::jsonb,
  '["Execução da obra quando não contratada","Projetos complementares não expressamente incluídos","Laudos, ensaios e levantamentos especializados não contratados","Taxas, aprovações, materiais, mão de obra e serviços de terceiros não discriminados"]'::jsonb,
  '["Informações e documentos disponíveis da edificação existente","Objetivos e prioridades da reforma","Acesso ao local quando necessário","Projetos, levantamentos e registros existentes quando disponíveis"]'::jsonb,
  2,'["PDF"]'::jsonb,true,
  'Prazo conforme extensão das intervenções, informações existentes, compatibilizações necessárias e etapas expressamente contratadas.',
  '{}'::text[],1,true,now(),
  array['reforma','adequacao','adequação','reforma residencial','reforma comercial'],
  array['projeto de reforma','adequação de edificação','adequacao de edificacao'],
  array['reforma','adequacao','edificacao existente','intervencao','remodelacao']
)
on conflict (code) do update set
  name=excluded.name,
  category=excluded.category,
  level_applicable=true,
  description=excluded.description,
  deliverables=excluded.deliverables,
  exclusions=excluded.exclusions,
  client_inputs=excluded.client_inputs,
  default_revisions=excluded.default_revisions,
  delivery_formats=excluded.delivery_formats,
  acceptance_required=excluded.acceptance_required,
  planning_reference=excluded.planning_reference,
  aliases=excluded.aliases,
  synonyms=excluded.synonyms,
  keywords=excluded.keywords,
  active=true,
  version=greatest(public.service_catalog.version,excluded.version),
  updated_at=now();

update public.service_catalog set
  aliases = case code
    when 'a' then array['estudo preliminar','estudo inicial']
    when 'b' then array['anteprojeto','projeto preliminar']
    when 'c' then array['projeto legal','projeto prefeitura','aprovacao prefeitura','aprovação prefeitura']
    when 'd' then array['projeto executivo','detalhamento','detalhamento executivo']
    when 'e' then array['projeto estrutural','estrutural']
    when 'f' then array['projeto eletrico','projeto elétrico','instalacoes eletricas','instalações elétricas']
    when 'g' then array['projeto hidrossanitario','projeto hidrossanitário','projeto hidraulico','projeto hidráulico','projeto sanitario','projeto sanitário']
    when 'h' then array['projeto de interiores','interiores']
    when 'i' then array['paisagismo','projeto paisagistico','projeto paisagístico']
    when 'j' then array['render','render 3d','maquete eletronica','maquete eletrônica','visualizacao 3d','visualização 3d']
    when 'k' then array['legalizacao','legalização','aprovacao prefeitura','aprovação prefeitura','regularizacao prefeitura','regularização prefeitura']
    when 'l' then array['alvara','alvará','alvara de construcao','alvará de construção']
    when 'm' then array['habite-se','habite se']
    when 'n' then array['acompanhamento de obra','acompanhamento tecnico','acompanhamento técnico','assistencia tecnica de obra','assistência técnica de obra']
    when 'o' then array['laudo','laudo tecnico','laudo técnico','vistoria','avaliacao','avaliação']
    when 'p' then array['outro','outros','servico personalizado','serviço personalizado']
    when 'q' then array['consultoria','consultoria tecnica','consultoria técnica']
    when 'r' then array['projeto de incendio','projeto de incêndio','combate a incendio','combate a incêndio','seguranca contra incendio','segurança contra incêndio']
    when 's' then array['cronograma','cronograma fisico financeiro','cronograma físico-financeiro','planejamento de obra','planejamento obra']
    when 't' then aliases
    else aliases end,
  synonyms = case code
    when 'a' then array['estudo inicial de projeto','definicao preliminar','definição preliminar']
    when 'b' then array['desenvolvimento preliminar do projeto']
    when 'c' then array['projeto para licenciamento','pecas para aprovacao','peças para aprovação']
    when 'd' then array['projeto para execucao','projeto para execução']
    when 'e' then array['calculo estrutural','cálculo estrutural']
    when 'f' then array['instalacao eletrica','instalação elétrica']
    when 'g' then array['hidraulica e sanitaria','hidráulica e sanitária','agua e esgoto','água e esgoto']
    when 'h' then array['ambientacao de interiores','ambientação de interiores']
    when 'i' then array['projeto de jardim','areas externas','áreas externas']
    when 'j' then array['imagem 3d','imagem renderizada','modelagem 3d']
    when 'k' then array['processo de legalizacao','processo de legalização','processo prefeitura']
    when 'l' then array['licenca para construir','licença para construir']
    when 'm' then array['certificado de conclusao','certificado de conclusão']
    when 'n' then array['visitas de obra','suporte tecnico de obra','suporte técnico de obra']
    when 'o' then array['inspecao tecnica','inspeção técnica','avaliacao tecnica','avaliação técnica']
    when 'p' then array['atividade personalizada','atividade especifica','atividade específica']
    when 'q' then array['orientacao tecnica','orientação técnica','parecer consultivo']
    when 'r' then array['projeto de seguranca contra incendio','projeto de segurança contra incêndio']
    when 's' then array['planejamento fisico financeiro','planejamento físico-financeiro','curva s','gantt']
    when 't' then synonyms
    else synonyms end,
  keywords = case code
    when 'a' then array['programa','necessidades','implantacao','implantação','premissas']
    when 'b' then array['layout','volumetria','dimensoes','dimensões']
    when 'c' then array['prefeitura','licenciamento','protocolo','urbano']
    when 'd' then array['detalhes','execucao','execução','pranchas']
    when 'e' then array['estrutura','concreto','aco','aço','fundacao','fundação']
    when 'f' then array['eletrica','elétrica','circuitos','cargas','quadros']
    when 'g' then array['agua','água','esgoto','hidraulica','hidráulica','sanitaria','sanitária']
    when 'h' then array['layout','acabamentos','mobiliario','mobiliário','ambientacao','ambientação']
    when 'i' then array['jardim','vegetacao','vegetação','especies','espécies']
    when 'j' then array['render','3d','imagem','maquete','visualizacao','visualização']
    when 'k' then array['prefeitura','regularizacao','regularização','protocolo','aprovacao','aprovação']
    when 'l' then array['alvara','alvará','construcao','construção','prefeitura']
    when 'm' then array['habite-se','conclusao','conclusão','obra','prefeitura']
    when 'n' then array['obra','visita','acompanhamento','verificacao','verificação']
    when 'o' then array['laudo','vistoria','avaliacao','avaliação','inspecao','inspeção']
    when 'p' then array['personalizado','especifico','específico']
    when 'q' then array['consultoria','analise','análise','orientacao','orientação']
    when 'r' then array['incendio','incêndio','hidrante','sprinkler','alarme','saidas','saídas']
    when 's' then array['cronograma','prazo','gantt','curva s','cpm','planejamento']
    when 't' then keywords
    else keywords end,
  updated_at=now()
where active=true and code between 'a' and 't';

insert into public.service_level_scope_catalog (
  service_code,level_code,applicable,included_deliverables,excluded_deliverables,parameters,
  revisions_included,visits_included,detail_level,delivery_formats,inherit_legacy_catalog,
  review_status,source_service_version,source_level_version,version,active,updated_at
)
select s.code,l.code,s.level_applicable,s.deliverables,(s.exclusions || l.exclusions),'[]'::jsonb,
       s.default_revisions,null,
       case l.code when 'bronze' then 'essencial' when 'prata' then 'ampliado' else 'completo' end,
       s.delivery_formats,true,'pending',s.version,l.version,1,true,now()
from public.service_catalog s cross join public.service_level_catalog l
where s.code='t' and s.active and l.active
on conflict (service_code,level_code) do nothing;

update public.service_level_scope_catalog m
set
  budget_description = concat(
    s.name, ' — ',
    case m.level_code
      when 'bronze' then 'nível Bronze: prestação essencial e objetiva, concentrada no núcleo técnico da atividade contratada. '
      when 'prata' then 'nível Prata: prestação ampliada, com maior detalhamento, organização e suporte dentro da mesma atividade. '
      else 'nível Ouro: prestação mais abrangente, com aprofundamento técnico, detalhamento e suporte avançado compatíveis com a atividade. '
    end,
    s.description,
    ' Permanecem excluídos os serviços e entregáveis não expressamente indicados no orçamento.'
  ),
  contract_scope = concat(
    'A CONTRATADA prestará o serviço de ', s.name, ' no nível ', upper(m.level_code),
    ', limitado ao objeto, etapas, quantidades, formatos, visitas, revisões, prazos e entregáveis expressamente descritos no orçamento e no Anexo I. ',
    s.description,
    ' A classificação do nível não inclui automaticamente outra atividade, execução, aprovação, taxa, fornecimento ou serviço de terceiro.'
  ),
  annex_scope = concat(
    'Escopo do serviço: ', s.name, '. Descrição técnica: ', s.description, ' ',
    case m.level_code
      when 'bronze' then 'No nível Bronze, devem constar apenas os entregáveis essenciais necessários ao objeto contratado.'
      when 'prata' then 'No nível Prata, o escopo incorpora os entregáveis essenciais e os acréscimos de detalhamento, apresentação ou suporte que forem compatíveis e expressamente selecionados.'
      else 'No nível Ouro, o escopo incorpora os entregáveis dos níveis anteriores e os acréscimos avançados de detalhamento, apresentação ou suporte que forem compatíveis e expressamente selecionados.'
    end,
    ' Entregáveis de referência: ',
    coalesce((select string_agg(value, '; ') from jsonb_array_elements_text(s.deliverables)), 'conforme orçamento'),
    '. Exclusões de referência: ',
    coalesce((select string_agg(value, '; ') from jsonb_array_elements_text(s.exclusions)), 'itens não contratados'),
    '. Os parâmetros particulares da contratação prevalecem sobre esta referência.'
  ),
  review_status='pending',
  inherit_legacy_catalog=false,
  updated_at=now()
from public.service_catalog s
where s.code=m.service_code and m.active=true and s.active=true;
