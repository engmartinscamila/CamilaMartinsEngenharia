-- Expand the existing type check without changing documents or emission snapshots.
alter table public.documentos drop constraint if exists documentos_document_kind_valid;
alter table public.documentos add constraint documentos_document_kind_valid check (document_kind is null or document_kind = any(array['contrato','orcamento','notificacao_formal','anexo_i','termo_aceite','estudo_preliminar','levantamento_tecnico','servico_adicional','autorizacao_imagem','quitacao_encerramento'])) not valid;

CREATE OR REPLACE FUNCTION public.assign_document_revision_version()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_prev public.documentos%rowtype; v_major int:=1; v_minor int:=0; v_bump text; v_commercial_record text;
begin
 if new.document_kind is null then return new; end if;
 v_bump:=lower(coalesce(new.generated_data->>'version_bump','minor'));
 v_commercial_record:=new.generated_data->>'commercial_record_id';
 if new.projeto_id is not null then
   select * into v_prev from public.documentos d where d.projeto_id=new.projeto_id and coalesce(d.document_kind,d.generated_data->>'commercial_document_kind')=new.document_kind and d.id<>new.id and (new.approval_id is null or d.approval_id is not distinct from new.approval_id) order by d.created_at desc limit 1;
 elsif v_commercial_record is not null then
   select * into v_prev from public.documentos d where coalesce(d.document_kind,d.generated_data->>'commercial_document_kind')=new.document_kind and d.id<>new.id and d.generated_data->>'commercial_record_id'=v_commercial_record order by d.created_at desc limit 1;
 end if;
 if found then
   begin v_major:=split_part(coalesce(v_prev.versao,'1.0'),'.',1)::int; exception when others then v_major:=1; end;
   begin v_minor:=split_part(coalesce(v_prev.versao,'1.0'),'.',2)::int; exception when others then v_minor:=0; end;
   if v_bump='major' then v_major:=v_major+1; v_minor:=0; else v_minor:=v_minor+1; end if;
   new.revision_of:=v_prev.id;
 else v_major:=1; v_minor:=0; new.revision_of:=null; end if;
 new.versao:=v_major::text||'.'||v_minor::text;
 new.version_reason:=nullif(btrim(coalesce(new.generated_data->>'version_reason','')),'');
 new.generated_data:=coalesce(new.generated_data,'{}'::jsonb)||jsonb_build_object('document_version',new.versao,'revision_of',new.revision_of,'version_reason',new.version_reason);
 return new;
end; $function$;


CREATE OR REPLACE FUNCTION public.document_governance_on_document_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ declare k text; begin k:=coalesce(nullif(new.document_kind,''),nullif(lower(new.tipo),''),''); if k='contrato' and new.projeto_id is not null and new.snapshot_frozen_at is not null then insert into public.document_pending_alerts(project_id,alert_code,source_document_id,title,message,severity,due_at) values(new.projeto_id,'missing_anexo_i',new.id,'Anexo I pendente','Contrato emitido sem Anexo I correspondente.','warning',now()+interval '3 days') on conflict do nothing; elsif k='anexo_i' then update public.document_pending_alerts set resolved_at=now(),resolution_note='Anexo I emitido.' where project_id=new.projeto_id and alert_code='missing_anexo_i' and resolved_at is null; elsif k='quitacao_encerramento' then update public.document_pending_alerts set resolved_at=now(),resolution_note='Encerramento emitido.' where project_id=new.projeto_id and alert_code='missing_closure_document' and resolved_at is null; end if; return new; end $function$
