
create table if not exists public.service_catalog (
  code text primary key,
  name text not null,
  category text not null default 'projeto',
  level_applicable boolean not null default false,
  description text not null,
  deliverables jsonb not null default '[]'::jsonb,
  exclusions jsonb not null default '[]'::jsonb,
  client_inputs jsonb not null default '[]'::jsonb,
  default_revisions integer,
  delivery_formats jsonb not null default '["PDF"]'::jsonb,
  acceptance_required boolean not null default true,
  planning_reference text,
  contract_clause_refs text[] not null default '{}'::text[],
  version integer not null default 1,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.service_level_catalog (
  code text primary key,
  label text not null,
  subtitle text not null,
  description text not null,
  features jsonb not null default '[]'::jsonb,
  exclusions jsonb not null default '[]'::jsonb,
  contract_clause_refs text[] not null default '{}'::text[],
  version integer not null default 1,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.service_catalog enable row level security;
alter table public.service_level_catalog enable row level security;

drop policy if exists service_catalog_admin_read on public.service_catalog;
create policy service_catalog_admin_read on public.service_catalog
for select to authenticated
using (public.is_portal_admin());

drop policy if exists service_level_catalog_admin_read on public.service_level_catalog;
create policy service_level_catalog_admin_read on public.service_level_catalog
for select to authenticated
using (public.is_portal_admin());

grant select on public.service_catalog to authenticated;
grant select on public.service_level_catalog to authenticated;

insert into public.service_level_catalog(code,label,subtitle,description,features,exclusions,contract_clause_refs,version,active)
values
('bronze','BRONZE','Essencial',
 'Documentação técnica objetiva do projeto, adequada à definição e comunicação técnica do escopo contratado.',
 '["Documentação técnica objetiva","Pranchas e arquivos previstos no serviço contratado","Revisões previstas no Anexo I"]'::jsonb,
 '["Plantas humanizadas","Renderização 3D","Vídeo","Tour virtual 360°"]'::jsonb,
 array['1.5','1.5.1','1.7','1.8','1.9'],1,true),
('prata','PRATA','Visual',
 'Inclui os conteúdos aplicáveis do nível BRONZE e acrescenta recursos visuais para facilitar a compreensão do projeto.',
 '["Conteúdos aplicáveis do BRONZE","Plantas humanizadas","Renderizações 3D em imagens estáticas"]'::jsonb,
 '["Vídeo de renderização","Tour virtual 360°","Curadoria integral de catálogos, quando não prevista no serviço"]'::jsonb,
 array['1.5','1.5.2','1.7','1.8','1.9'],1,true),
('ouro','OURO','Imersivo',
 'Inclui os conteúdos aplicáveis dos níveis anteriores e acrescenta recursos imersivos e de curadoria, quando compatíveis com o serviço de projeto contratado.',
 '["Conteúdos aplicáveis do BRONZE e PRATA","Renderização 3D em vídeo","Tour virtual 360°","Curadoria integral de materiais, mobiliário e acabamentos quando aplicável"]'::jsonb,
 '[]'::jsonb,
 array['1.5','1.5.3','1.7','1.8','1.9'],1,true)
on conflict (code) do update set
 label=excluded.label,
 subtitle=excluded.subtitle,
 description=excluded.description,
 features=excluded.features,
 exclusions=excluded.exclusions,
 contract_clause_refs=excluded.contract_clause_refs,
 version=greatest(public.service_level_catalog.version,excluded.version),
 active=true,
 updated_at=now();

insert into public.service_catalog
(code,name,category,level_applicable,description,deliverables,exclusions,client_inputs,default_revisions,delivery_formats,acceptance_required,planning_reference,contract_clause_refs,version,active)
values
('a','Estudo Preliminar','projeto',true,
 'Etapa destinada à consolidação das necessidades, condicionantes e diretrizes iniciais do projeto, com definição do partido e da organização espacial em nível preliminar.',
 '["Síntese do programa de necessidades","Premissas e condicionantes adotados","Estudos de implantação e organização espacial compatíveis com a etapa","Quadro preliminar de áreas","Representações gráficas compatíveis com a etapa contratada"]'::jsonb,
 '["Detalhamento executivo","Dimensionamento de projetos complementares","Aprovação em órgão público, salvo contratação específica","Execução de obra"]'::jsonb,
 '["Briefing e programa de necessidades","Documentos e medidas disponíveis do imóvel","Restrições e prioridades informadas pelo cliente"]'::jsonb,
 2,'["PDF"]'::jsonb,true,'Integrado ao cronograma geral do contrato.',array['1.1','1.2','2.1','3.1','6.1'],1,true),

('b','Anteprojeto','projeto',true,
 'Desenvolvimento da solução aprovada no Estudo Preliminar, com maior definição de layout, volumetria, dimensões principais e soluções arquitetônicas.',
 '["Plantas do anteprojeto","Cortes e fachadas compatíveis com a etapa","Definições principais de layout e volumetria","Quadro de áreas atualizado","Materiais de apoio previstos no nível de experiência contratado"]'::jsonb,
 '["Detalhamento executivo completo","Projetos complementares não contratados","Aprovação em órgão público, salvo contratação específica","Execução de obra"]'::jsonb,
 '["Validação do Estudo Preliminar","Definições de materiais e preferências solicitadas","Documentos adicionais indicados durante o desenvolvimento"]'::jsonb,
 2,'["PDF"]'::jsonb,true,'Integrado ao cronograma geral do contrato.',array['1.1','1.2','2.1','3.1','6.1'],1,true),

('c','Projeto Legal','projeto',true,
 'Preparação das peças técnicas necessárias ao protocolo ou análise perante o órgão competente, limitada ao escopo e à legislação aplicável ao processo contratado.',
 '["Peças gráficas exigíveis para o protocolo contratado","Quadros e informações urbanísticas pertinentes","Ajustes decorrentes de exigências do órgão, quando abrangidos pelo contrato","Organização documental técnica do processo"]'::jsonb,
 '["Taxas e emolumentos","Documentos de terceiros não previstos","Projetos complementares não contratados","Garantia de aprovação por órgão público"]'::jsonb,
 '["Documentação do imóvel e do proprietário","Levantamentos e dados cadastrais necessários","Procurações ou autorizações quando exigidas","Informações solicitadas pelo órgão competente"]'::jsonb,
 2,'["PDF"]'::jsonb,true,'Sujeito aos prazos do órgão público além do cronograma técnico.',array['1.4','2.1','5.5','5.6','6.2.1'],1,true),

('d','Projeto Executivo / detalhamento','projeto',true,
 'Desenvolvimento técnico do projeto com informações e detalhamentos necessários à compreensão e execução do escopo arquitetônico contratado.',
 '["Plantas executivas","Cortes e fachadas executivas","Detalhamentos construtivos previstos no escopo","Indicações de materiais e especificações compatíveis com o serviço","Pranchas técnicas para execução do escopo contratado"]'::jsonb,
 '["Projetos complementares não contratados","Compatibilizações especiais não previstas","Quantitativos orçamentários completos, salvo previsão expressa","Gerenciamento ou execução da obra"]'::jsonb,
 '["Aprovação das etapas anteriores","Definições de materiais e equipamentos solicitadas","Projetos complementares disponíveis para compatibilização, quando aplicável"]'::jsonb,
 2,'["PDF"]'::jsonb,true,'Integrado ao cronograma geral do contrato.',array['1.1','1.2','1.3','2.1','6.1'],1,true),

('e','Projeto Estrutural','complementar',false,
 'Projeto complementar destinado ao dimensionamento e representação dos elementos estruturais abrangidos pelo escopo contratado.',
 '["Plantas estruturais","Detalhes e indicações de elementos dimensionados","Especificações técnicas compatíveis com o sistema adotado","Documentação técnica prevista no escopo"]'::jsonb,
 '["Sondagem e ensaios não contratados","Projeto arquitetônico","Execução, fabricação ou fornecimento de materiais","Alterações decorrentes de dados incorretos fornecidos por terceiros"]'::jsonb,
 '["Projeto arquitetônico de referência","Informações geotécnicas quando necessárias","Dados de cargas e usos especiais","Levantamentos e documentos técnicos disponíveis"]'::jsonb,
 2,'["PDF"]'::jsonb,true,'Integrado ao cronograma do projeto complementar.',array['1.2','1.7','2.1','4.1','6.1'],1,true),

('f','Projeto Elétrico','complementar',false,
 'Projeto complementar das instalações elétricas abrangidas pelo escopo, elaborado a partir das premissas, cargas e necessidades informadas e validadas.',
 '["Plantas de pontos e circuitos","Quadros e diagramas previstos no escopo","Indicações de cargas e circuitos","Especificações técnicas compatíveis com a etapa contratada"]'::jsonb,
 '["Projetos de automação não contratados","Projeto luminotécnico especial não contratado","Execução das instalações","Adequações de concessionária fora do escopo"]'::jsonb,
 '["Layout e projeto arquitetônico de referência","Relação de equipamentos e cargas especiais","Padrão de fornecimento disponível","Definições do cliente sobre usos e equipamentos"]'::jsonb,
 2,'["PDF"]'::jsonb,true,'Integrado ao cronograma do projeto complementar.',array['1.2','1.7','2.1','3.1','6.1'],1,true),

('g','Projeto Hidrossanitário','complementar',false,
 'Projeto complementar das instalações hidrossanitárias abrangidas pelo escopo, desenvolvido conforme informações do imóvel e necessidades de uso disponibilizadas.',
 '["Plantas de água e esgoto previstas no escopo","Esquemas e detalhes técnicos necessários","Indicações de pontos e encaminhamentos","Especificações compatíveis com a etapa contratada"]'::jsonb,
 '["Execução das instalações","Projetos especiais não contratados","Ensaios e laudos de redes existentes","Adequações de concessionárias fora do escopo"]'::jsonb,
 '["Projeto arquitetônico de referência","Posição de entradas e redes disponíveis","Informações de equipamentos hidráulicos especiais","Dados do sistema existente quando houver"]'::jsonb,
 2,'["PDF"]'::jsonb,true,'Integrado ao cronograma do projeto complementar.',array['1.2','1.7','2.1','3.1','6.1'],1,true),

('h','Projeto de Interiores','projeto',true,
 'Desenvolvimento das soluções de interiores previstas no escopo, considerando layout, materiais, acabamentos, mobiliário e ambientação compatíveis com o nível contratado.',
 '["Layout de interiores","Definições de materiais e acabamentos previstas no escopo","Detalhamentos de interiores contratados","Pranchas de especificação e apoio","Recursos visuais correspondentes ao nível BRONZE, PRATA ou OURO"]'::jsonb,
 '["Mobiliário sob medida quando não previsto","Projetos complementares não contratados","Compra ou fornecimento de materiais","Execução ou gerenciamento da obra, salvo contratação específica"]'::jsonb,
 '["Briefing de estilo e preferências","Medidas e levantamento disponíveis","Referências de mobiliário, equipamentos e orçamento","Aprovação das definições por etapa"]'::jsonb,
 2,'["PDF"]'::jsonb,true,'Integrado ao cronograma geral do contrato.',array['1.1','1.5','1.7','2.1','6.1'],1,true),

('i','Paisagismo','projeto',true,
 'Desenvolvimento do conceito e especificações paisagísticas previstas no escopo, considerando organização dos espaços externos e espécies/elementos compatíveis com as condições informadas.',
 '["Planta de paisagismo","Setorização dos espaços externos","Especificações de espécies e elementos previstos","Detalhes compatíveis com a etapa contratada","Recursos visuais correspondentes ao nível contratado quando aplicável"]'::jsonb,
 '["Execução e manutenção do jardim","Irrigação automatizada não contratada","Análises laboratoriais de solo","Fornecimento de espécies e materiais"]'::jsonb,
 '["Levantamento do terreno","Informações de insolação e uso dos espaços","Preferências de manutenção e espécies","Restrições condominiais ou legais disponíveis"]'::jsonb,
 2,'["PDF"]'::jsonb,true,'Integrado ao cronograma geral do contrato.',array['1.1','1.5','1.7','2.1','6.1'],1,true),

('j','Render 3D / Maquete eletrônica','visualizacao',false,
 'Produção de imagens ou representações tridimensionais para comunicação visual do projeto, com caráter ilustrativo e sujeitas às limitações previstas no contrato.',
 '["Modelagem compatível com os materiais de referência disponíveis","Imagens renderizadas previstas no orçamento","Ajustes dentro das rodadas contratadas"]'::jsonb,
 '["Garantia de reprodução exata de cores e texturas em obra","Projeto executivo ou detalhamento técnico","Vídeo ou tour 360° quando não contratado"]'::jsonb,
 '["Projeto ou modelo de referência","Materiais e acabamentos definidos","Referências de iluminação e ambientação quando necessárias"]'::jsonb,
 2,'["JPG","PNG","PDF"]'::jsonb,true,'Conforme quantidade de imagens e complexidade previstas no orçamento.',array['6.1','8.1','8.2'],1,true),

('k','Legalização / Aprovação Prefeitura','legalizacao',false,
 'Serviço técnico-administrativo de preparação, protocolo e acompanhamento do processo de legalização/aprovação expressamente contratado.',
 '["Organização das peças técnicas do processo","Protocolo ou suporte ao protocolo quando previsto","Acompanhamento de exigências e comunicações do órgão","Adequações técnicas abrangidas pelo contrato"]'::jsonb,
 '["Taxas e emolumentos","Garantia de deferimento","Regularização de pendências documentais de terceiros não previstas","Serviços adicionais solicitados pelo órgão fora do escopo original"]'::jsonb,
 '["Documentação do imóvel e proprietários","Procurações e autorizações necessárias","Documentos exigidos pelo órgão","Resposta do cliente às solicitações dentro dos prazos"]'::jsonb,
 2,'["PDF"]'::jsonb,true,'Prazos externos dependem do órgão competente.',array['1.4','2.1','5.5','5.6','6.2.1'],1,true),

('l','Alvará de Construção','legalizacao',false,
 'Serviço vinculado à preparação e acompanhamento técnico do processo de obtenção do Alvará de Construção, quando expressamente incluído no Anexo I.',
 '["Peças técnicas exigíveis no escopo","Organização e acompanhamento do processo","Atendimento às exigências técnicas abrangidas pelo contrato"]'::jsonb,
 '["Taxas e emolumentos","Garantia de emissão do alvará","Obrigações documentais de terceiros não previstas"]'::jsonb,
 '["Documentos do imóvel e proprietários","Projeto legal compatível","Documentos e autorizações exigidos pelo órgão"]'::jsonb,
 2,'["PDF"]'::jsonb,true,'Prazos externos dependem do órgão competente.',array['1.4','5.5','5.6','6.2.1'],1,true),

('m','Habite-se','legalizacao',false,
 'Serviço técnico-administrativo relacionado ao processo de obtenção do Habite-se ou documento equivalente, limitado ao escopo contratado e às condições existentes da obra.',
 '["Verificação documental do processo contratado","Preparação das peças técnicas abrangidas","Acompanhamento das exigências técnicas incluídas no serviço"]'::jsonb,
 '["Taxas e emolumentos","Garantia de deferimento","Correções ou obras físicas necessárias para adequação","Documentos de terceiros não previstos"]'::jsonb,
 '["Documentação da obra e imóvel","Alvarás e projetos aprovados disponíveis","Comprovações e documentos exigidos pelo órgão","Acesso ao imóvel quando necessário"]'::jsonb,
 2,'["PDF"]'::jsonb,true,'Prazos externos dependem do órgão competente.',array['1.4','5.5','5.6','6.2.1'],1,true),

('n','Acompanhamento técnico de obra','obra',false,
 'Acompanhamento técnico periódico da execução para verificação de compatibilidade com o escopo contratado, sem substituir gerenciamento integral, responsabilidade da construtora ou mão de obra.',
 '["Visitas técnicas na frequência contratada","Registros e orientações técnicas correspondentes às visitas","Comunicação de incompatibilidades observadas dentro do escopo"]'::jsonb,
 '["Gerenciamento integral da obra, salvo contratação específica","Controle diário de mão de obra","Responsabilidade por execução de terceiros","Aquisição de materiais"]'::jsonb,
 '["Cronograma de obra","Acesso ao local","Projetos atualizados","Comunicação prévia de etapas críticas"]'::jsonb,
 null,'["PDF"]'::jsonb,false,'Conforme frequência de visitas prevista no orçamento/Anexo I.',array['1.2','1.7','4.1','4.2'],1,true),

('o','Laudo técnico / avaliação / vistoria','laudo',false,
 'Serviço técnico de inspeção, avaliação ou vistoria limitado ao objetivo, escopo, metodologia e condições de acesso definidos para a contratação.',
 '["Identificação do objeto e finalidade","Registro das constatações técnicas pertinentes","Análise compatível com o escopo contratado","Conclusões e recomendações dentro dos limites da vistoria"]'::jsonb,
 '["Ensaios destrutivos ou laboratoriais não contratados","Garantia sobre elementos não acessíveis ou não inspecionados","Projetos ou reparos não incluídos","Perícias judiciais salvo contratação específica"]'::jsonb,
 '["Acesso ao imóvel ou objeto da vistoria","Documentos e históricos disponíveis","Informação clara sobre a finalidade do laudo","Autorização para registros necessários"]'::jsonb,
 1,'["PDF"]'::jsonb,true,'Conforme complexidade, acesso e escopo da vistoria.',array['4.1','4.2','4.3','6.1'],1,true),

('p','Outro','outro',false,
 'Serviço específico definido no orçamento e detalhado no Anexo I. O conteúdo deve ser descrito de forma expressa antes da emissão definitiva.',
 '[]'::jsonb,
 '[]'::jsonb,
 '[]'::jsonb,
 null,'["PDF"]'::jsonb,true,'Conforme descrição específica aprovada.',array['1.1','1.2'],1,true)
on conflict (code) do update set
 name=excluded.name,
 category=excluded.category,
 level_applicable=excluded.level_applicable,
 description=excluded.description,
 deliverables=excluded.deliverables,
 exclusions=excluded.exclusions,
 client_inputs=excluded.client_inputs,
 default_revisions=excluded.default_revisions,
 delivery_formats=excluded.delivery_formats,
 acceptance_required=excluded.acceptance_required,
 planning_reference=excluded.planning_reference,
 contract_clause_refs=excluded.contract_clause_refs,
 version=greatest(public.service_catalog.version,excluded.version),
 active=true,
 updated_at=now();

create or replace function public.enrich_commercial_services(p_services jsonb, p_level text)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $function$
declare
  v_result jsonb := '[]'::jsonb;
  v_item jsonb;
  v_catalog public.service_catalog%rowtype;
  v_level public.service_level_catalog%rowtype;
  v_code text;
  v_level_code text := lower(nullif(btrim(coalesce(p_level,'')),''));
  v_level_json jsonb;
begin
  if v_level_code in ('bronze','prata','ouro') then
    select * into v_level
    from public.service_level_catalog
    where code=v_level_code and active=true;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_services,'[]'::jsonb))
  loop
    v_code := nullif(btrim(v_item->>'code'),'');
    if v_code is null then
      continue;
    end if;

    select * into v_catalog
    from public.service_catalog
    where code=v_code and active=true;

    if found then
      v_level_json := null;
      if v_catalog.level_applicable and v_level.code is not null then
        v_level_json := jsonb_build_object(
          'code',v_level.code,
          'label',v_level.label,
          'subtitle',v_level.subtitle,
          'description',v_level.description,
          'features',v_level.features,
          'exclusions',v_level.exclusions,
          'contractClauses',to_jsonb(v_level.contract_clause_refs),
          'catalogVersion',v_level.version
        );
      end if;

      v_result := v_result || jsonb_build_array(
        jsonb_build_object(
          'code',v_catalog.code,
          'name',v_catalog.name,
          'included',coalesce((v_item->>'included')::boolean,false),
          'value',v_item->'value',
          'notes',nullif(btrim(v_item->>'notes'),''),
          'acceptanceRequired',v_catalog.acceptance_required,
          'displayOrder',coalesce((v_item->>'displayOrder')::integer,ascii(v_catalog.code)-96),
          'description',v_catalog.description,
          'deliverables',v_catalog.deliverables,
          'exclusions',v_catalog.exclusions,
          'clientInputs',v_catalog.client_inputs,
          'revisions',v_catalog.default_revisions,
          'deliveryFormats',v_catalog.delivery_formats,
          'planningReference',v_catalog.planning_reference,
          'contractClauses',to_jsonb(v_catalog.contract_clause_refs),
          'catalogVersion',v_catalog.version,
          'levelApplicable',v_catalog.level_applicable,
          'level',v_level_json
        )
      );
    else
      v_result := v_result || jsonb_build_array(v_item);
    end if;
  end loop;

  return v_result;
