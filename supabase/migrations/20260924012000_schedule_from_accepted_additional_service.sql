-- Permite contratar o cronograma completo depois do contrato original por Serviço Adicional aceito.
-- O contrato-base não é reescrito: a autorização é a versão congelada do termo adicional,
-- vinculada ao mesmo projeto/contrato e aceita pelo cliente.

create or replace function public.assert_full_schedule_additional_service(
  p_project_id uuid,
  p_document_id uuid
)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  v_project public.projetos%rowtype;
  v_document public.documentos%rowtype;
  v_acceptance public.document_acceptances%rowtype;
  v_code text;
  v_name text;
  v_level text;
  v_version text;
  v_value text;
  v_payment text;
begin
  if not public.is_portal_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;

  select * into v_project
  from public.projetos
  where id=p_project_id;

  select * into v_document
  from public.documentos
  where id=p_document_id
    and projeto_id=p_project_id
    and document_kind='servico_adicional'
    and superseded_by is null;

  if v_project.id is null or v_document.id is null then
    raise exception 'Serviço Adicional não pertence ao projeto selecionado';
  end if;

  if v_project.contract_id is null
     or v_document.contract_id is distinct from v_project.contract_id then
    raise exception 'Serviço Adicional precisa estar vinculado ao contrato vigente do projeto';
  end if;

  if v_document.snapshot_frozen_at is null then
    raise exception 'Gere e congele a versão oficial do Serviço Adicional antes de usar o cronograma';
  end if;

  v_version:=coalesce(nullif(v_document.version,''),nullif(v_document.versao,''),'1.0');
  select * into v_acceptance
  from public.document_acceptances a
  where a.document_id=v_document.id
    and a.document_version=v_version
    and a.decision in ('accepted','accepted_with_notes')
  order by a.accepted_at desc
  limit 1;

  if v_acceptance.id is null then
    raise exception 'O cliente precisa aceitar a versão atual do Serviço Adicional antes de criar o cronograma completo';
  end if;

  v_code:=lower(coalesce(
    v_document.generated_data#>>'{document_options,additional_service_code}',
    v_document.generated_data->>'additional_service_code',
    ''
  ));
  v_name:=coalesce(
    nullif(v_document.generated_data#>>'{document_options,additional_service_name}',''),
    nullif(v_document.generated_data->>'additional_service_name',''),
    'Cronograma completo de acompanhamento de obra'
  );
  v_level:=lower(coalesce(
    nullif(v_document.generated_data#>>'{document_options,additional_service_level}',''),
    nullif(v_document.generated_data->>'additional_service_level',''),
    ''
  ));
  v_value:=coalesce(
    nullif(v_document.generated_data#>>'{document_options,additional_value}',''),
    nullif(v_document.generated_data->>'additional_value',''),
    ''
  );
  v_payment:=coalesce(
    nullif(v_document.generated_data#>>'{document_options,payment_method}',''),
    nullif(v_document.generated_data->>'payment_method',''),
    ''
  );

  if v_code<>'s' then
    raise exception 'O Serviço Adicional aceito não corresponde ao serviço de cronograma completo';
  end if;
  if nullif(v_value,'') is null or nullif(v_payment,'') is null then
    raise exception 'O Serviço Adicional do cronograma precisa registrar valor e forma de pagamento';
  end if;

  return jsonb_build_object(
    'authorization_type','servico_adicional_aceito',
    'source_document_id',v_document.id,
    'project_id',v_project.id,
    'client_id',v_project.cliente_id,
    'contract_id',v_project.contract_id,
    'document_version',v_version,
    'accepted_at',v_acceptance.accepted_at,
    'service_code',v_code,
    'service_name',v_name,
    'service_level',nullif(v_level,''),
    'additional_value',v_value,
    'payment_method',v_payment,
    'services',jsonb_build_array(jsonb_build_object(
      'code',v_code,
      'name',v_name,
      'included',true,
      'levelCode',nullif(v_level,'')
    ))
  );
end
$function$;

create or replace function public.admin_list_full_schedule_additional_authorizations()
returns table(
  document_id uuid,
  project_id uuid,
  contract_id uuid,
  document_version text,
  accepted_at timestamptz,
  service_code text,
  service_name text,
  service_level text
)
language sql
set search_path to 'public'
as $function$
  select distinct on (d.id)
    d.id as document_id,
    d.projeto_id as project_id,
    d.contract_id,
    coalesce(nullif(d.version,''),nullif(d.versao,''),'1.0') as document_version,
    a.accepted_at,
    lower(coalesce(
      d.generated_data#>>'{document_options,additional_service_code}',
      d.generated_data->>'additional_service_code',
      ''
    )) as service_code,
    coalesce(
      nullif(d.generated_data#>>'{document_options,additional_service_name}',''),
      nullif(d.generated_data->>'additional_service_name',''),
      'Cronograma completo de acompanhamento de obra'
    ) as service_name,
    lower(coalesce(
      nullif(d.generated_data#>>'{document_options,additional_service_level}',''),
      nullif(d.generated_data->>'additional_service_level',''),
      ''
    )) as service_level
  from public.documentos d
  join public.document_acceptances a
    on a.document_id=d.id
   and a.document_version=coalesce(nullif(d.version,''),nullif(d.versao,''),'1.0')
   and a.decision in ('accepted','accepted_with_notes')
  join public.projetos p
    on p.id=d.projeto_id
   and p.contract_id=d.contract_id
  where public.is_portal_admin()
    and d.document_kind='servico_adicional'
    and d.superseded_by is null
    and d.snapshot_frozen_at is not null
    and lower(coalesce(
      d.generated_data#>>'{document_options,additional_service_code}',
      d.generated_data->>'additional_service_code',
      ''
    ))='s'
  order by d.id,a.accepted_at desc;
$function$;

create or replace function public.admin_preview_full_schedule_template_from_additional_service(
  p_project_id uuid,
  p_document_id uuid,
  p_template_code text
)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  v_template public.construction_schedule_templates%rowtype;
  v_authorization jsonb;
begin
  if not public.is_portal_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;

  v_authorization:=public.assert_full_schedule_additional_service(p_project_id,p_document_id);

  select * into v_template
  from public.construction_schedule_templates
  where template_code=p_template_code and active=true
  order by template_version desc
  limit 1;

  if v_template.template_code is null then
    raise exception 'Modelo de cronograma não encontrado';
  end if;

  return jsonb_build_object(
    'commercial',v_authorization,
    'template_code',v_template.template_code,
    'template_version',v_template.template_version,
    'reference_only',true,
    'requires_scope_confirmation',true,
    'items',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'code',code,
        'category',category,
        'activity',activity,
        'display_order',display_order,
        'reference_weight_percent',reference_weight_percent,
        'reference_duration_days',reference_duration_days,
        'predecessor_code',predecessor_code,
        'requires_scope_confirmation',true
      ) order by display_order),'[]'::jsonb)
      from public.construction_schedule_template_items
      where template_code=v_template.template_code
        and template_version=v_template.template_version
    )
  );
end
$function$;

create or replace function public.admin_initialize_and_save_full_schedule_from_additional_service(
  p_project_id uuid,
  p_document_id uuid,
  p_plan jsonb
)
returns uuid
language plpgsql
set search_path to 'public'
as $function$
declare
  v_schedule_id uuid;
  v_current public.construction_schedules%rowtype;
  v_project public.projetos%rowtype;
  v_authorization jsonb;
begin
  if (select auth.uid()) is null or not public.is_portal_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;

  v_authorization:=public.assert_full_schedule_additional_service(p_project_id,p_document_id);
  select * into v_project from public.projetos where id=p_project_id;

  select * into v_current
  from public.construction_schedules
  where project_id=p_project_id and is_current is true
  order by revision_number desc
  limit 1
  for update;

  if v_current.id is not null then
    if v_current.activation_status='draft'
       and v_current.revision_number=1
       and v_current.source_scope_snapshot->>'source_document_id'=p_document_id::text then
      v_schedule_id:=v_current.id;
    elsif v_current.activation_status='approved' then
      raise exception 'Projeto já possui cronograma aprovado vigente; abra uma revisão/aditivo com justificativa';
    else
      raise exception 'Projeto já possui cronograma incompatível; não sobrescreva o histórico';
    end if;
  else
    insert into public.construction_schedules(
      project_id,client_id,contract_id,quote_record_id,contract_record_id,
      source_scope_snapshot,title,planned_start,planned_finish,reference_date,
      activation_status,revision_number,is_current
    )
    values(
      v_project.id,v_project.cliente_id,v_project.contract_id,null,null,
      v_authorization,
      'Cronograma físico-financeiro — '||coalesce(v_project.nome,'Obra'),
      null,null,current_date,'draft',1,true
    )
    returning id into v_schedule_id;
  end if;

  perform public.admin_save_full_schedule_plan(v_schedule_id,p_plan);
  perform public.admin_set_construction_schedule_holidays(
    v_schedule_id,coalesce(p_plan->'holidays','[]'::jsonb)
  );
  perform public.admin_set_full_schedule_physical_weights(
    v_schedule_id,coalesce(p_plan->'physical_weights','[]'::jsonb)
  );

  return v_schedule_id;
end
$function$;

revoke all on function public.assert_full_schedule_additional_service(uuid,uuid) from public,anon;
revoke all on function public.admin_list_full_schedule_additional_authorizations() from public,anon;
revoke all on function public.admin_preview_full_schedule_template_from_additional_service(uuid,uuid,text) from public,anon;
revoke all on function public.admin_initialize_and_save_full_schedule_from_additional_service(uuid,uuid,jsonb) from public,anon;

grant execute on function public.assert_full_schedule_additional_service(uuid,uuid) to authenticated,service_role;
grant execute on function public.admin_list_full_schedule_additional_authorizations() to authenticated,service_role;
grant execute on function public.admin_preview_full_schedule_template_from_additional_service(uuid,uuid,text) to authenticated,service_role;
grant execute on function public.admin_initialize_and_save_full_schedule_from_additional_service(uuid,uuid,jsonb) to authenticated,service_role;
