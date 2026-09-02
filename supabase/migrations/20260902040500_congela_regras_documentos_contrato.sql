
create or replace function public.current_document_text_snapshot_all()
returns jsonb
language sql
stable
security definer
set search_path=public
as $function$
  select coalesce(jsonb_object_agg(
    t.code,
    jsonb_build_object(
      'body',t.body,
      'title',t.title,
      'version',t.version,
      'documentKind',t.document_kind,
      'contractClauses',to_jsonb(t.contract_clause_refs)
    )
  ),'{}'::jsonb)
  from public.document_text_catalog t
  where t.active=true
$function$;

create or replace function public.freeze_commercial_document_governance()
returns trigger
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_master_id uuid;
  v_master_version integer;
begin
  if new.contract_master_id is null or new.contract_master_version is null then
    select id,version into v_master_id,v_master_version
    from public.contract_master_versions
    where active=true
    order by version desc
    limit 1;

    new.contract_master_id := coalesce(new.contract_master_id,v_master_id);
    new.contract_master_version := coalesce(new.contract_master_version,v_master_version);
  end if;

  if new.smart_texts is null or new.smart_texts='{}'::jsonb then
    if coalesce(new.record_kind,'orcamento')='contrato' then
      new.smart_texts := public.current_document_text_snapshot_all();
    else
      new.smart_texts := public.current_document_text_snapshot('orcamento');
    end if;
  end if;

  return new;
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
  if not public.is_portal_admin() then raise exception 'Acesso administrativo necessário'; end if;

  if p_document_kind not in (
    'anexo_i','termo_aceite','estudo_preliminar','levantamento_tecnico',
    'servico_adicional','autorizacao_imagem','quitacao_encerramento'
  ) then raise exception 'Tipo de documento não suportado'; end if;

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

  if nullif(btrim(coalesce(v_commercial.experience_level,'')),'') is not null then
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
$function$;

revoke all on function public.current_document_text_snapshot_all() from public,anon,authenticated;
grant execute on function public.current_document_text_snapshot_all() to service_role;
