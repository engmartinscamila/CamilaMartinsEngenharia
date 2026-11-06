-- Compare the issued business snapshot, not preparation timestamps.
-- Preparing or refreshing identical data must not request a phantom revision.
create or replace function public.admin_commercial_closure(p_record_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.commercial_records%rowtype;s jsonb;t jsonb;issues jsonb:='[]';
 code text;delivery text;water_delivery text;target text;approved text;source_version int;doc public.documentos%rowtype;
 access_ready boolean;annex_current boolean;
begin
 if auth.uid() is null or not public.is_portal_admin() then raise exception 'Acesso administrativo necessário';end if;
 select * into r from public.commercial_records where id=p_record_id;
 if not found or r.record_kind<>'contrato' then raise exception 'Selecione um contrato comercial';end if;
 for s in select value from jsonb_array_elements(coalesce(r.services,'[]')) where value->>'included'='true' loop
  code:=lower(s->>'code');target:=null;approved:=null;source_version:=null;
  select value into t from jsonb_array_elements(coalesce(r.commercial_terms->'scope','[]')) where lower(value->>'code')=code limit 1;
  delivery:=translate(lower(coalesce(t->>'deliverables','')),'áàâãéêíóôõúç','aaaaeeiooouc');
  water_delivery:=regexp_replace(delivery,E'\\m(sem|nao inclui|nao contempla|nao abrange|exclui)\\M[^,.;\\n]*(esgoto|hidrossanit)[^,.;\\n]*','','g');
  select string_agg(v.value,E'\n' order by v.ord),sc.version into approved,source_version
  from public.service_level_scope_catalog sc cross join lateral jsonb_array_elements_text(sc.included_deliverables) with ordinality v(value,ord)
  where sc.service_code=code and sc.level_code=coalesce(nullif(s->>'levelCode',''),s#>>'{level,code}',r.experience_level)
   and sc.active and sc.applicable and sc.review_status='approved' group by sc.version;
  if delivery='' then
   issues:=issues||jsonb_build_array(jsonb_build_object('code',code,'name',s->>'name','kind','missing','message','Faltam os entregáveis particulares desta atividade.','current',coalesce(t->>'deliverables',''),'suggestion',approved));
  elsif code in ('am','aj') and water_delivery~'(hidrossanit|esgoto)' and water_delivery!~'(rede externa|rede publica|saneamento externo)' then
   target:='g';
  elsif code='aj' and water_delivery~'hidraulico' and water_delivery!~'(rede externa|rede publica|saneamento externo)' then
   target:='am';
  elsif code='u' and delivery~'(projeto arquitetonico|maquete tridimensional)' and delivery!~'(levantamento geometrico|levantamento cadastral|medicao cadastral)' then
   issues:=issues||jsonb_build_array(jsonb_build_object('code',code,'name',s->>'name','kind','scope','current',t->>'deliverables',
    'message','Os entregáveis pertencem a projeto arquitetônico e representação 3D, mas o item selecionado é levantamento cadastral.',
    'suggestion',approved,'sourceVersion',source_version,
    'canRemove',exists(select 1 from jsonb_array_elements(r.services)x where x->>'code'='d' and x->>'included'='true') and exists(select 1 from jsonb_array_elements(r.services)x where x->>'code'='j' and x->>'included'='true')));
  end if;
  if target is not null then
   issues:=issues||jsonb_build_array(jsonb_build_object('code',code,'name',s->>'name','kind','classification','current',t->>'deliverables','targetCode',target,
     'targetName',(select name from public.service_catalog where public.service_catalog.code=target and active),
     'targetIncluded',exists(select 1 from jsonb_array_elements(r.services)x where x->>'code'=target and x->>'included'='true'),
     'message','A classificação não corresponde aos sistemas descritos. Reclassificar preserva os entregáveis, valores e prazos particulares.'));
  end if;
 end loop;
 select * into doc from public.documentos where id=r.contract_document_id;
 select coalesce(c.auth_id is not null,false) into access_ready from public.clientes c where c.id=r.linked_client_id;
 select exists(select 1 from public.documentos d where d.contract_id=r.linked_contract_id and d.document_kind='anexo_i'
  and d.generated_data->>'source_contract_document_id'=r.contract_document_id::text and d.generated_at is not null) into annex_current;
 return jsonb_build_object('recordId',r.id,'projectId',r.linked_project_id,'number',r.contract_number,'clientId',r.linked_client_id,'clientName',r.prospect_name,
  'token',md5(concat_ws('|',r.updated_at::text,r.services::text,r.commercial_terms::text,r.contract_document_id::text,issues::text)),
  'issues',issues,'contractReady',r.linked_contract_id is not null,'documentId',r.contract_document_id,
  'version',coalesce(doc.version,doc.versao),'emitted',doc.generated_at is not null,'annexCurrent',annex_current,
  'accessReady',coalesce(access_ready,false),'total',r.total_value,
  'revisionRequired',doc.generated_at is not null and (
    jsonb_array_length(issues)>0 or doc.generated_data->'commercial_record_snapshot' is null or
    (select jsonb_object_agg(k,to_jsonb(r)->k) is distinct from
            jsonb_object_agg(k,(doc.generated_data->'commercial_record_snapshot')->k)
     from unnest(array['services','commercial_terms','total_value','property_address','address','cpf_cnpj',
       'prospect_name','email','phone','coobligors','smart_texts','experience_level','property_type',
       'area_terreno_m2','area_construida_m2','construction_standard','contract_master_id',
       'contract_master_version','payment_terms','custom_service']) k)
  ));
end;$$;
