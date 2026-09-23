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
  v_custom_description text;
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
    v_custom_description := nullif(btrim(coalesce(v_item->>'customDescription','')),'');
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
        'customDescription',case when v_catalog.code='p' then v_custom_description else null end,
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
        'budgetDescription',case
          when v_catalog.code='p' and v_custom_description is not null then
            'Serviço técnico personalizado: '||v_custom_description||'. A proposta compreende exclusivamente a atividade descrita e os entregáveis, quantidades, formatos, revisões, visitas e prazos expressamente indicados no orçamento e no Anexo I.'
          when v_scope_approved then v_scope.budget_description
          else null
        end,
        'contractScope',case
          when v_catalog.code='p' and v_custom_description is not null then
            'A CONTRATADA prestará o serviço técnico específico consistente em '||v_custom_description||', limitado às atividades, etapas, entregáveis, quantidades, formatos, revisões, visitas e prazos expressamente previstos no orçamento e no Anexo I. Qualquer ampliação dependerá de aprovação e contratação prévias.'
          when v_scope_approved then v_scope.contract_scope
          else null
        end,
        'annexScope',case
          when v_catalog.code='p' and v_custom_description is not null then
            'Atividade específica contratada: '||v_custom_description||'. O escopo fica restrito às atividades, etapas, entregáveis, quantidades, formatos, revisões, visitas e prazos expressamente registrados neste Anexo I; qualquer ampliação dependerá de aprovação e contratação prévias.'
          when v_scope_approved then v_scope.annex_scope
          else null
        end,
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

