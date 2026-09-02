
alter table public.commercial_records
  add column if not exists source_project_id uuid null
  references public.projetos(id) on delete set null;

create index if not exists commercial_records_source_project_idx
  on public.commercial_records(source_project_id);

comment on column public.commercial_records.source_project_id is
  'Projeto/orçamento legado usado como origem de um contrato CON.';

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

    if not found then
      raise exception 'Orçamento de origem inválido';
    end if;
  end if;

  if p_source_project_id is not null then
    select * into v_project
    from public.projetos
    where id=p_source_project_id;

    if not found or nullif(btrim(coalesce(v_project.numero_orcamento,'')),'') is null then
      raise exception 'Orçamento de origem inválido';
    end if;

    if v_project.cliente_id is not null then
      select * into v_client
      from public.clientes
      where id=v_project.cliente_id;
    end if;

    if v_project.contract_id is not null then
      select * into v_existing_contract
      from public.contratos
      where id=v_project.contract_id;
    end if;

    v_property_address := nullif(
      concat_ws(', ',
        nullif(btrim(v_project.endereco_obra),''),
        nullif(btrim(v_project.numero_obra),''),
        nullif(btrim(v_project.complemento_obra),''),
        nullif(btrim(v_project.bairro_obra),''),
        nullif(btrim(v_project.cidade_obra),''),
        nullif(btrim(v_project.estado_obra),'')
      ),
      ''
    );
  end if;

  if nullif(btrim(coalesce(
    p_data->>'prospect_name',
    v_source.prospect_name,
    v_client.nome
  )),'') is null then
    raise exception 'Nome / razão social é obrigatório';
  end if;

  v_raw:=nullif(btrim(p_data->>'total_value'),'');
  if v_raw is not null then
    v_total:=case
      when v_raw like '%,%' then replace(replace(v_raw,'.',''),',','.')::numeric
      else replace(v_raw,' ','')::numeric
    end;
  else
    v_total:=coalesce(v_source.total_value,v_existing_contract.contract_value);
  end if;

  v_raw:=nullif(btrim(p_data->>'area_terreno_m2'),'');
  if v_raw is not null then
    v_area_terreno:=case
      when v_raw like '%,%' then replace(replace(v_raw,'.',''),',','.')::numeric
      else replace(v_raw,' ','')::numeric
    end;
  else
    v_area_terreno:=coalesce(v_source.area_terreno_m2,v_project.area_terreno_m2);
  end if;

  v_raw:=nullif(btrim(p_data->>'area_construida_m2'),'');
  if v_raw is not null then
    v_area_construida:=case
      when v_raw like '%,%' then replace(replace(v_raw,'.',''),',','.')::numeric
      else replace(v_raw,' ','')::numeric
    end;
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
  values (
    'REF-'||v_contract,
    v_contract,
    'contrato',
    case
      when v_source_count>0 then 'orcamento'
      when p_source_project_id is not null then 'projeto_orcamento'
      else 'manual'
    end,
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
    v_area_terreno,
    v_area_construida,
    coalesce(nullif(btrim(p_data->>'construction_standard'),''),v_source.construction_standard),
    coalesce(nullif(btrim(p_data->>'experience_level'),''),v_source.experience_level),
    coalesce(p_data->'services',v_source.services,'[]'::jsonb),
    coalesce(nullif(btrim(p_data->>'custom_service'),''),v_source.custom_service),
    v_total,
    coalesce(p_data->'payment_terms',v_source.payment_terms,'[]'::jsonb),
    current_date+30,
    coalesce(nullif(btrim(p_data->>'notes'),''),v_source.notes,v_existing_contract.notes),
    p_source_project_id
  )
  returning id into v_id;

  foreach v_q in array coalesce(p_quote_ids,'{}'::uuid[]) loop
    if not exists(
      select 1 from public.commercial_records
      where id=v_q and record_kind='orcamento'
    ) then
      raise exception 'Um dos vínculos não é um orçamento válido';
    end if;

    insert into public.commercial_contract_quote_links(contract_record_id,quote_record_id)
    values(v_id,v_q)
    on conflict do nothing;
  end loop;

  insert into public.audit_log(user_id,action,entity_type,entity_id,details)
  values(
    auth.uid(),
    'create_independent_contract',
    'commercial_records',
    v_id,
    jsonb_build_object(
      'contract_number',v_contract,
      'quote_ids',to_jsonb(coalesce(p_quote_ids,'{}'::uuid[])),
      'source_project_id',p_source_project_id,
      'source_quote_number',v_project.numero_orcamento
    )
  );

  return v_id;
end
$function$;

create or replace function public.admin_convert_commercial_record(p_record_id uuid)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  r public.commercial_records%rowtype;
  v_client uuid;
  v_contract uuid;
  v_project uuid;
  v_project_name text;
  v_source_project public.projetos%rowtype;
  item jsonb;
  v_code text;
  v_name text;
  v_origin_quote text;
