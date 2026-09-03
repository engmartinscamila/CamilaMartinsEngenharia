insert into public.document_pending_alerts(project_id,alert_code,source_document_id,title,message,severity,due_at)
select d.projeto_id,'missing_anexo_i',d.id,'Anexo I pendente','Contrato emitido sem Anexo I correspondente.','warning',coalesce(d.snapshot_frozen_at,d.created_at)+interval '3 days'
from public.documentos d
where coalesce(d.document_kind,lower(d.tipo))='contrato' and d.snapshot_frozen_at is not null and d.superseded_by is null
and not exists(select 1 from public.documentos x where x.projeto_id=d.projeto_id and coalesce(x.document_kind,lower(x.tipo))='anexo_i' and x.superseded_by is null)
on conflict do nothing;

insert into public.document_pending_alerts(project_id,alert_code,title,message,severity,due_at)
select p.id,'missing_closure_document','Encerramento documental pendente','Projeto concluído sem Termo de Quitação / Encerramento vigente.','warning',now()
from public.projetos p
where lower(coalesce(p.status,'')) in('concluido','concluído','completed','encerrado')
and not exists(select 1 from public.documentos d where d.projeto_id=p.id and coalesce(d.document_kind,lower(d.tipo))='quitacao_encerramento' and d.superseded_by is null)
on conflict do nothing;

insert into public.document_pending_alerts(project_id,alert_code,source_document_id,title,message,severity,due_at)
select d.projeto_id,'awaiting_document_acceptance',d.id,'Aceite documental pendente',coalesce(d.nome,'Documento')||' — versão '||coalesce(nullif(d.version,''),to_jsonb(d)->>'versao','1.0')||' aguarda manifestação do cliente.','warning',d.client_released_at+interval '5 days'
from public.documentos d
where d.client_released_at is not null and d.acceptance_required=true and d.superseded_by is null
and not exists(select 1 from public.document_acceptances a where a.document_id=d.id)
on conflict do nothing;

insert into public.document_pending_alerts(project_id,alert_code,source_document_id,title,message,severity,due_at)
select d.projeto_id,'document_expiring',d.id,'Validade documental',coalesce(d.nome,'Documento')||' precisa de revisão de validade.','warning',d.valid_until::timestamptz
from public.documentos d
where d.valid_until is not null and d.superseded_by is null
on conflict do nothing;
