-- Anexo I usa dados imutáveis do contrato emitido.
-- Não altera ou apaga versões históricas.
CREATE OR REPLACE FUNCTION public.enforce_annex_contract_emission_snapshot()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_contract_record public.commercial_records%rowtype;
  v_contract_doc public.documentos%rowtype;
  v_contract_data jsonb;
  v_services jsonb;
  v_scope jsonb;
  v_consistency jsonb;
  v_emission jsonb;
  v_issued jsonb;
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

  -- Anexo I deve usar o estado comercial congelado na versão emitida.
  select snapshot into v_emission
    from public.document_emission_snapshots
   where document_id=v_contract_doc.id
   order by emitted_at desc limit 1;
  v_issued:=v_emission->'commercial_record_snapshot';
  if jsonb_typeof(v_issued) is distinct from 'object'
     or jsonb_typeof(v_issued->'commercial_terms') is distinct from 'object'
     or jsonb_typeof(v_issued->'services') is distinct from 'array' then
    raise exception 'O contrato emitido não possui snapshot comercial completo. Gere uma nova revisão do contrato antes do Anexo I.';
  end if;
  if coalesce(v_emission->>'commercial_record_id','') is distinct from v_contract_record.id::text then
    raise exception 'A origem documental do Anexo I não corresponde ao contrato selecionado';
  end if;
  v_contract_data:=v_contract_doc.generated_data;
  v_services:=v_issued->'services';

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
      -- Reutiliza orçamento e contrato sem pedir ao usuário os mesmos campos.
      'commercial_terms',v_issued->'commercial_terms',
      'payment_terms',coalesce(v_issued->'payment_terms','[]'::jsonb),
      'contract_value',v_issued->'total_value',
      'commercial_notes',v_issued->'notes',
      'client_name',v_issued->'prospect_name',
      'client_email',v_issued->'email',
      'client_phone',v_issued->'phone',
      'client_cpf_cnpj',v_issued->'cpf_cnpj',
      'client_address',v_issued->'address',
      'property_address',v_issued->'property_address',
      'project_type',v_issued->'property_type',
      'area_construida_m2',v_issued->'area_construida_m2',
      'area_terreno_m2',v_issued->'area_terreno_m2',
      'source_quote_number',v_issued->'quote_number',
      'source_commercial_record_id',v_contract_record.id,
      'annex_source','emitted_contract_snapshot',
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
      'source_contract_emitted_at',v_contract_doc.generated_at,
      'commercial_consistency',v_consistency
    );

  return new;
end;
$function$;
