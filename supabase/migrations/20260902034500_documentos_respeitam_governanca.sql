
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
  v_master_id uuid;
  v_master_version integer;
begin
  if not public.is_portal_admin() then raise exception 'Acesso administrativo necessário'; end if;
  perform public.assert_document_governance_ready();

  if nullif(btrim(p_data->>'prospect_name'),'') is null then
    raise exception 'Nome do prospect é obrigatório';
  end if;

  select id,version into v_master_id,v_master_version
  from public.contract_master_versions
  where active=true
  order by version desc
  limit 1;

  v_level := lower(nullif(btrim(p_data->>'experience_level'),''));
  if v_level is not null and not exists(
    select 1 from public.service_level_catalog where code=v_level and active=true
  ) then
    raise exception 'Nível de prestação inválido ou inativo';
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
    experience_level,services,custom_service,total_value,payment_terms,valid_until,notes,
    contract_master_id,contract_master_version
  ) values (
    v_quote,btrim(p_data->>'prospect_name'),nullif(btrim(p_data->>'cpf_cnpj'),''),nullif(btrim(p_data->>'email'),''),
    nullif(btrim(p_data->>'phone'),''),nullif(btrim(p_data->>'cep'),''),nullif(btrim(p_data->>'address'),''),
    nullif(btrim(p_data->>'city'),''),nullif(btrim(p_data->>'state'),''),nullif(btrim(p_data->>'property_address'),''),
    nullif(btrim(p_data->>'property_type'),''),v_area_terreno,v_area_construida,
    nullif(btrim(p_data->>'construction_standard'),''),v_level,v_services,
    nullif(btrim(p_data->>'custom_service'),''),v_total,
    coalesce(p_data->'payment_terms','[]'::jsonb),
    coalesce(nullif(p_data->>'valid_until','')::date,current_date+15),
    nullif(btrim(p_data->>'notes'),''),
    v_master_id,v_master_version
  )
  returning id into v_id;

  insert into public.audit_log(user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'create_commercial_record','commercial_records',v_id,
    jsonb_build_object(
      'quote_number',v_quote,
      'experience_level',v_level,
      'catalog_snapshot',true,
      'contract_master_version',v_master_version
    ));

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
  v_master_id uuid;
  v_master_version integer;
begin
  if not public.is_portal_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;
  perform public.assert_document_governance_ready();

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

  if v_level is not null and not exists(
    select 1 from public.service_level_catalog where code=v_level and active=true
  ) then
    raise exception 'Nível de prestação inválido ou inativo';
  end if;

  v_services := public.enrich_commercial_services(
    coalesce(p_data->'services',v_source.services,'[]'::jsonb),
    v_level
  );

  if v_source.contract_master_id is not null then
    v_master_id := v_source.contract_master_id;
    v_master_version := v_source.contract_master_version;
  else
    select id,version into v_master_id,v_master_version
    from public.contract_master_versions
    where active=true
    order by version desc
    limit 1;
  end if;

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
    total_value,payment_terms,valid_until,notes,source_project_id,
    contract_master_id,contract_master_version
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
    p_source_project_id,
    v_master_id,v_master_version
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
      'catalog_snapshot',true,
      'contract_master_version',v_master_version
    ));

  return v_id;
end
$function$;

