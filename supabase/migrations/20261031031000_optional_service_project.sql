-- Preserve existing records and project links; allow client/contract-only service documents.
alter table public.payment_receipts alter column project_id drop not null;
CREATE OR REPLACE FUNCTION public.admin_issue_payment_receipt(p_data jsonb)
 RETURNS payment_receipts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.clientes; p public.projetos; r public.payment_receipts; identity_data jsonb; issuer jsonb; doc text; amount_value numeric; paid date; city text; ct public.contratos;
begin
 if auth.uid() is null or not public.is_portal_admin() then raise exception 'Acesso administrativo necessário.' using errcode='42501'; end if;
 -- The same request always yields the same immutable receipt, including a lost HTTP response.
 select * into r from public.payment_receipts where request_id=(p_data->>'request_id')::uuid;
 if found then return r; end if;
 select * into c from public.clientes where id=(p_data->>'client_id')::uuid;
 if not found then raise exception 'Cliente não encontrado.'; end if;
 if nullif(p_data->>'project_id','') is not null then
 select * into p from public.projetos where id=(p_data->>'project_id')::uuid and cliente_id=c.id;
 if not found then raise exception 'Selecione um projeto pertencente ao cliente.'; end if;
 end if;
 if coalesce(nullif(p_data->>'contract_id','')::uuid,p.contract_id) is not null then
 select * into ct from public.contratos where id=coalesce(nullif(p_data->>'contract_id','')::uuid,p.contract_id) and cliente_id=c.id;
 if not found or (p.id is not null and p.contract_id is distinct from ct.id) then raise exception 'Contrato incompatível com o cliente/projeto.'; end if;
 end if;
 amount_value:=(p_data->>'amount')::numeric; paid:=(p_data->>'paid_on')::date;
 if amount_value is null or amount_value<=0 or amount_value<>round(amount_value,2) then raise exception 'Informe o valor recebido com até duas casas decimais.'; end if;
 if paid is null or paid>(now() at time zone 'America/Sao_Paulo')::date then raise exception 'Informe uma data de pagamento já realizado.'; end if;
 city:=trim(p_data->>'city');
 if coalesce(length(city),0)<2 or length(city)>160 then raise exception 'Informe a cidade de emissão.'; end if;
 identity_data:=public.service_get_professional_identity();
 doc:=regexp_replace(coalesce(nullif(identity_data->>'cpf',''),identity_data->>'cnpj',''),'\D','','g');
 if coalesce(length(identity_data->>'full_name'),0)<3 or length(doc) not in(11,14) then raise exception 'Complete o nome e CPF/CNPJ da profissional em Configurações antes de emitir.'; end if;
 issuer:=jsonb_build_object('name',identity_data->>'full_name','document',doc,'title',identity_data->>'professional_title');
 insert into public.payment_receipts(request_id,client_id,project_id,amount,paid_on,payment_method,description,snapshot,created_by)
 values((p_data->>'request_id')::uuid,c.id,p.id,amount_value,paid,p_data->>'payment_method',trim(p_data->>'description'),
 jsonb_build_object('issuer',issuer,'payer_name',c.nome,'payer_document',coalesce(c.cpf_cnpj,''),'project_name',p.nome,'contract_number',ct.contract_number,'city',city),auth.uid())
 on conflict(request_id) do nothing returning * into r;
 if r.id is null then select * into r from public.payment_receipts where request_id=(p_data->>'request_id')::uuid; end if;
 insert into public.audit_log(user_id,action,entity_type,entity_id,details)
 values(auth.uid(),'issue_payment_receipt','payment_receipts',r.id,jsonb_build_object('receipt_number',r.receipt_number));
 return r;
