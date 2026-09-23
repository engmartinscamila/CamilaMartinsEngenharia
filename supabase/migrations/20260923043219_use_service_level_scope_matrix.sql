-- Conecta a matriz serviço x nível ao snapshot comercial e aos documentos derivados.
-- Regra de segurança/governança:
-- - textos pending/rejected nunca entram em documento oficial;
-- - somente review_status='approved' substitui o texto legado;
-- - snapshots históricos permanecem imutáveis.

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
  v_scope public.service_level_scope_catalog%rowtype;
  v_code text;
  v_legacy_level_code text := lower(nullif(btrim(coalesce(p_level,'')),''));
  v_item_level_code text;
  v_level_json jsonb;
  v_included boolean;
  v_scope_approved boolean := false;
  v_deliverables jsonb;
  v_exclusions jsonb;
  v_formats jsonb;
  v_revisions integer;
begin
  if v_legacy_level_code is not null and v_legacy_level_code not in ('bronze','prata','ouro') then
    raise exception 'Nível de prestação legado inválido';
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_services,'[]'::jsonb))
  loop
    v_code := nullif(btrim(v_item->>'code'),'');
    if v_code is null then continue; end if;

    select * into v_catalog
    from public.service_catalog
    where code=v_code and active=true;

    if not found then
      v_result := v_result || jsonb_build_array(v_item);
      continue;
    end if;

    v_included := coalesce((v_item->>'included')::boolean,false);
    v_item_level_code := lower(nullif(btrim(coalesce(
      v_item->>'levelCode',
      v_item#>>'{level,code}',
      v_legacy_level_code,
      ''
    )), ''));

    if v_item_level_code is not null and v_item_level_code not in ('bronze','prata','ouro') then
      raise exception 'Nível de prestação inválido para o serviço %', v_catalog.name;
    end if;

    v_level_json := null;
    v_scope_approved := false;
    v_deliverables := v_catalog.deliverables;
    v_exclusions := v_catalog.exclusions;
    v_formats := v_catalog.delivery_formats;
    v_revisions := v_catalog.default_revisions;

    if v_catalog.level_applicable then
      if v_included and v_item_level_code is null then
        raise exception 'Selecione Bronze, Prata ou Ouro para o serviço %', v_catalog.name;
      end if;

      if v_item_level_code is not null then
        select * into v_level
        from public.service_level_catalog
        where code=v_item_level_code and active=true;
        if not found then
          raise exception 'Nível de prestação não localizado para o serviço %', v_catalog.name;
        end if;

        select * into v_scope
        from public.service_level_scope_catalog
        where service_code=v_catalog.code
          and level_code=v_item_level_code
          and active=true;

        v_scope_approved := found and v_scope.applicable and v_scope.review_status='approved';

        if found and not v_scope.applicable and v_included then
          raise exception 'O nível % não é aplicável ao serviço %', upper(v_item_level_code), v_catalog.name;
        end if;

        if v_scope_approved then
          if jsonb_array_length(coalesce(v_scope.included_deliverables,'[]'::jsonb)) > 0 then
            v_deliverables := v_scope.included_deliverables;
          end if;
          if jsonb_array_length(coalesce(v_scope.excluded_deliverables,'[]'::jsonb)) > 0 then
            v_exclusions := v_scope.excluded_deliverables;
          end if;
          if jsonb_array_length(coalesce(v_scope.delivery_formats,'[]'::jsonb)) > 0 then
            v_formats := v_scope.delivery_formats;
          end if;
          v_revisions := coalesce(v_scope.revisions_included,v_catalog.default_revisions);
        end if;

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
    end if;

    v_result := v_result || jsonb_build_array(
      jsonb_build_object(
        'code',v_catalog.code,
        'name',v_catalog.name,
        'included',v_included,
        'value',v_item->'value',
        'notes',nullif(btrim(v_item->>'notes'),''),
        'acceptanceRequired',v_catalog.acceptance_required,
        'displayOrder',coalesce((v_item->>'displayOrder')::integer,ascii(left(v_catalog.code,1))-96),
        'description',v_catalog.description,
        'deliverables',v_deliverables,
        'exclusions',v_exclusions,
        'clientInputs',v_catalog.client_inputs,
        'revisions',v_revisions,
        'deliveryFormats',v_formats,
        'planningReference',v_catalog.planning_reference,
        'contractClauses',to_jsonb(v_catalog.contract_clause_refs),
        'catalogVersion',v_catalog.version,
        'levelApplicable',v_catalog.level_applicable,
        'levelCode',case when v_catalog.level_applicable then v_item_level_code else null end,
        'level',v_level_json,
        'levelScopeReviewStatus',case when v_item_level_code is not null then v_scope.review_status else null end,
        'levelScopeVersion',case when v_item_level_code is not null then v_scope.version else null end,
        'budgetDescription',case when v_scope_approved then v_scope.budget_description else null end,
        'contractScope',case when v_scope_approved then v_scope.contract_scope else null end,
        'annexScope',case when v_scope_approved then v_scope.annex_scope else null end,
        'parameters',case when v_scope_approved then v_scope.parameters else '[]'::jsonb end,
        'visitsIncluded',case when v_scope_approved then v_scope.visits_included else null end,
        'detailLevel',case when v_scope_approved then v_scope.detail_level else null end
      )
    );
  end loop;

  return v_result;
