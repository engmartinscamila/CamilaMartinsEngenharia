-- FASE 20 — contrato oficial precisa nascer de um orçamento verificável.
-- Mantém dois caminhos válidos: ORC(s) da Central ou projeto legado que já
-- possua numero_orcamento. Remove o caminho manual sem origem.

do $migration$
declare
  v_definition text;
  v_old text := $$  if v_source_count > 0 and p_source_project_id is not null then
    raise exception 'Selecione apenas uma origem de orçamento';
  end if;$$;
  v_new text := $$  if v_source_count = 0 and p_source_project_id is null then
    raise exception 'Selecione o orçamento aprovado que dará origem ao contrato';
  end if;

  if v_source_count > 0 and p_source_project_id is not null then
    raise exception 'Selecione apenas uma origem de orçamento';
  end if;$$;
begin
  select pg_get_functiondef(
    'public.admin_create_independent_contract(jsonb,uuid[],uuid)'::regprocedure
  ) into v_definition;

  if position('Selecione o orçamento aprovado que dará origem ao contrato' in v_definition)=0 then
    if position(v_old in v_definition)=0 then
      raise exception 'Trecho de origem do contrato não localizado';
    end if;
    v_definition:=replace(v_definition,v_old,v_new);
    execute v_definition;
  end if;
end
$migration$;

do $migration$
declare
  v_definition text;
  v_old text := $$  -- Contrato criado manualmente pode não possuir orçamento vinculado.
  if v_link_count=0 then
    return jsonb_build_object('contract_record_id',c.id,'manual_contract',true,'quotes',0);
  end if;$$;
  v_new text := $$  -- Sem ORC da Central, somente um projeto legado com número de orçamento
  -- pode sustentar o contrato. Contrato totalmente manual é bloqueado.
  if v_link_count=0 then
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
  end if;$$;
begin
  select pg_get_functiondef(
    'public.assert_commercial_contract_quote_consistency(uuid)'::regprocedure
  ) into v_definition;

  if position('Contrato sem orçamento de origem. Vincule um ORC aprovado antes de prosseguir' in v_definition)=0 then
    if position(v_old in v_definition)=0 then
      raise exception 'Trecho de consistência de contrato manual não localizado';
    end if;
    v_definition:=replace(v_definition,v_old,v_new);
    execute v_definition;
  end if;
end
$migration$;

revoke all on function public.admin_create_independent_contract(jsonb,uuid[],uuid) from public,anon;
grant execute on function public.admin_create_independent_contract(jsonb,uuid[],uuid) to authenticated,service_role;

revoke all on function public.assert_commercial_contract_quote_consistency(uuid) from public,anon;
grant execute on function public.assert_commercial_contract_quote_consistency(uuid) to authenticated,service_role;
