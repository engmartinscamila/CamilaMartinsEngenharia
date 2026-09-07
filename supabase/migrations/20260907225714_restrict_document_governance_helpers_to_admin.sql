-- Restringe auxiliares SECURITY DEFINER de governança documental a administradores/serviço.

create or replace function public.assert_document_governance_ready()
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_master integer;
  v_pending integer;
  v_outdated integer;
  v_missing_refs integer;
  v_missing_texts integer;
begin
  if auth.role() <> 'service_role' and not public.is_portal_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;

  select version into v_master
  from public.contract_master_versions where active=true order by version desc limit 1;
  if v_master is null then
    raise exception 'Nenhum Contrato Mestre ativo foi encontrado';
  end if;

  select count(*) into v_pending
  from public.document_rule_reviews
  where contract_master_version=v_master and status='pending';

  select
    (select count(*) from public.service_catalog where active=true and last_contract_master_version is distinct from v_master) +
    (select count(*) from public.service_level_catalog where active=true and last_contract_master_version is distinct from v_master) +
    (select count(*) from public.document_text_catalog where active=true and last_contract_master_version is distinct from v_master)
  into v_outdated;

  select
    (select count(*) from public.service_catalog where active=true and cardinality(contract_clause_refs)=0) +
    (select count(*) from public.service_level_catalog where active=true and cardinality(contract_clause_refs)=0) +
    (select count(*) from public.document_text_catalog where active=true and cardinality(contract_clause_refs)=0)
  into v_missing_refs;

  select count(*) into v_missing_texts
  from unnest(array[
    'proposal_scope_governance','proposal_revision_rule','proposal_timeline_rule',
    'proposal_client_inputs_rule','anexo_scope_governance','anexo_revision_rule',
    'anexo_timeline_rule','acceptance_rule','additional_service_rule','notification_rule',
    'study_prelim_limit','survey_limit','image_authorization_conditions',
    'closing_release_rule','level_scope_rule','scope_limits_rule'
  ]) required(code)
  where not exists(
    select 1 from public.document_text_catalog t where t.code=required.code and t.active=true
  );

  if v_pending>0 or v_outdated>0 or v_missing_refs>0 or v_missing_texts>0 then
    raise exception
      'Governanca documental incompleta para o Contrato Mestre v%: % revisao(oes) pendente(s), % item(ns) desatualizado(s), % item(ns) sem clausula vinculada e % texto(s) obrigatorio(s) ausente(s). Revise em Configuracoes antes de criar ou gerar documentos.',
      v_master,v_pending,v_outdated,v_missing_refs,v_missing_texts;
  end if;
end
$function$;

