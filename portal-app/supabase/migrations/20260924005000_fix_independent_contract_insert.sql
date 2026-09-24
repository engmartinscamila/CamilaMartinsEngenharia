-- Corrige a criação de contratos independentes sem alterar contratos/documentos já existentes.
-- A versão anterior repetia linked_client_id na lista de colunas do INSERT, causando falha em runtime.
-- Para origem em projeto existente, o cliente do projeto é usado apenas como vínculo do novo registro comercial.

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
    linked_client_id,prospect_name,cpf_cnpj,email,phone,cep,address,city,state,
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
    coalesce(nullif(p_data->>'linked_client_id','')::uuid,v_client.id),
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

-- A função de 3 parâmetros já aceita a omissão de p_source_project_id.
-- Remove apenas o overload redundante que poderia tornar a resolução RPC ambígua.
drop function if exists public.admin_create_independent_contract(jsonb,uuid[]);
