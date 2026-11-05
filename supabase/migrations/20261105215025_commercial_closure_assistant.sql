-- Read-only diagnosis, explicit resolutions and immutable issued documents.
-- No customer records are changed by installing this migration.
create or replace function public.admin_project_contract_closure()
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not public.is_portal_admin() then raise exception 'Acesso administrativo necessário';end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',p.id,'name',p.nome,'clientName',cl.nome,'number',p.numero_contrato,
  'address',concat_ws(', ',nullif(p.endereco_obra,''),nullif(p.numero_obra,''),nullif(p.cidade_obra,'')),
  'token',md5(to_jsonb(p)::text),
  'candidates',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'number',c.contract_number,
   'service',c.service_type,'numberMatch',lower(btrim(coalesce(p.numero_contrato,'')))=lower(btrim(c.contract_number)),
   'address',(select cr.property_address from public.commercial_records cr where cr.linked_contract_id=c.id and cr.record_kind='contrato' order by cr.updated_at desc limit 1)
  ) order by (lower(btrim(coalesce(p.numero_contrato,'')))=lower(btrim(c.contract_number))) desc,c.contract_number),'[]'::jsonb)
   from public.contratos c where c.cliente_id=p.cliente_id and c.status not in ('cancelado','arquivado'))
 ) order by cl.nome,p.nome),'[]'::jsonb) into result
 from public.projetos p join public.clientes cl on cl.id=p.cliente_id where p.contract_id is null;
 return result;
end;$$;