create or replace function public.current_document_text_snapshot(p_document_kind text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare v_result jsonb;
begin
  if auth.role() <> 'service_role' and not public.is_portal_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;
  select coalesce(jsonb_object_agg(
    t.code,
    jsonb_build_object(
      'body',t.body,'title',t.title,'version',t.version,'documentKind',t.document_kind,
      'contractClauses',to_jsonb(t.contract_clause_refs),'contractMasterVersion',t.last_contract_master_version
    )
  ),'{}'::jsonb)
  into v_result
  from public.document_text_catalog t
  where t.active=true and t.document_kind in (p_document_kind,'geral');
  return v_result;
end
$function$;

create or replace function public.current_document_text_snapshot_all()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare v_result jsonb;
begin
  if auth.role() <> 'service_role' and not public.is_portal_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;
  select coalesce(jsonb_object_agg(
    t.code,
    jsonb_build_object(
      'body',t.body,'title',t.title,'version',t.version,'documentKind',t.document_kind,
      'contractClauses',to_jsonb(t.contract_clause_refs),'contractMasterVersion',t.last_contract_master_version
    )
  ),'{}'::jsonb)
  into v_result
  from public.document_text_catalog t
  where t.active=true;
  return v_result;
end
$function$;

create or replace function public.enqueue_document_text_reviews(
  p_contract_master_version integer,
  p_reason text,
  p_document_kinds text[] default null::text[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare v_count integer;
begin
  if auth.role() <> 'service_role' and not public.is_portal_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;
  insert into public.document_rule_reviews(
    contract_master_version,source_type,source_code,clause_refs,reason,status,created_at,resolved_at,resolved_by
  )
  select p_contract_master_version,'text',t.code,t.contract_clause_refs,p_reason,'pending',now(),null,null
  from public.document_text_catalog t
  where t.active=true
    and (p_document_kinds is null or t.document_kind='geral' or t.document_kind=any(p_document_kinds))
  on conflict(contract_master_version,source_type,source_code) do update set
    clause_refs=excluded.clause_refs,reason=excluded.reason,status='pending',created_at=now(),resolved_at=null,resolved_by=null;
  get diagnostics v_count = row_count;
  return v_count;
end
$function$;

create or replace function public.enrich_commercial_services(p_services jsonb, p_level text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
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
  if auth.role() <> 'service_role' and not public.is_portal_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;
  if v_level_code is not null then
    select * into v_level from public.service_level_catalog where code=v_level_code and active=true;
  end if;
  for v_item in select * from jsonb_array_elements(coalesce(p_services,'[]'::jsonb)) loop
    v_code := nullif(btrim(v_item->>'code'),'');
    if v_code is null then continue; end if;
    select * into v_catalog from public.service_catalog where code=v_code and active=true;
    if found then
      v_level_json := null;
      if v_catalog.level_applicable and v_level.code is not null then
        v_level_json := jsonb_build_object(
          'code',v_level.code,'label',v_level.label,'subtitle',v_level.subtitle,'description',v_level.description,
          'features',v_level.features,'exclusions',v_level.exclusions,'contractClauses',to_jsonb(v_level.contract_clause_refs),'catalogVersion',v_level.version
        );
      end if;
      v_result := v_result || jsonb_build_array(jsonb_build_object(
        'code',v_catalog.code,'name',v_catalog.name,'included',coalesce((v_item->>'included')::boolean,false),
        'value',v_item->'value','notes',nullif(btrim(v_item->>'notes'),''),'acceptanceRequired',v_catalog.acceptance_required,
        'displayOrder',coalesce((v_item->>'displayOrder')::integer,ascii(left(v_catalog.code,1))-96),
        'description',v_catalog.description,'deliverables',v_catalog.deliverables,'exclusions',v_catalog.exclusions,
        'clientInputs',v_catalog.client_inputs,'revisions',v_catalog.default_revisions,'deliveryFormats',v_catalog.delivery_formats,
        'planningReference',v_catalog.planning_reference,'contractClauses',to_jsonb(v_catalog.contract_clause_refs),
        'catalogVersion',v_catalog.version,'levelApplicable',v_catalog.level_applicable,'level',v_level_json
      ));
    else
      v_result := v_result || jsonb_build_array(v_item);
    end if;
  end loop;
  return v_result;
end
$function$;

revoke all on function public.assert_document_governance_ready() from public, anon;
revoke all on function public.current_document_text_snapshot(text) from public, anon;
revoke all on function public.current_document_text_snapshot_all() from public, anon;
revoke all on function public.enqueue_document_text_reviews(integer,text,text[]) from public, anon;
revoke all on function public.enrich_commercial_services(jsonb,text) from public, anon;

grant execute on function public.assert_document_governance_ready() to authenticated, service_role;
grant execute on function public.current_document_text_snapshot(text) to authenticated, service_role;
grant execute on function public.current_document_text_snapshot_all() to authenticated, service_role;
grant execute on function public.enqueue_document_text_reviews(integer,text,text[]) to authenticated, service_role;
grant execute on function public.enrich_commercial_services(jsonb,text) to authenticated, service_role;
