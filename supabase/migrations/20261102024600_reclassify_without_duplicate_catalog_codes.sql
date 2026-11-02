-- Sem códigos duplicados: ao reclassificar, ativa a categoria existente, se houver.
-- A migração modifica apenas a função administrativa; nenhum contrato é reclassificado automaticamente.
CREATE OR REPLACE FUNCTION public.admin_reclassify_commercial_service(p_record_id uuid, p_old_code text, p_new_code text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_record public.commercial_records%rowtype;
  v_old text:=lower(btrim(coalesce(p_old_code,'')));
  v_new text:=nullif(lower(btrim(coalesce(p_new_code,''))),'');
  v_catalog public.service_catalog%rowtype;
  v_next jsonb;
  v_scope jsonb;
  v_terms jsonb;
  v_old_count int;
  v_active_count int;
  v_old_item jsonb;
  v_target_exists boolean:=false;
begin
  if (select auth.uid()) is null or not public.is_portal_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;
  if v_old='' or v_old=v_new then
    raise exception 'Informe um serviço de origem e uma classificação de destino diferente';
  end if;
  select * into v_record from public.commercial_records where id=p_record_id for update;
  if not found or v_record.record_kind<>'contrato' then
    raise exception 'Selecione um cadastro de contrato válido';
  end if;
  select count(*) into v_old_count
    from jsonb_array_elements(coalesce(v_record.services,'[]'::jsonb)) item
   where lower(item->>'code')=v_old and item->>'included'='true';
  if v_old_count<>1 then raise exception 'Serviço original não está selecionado exatamente uma vez'; end if;
  select item into v_old_item from jsonb_array_elements(v_record.services) item where lower(item->>'code')=v_old and item->>'included'='true' limit 1;
  if v_new is not null then
    select * into v_catalog from public.service_catalog where code=v_new and active=true;
    if not found then raise exception 'Serviço de destino não existe no catálogo ativo'; end if;
    select exists(select 1 from jsonb_array_elements(v_record.services) item where lower(item->>'code')=v_new) into v_target_exists;
    if exists(select 1 from jsonb_array_elements(v_record.services) item
              where lower(item->>'code')=v_new and item->>'included'='true') then
      raise exception 'O serviço de destino já está contratado. Para eliminar um item redundante, escolha remover e confira os entregáveis do serviço existente.';
    end if;
  end if;
  select jsonb_agg(
     case when lower(item->>'code')=v_old then
       case when v_new is null or v_target_exists
         then item || jsonb_build_object('included',false)
         else item || jsonb_build_object('code',v_new,'name',v_catalog.name,'included',true)
       end
       when v_new is not null and v_target_exists and lower(item->>'code')=v_new then
         item || jsonb_build_object('included',true,'value',v_old_item->'value',
           'levelCode',coalesce(v_old_item->'levelCode',v_old_item#>'{level,code}'))
       else item end order by ord
  ) into v_next
  from jsonb_array_elements(v_record.services) with ordinality as src(item,ord);
  v_next:=public.enrich_commercial_services(v_next,v_record.experience_level);
  select count(*) into v_active_count from jsonb_array_elements(v_next) item where item->>'included'='true';
  if v_active_count<1 then raise exception 'O contrato deve manter ao menos um serviço contratado'; end if;
  v_terms:=coalesce(v_record.commercial_terms,'{}'::jsonb);
  select coalesce(jsonb_agg(
    case when lower(item->>'code')=v_old
      then item || jsonb_build_object('code',v_new)
      else item end order by ord
  ),'[]'::jsonb) into v_scope
  from jsonb_array_elements(coalesce(v_terms->'scope','[]'::jsonb)) with ordinality as src(item,ord)
  where v_new is not null or lower(item->>'code')<>v_old;
  v_terms:=jsonb_set(v_terms,'{scope}',v_scope,true);
  update public.commercial_records
    set services=v_next,commercial_terms=v_terms,updated_at=now()
    where id=v_record.id;
  if v_record.linked_contract_id is not null then
    if v_new is null then
      update public.contract_scope_items
         set included=false,updated_at=now()
       where contract_id=v_record.linked_contract_id and service_code=v_old;
    else
      if exists(select 1 from public.contract_scope_items
                where contract_id=v_record.linked_contract_id and service_code=v_new) then
        update public.contract_scope_items
          set included=true,service_name=v_catalog.name,updated_at=now()
          where contract_id=v_record.linked_contract_id and service_code=v_new;
        update public.contract_scope_items
          set included=false,updated_at=now()
          where contract_id=v_record.linked_contract_id and service_code=v_old;
      else
        update public.contract_scope_items
          set service_code=v_new,service_name=v_catalog.name,updated_at=now()
          where contract_id=v_record.linked_contract_id and service_code=v_old;
      end if;
    end if;
  end if;
  insert into public.audit_log(user_id,action,entity_type,entity_id,details)
  values((select auth.uid()),'reclassify_commercial_service','commercial_records',v_record.id,
    jsonb_build_object('old_code',v_old,'new_code',v_new,
      'old_document_id',v_record.contract_document_id,'historical_documents_untouched',true));
  return jsonb_build_object('updated',true,'old_code',v_old,'new_code',v_new,'requires_new_contract_revision',true);
end;
$function$;
