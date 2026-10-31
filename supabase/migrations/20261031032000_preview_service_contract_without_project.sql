CREATE OR REPLACE FUNCTION public.admin_preview_contract_document(p_project_id uuid, p_document_kind text, p_approval_id uuid DEFAULT NULL::uuid, p_extra_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v record; v_prev record; v_scope jsonb; v_major int:=1; v_minor int:=0; v_bump text:=lower(coalesce(p_extra_data->>'version_bump','minor')); v_next text;
begin
 if not public.is_portal_admin() then raise exception 'Acesso administrativo necessário'; end if;
 select p.id,coalesce(p.nome,c.service_type) project_name,coalesce(p.tipo,c.service_type) project_type,p.endereco_obra,p.numero_obra,p.complemento_obra,p.bairro_obra,p.cidade_obra,p.estado_obra,c.id contract_id,c.cliente_id,c.contract_number,c.contract_value,cl.nome client_name,cl.cpf_cnpj client_cpf_cnpj,cl.endereco client_address into v from public.contratos c left join public.projetos p on p.contract_id=c.id and p.id=p_project_id left join public.clientes cl on cl.id=c.cliente_id where (p_project_id is not null and p.id=p_project_id) or (p_project_id is null and c.id=nullif(p_extra_data->>'contract_id','')::uuid);
 if not found then raise exception 'Projeto/contrato não encontrado'; end if;
 select d.id,d.versao into v_prev from public.documentos d where d.contract_id=v.contract_id and d.projeto_id is not distinct from p_project_id and d.document_kind=p_document_kind and (p_approval_id is null or d.approval_id is not distinct from p_approval_id) order by d.created_at desc limit 1;
 if found then begin v_major:=split_part(coalesce(v_prev.versao,'1.0'),'.',1)::int; exception when others then v_major:=1; end; begin v_minor:=split_part(coalesce(v_prev.versao,'1.0'),'.',2)::int; exception when others then v_minor:=0; end; if v_bump='major' then v_major:=v_major+1;v_minor:=0;else v_minor:=v_minor+1;end if; end if;
 v_next:=v_major::text||'.'||v_minor::text;
 select coalesce(jsonb_agg(jsonb_build_object('code',s.service_code,'name',s.service_name,'included',s.included) order by s.display_order),'[]'::jsonb) into v_scope from public.contract_scope_items s where s.contract_id=v.contract_id and s.included=true;
 return jsonb_build_object('document_kind',p_document_kind,'next_version',v_next,'revision_of',v_prev.id,'client_name',v.client_name,'client_cpf_cnpj',v.client_cpf_cnpj,'client_address',v.client_address,'project_name',v.project_name,'project_type',v.project_type,'contract_number',v.contract_number,'contract_value',v.contract_value,'property_address',concat_ws(', ',nullif(v.endereco_obra,''),nullif(v.numero_obra,''),nullif(v.complemento_obra,''),nullif(v.bairro_obra,''),nullif(v.cidade_obra,''),nullif(v.estado_obra,'')),'scope_items',v_scope,'document_options',coalesce(p_extra_data->'document_options','{}'::jsonb));
end; $function$
;
