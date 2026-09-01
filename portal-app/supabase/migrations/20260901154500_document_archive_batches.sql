create table if not exists public.document_archive_batches (
  id uuid primary key default gen_random_uuid(),
  cutoff_at timestamptz not null,
  document_count integer not null default 0,
  archive_path text,
  status text not null default 'preparado',
  created_by uuid,
  created_at timestamptz not null default now(),
  exported_at timestamptz,
  purged_at timestamptz,
  manifest jsonb not null default '{}'::jsonb,
  constraint document_archive_batches_status_check check (status in ('preparado','exportado','limpo','falhou'))
);

alter table public.document_archive_batches enable row level security;

create policy "document_archive_batches_admin_read"
on public.document_archive_batches
for select
to authenticated
using ((select public.is_portal_admin()));

create policy "document_archive_batches_admin_manage"
on public.document_archive_batches
for all
to authenticated
using ((select public.is_portal_admin()))
with check ((select public.is_portal_admin()));

alter table public.documentos
  add column if not exists exported_at timestamptz,
  add column if not exists purged_at timestamptz,
  add column if not exists export_batch_id uuid references public.document_archive_batches(id) on delete set null;

create index if not exists documentos_export_batch_id_idx on public.documentos(export_batch_id);
create index if not exists documentos_archive_eligibility_idx on public.documentos(workflow_status, generated_at) where purged_at is null;

comment on table public.document_archive_batches is 'Lotes administrativos de exportacao e limpeza de documentos gerados.';
comment on column public.documentos.purged_at is 'Data em que o arquivo fisico foi removido do storage apos exportacao administrativa.';