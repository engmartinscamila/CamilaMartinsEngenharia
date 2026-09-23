-- Garante coerência forte ORÇAMENTO -> CONTRATO -> ANEXO I.
-- 1) Atualiza o snapshot comercial com a matriz serviço x nível aprovada antes da emissão.
-- 2) Bloqueia documento oficial se houver combinação pendente/rejeitada ou placeholder.
-- 3) Valida orçamento(s) vinculado(s) x contrato.
-- 4) Faz o Anexo I copiar o snapshot congelado do contrato emitido.

create or replace function public.admin_prepare_commercial_scope_for_generation(p_record_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  r public.commercial_records%rowtype;
  v_services jsonb;
  v_bad integer;
begin
  if coalesce(auth.role(),'') <> 'service_role' and not public.is_portal_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;

  select * into r
  from public.commercial_records
  where id=p_record_id
  for update;

  if not found then
    raise exception 'Registro comercial não encontrado';
  end if;

  v_services := public.enrich_commercial_services(coalesce(r.services,'[]'::jsonb),r.experience_level);

  -- Todo serviço com nível aplicável precisa de texto aprovado para os três documentos.
  select count(*) into v_bad
  from jsonb_array_elements(v_services) item
  where coalesce((item->>'included')::boolean,false)=true
    and coalesce((item->>'levelApplicable')::boolean,false)=true
    and not (
      (
        lower(coalesce(item->>'code',''))='p'
        and length(btrim(coalesce(item->>'customDescription','')))>=12
        and length(btrim(coalesce(item->>'budgetDescription','')))>=20
        and length(btrim(coalesce(item->>'contractScope','')))>=20
        and length(btrim(coalesce(item->>'annexScope','')))>=20
      )
      or
      (
        item->>'levelScopeReviewStatus'='approved'
        and nullif(item->>'levelScopeVersion','') is not null
        and length(btrim(coalesce(item->>'budgetDescription','')))>=20
        and length(btrim(coalesce(item->>'contractScope','')))>=20
        and length(btrim(coalesce(item->>'annexScope','')))>=20
      )
    );

  if v_bad>0 then
    raise exception 'Existem atividades/níveis ainda não aprovados para Orçamento, Contrato e Anexo I. Revise a matriz Serviço x Bronze/Prata/Ouro antes da emissão oficial';
  end if;

  -- Proíbe placeholders e instruções internas em qualquer texto que possa chegar ao cliente.
  select count(*) into v_bad
  from jsonb_array_elements(v_services) item
  cross join lateral unnest(array[
    coalesce(item->>'description',''),
    coalesce(item->>'budgetDescription',''),
    coalesce(item->>'contractScope',''),
    coalesce(item->>'annexScope',''),
    coalesce(item->>'customDescription','')
  ]) txt
  where coalesce((item->>'included')::boolean,false)=true
    and (
      lower(txt) ~ '(aqui.{0,30}descr|descri[cç][aã]o.{0,20}servi[cç]o.{0,20}outro|inserir.{0,20}descri[cç][aã]o|preencher.{0,20}atividade|ser[aá].{0,20}informad[ao].{0,20}atividade)'
      or txt ~ '\{\{[^}]+\}\}'
    );

  if v_bad>0 then
    raise exception 'Documento bloqueado: foi encontrado placeholder ou instrução interna no escopo do cliente';
  end if;

  update public.commercial_records
  set services=v_services,
      updated_at=now()
  where id=r.id;

  insert into public.audit_log(user_id,action,entity_type,entity_id,details)
  values(
    auth.uid(),
    'prepare_commercial_scope_for_generation',
    'commercial_records',
    r.id,
    jsonb_build_object(
      'record_kind',r.record_kind,
      'service_count',(select count(*) from jsonb_array_elements(v_services) x where coalesce((x->>'included')::boolean,false)),
      'approved_service_level_scope_required',true
    )
  );

  return v_services;
end;
$$;

revoke all on function public.admin_prepare_commercial_scope_for_generation(uuid) from public,anon;
grant execute on function public.admin_prepare_commercial_scope_for_generation(uuid) to authenticated,service_role;

create or replace function public.assert_commercial_contract_quote_consistency(p_contract_record_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
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

  -- Contrato criado manualmente pode não possuir orçamento vinculado.
  if v_link_count=0 then
    return jsonb_build_object('contract_record_id',c.id,'manual_contract',true,'quotes',0);
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
$$;

revoke all on function public.assert_commercial_contract_quote_consistency(uuid) from public,anon;
grant execute on function public.assert_commercial_contract_quote_consistency(uuid) to authenticated,service_role;

create or replace function public.enforce_annex_contract_emission_snapshot()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_contract_record public.commercial_records%rowtype;
  v_contract_doc public.documentos%rowtype;
  v_contract_data jsonb;
  v_services jsonb;
  v_scope jsonb;
  v_consistency jsonb;
begin
  if new.document_kind is distinct from 'anexo_i' then
    return new;
  end if;

  if new.contract_id is null then
    raise exception 'Anexo I precisa estar vinculado a um contrato';
  end if;

  select * into v_contract_record
  from public.commercial_records
  where linked_contract_id=new.contract_id
    and record_kind='contrato'
  order by updated_at desc
  limit 1;

  if not found or v_contract_record.contract_document_id is null then
    raise exception 'Gere o contrato Word oficial antes de preparar o Anexo I';
  end if;

  select * into v_contract_doc
  from public.documentos
  where id=v_contract_record.contract_document_id;

  if not found
     or v_contract_doc.workflow_status not in ('gerado','enviado','aceito')
     or v_contract_doc.generated_data is null then
    raise exception 'O contrato precisa estar gerado e possuir snapshot congelável antes do Anexo I';
  end if;

  v_contract_data:=v_contract_doc.generated_data;
  v_services:=v_contract_data->'services';

  if jsonb_typeof(v_services) is distinct from 'array' then
    raise exception 'Contrato emitido não possui snapshot estruturado de serviços; gere uma nova versão antes do Anexo I';
  end if;

  v_consistency:=public.assert_commercial_contract_quote_consistency(v_contract_record.id);

  select coalesce(jsonb_agg(item order by coalesce((item->>'displayOrder')::integer,999)),'[]'::jsonb)
  into v_scope
  from jsonb_array_elements(v_services) item
  where coalesce((item->>'included')::boolean,false)=true;

  if jsonb_array_length(v_scope)=0 then
    raise exception 'Contrato emitido não possui serviços incluídos para compor o Anexo I';
  end if;

  new.generated_data :=
    coalesce(new.generated_data,'{}'::jsonb)
    || jsonb_build_object(
      'scope_snapshot',v_scope,
      'scope_items',v_scope,
      'services',v_services,
      'experience_level',v_contract_data->'experience_level',
      'smart_texts',coalesce(v_contract_data->'smart_texts',new.generated_data->'smart_texts'),
      'contract_master_id',v_contract_data->'contract_master_id',
      'contract_master_version',v_contract_data->'contract_master_version',
      'source_contract_document_id',v_contract_doc.id,
      'source_contract_document_version',coalesce(v_contract_doc.versao,v_contract_doc.version,'1.0'),
      'source_contract_snapshot_frozen_at',v_contract_doc.snapshot_frozen_at,
      'commercial_consistency',v_consistency
    );

  return new;
end;
$$;

revoke all on function public.enforce_annex_contract_emission_snapshot() from public,anon,authenticated;

drop trigger if exists trg_enforce_annex_contract_emission_snapshot on public.documentos;
create trigger trg_enforce_annex_contract_emission_snapshot
before insert on public.documentos
for each row
when (new.document_kind='anexo_i')
execute function public.enforce_annex_contract_emission_snapshot();