begin
  if not public.is_portal_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;

  select * into r
  from public.commercial_records
  where id=p_record_id
  for update;

  if not found then
    raise exception 'Registro comercial não encontrado';
  end if;

  if r.record_kind<>'contrato' then
    raise exception 'Selecione um contrato independente para formalizar cliente/projeto';
  end if;

  if r.linked_project_id is not null then
    return jsonb_build_object(
      'client_id',r.linked_client_id,
      'contract_id',r.linked_contract_id,
      'project_id',r.linked_project_id
    );
  end if;

  select q.quote_number into v_origin_quote
  from public.commercial_contract_quote_links l
  join public.commercial_records q on q.id=l.quote_record_id
  where l.contract_record_id=r.id
  order by l.created_at
  limit 1;

  if r.source_project_id is not null then
    select * into v_source_project
    from public.projetos
    where id=r.source_project_id
    for update;

    if not found then
      raise exception 'Projeto do orçamento de origem não encontrado';
    end if;

    v_origin_quote:=coalesce(v_origin_quote,v_source_project.numero_orcamento);
    v_project:=v_source_project.id;
    v_client:=v_source_project.cliente_id;
  end if;

  if v_client is null and r.email is not null then
    select id into v_client
    from public.clientes
    where lower(btrim(email))=lower(btrim(r.email))
    limit 1;
  end if;

  if v_client is null and r.cpf_cnpj is not null then
    select id into v_client
    from public.clientes
    where regexp_replace(coalesce(cpf_cnpj,''),'\D','','g')=
          regexp_replace(r.cpf_cnpj,'\D','','g')
    limit 1;
  end if;

  if v_client is null then
    insert into public.clientes(
      nome,cpf_cnpj,telefone,email,endereco,cidade,estado,cep,status,parceria
    )
    values(
      r.prospect_name,r.cpf_cnpj,r.phone,r.email,r.address,r.city,r.state,r.cep,'ativo',false
    )
    returning id into v_client;
  end if;

  if v_project is not null and v_source_project.contract_id is not null then
    v_contract:=v_source_project.contract_id;

    update public.contratos
    set
      legacy_contract_number = case
        when contract_number is distinct from r.contract_number
          then coalesce(legacy_contract_number,contract_number)
        else legacy_contract_number
      end,
      contract_number=r.contract_number,
      cliente_id=v_client,
      service_type=coalesce(r.custom_service,r.property_type,service_type),
      status='ativo',
      contract_value=coalesce(r.total_value,contract_value),
      currency='BRL',
      notes=concat_ws(
        ' | ',
        case when v_origin_quote is not null then 'Vinculado ao orçamento '||v_origin_quote end,
        nullif(r.notes,''),
        nullif(notes,'')
      ),
      updated_at=now()
    where id=v_contract;
  else
    insert into public.contratos(
      cliente_id,contract_number,service_type,status,contract_value,currency,notes
    )
    values(
      v_client,
      r.contract_number,
      coalesce(r.custom_service,r.property_type),
      'ativo',
      r.total_value,
      'BRL',
      concat_ws(
        ' | ',
        case when v_origin_quote is not null then 'Vinculado ao orçamento '||v_origin_quote end,
        r.notes
      )
    )
    returning id into v_contract;
  end if;

  if v_project is null then
    v_project_name:=coalesce(nullif(r.property_type,''),'Projeto')||' — '||r.prospect_name;

    insert into public.projetos(
      cliente_id,nome,tipo,status,numero_contrato,numero_orcamento,
      area_construida_m2,area_terreno_m2,cep_obra,endereco_obra,
      cidade_obra,estado_obra,contract_id,parceria
    )
    values(
      v_client,v_project_name,r.property_type,'ativo',r.contract_number,v_origin_quote,
      r.area_construida_m2,r.area_terreno_m2,r.cep,r.property_address,
      r.city,r.state,v_contract,false
    )
    returning id into v_project;
  else
    update public.projetos
    set
      cliente_id=v_client,
      numero_contrato=r.contract_number,
      numero_orcamento=coalesce(numero_orcamento,v_origin_quote),
      contract_id=v_contract,
      tipo=coalesce(nullif(r.property_type,''),tipo),
      area_construida_m2=coalesce(r.area_construida_m2,area_construida_m2),
      area_terreno_m2=coalesce(r.area_terreno_m2,area_terreno_m2),
      cep_obra=coalesce(nullif(r.cep,''),cep_obra),
      endereco_obra=coalesce(nullif(r.property_address,''),endereco_obra),
      cidade_obra=coalesce(nullif(r.city,''),cidade_obra),
      estado_obra=coalesce(nullif(r.state,''),estado_obra)
    where id=v_project;
  end if;

  for item in
    select * from jsonb_array_elements(coalesce(r.services,'[]'::jsonb))
  loop
    if coalesce((item->>'included')::boolean,true) then
      v_code:=nullif(btrim(item->>'code'),'');
      v_name:=nullif(btrim(item->>'name'),'');
      if v_code is not null and v_name is not null then
        insert into public.contract_scope_items(
          contract_id,service_code,service_name,included,
          acceptance_required,display_order,notes
        )
        values(
          v_contract,v_code,v_name,true,
          coalesce((item->>'acceptanceRequired')::boolean,true),
          coalesce((item->>'displayOrder')::integer,0),
          nullif(item->>'notes','')
        )
        on conflict(contract_id,service_code)
        do update set
          service_name=excluded.service_name,
          included=true,
          acceptance_required=excluded.acceptance_required,
          display_order=excluded.display_order,
          notes=excluded.notes,
          updated_at=now();
      end if;
    end if;
  end loop;

  update public.commercial_records
  set
    linked_client_id=v_client,
    linked_contract_id=v_contract,
    linked_project_id=v_project,
    status='convertido',
    updated_at=now()
  where id=r.id;

  update public.documentos
  set cliente_id=v_client,projeto_id=v_project,contract_id=v_contract
  where id=r.contract_document_id and id is not null;

  insert into public.audit_log(user_id,action,entity_type,entity_id,details)
  values(
    auth.uid(),
    'convert_independent_contract',
    'commercial_records',
    r.id,
    jsonb_build_object(
      'client_id',v_client,
      'contract_id',v_contract,
      'project_id',v_project,
      'origin_quote',v_origin_quote,
      'reused_source_project',r.source_project_id is not null
    )
  );

  return jsonb_build_object(
    'client_id',v_client,
    'contract_id',v_contract,
    'project_id',v_project
  );
end
$function$;
