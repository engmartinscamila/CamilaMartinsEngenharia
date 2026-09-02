
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
  if v_level_code is not null then
    select * into v_level
    from public.service_level_catalog
    where code=v_level_code and active=true;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_services,'[]'::jsonb))
  loop
    v_code := nullif(btrim(v_item->>'code'),'');
    if v_code is null then continue; end if;

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
          'displayOrder',coalesce((v_item->>'displayOrder')::integer,ascii(left(v_catalog.code,1))-96),
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

grant execute on function public.assert_document_governance_ready() to authenticated;
