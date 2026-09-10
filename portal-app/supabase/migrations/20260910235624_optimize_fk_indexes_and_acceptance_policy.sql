create index if not exists document_acceptances_client_id_idx
  on public.document_acceptances (client_id);

create index if not exists document_pending_alerts_source_document_id_idx
  on public.document_pending_alerts (source_document_id);

create index if not exists documentos_superseded_by_idx
  on public.documentos (superseded_by);

create index if not exists financeiro_account_id_idx
  on public.financeiro (account_id);

create index if not exists financeiro_bank_transaction_id_idx
  on public.financeiro (bank_transaction_id);

create index if not exists fotos_work_diary_entry_id_idx
  on public.fotos (work_diary_entry_id);

drop policy if exists document_acceptances_admin_read on public.document_acceptances;
drop policy if exists document_acceptances_client_read on public.document_acceptances;

create policy document_acceptances_authorized_read
on public.document_acceptances
for select
to authenticated
using (
  public.is_portal_admin()
  or public.user_has_project_access(project_id)
);