end $function$
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
revoke all on function public.admin_formalize_service_contract(uuid) from public,anon;
grant execute on function public.admin_formalize_service_contract(uuid) to authenticated;
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
$function$
;
CREATE OR REPLACE FUNCTION public.admin_prepare_contract_document(p_project_id uuid, p_document_kind text, p_approval_id uuid DEFAULT NULL::uuid, p_extra_data jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_project record;
  v_approval public.aprovacoes%rowtype;
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
  if not public.is_portal_admin() then raise exception 'Acesso administrativo necessário'; end if;

  if p_document_kind not in (
    'anexo_i','termo_aceite','estudo_preliminar','levantamento_tecnico',
    'servico_adicional','autorizacao_imagem','quitacao_encerramento'
  ) then raise exception 'Tipo de documento não suportado'; end if;

  select
    p.id,c.cliente_id,c.id as contract_id,coalesce(p.nome,c.service_type) as project_name,coalesce(p.tipo,c.service_type) as project_type,
    p.area_construida_m2,p.area_terreno_m2,p.endereco_obra,p.numero_obra,
    p.complemento_obra,p.bairro_obra,p.cidade_obra,p.estado_obra,p.descricao as project_description,
    c.contract_number,c.signed_at,c.contract_value,c.currency,c.notes as contract_notes,
    cl.nome as client_name,cl.email as client_email,cl.telefone as client_phone,
    cl.cpf_cnpj as client_cpf_cnpj
  into v_project
  from public.contratos c
  left join public.projetos p on p.contract_id=c.id and p.id=p_project_id
  left join public.clientes cl on cl.id=c.cliente_id
  where (p_project_id is not null and p.id=p_project_id) or (p_project_id is null and c.id=nullif(p_extra_data->>'contract_id','')::uuid);

  if not found then raise exception 'Projeto/contrato não encontrado'; end if;

  select
    cr.id,cr.experience_level,cr.services,cr.notes,cr.quote_number,cr.contract_number,
    cr.payment_terms,cr.total_value,cr.contract_master_id,cr.contract_master_version,cr.smart_texts
  into v_commercial
  from public.commercial_records cr
  where cr.linked_contract_id=v_project.contract_id or cr.linked_project_id=p_project_id
  order by (cr.record_kind='contrato') desc,cr.updated_at desc
  limit 1;

  if v_commercial.contract_master_id is not null then
    v_master_id := v_commercial.contract_master_id;
    v_master_version := v_commercial.contract_master_version;
  else
    select id,version into v_master_id,v_master_version
    from public.contract_master_versions where active=true order by version desc limit 1;
  end if;

  v_text_snapshot := case
    when v_commercial.smart_texts is not null and v_commercial.smart_texts <> '{}'::jsonb
      then v_commercial.smart_texts
    else public.current_document_text_snapshot_all()
  end;

  select item->'level'
  into v_level
  from jsonb_array_elements(coalesce(v_commercial.services,'[]'::jsonb)) item
  where jsonb_typeof(item->'level')='object'
  limit 1;

  if v_level is null
     and nullif(btrim(coalesce(v_commercial.experience_level,'')),'') is not null then
    select jsonb_build_object(
      'code',l.code,'label',l.label,'subtitle',l.subtitle,'description',l.description,
      'features',l.features,'exclusions',l.exclusions,
      'contractClauses',to_jsonb(l.contract_clause_refs),'catalogVersion',l.version
    ) into v_level
    from public.service_level_catalog l
    where l.code=lower(v_commercial.experience_level) and l.active=true;
  end if;

  select coalesce(jsonb_agg(
    (
      coalesce(
        (
          select item
          from jsonb_array_elements(coalesce(v_commercial.services,'[]'::jsonb)) item
          where item->>'code'=s.service_code limit 1
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
    ) order by s.display_order
  ),'[]'::jsonb)
  into v_scope_snapshot
  from public.contract_scope_items s
  left join public.service_catalog sc on sc.code=s.service_code
  where s.contract_id=v_project.contract_id;

  if p_document_kind='termo_aceite' then
    if p_approval_id is null then raise exception 'Selecione uma aprovação para gerar o Termo de Aceite'; end if;
    select * into v_approval from public.aprovacoes
    where id=p_approval_id and projeto_id=p_project_id;
    if not found then raise exception 'Aprovação não encontrada para este projeto'; end if;
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
    'contract_number',v_project.contract_number,'contract_signed_at',v_project.signed_at,
    'contract_value',v_project.contract_value,'currency',v_project.currency,
    'contract_notes',v_project.contract_notes,'client_name',v_project.client_name,
    'client_email',v_project.client_email,'client_phone',v_project.client_phone,
    'client_cpf_cnpj',v_project.client_cpf_cnpj,'project_name',v_project.project_name,
    'project_type',v_project.project_type,'project_description',v_project.project_description,
    'area_construida_m2',v_project.area_construida_m2,'area_terreno_m2',v_project.area_terreno_m2,
    'property_address',concat_ws(', ',
      nullif(v_project.endereco_obra,''),nullif(v_project.numero_obra,''),
      nullif(v_project.complemento_obra,''),nullif(v_project.bairro_obra,''),
      nullif(v_project.cidade_obra,''),nullif(v_project.estado_obra,'')
    ),
    'experience_level',v_commercial.experience_level,'service_level',v_level,
    'scope_snapshot',v_scope_snapshot,'smart_texts',v_text_snapshot,
    'contract_master_id',v_master_id,'contract_master_version',v_master_version,
    'source_quote_number',v_commercial.quote_number,'commercial_notes',v_commercial.notes,
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
      'approval_id',v_approval.id,'approval_type',v_approval.tipo,'approval_title',v_approval.titulo,
      'approval_description',v_approval.descricao,'delivered_at',v_approval.delivered_at,
      'approval_due_at',v_approval.approval_due_at,'approval_status',v_approval.status
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
  ) returning id into v_document_id;

  insert into public.audit_log(user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'prepare_contract_document','documentos',v_document_id,
    jsonb_build_object(
      'document_kind',p_document_kind,'project_id',p_project_id,'catalog_snapshot',true,
      'experience_level',v_commercial.experience_level,'contract_master_version',v_master_version,
      'smart_text_snapshot',true
    ));

  return v_document_id;
end
$function$
;

