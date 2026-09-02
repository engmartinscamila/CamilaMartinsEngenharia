
do $do$
declare
  v_def text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef(p.oid)
  into v_def
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='admin_prepare_contract_document'
    and pg_get_function_arguments(p.oid) like 'p_project_id uuid, p_document_kind text%';

  v_old := $old$
  if nullif(btrim(coalesce(v_commercial.experience_level,'')),'') is not null then
    select jsonb_build_object(
      'code',l.code,'label',l.label,'subtitle',l.subtitle,'description',l.description,
      'features',l.features,'exclusions',l.exclusions,
      'contractClauses',to_jsonb(l.contract_clause_refs),'catalogVersion',l.version
    ) into v_level
    from public.service_level_catalog l
    where l.code=lower(v_commercial.experience_level) and l.active=true;
  end if;
$old$;

  v_new := $new$
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
$new$;

  if v_def is null or position(v_old in v_def)=0 then
    raise exception 'Trecho de nível do admin_prepare_contract_document não localizado';
  end if;

  execute replace(v_def,v_old,v_new);
end
$do$;