end
$function$;

revoke all on function public.enrich_commercial_services(jsonb,text) from public,anon,authenticated;
grant execute on function public.enrich_commercial_services(jsonb,text) to service_role;

-- Documentos derivados usam o snapshot comercial por atividade.
-- Caso o snapshot seja legado, a função enriquece somente com combinação APROVADA.
create or replace function public.service_apply_level_scope_to_item(p_item jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $function$
declare
  v_code text := nullif(btrim(coalesce(p_item->>'code','')),'');
  v_level_code text := lower(nullif(btrim(coalesce(p_item->>'levelCode',p_item#>>'{level,code}','')),''));
  v_scope public.service_level_scope_catalog%rowtype;
begin
  if v_code is null or v_level_code is null then return p_item; end if;

  select * into v_scope
  from public.service_level_scope_catalog
  where service_code=v_code and level_code=v_level_code and active=true;

  if not found or not v_scope.applicable or v_scope.review_status <> 'approved' then
    return p_item || jsonb_build_object(
      'levelScopeReviewStatus',case when found then v_scope.review_status else null end,
      'levelScopeVersion',case when found then v_scope.version else null end
    );
  end if;

  return p_item || jsonb_build_object(
    'levelScopeReviewStatus',v_scope.review_status,
    'levelScopeVersion',v_scope.version,
    'budgetDescription',v_scope.budget_description,
    'contractScope',v_scope.contract_scope,
    'annexScope',v_scope.annex_scope,
    'deliverables',case when jsonb_array_length(v_scope.included_deliverables)>0 then v_scope.included_deliverables else coalesce(p_item->'deliverables','[]'::jsonb) end,
    'exclusions',case when jsonb_array_length(v_scope.excluded_deliverables)>0 then v_scope.excluded_deliverables else coalesce(p_item->'exclusions','[]'::jsonb) end,
    'revisions',coalesce(v_scope.revisions_included,(p_item->>'revisions')::integer),
    'deliveryFormats',case when jsonb_array_length(v_scope.delivery_formats)>0 then v_scope.delivery_formats else coalesce(p_item->'deliveryFormats','[]'::jsonb) end,
    'parameters',v_scope.parameters,
    'visitsIncluded',v_scope.visits_included,
    'detailLevel',v_scope.detail_level
  );
end
$function$;

revoke all on function public.service_apply_level_scope_to_item(jsonb) from public,anon,authenticated;
grant execute on function public.service_apply_level_scope_to_item(jsonb) to service_role;
