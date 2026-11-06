-- Projeto pode preceder contrato e orçamento. Nenhum contrato ou número é inventado.
create or replace function public.admin_create_project_draft(p_client_id uuid,p_project jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid;v_auth uuid;
begin
 if not public.is_portal_admin() then raise exception 'Acesso administrativo necessário';end if;
 if jsonb_typeof(p_project) is distinct from 'object' or length(btrim(coalesce(p_project->>'name','')))<3
   or nullif(btrim(p_project->>'address'),'') is null then raise exception 'Informe nome do projeto e endereço da obra';end if;
 if length(coalesce(p_project->>'name',''))>250 or length(coalesce(p_project->>'address',''))>1000
   or (nullif(btrim(p_project->>'state'),'') is not null and btrim(p_project->>'state') !~* '^[a-z]{2}$') then raise exception 'Dados do projeto inválidos';end if;
 select auth_id into v_auth from public.clientes where id=p_client_id and coalesce(status,'ativo')='ativo' for key share;
 if not found then raise exception 'Cliente ativo não encontrado';end if;
 insert into public.projetos(cliente_id,nome,tipo,status,endereco_obra,numero_obra,bairro_obra,cidade_obra,estado_obra,numero_orcamento)
 values(p_client_id,btrim(p_project->>'name'),nullif(btrim(p_project->>'service_type'),''),'orcamento',
 btrim(p_project->>'address'),nullif(btrim(p_project->>'number'),''),nullif(btrim(p_project->>'neighborhood'),''),
 nullif(btrim(p_project->>'city'),''),upper(nullif(btrim(p_project->>'state'),'')),nullif(btrim(p_project->>'quote_number'),''))
 returning id into v_id;
 if v_auth is not null then
 insert into public.project_members(project_id,user_id,role,active)values(v_id,v_auth,'client',true)
 on conflict(project_id,user_id) do update set active=true,role='client',updated_at=now();
 end if;
 insert into public.audit_log(user_id,action,entity_type,entity_id,details)
 values(auth.uid(),'create_project_before_contract','projetos',v_id,jsonb_build_object('client_id',p_client_id,'contract_created',false));
 return v_id;
end $$;
revoke all on function public.admin_create_project_draft(uuid,jsonb) from public,anon;
grant execute on function public.admin_create_project_draft(uuid,jsonb) to authenticated;

CREATE OR REPLACE FUNCTION public.admin_create_independent_contract(p_data jsonb, p_quote_ids uuid[] DEFAULT '{}'::uuid[], p_source_project_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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


  if v_source_count > 0 then
    select * into v_source
    from public.commercial_records
    where id=p_quote_ids[1] and record_kind='orcamento';
    if not found then raise exception 'Orçamento de origem inválido'; end if;
  end if;

  if p_source_project_id is not null then
    select * into v_project from public.projetos where id=p_source_project_id for update;
    if not found then
      raise exception 'Projeto de origem inválido';
    end if;
    if v_project.cliente_id is not null then
      select * into v_client from public.clientes where id=v_project.cliente_id;
    end if;
    if v_client.id is null or coalesce(v_client.status,'ativo')<>'ativo' then
      raise exception 'Selecione um projeto de cliente ativo';
    end if;
    if nullif(p_data->>'linked_client_id','') is not null
      and (p_data->>'linked_client_id')::uuid<>v_project.cliente_id then
      raise exception 'O projeto precisa pertencer ao cliente selecionado';
    end if;
    foreach v_q in array coalesce(p_quote_ids,'{}'::uuid[]) loop
      select * into v_source from public.commercial_records where id=v_q and record_kind='orcamento';
      if not found or not coalesce((
        v_source.linked_client_id=v_client.id or
        (v_source.linked_client_id is null and (
          (nullif(regexp_replace(coalesce(v_client.cpf_cnpj,''),'[^0-9]','','g'),'') is not null
            and regexp_replace(coalesce(v_source.cpf_cnpj,''),'[^0-9]','','g')=regexp_replace(v_client.cpf_cnpj,'[^0-9]','','g'))
          or (nullif(btrim(v_client.email),'') is not null and lower(btrim(v_source.email))=lower(btrim(v_client.email)))
        ))
      ),false) then raise exception 'O orçamento e o projeto precisam pertencer ao mesmo cliente';end if;
    end loop;
    if v_source_count>0 then select * into v_source from public.commercial_records where id=p_quote_ids[1];end if;
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

  if v_source_count > 0 then
    -- O contrato herda o escopo congelado dos ORCs de origem, sem recalcular versões
    -- do catálogo e sem depender de campos reenviados pelo navegador.
    select coalesce(jsonb_agg(svc.item order by source.quote_ord,svc.item_ord),'[]'::jsonb)
      into v_services
    from unnest(p_quote_ids) with ordinality as source(id,quote_ord)
    join public.commercial_records q on q.id=source.id and q.record_kind='orcamento'
    cross join lateral jsonb_array_elements(coalesce(q.services,'[]'::jsonb)) with ordinality as svc(item,item_ord)
    where coalesce((svc.item->>'included')::boolean,false)=true;
  else
    v_services := public.enrich_commercial_services(
      coalesce(p_data->'services',v_source.services,'[]'::jsonb),
      v_level
    );
  end if;

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

  v_raw:=nullif(nullif(nullif(nullif(btrim(p_data->>'total_value'),'-'),'–'),'—'),'');
  if v_raw is not null then
    v_total:=case when v_raw like '%,%' then replace(replace(v_raw,'.',''),',','.')::numeric else replace(v_raw,' ','')::numeric end;
  else
    v_total:=coalesce(v_source.total_value,v_existing_contract.contract_value);
  end if;

  v_raw:=nullif(nullif(nullif(nullif(btrim(p_data->>'area_terreno_m2'),'-'),'–'),'—'),'');
  if v_raw is not null then
    v_area_terreno:=case when v_raw like '%,%' then replace(replace(v_raw,'.',''),',','.')::numeric else replace(v_raw,' ','')::numeric end;
  else
    v_area_terreno:=coalesce(v_source.area_terreno_m2,v_project.area_terreno_m2);
  end if;

  v_raw:=nullif(nullif(nullif(nullif(btrim(p_data->>'area_construida_m2'),'-'),'–'),'—'),'');
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
         when p_source_project_id is not null and nullif(btrim(v_project.numero_orcamento),'') is not null then 'projeto_orcamento'
         else 'manual' end,
    'rascunho_orcamento',
    coalesce(nullif(p_data->>'linked_client_id','')::uuid,v_source.linked_client_id,v_client.id),
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
$function$
;

CREATE OR REPLACE FUNCTION public.assert_commercial_contract_quote_consistency(p_contract_record_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  c public.commercial_records%rowtype;
  v_link_count integer;
  v_bad integer;
  v_quote_total numeric;
begin
  if coalesce(auth.role(),'') <> 'service_role' and not public.is_portal_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;

  select * into c
  from public.commercial_records
  where id=p_contract_record_id and record_kind='contrato';

  if not found then
    raise exception 'Contrato comercial não encontrado';
  end if;

  select count(*) into v_link_count
  from public.commercial_contract_quote_links
  where contract_record_id=c.id;

  -- Sem ORC da Central, somente um projeto legado com número de orçamento
  -- pode sustentar o contrato. Contrato totalmente manual é bloqueado.
  if v_link_count=0 then
    -- Contrato direto solicitado pela administradora: não exige orçamento prévio.
    -- Permanecem obrigatórias a governança documental e a autorização administrativa.
    if c.source_mode = 'manual' and (c.source_project_id is null or exists(
      select 1 from public.projetos p where p.id=c.source_project_id and p.cliente_id=c.linked_client_id
    )) then
      return jsonb_build_object(
        'contract_record_id', c.id,
        'contract_number', c.contract_number,
        'manual_contract', true,
        'legacy_project_quote', false,
        'quotes', 0,
        'contract_master_version', c.contract_master_version,
        'consistent', true
      );
    end if;
    if c.source_project_id is null or not exists(
      select 1
      from public.projetos p
      where p.id=c.source_project_id
        and nullif(btrim(coalesce(p.numero_orcamento,'')),'') is not null
    ) then
      raise exception 'Contrato sem orçamento de origem. Vincule um ORC aprovado antes de prosseguir';
    end if;

    return jsonb_build_object(
      'contract_record_id',c.id,
      'manual_contract',false,
      'legacy_project_quote',true,
      'quotes',0,
      'source_project_id',c.source_project_id
    );
  end if;

  -- Todos os orçamentos vinculados precisam ter sido realmente emitidos.
  select count(*) into v_bad
  from public.commercial_contract_quote_links l
  join public.commercial_records q on q.id=l.quote_record_id
  where l.contract_record_id=c.id
    and (
      q.record_kind<>'orcamento'
      or q.quote_document_id is null
      or q.status not in ('orcamento_gerado','orcamento_aceito','contrato_gerado','convertido')
    );
  if v_bad>0 then
    raise exception 'Há orçamento vinculado que ainda não foi emitido/validado';
  end if;

  -- A versão contratual do orçamento e do contrato precisa ser a mesma.
  select count(*) into v_bad
  from public.commercial_contract_quote_links l
  join public.commercial_records q on q.id=l.quote_record_id
  where l.contract_record_id=c.id
    and q.contract_master_version is distinct from c.contract_master_version;
  if v_bad>0 then
    raise exception 'Orçamento e contrato utilizam versões diferentes do Contrato Mestre. Gere nova versão coerente antes do Anexo I';
  end if;

  -- Não permite o mesmo código de serviço repetido em orçamentos diferentes do mesmo contrato.
  select count(*) into v_bad
  from (
    select item->>'code' code,count(*) qtd
    from public.commercial_contract_quote_links l
    join public.commercial_records q on q.id=l.quote_record_id
    cross join lateral jsonb_array_elements(coalesce(q.services,'[]'::jsonb)) item
    where l.contract_record_id=c.id
      and coalesce((item->>'included')::boolean,false)=true
    group by item->>'code'
    having count(*)>1
  ) d;
  if v_bad>0 then
    raise exception 'O mesmo serviço aparece em mais de um orçamento vinculado. Consolide/revise antes de gerar o Anexo I';
  end if;

  -- O conjunto de serviços deve ser idêntico.
  if exists (
    select item->>'code'
    from jsonb_array_elements(coalesce(c.services,'[]'::jsonb)) item
    where coalesce((item->>'included')::boolean,false)=true
    except
    select item->>'code'
    from public.commercial_contract_quote_links l
    join public.commercial_records q on q.id=l.quote_record_id
    cross join lateral jsonb_array_elements(coalesce(q.services,'[]'::jsonb)) item
    where l.contract_record_id=c.id
      and coalesce((item->>'included')::boolean,false)=true
  ) or exists (
    select item->>'code'
    from public.commercial_contract_quote_links l
    join public.commercial_records q on q.id=l.quote_record_id
    cross join lateral jsonb_array_elements(coalesce(q.services,'[]'::jsonb)) item
    where l.contract_record_id=c.id
      and coalesce((item->>'included')::boolean,false)=true
    except
    select item->>'code'
    from jsonb_array_elements(coalesce(c.services,'[]'::jsonb)) item
    where coalesce((item->>'included')::boolean,false)=true
  ) then
    raise exception 'Serviços divergem entre orçamento e contrato. Corrija a contratação ou formalize revisão/aditivo';
  end if;

  -- Total comercial também precisa bater.
  select sum(q.total_value) into v_quote_total
  from public.commercial_contract_quote_links l
  join public.commercial_records q on q.id=l.quote_record_id
  where l.contract_record_id=c.id;

  if c.total_value is null or v_quote_total is null or abs(c.total_value-v_quote_total)>0.01 then
    raise exception 'Valor total diverge entre orçamento e contrato. Corrija antes do Anexo I';
  end if;

  -- Confere, por atividade: nível, valor, catálogo, versão da matriz, escopo e exclusões.
  with q_items as (
    select
      item->>'code' code,
      item->>'levelCode' level_code,
      item->>'value' value_text,
      item->>'catalogVersion' catalog_version,
      item->>'levelScopeVersion' level_scope_version,
      coalesce(item->>'customDescription','') custom_description,
      coalesce(item->'deliverables','[]'::jsonb) deliverables,
      coalesce(item->'exclusions','[]'::jsonb) exclusions,
      coalesce(item->>'revisions','') revisions,
      coalesce(item->'deliveryFormats','[]'::jsonb) delivery_formats
    from public.commercial_contract_quote_links l
    join public.commercial_records q on q.id=l.quote_record_id
    cross join lateral jsonb_array_elements(coalesce(q.services,'[]'::jsonb)) item
    where l.contract_record_id=c.id
      and coalesce((item->>'included')::boolean,false)=true
  ),
  c_items as (
    select
      item->>'code' code,
      item->>'levelCode' level_code,
      item->>'value' value_text,
      item->>'catalogVersion' catalog_version,
      item->>'levelScopeVersion' level_scope_version,
      coalesce(item->>'customDescription','') custom_description,
      coalesce(item->'deliverables','[]'::jsonb) deliverables,
      coalesce(item->'exclusions','[]'::jsonb) exclusions,
      coalesce(item->>'revisions','') revisions,
      coalesce(item->'deliveryFormats','[]'::jsonb) delivery_formats
    from jsonb_array_elements(coalesce(c.services,'[]'::jsonb)) item
    where coalesce((item->>'included')::boolean,false)=true
  )
  select count(*) into v_bad
  from q_items q
  full join c_items x using(code)
  where q.code is null or x.code is null
     or q.level_code is distinct from x.level_code
     or q.catalog_version is distinct from x.catalog_version
     or q.level_scope_version is distinct from x.level_scope_version
     or q.custom_description is distinct from x.custom_description
     or q.deliverables is distinct from x.deliverables
     or q.exclusions is distinct from x.exclusions
     or q.revisions is distinct from x.revisions
     or q.delivery_formats is distinct from x.delivery_formats
     or (
       q.value_text is not null and x.value_text is not null
       and q.value_text ~ '^[0-9]+(\.[0-9]{1,2})?$'
       and x.value_text ~ '^[0-9]+(\.[0-9]{1,2})?$'
       and q.value_text::numeric is distinct from x.value_text::numeric
     )
     or (q.value_text is null) is distinct from (x.value_text is null);

  if v_bad>0 then
    raise exception 'Escopo, nível, valor ou entregáveis divergem entre orçamento e contrato. O Anexo I foi bloqueado';
  end if;

  return jsonb_build_object(
    'contract_record_id',c.id,
    'contract_number',c.contract_number,
    'quotes',v_link_count,
    'contract_master_version',c.contract_master_version,
    'consistent',true
  );
end;
$function$

;


CREATE OR REPLACE FUNCTION public.admin_formalize_service_contract(p_record_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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

  -- Projeto escolhido na elaboração deve ser reutilizado, inclusive após retomada.
  if r.source_project_id is not null and r.linked_project_id is null then
    return public.admin_convert_commercial_record(p_record_id);
  end if;

  if r.linked_contract_id is not null then
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

  -- Prefer the client explicitly linked in the commercial record.
  -- Avoid duplicate clients or a mistaken match by shared e-mail.
  if v_client is null and r.linked_client_id is not null then
    select id into v_client from public.clientes where id=r.linked_client_id;
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
    status='contrato_gerado',
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
$function$

;

-- Ao formalizar, preservar o endereço estruturado do projeto selecionado.
CREATE OR REPLACE FUNCTION public.admin_convert_commercial_record(p_record_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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

    if r.linked_client_id is not null and r.linked_client_id is distinct from v_source_project.cliente_id then
      raise exception 'O projeto precisa pertencer ao cliente do contrato';
    end if;
    v_origin_quote:=coalesce(v_origin_quote,v_source_project.numero_orcamento);
    v_project:=v_source_project.id;
    v_client:=v_source_project.cliente_id;
  end if;

  -- Prefer the client explicitly linked in the commercial record.
  -- Avoid duplicate clients or a mistaken match by shared e-mail.
  if v_client is null and r.linked_client_id is not null then
    select id into v_client from public.clientes where id=r.linked_client_id;
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
    if r.linked_contract_id is not null then
      v_contract:=r.linked_contract_id;
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
      cep_obra=coalesce(nullif(cep_obra,''),nullif(r.cep,'')),
      endereco_obra=coalesce(nullif(endereco_obra,''),nullif(r.property_address,'')),
      cidade_obra=coalesce(nullif(cidade_obra,''),nullif(r.city,'')),
      estado_obra=coalesce(nullif(estado_obra,''),nullif(r.state,''))
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
$function$
;
