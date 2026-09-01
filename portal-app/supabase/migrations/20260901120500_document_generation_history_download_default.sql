alter table public.documentos
  add column if not exists archived_explicitly boolean not null default false,
  add column if not exists last_downloaded_at timestamptz;

create table if not exists public.document_generation_history (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.documentos(id) on delete set null,
  document_kind text,
  document_name text not null,
  document_number text,
  version text,
  workflow_status text,
  client_id uuid references public.clientes(id) on delete set null,
  project_id uuid references public.projetos(id) on delete set null,
  contract_id uuid references public.contratos(id) on delete set null,
  commercial_record_id uuid references public.commercial_records(id) on delete set null,
  party_name text,
  storage_mode text not null default 'download_only' check (storage_mode in ('download_only','archived')),
  archive_path text,
  file_size_bytes bigint,
  generated_by uuid references auth.users(id) on delete set null,
  generated_at timestamptz not null default now(),
  restored_at timestamptz
);

alter table public.document_generation_history enable row level security;

drop policy if exists "admin_manage_document_generation_history" on public.document_generation_history;
create policy "admin_manage_document_generation_history"
  on public.document_generation_history
  for all
  to authenticated
  using (public.is_portal_admin())
  with check (public.is_portal_admin());

create index if not exists idx_document_generation_history_generated_at on public.document_generation_history (generated_at desc);
create index if not exists idx_document_generation_history_document on public.document_generation_history (document_id, generated_at desc);
create index if not exists idx_document_generation_history_client on public.document_generation_history (client_id, generated_at desc);
create index if not exists idx_document_generation_history_project on public.document_generation_history (project_id, generated_at desc);
create index if not exists idx_document_generation_history_kind on public.document_generation_history (document_kind, generated_at desc);

insert into public.document_generation_history (
  document_id, document_kind, document_name, version, workflow_status, client_id, project_id, contract_id,
  commercial_record_id, party_name, storage_mode, archive_path, generated_at
)
select
  d.id,
  d.document_kind,
  d.nome,
  d.versao,
  d.workflow_status,
  d.cliente_id,
  d.projeto_id,
  d.contract_id,
  nullif(d.generated_data->>'commercial_record_id','')::uuid,
  coalesce(d.generated_data->>'prospect_name', c.nome),
  case when d.arquivo is null then 'download_only' else 'archived' end,
  d.arquivo,
  d.generated_at
from public.documentos d
left join public.clientes c on c.id = d.cliente_id
where d.generated_at is not null
  and not exists (
    select 1 from public.document_generation_history h
    where h.document_id = d.id and h.generated_at = d.generated_at
  );
