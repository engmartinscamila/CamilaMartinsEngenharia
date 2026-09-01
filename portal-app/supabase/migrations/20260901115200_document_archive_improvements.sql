alter table public.documentos
  add column if not exists retain_online boolean not null default false,
  add column if not exists archived_storage_size bigint,
  add column if not exists restored_at timestamptz;

create index if not exists idx_documentos_archive_filters
  on public.documentos (document_kind, cliente_id, projeto_id, generated_at)
  where purged_at is null;

create index if not exists idx_documentos_retain_online
  on public.documentos (retain_online)
  where retain_online = true;

create or replace function public.admin_document_archive_reminder(p_days integer default 180)
returns table(eligible_count bigint)
language sql
security invoker
set search_path = public
as $$
  select count(*)::bigint
  from public.documentos d
  where public.is_portal_admin()
    and d.arquivo is not null
    and d.purged_at is null
    and coalesce(d.retain_online, false) = false
    and d.generated_at <= now() - make_interval(days => greatest(30, least(coalesce(p_days, 180), 3650)))
    and (
      d.workflow_status in ('assinado','aceito','cancelado')
      or exists (
        select 1
        from public.commercial_records c
        where c.status in ('convertido','cancelado')
          and (c.quote_document_id = d.id or c.contract_document_id = d.id)
      )
    );
$$;

grant execute on function public.admin_document_archive_reminder(integer) to authenticated;