create or replace function public.admin_link_existing_project_contract(p_project_id uuid,p_contract_id uuid,p_expected_token text,p_acknowledge boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.projetos%rowtype;c public.contratos%rowtype;
begin
 if auth.uid() is null or not public.is_portal_admin() then raise exception 'Acesso administrativo necessário';end if;
 select * into p from public.projetos where id=p_project_id for update;
 if not found then raise exception 'Projeto não encontrado';end if;
 if p.contract_id=p_contract_id then return jsonb_build_object('linked',true,'alreadyLinked',true);end if;
 if p.contract_id is not null then raise exception 'Este projeto já possui contrato. Atualize o diagnóstico';end if;
 if p_expected_token is distinct from md5(to_jsonb(p)::text) then raise exception 'O projeto mudou. Atualize o diagnóstico antes de aplicar';end if;
 select * into c from public.contratos where id=p_contract_id for share;
 if not found or c.cliente_id<>p.cliente_id or c.status in ('cancelado','arquivado') then raise exception 'Selecione um contrato ativo pertencente ao mesmo cliente';end if;
 if p_acknowledge is distinct from true then raise exception 'Confira o número, os endereços e a abrangência do contrato antes de vincular';end if;
 update public.projetos set contract_id=c.id,numero_contrato=c.contract_number where id=p.id;
 insert into public.audit_log(user_id,action,entity_type,entity_id,details)
 values(auth.uid(),'link_existing_project_contract','projetos',p.id,jsonb_build_object('previous_number',p.numero_contrato,'contract_id',c.id,'contract_number',c.contract_number,'address_preserved',true));
 return jsonb_build_object('linked',true,'projectId',p.id,'contractId',c.id);
end;$$;

create or replace function public.admin_commercial_closure(p_record_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.commercial_records%rowtype;s jsonb;t jsonb;issues jsonb:='[]';
 code text;delivery text;target text;approved text;source_version int;doc public.documentos%rowtype;
 access_ready boolean;annex_current boolean;
begin
 if auth.uid() is null or not public.is_portal_admin() then raise exception 'Acesso administrativo necessário';end if;
 select * into r from public.commercial_records where id=p_record_id;
 if not found or r.record_kind<>'contrato' then raise exception 'Selecione um contrato comercial';end if;
 for s in select value from jsonb_array_elements(coalesce(r.services,'[]')) where value->>'included'='true' loop
  code:=lower(s->>'code');target:=null;approved:=null;source_version:=null;
  select value into t from jsonb_array_elements(coalesce(r.commercial_terms->'scope','[]')) where lower(value->>'code')=code limit 1;
  delivery:=translate(lower(coalesce(t->>'deliverables','')),'áàâãéêíóôõúç','aaaaeeiooouc');
  select string_agg(v.value,E'\n' order by v.ord),sc.version into approved,source_version
  from public.service_level_scope_catalog sc cross join lateral jsonb_array_elements_text(sc.included_deliverables) with ordinality v(value,ord)
  where sc.service_code=code and sc.level_code=coalesce(nullif(s->>'levelCode',''),s#>>'{level,code}',r.experience_level)
   and sc.active and sc.applicable and sc.review_status='approved' group by sc.version;
  if delivery='' then
   issues:=issues||jsonb_build_array(jsonb_build_object('code',code,'name',s->>'name','kind','missing','message','Faltam os entregáveis particulares desta atividade.','current',coalesce(t->>'deliverables',''),'suggestion',approved));
  elsif code in ('am','aj') and delivery~'(hidrossanit|esgoto)' and delivery!~'(rede externa|rede publica|saneamento externo)' then
   target:='g';
  elsif code='aj' and delivery~'hidraulico' and delivery!~'(rede externa|rede publica|saneamento externo)' then
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
  'token',md5(concat_ws('|',r.updated_at::text,r.services::text,r.commercial_terms::text,r.contract_document_id::text)),
  'issues',issues,'contractReady',r.linked_contract_id is not null,'documentId',r.contract_document_id,
  'version',coalesce(doc.version,doc.versao),'emitted',doc.generated_at is not null,'annexCurrent',annex_current,
  'accessReady',coalesce(access_ready,false),'total',r.total_value,
  'revisionRequired',r.contract_document_id is not null and (jsonb_array_length(issues)>0 or r.updated_at>doc.generated_at));
end;$$;

create or replace function public.admin_resolve_commercial_closure(p_record_id uuid,p_expected_token text,p_action text,p_code text,p_target_code text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.commercial_records%rowtype;plan jsonb;issue jsonb;terms jsonb;rows jsonb;previous_delivery text;
begin
 if auth.uid() is null or not public.is_portal_admin() then raise exception 'Acesso administrativo necessário';end if;
 select * into r from public.commercial_records where id=p_record_id for update;
 if not found then raise exception 'Contrato não localizado';end if;
 plan:=public.admin_commercial_closure(p_record_id);
 if p_expected_token is distinct from plan->>'token' then raise exception 'O contrato mudou. Atualize o diagnóstico antes de aplicar';end if;
 select value into issue from jsonb_array_elements(plan->'issues') where value->>'code'=p_code limit 1;
 if issue is null then raise exception 'Esta pendência já foi resolvida ou não pertence ao contrato';end if;
 if p_action='reclassify' then
  if issue->>'kind'<>'classification' or issue->>'targetCode' is distinct from p_target_code or (issue->>'targetIncluded')::boolean then raise exception 'Classificação não corresponde à sugestão atual';end if;
  perform public.admin_reclassify_commercial_service(p_record_id,p_code,p_target_code);
 elsif p_action='remove_redundant' then
  if issue->>'kind'<>'scope' or not coalesce((issue->>'canRemove')::boolean,false) then raise exception 'Confira a cobertura por serviços existentes antes de remover';end if;
  perform public.admin_reclassify_commercial_service(p_record_id,p_code,null);
 elsif p_action='use_approved_deliverables' then
  if issue->>'kind'<>'scope' or nullif(btrim(issue->>'suggestion'),'') is null then raise exception 'Não há entregável aprovado disponível para esta correção';end if;
  terms:=r.commercial_terms;
  select jsonb_agg(case when value->>'code'=p_code then value||jsonb_build_object('deliverables',issue->>'suggestion') else value end order by ord)
   into rows from jsonb_array_elements(terms->'scope') with ordinality src(value,ord);
  previous_delivery:=issue->>'current';terms:=jsonb_set(terms,'{scope}',rows);
  perform public.admin_save_commercial_terms(r.id,terms);
  insert into public.audit_log(user_id,action,entity_type,entity_id,details)
   values(auth.uid(),'repair_commercial_scope','commercial_records',r.id,jsonb_build_object('service_code',p_code,'before',previous_delivery,'after',issue->>'suggestion','catalog_version',issue->'sourceVersion','historical_documents_untouched',true));
 else raise exception 'Ação de fechamento inválida';end if;
 return public.admin_commercial_closure(r.id);
end;$$;

revoke all on function public.admin_project_contract_closure() from public,anon;
revoke all on function public.admin_link_existing_project_contract(uuid,uuid,text,boolean) from public,anon;
revoke all on function public.admin_commercial_closure(uuid) from public,anon;
revoke all on function public.admin_resolve_commercial_closure(uuid,text,text,text,text) from public,anon;
grant execute on function public.admin_project_contract_closure() to authenticated;
grant execute on function public.admin_link_existing_project_contract(uuid,uuid,text,boolean) to authenticated;
grant execute on function public.admin_commercial_closure(uuid) to authenticated;
grant execute on function public.admin_resolve_commercial_closure(uuid,text,text,text,text) to authenticated;

-- Regularize an existing project without creating a second project or inventing agreement terms.
create or replace function public.admin_register_existing_project_contract(p_project_id uuid,p_expected_token text,p_number text,p_service text,p_value numeric)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.projetos%rowtype;c public.contratos%rowtype;new_id uuid;
begin
 if auth.uid() is null or not public.is_portal_admin() then raise exception 'Acesso administrativo necessário';end if;
 select * into p from public.projetos where id=p_project_id for update;
 if not found then raise exception 'Projeto não encontrado';end if;
 if p.contract_id is not null then
  select * into c from public.contratos where id=p.contract_id;
  if c.contract_number=upper(btrim(p_number)) then return jsonb_build_object('linked',true,'alreadyLinked',true,'contractId',c.id);end if;
  raise exception 'O projeto já foi vinculado. Atualize o diagnóstico';
 end if;
 if p_expected_token is distinct from md5(to_jsonb(p)::text) then raise exception 'O projeto mudou. Atualize o diagnóstico';end if;
 if length(btrim(coalesce(p_number,'')))<2 or length(btrim(coalesce(p_service,'')))<3 or p_value is null or p_value<=0 or p_value::text in ('NaN','Infinity','-Infinity') then
  raise exception 'Informe o número, o serviço e o valor positivo do acordo existente';end if;
 if exists(select 1 from public.contratos where lower(contract_number)=lower(btrim(p_number))) then raise exception 'Este número já existe. Use a opção de vincular contrato existente';end if;
 insert into public.contratos(cliente_id,contract_number,service_type,contract_value,currency,status,notes)
 values(p.cliente_id,upper(btrim(p_number)),btrim(p_service),p_value,'BRL','ativo','Registro administrativo de acordo existente; não substitui documento assinado.') returning id into new_id;
 perform public.admin_link_existing_project_contract(p.id,new_id,p_expected_token,true);
 insert into public.audit_log(user_id,action,entity_type,entity_id,details)
 values(auth.uid(),'register_existing_project_contract','contratos',new_id,jsonb_build_object('project_id',p.id,'word_issued',false,'signature_inferred',false));
 return jsonb_build_object('linked',true,'contractId',new_id,'projectId',p.id);
end;$$;
revoke all on function public.admin_register_existing_project_contract(uuid,text,text,text,numeric) from public,anon;
grant execute on function public.admin_register_existing_project_contract(uuid,text,text,text,numeric) to authenticated;