end
$function$;

revoke all on function public.enrich_commercial_services(jsonb,text) from public,anon,authenticated;
grant execute on function public.enrich_commercial_services(jsonb,text) to service_role;

create or replace function public.admin_create_commercial_record(p_data jsonb)
returns uuid
language plpgsql
set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_quote text;
  v_area_terreno numeric;
  v_area_construida numeric;
  v_total numeric;
  v_raw text;
  v_level text;
  v_services jsonb;
begin
  if not public.is_portal_admin() then raise exception 'Acesso administrativo necessário'; end if;
  if nullif(btrim(p_data->>'prospect_name'),'') is null then raise exception 'Nome do prospect é obrigatório'; end if;

  v_level := lower(nullif(btrim(p_data->>'experience_level'),''));
  if v_level is not null and v_level not in ('bronze','prata','ouro') then
    raise exception 'Nível de prestação inválido';
  end if;

  v_services := public.enrich_commercial_services(coalesce(p_data->'services','[]'::jsonb),v_level);

  v_raw := nullif(btrim(p_data->>'area_terreno_m2'),'');
  if v_raw is not null then
    v_area_terreno := case when v_raw like '%,%' then replace(replace(v_raw,'.',''),',','.')::numeric else replace(v_raw,' ','')::numeric end;
  end if;

  v_raw := nullif(btrim(p_data->>'area_construida_m2'),'');
  if v_raw is not null then
    v_area_construida := case when v_raw like '%,%' then replace(replace(v_raw,'.',''),',','.')::numeric else replace(v_raw,' ','')::numeric end;
  end if;

  v_raw := nullif(btrim(p_data->>'total_value'),'');
  if v_raw is not null then
    v_total := case when v_raw like '%,%' then replace(replace(v_raw,'.',''),',','.')::numeric else replace(v_raw,' ','')::numeric end;
  end if;

  v_quote := public.admin_next_commercial_number('ORC');

  insert into public.commercial_records(
    quote_number,prospect_name,cpf_cnpj,email,phone,cep,address,city,state,
    property_address,property_type,area_terreno_m2,area_construida_m2,construction_standard,
    experience_level,services,custom_service,total_value,payment_terms,valid_until,notes
  ) values (
    v_quote,btrim(p_data->>'prospect_name'),nullif(btrim(p_data->>'cpf_cnpj'),''),nullif(btrim(p_data->>'email'),''),
    nullif(btrim(p_data->>'phone'),''),nullif(btrim(p_data->>'cep'),''),nullif(btrim(p_data->>'address'),''),
    nullif(btrim(p_data->>'city'),''),nullif(btrim(p_data->>'state'),''),nullif(btrim(p_data->>'property_address'),''),
    nullif(btrim(p_data->>'property_type'),''),v_area_terreno,v_area_construida,
    nullif(btrim(p_data->>'construction_standard'),''),v_level,v_services,
    nullif(btrim(p_data->>'custom_service'),''),v_total,
    coalesce(p_data->'payment_terms','[]'::jsonb),
    coalesce(nullif(p_data->>'valid_until','')::date,current_date+15),
    nullif(btrim(p_data->>'notes'),'')
  )
  returning id into v_id;

  insert into public.audit_log(user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'create_commercial_record','commercial_records',v_id,
    jsonb_build_object('quote_number',v_quote,'experience_level',v_level,'catalog_snapshot',true));

  return v_id;