create or replace function public.admin_create_independent_contract(
  p_data jsonb,
  p_quote_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
set search_path to 'public'
as $function$
begin
  return public.admin_create_independent_contract(p_data,p_quote_ids,null);
end
$function$;

create or replace function public.admin_prepare_contract_document(
  p_project_id uuid,
  p_document_kind text,
  p_approval_id uuid default null,
  p_extra_data jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_project record;
  v_approval record;
  v_document_id uuid;
  v_title text;
  v_optional boolean := true;
  v_data jsonb;
  v_commercial record;
  v_level jsonb := null;
  v_scope_snapshot jsonb := '[]'::jsonb;
  v_text_snapshot jsonb := '{}'::jsonb;
  v_master_id uuid;
  v_master_version integer;
begin
  if not public.is_portal_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;

  if p_document_kind not in (
    'anexo_i','termo_aceite','estudo_preliminar','levantamento_tecnico',
    'servico_adicional','autorizacao_imagem','quitacao_encerramento'
  ) then
    raise exception 'Tipo de documento não suportado';
  end if;

  select
    p.id,p.cliente_id,p.contract_id,p.nome as project_name,p.tipo as project_type,
    p.area_construida_m2,p.area_terreno_m2,p.endereco_obra,p.numero_obra,
    p.complemento_obra,p.bairro_obra,p.cidade_obra,p.estado_obra,p.descricao as project_description,
    c.contract_number,c.signed_at,c.contract_value,c.currency,c.notes as contract_notes,
    cl.nome as client_name,cl.email as client_email,cl.telefone as client_phone,
    cl.cpf_cnpj as client_cpf_cnpj
  into v_project
  from public.projetos p
  join public.contratos c on c.id=p.contract_id
  left join public.clientes cl on cl.id=p.cliente_id
  where p.id=p_project_id;

  if not found then
    raise exception 'Projeto/contrato não encontrado';
  end if;

  select
    cr.id,cr.experience_level,cr.services,cr.notes,cr.quote_number,cr.contract_number,
    cr.payment_terms,cr.total_value,cr.contract_master_id,cr.contract_master_version
  into v_commercial
  from public.commercial_records cr
  where cr.linked_contract_id=v_project.contract_id
     or cr.linked_project_id=p_project_id
  order by cr.updated_at desc
  limit 1;

  if v_commercial.contract_master_id is not null then
    v_master_id := v_commercial.contract_master_id;
    v_master_version := v_commercial.contract_master_version;
  else
    select id,version into v_master_id,v_master_version
    from public.contract_master_versions
    where active=true
    order by version desc
    limit 1;
  end if;

  if nullif(btrim(coalesce(v_commercial.experience_level,'')),'') is not null then
    select jsonb_build_object(
      'code',l.code,'label',l.label,'subtitle',l.subtitle,'description',l.description,
      'features',l.features,'exclusions',l.exclusions,
      'contractClauses',to_jsonb(l.contract_clause_refs),'catalogVersion',l.version
    )
    into v_level
    from public.service_level_catalog l
    where l.code=lower(v_commercial.experience_level)
      and l.active=true;
  end if;

  select coalesce(jsonb_agg(
    (
      coalesce(
        (
          select item
          from jsonb_array_elements(coalesce(v_commercial.services,'[]'::jsonb)) item
          where item->>'code'=s.service_code
          limit 1
        ),
        jsonb_build_object(
          'code',s.service_code,'name',coalesce(sc.name,s.service_name),
          'description',sc.description,'deliverables',coalesce(sc.deliverables,'[]'::jsonb),
          'exclusions',coalesce(sc.exclusions,'[]'::jsonb),
          'clientInputs',coalesce(sc.client_inputs,'[]'::jsonb),
          'revisions',sc.default_revisions,
          'deliveryFormats',coalesce(sc.delivery_formats,'["PDF"]'::jsonb),
          'planningReference',sc.planning_reference,
          'contractClauses',to_jsonb(coalesce(sc.contract_clause_refs,'{}'::text[])),
          'catalogVersion',sc.version,'levelApplicable',coalesce(sc.level_applicable,false),
          'level',case when coalesce(sc.level_applicable,false) and v_level is not null then v_level else null end
        )
      )
      || jsonb_build_object(
        'included',s.included,'acceptanceRequired',s.acceptance_required,
        'displayOrder',s.display_order,'notes',s.notes
      )
    )
    order by s.display_order
  ),'[]'::jsonb)
  into v_scope_snapshot
  from public.contract_scope_items s
  left join public.service_catalog sc on sc.code=s.service_code
  where s.contract_id=v_project.contract_id;

  select coalesce(jsonb_object_agg(
    t.code,
    jsonb_build_object(
      'body',t.body,
      'title',t.title,
      'version',t.version,
      'contractClauses',to_jsonb(t.contract_clause_refs)
    )
  ),'{}'::jsonb)
  into v_text_snapshot
  from public.document_text_catalog t
  where t.active=true
    and t.document_kind=p_document_kind;

  if p_document_kind='termo_aceite' then
    if p_approval_id is null then
      raise exception 'Selecione uma aprovação para gerar o Termo de Aceite';
    end if;

    select * into v_approval
    from public.aprovacoes
    where id=p_approval_id and projeto_id=p_project_id;

    if not found then
      raise exception 'Aprovação não encontrada para este projeto';
    end if;
  end if;

  v_title := case p_document_kind
    when 'anexo_i' then 'Anexo I — Escopo de Serviços, Proposta Comercial e Cronograma'
    when 'termo_aceite' then 'Termo de Aceite de Etapa — ' || coalesce(v_approval.titulo,'Etapa')
    when 'estudo_preliminar' then 'Estudo Preliminar'
    when 'levantamento_tecnico' then 'Ficha de Levantamento Técnico / Vistoria'
    when 'servico_adicional' then 'Termo de Aprovação de Orçamento — Serviço Adicional'
    when 'autorizacao_imagem' then 'Autorização de Uso de Imagem e Divulgação do Projeto'
    when 'quitacao_encerramento' then 'Termo de Quitação e Encerramento de Contrato'
  end;

  v_optional := p_document_kind not in ('anexo_i','termo_aceite');

  v_data := jsonb_build_object(
    'contract_number',v_project.contract_number,
    'contract_signed_at',v_project.signed_at,
    'contract_value',v_project.contract_value,
    'currency',v_project.currency,
    'contract_notes',v_project.contract_notes,
    'client_name',v_project.client_name,
    'client_email',v_project.client_email,
    'client_phone',v_project.client_phone,
    'client_cpf_cnpj',v_project.client_cpf_cnpj,
    'project_name',v_project.project_name,
    'project_type',v_project.project_type,
    'project_description',v_project.project_description,
    'area_construida_m2',v_project.area_construida_m2,
    'area_terreno_m2',v_project.area_terreno_m2,
    'property_address',concat_ws(', ',
      nullif(v_project.endereco_obra,''),nullif(v_project.numero_obra,''),
      nullif(v_project.complemento_obra,''),nullif(v_project.bairro_obra,''),
      nullif(v_project.cidade_obra,''),nullif(v_project.estado_obra,'')
    ),
    'experience_level',v_commercial.experience_level,
    'service_level',v_level,
    'scope_snapshot',v_scope_snapshot,
    'smart_texts',v_text_snapshot,
    'contract_master_id',v_master_id,
    'contract_master_version',v_master_version,
    'source_quote_number',v_commercial.quote_number,
    'commercial_notes',v_commercial.notes,
    'payment_terms',v_commercial.payment_terms,
    'outside_contracted_scope',case
      when p_document_kind='estudo_preliminar' then not exists(
        select 1 from public.contract_scope_items s
        where s.contract_id=v_project.contract_id and s.service_code='a' and s.included=true
      )
      else false
    end
  ) || coalesce(p_extra_data,'{}'::jsonb);

  if p_document_kind='termo_aceite' then
    v_data := v_data || jsonb_build_object(
      'approval_id',v_approval.id,'approval_type',v_approval.tipo,
      'approval_title',v_approval.titulo,'approval_description',v_approval.descricao,
      'delivered_at',v_approval.delivered_at,'approval_due_at',v_approval.approval_due_at,
      'approval_status',v_approval.status
    );
  end if;

  if p_document_kind='anexo_i' then
    v_data := v_data || jsonb_build_object('scope_items',v_scope_snapshot);
  end if;

  insert into public.documentos(
    cliente_id,projeto_id,contract_id,approval_id,nome,tipo,categoria,versao,
    storage_bucket,permitir_download,protection_mode,document_kind,workflow_status,
    generated_data,optional_document
  ) values (
    v_project.cliente_id,v_project.id,v_project.contract_id,p_approval_id,v_title,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'Contratual','1.0','documentos',true,'administrative',p_document_kind,'rascunho',
    v_data,v_optional
  )
  returning id into v_document_id;

  insert into public.audit_log(user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'prepare_contract_document','documentos',v_document_id,
    jsonb_build_object(
      'document_kind',p_document_kind,'project_id',p_project_id,
      'catalog_snapshot',true,'experience_level',v_commercial.experience_level,
      'contract_master_version',v_master_version,'smart_text_snapshot',true
    ));

  return v_document_id;
end
$function$;