end
$function$;

create or replace function public.admin_create_independent_contract(
  p_data jsonb,
  p_quote_ids uuid[] default '{}'::uuid[],
  p_source_project_id uuid default null
)
returns uuid
language plpgsql
set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_contract text;
  v_source public.commercial_records%rowtype;
  v_project public.projetos%rowtype;
  v_client public.clientes%rowtype;
  v_existing_contract public.contratos%rowtype;
  v_q uuid;
  v_raw text;
  v_total numeric;
  v_area_terreno numeric;
  v_area_construida numeric;
  v_property_address text;
  v_source_count integer := coalesce(array_length(p_quote_ids,1),0);
  v_level text;
  v_services jsonb;
begin
  if not public.is_portal_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;

  if v_source_count > 0 and p_source_project_id is not null then
    raise exception 'Selecione apenas uma origem de orçamento';
  end if;

  if v_source_count > 0 then
    select * into v_source
    from public.commercial_records
    where id=p_quote_ids[1] and record_kind='orcamento';
    if not found then raise exception 'Orçamento de origem inválido'; end if;
  end if;

  if p_source_project_id is not null then
    select * into v_project from public.projetos where id=p_source_project_id;
    if not found or nullif(btrim(coalesce(v_project.numero_orcamento,'')),'') is null then
      raise exception 'Orçamento de origem inválido';
    end if;
    if v_project.cliente_id is not null then
      select * into v_client from public.clientes where id=v_project.cliente_id;
    end if;
    if v_project.contract_id is not null then
      select * into v_existing_contract from public.contratos where id=v_project.contract_id;
    end if;
    v_property_address := nullif(concat_ws(', ',
      nullif(btrim(v_project.endereco_obra),''),
      nullif(btrim(v_project.numero_obra),''),
      nullif(btrim(v_project.complemento_obra),''),
      nullif(btrim(v_project.bairro_obra),''),
      nullif(btrim(v_project.cidade_obra),''),
      nullif(btrim(v_project.estado_obra),'')
    ),'');
  end if;

  if nullif(btrim(coalesce(p_data->>'prospect_name',v_source.prospect_name,v_client.nome)),'') is null then
    raise exception 'Nome / razão social é obrigatório';
  end if;

  v_level := lower(coalesce(
    nullif(btrim(p_data->>'experience_level'),''),
    nullif(btrim(v_source.experience_level),'')
  ));

  if v_level is not null and v_level not in ('bronze','prata','ouro') then
    raise exception 'Nível de prestação inválido';
  end if;

  v_services := public.enrich_commercial_services(
    coalesce(p_data->'services',v_source.services,'[]'::jsonb),
    v_level
  );

  v_raw:=nullif(btrim(p_data->>'total_value'),'');
  if v_raw is not null then
    v_total:=case when v_raw like '%,%' then replace(replace(v_raw,'.',''),',','.')::numeric else replace(v_raw,' ','')::numeric end;
  else
    v_total:=coalesce(v_source.total_value,v_existing_contract.contract_value);
  end if;

  v_raw:=nullif(btrim(p_data->>'area_terreno_m2'),'');
  if v_raw is not null then
    v_area_terreno:=case when v_raw like '%,%' then replace(replace(v_raw,'.',''),',','.')::numeric else replace(v_raw,' ','')::numeric end;
  else
    v_area_terreno:=coalesce(v_source.area_terreno_m2,v_project.area_terreno_m2);
  end if;

  v_raw:=nullif(btrim(p_data->>'area_construida_m2'),'');
  if v_raw is not null then
    v_area_construida:=case when v_raw like '%,%' then replace(replace(v_raw,'.',''),',','.')::numeric else replace(v_raw,' ','')::numeric end;
  else
    v_area_construida:=coalesce(v_source.area_construida_m2,v_project.area_construida_m2);
  end if;

  v_contract:=public.admin_next_commercial_number('CON');

  insert into public.commercial_records(
    quote_number,contract_number,record_kind,source_mode,status,
    prospect_name,cpf_cnpj,email,phone,cep,address,city,state,
    property_address,property_type,area_terreno_m2,area_construida_m2,
    construction_standard,experience_level,services,custom_service,
    total_value,payment_terms,valid_until,notes,source_project_id
  )
  values(
    'REF-'||v_contract,v_contract,'contrato',
    case when v_source_count>0 then 'orcamento'
         when p_source_project_id is not null then 'projeto_orcamento'
         else 'manual' end,
    'rascunho_orcamento',
    coalesce(nullif(btrim(p_data->>'prospect_name'),''),v_source.prospect_name,v_client.nome),
    coalesce(nullif(btrim(p_data->>'cpf_cnpj'),''),v_source.cpf_cnpj,v_client.cpf_cnpj),
    coalesce(nullif(btrim(p_data->>'email'),''),v_source.email,v_client.email),
    coalesce(nullif(btrim(p_data->>'phone'),''),v_source.phone,v_client.telefone),
    coalesce(nullif(btrim(p_data->>'cep'),''),v_source.cep,v_project.cep_obra,v_client.cep),
    coalesce(nullif(btrim(p_data->>'address'),''),v_source.address,v_client.endereco),
    coalesce(nullif(btrim(p_data->>'city'),''),v_source.city,v_project.cidade_obra,v_client.cidade),
    coalesce(nullif(btrim(p_data->>'state'),''),v_source.state,v_project.estado_obra,v_client.estado),
    coalesce(nullif(btrim(p_data->>'property_address'),''),v_source.property_address,v_property_address),
    coalesce(nullif(btrim(p_data->>'property_type'),''),v_source.property_type,v_project.tipo,v_existing_contract.service_type),
    v_area_terreno,v_area_construida,
    coalesce(nullif(btrim(p_data->>'construction_standard'),''),v_source.construction_standard),
    v_level,v_services,
    coalesce(nullif(btrim(p_data->>'custom_service'),''),v_source.custom_service),
    v_total,
    coalesce(p_data->'payment_terms',v_source.payment_terms,'[]'::jsonb),
    current_date+30,
    coalesce(nullif(btrim(p_data->>'notes'),''),v_source.notes,v_existing_contract.notes),
    p_source_project_id
  )
  returning id into v_id;

  foreach v_q in array coalesce(p_quote_ids,'{}'::uuid[]) loop
    if not exists(select 1 from public.commercial_records where id=v_q and record_kind='orcamento') then
      raise exception 'Um dos vínculos não é um orçamento válido';
    end if;
    insert into public.commercial_contract_quote_links(contract_record_id,quote_record_id)
    values(v_id,v_q)
    on conflict do nothing;
  end loop;

  insert into public.audit_log(user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'create_independent_contract','commercial_records',v_id,
    jsonb_build_object(
      'contract_number',v_contract,
      'quote_ids',to_jsonb(coalesce(p_quote_ids,'{}'::uuid[])),
      'source_project_id',p_source_project_id,
      'source_quote_number',v_project.numero_orcamento,
      'experience_level',v_level,
      'catalog_snapshot',true
    ));

  return v_id;
end
$function$;
