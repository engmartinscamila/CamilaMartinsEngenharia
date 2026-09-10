create or replace function public.admin_mark_exported_documents_purged(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.document_archive_batches%rowtype;
  v_now timestamptz := now();
  v_objects jsonb := '[]'::jsonb;
  v_removed_count integer := 0;
  v_retained_count integer := 0;
begin
  if not public.is_portal_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;

  select * into v_batch
  from public.document_archive_batches
  where id = p_batch_id
  for update;

  if not found then
    raise exception 'Lote de arquivo não encontrado';
  end if;
  if v_batch.status <> 'exportado' then
    raise exception 'Somente lotes exportados podem ser limpos';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', d.id,
    'bucket', coalesce(d.storage_bucket, 'documentos'),
    'path', d.arquivo
  ) order by d.id), '[]'::jsonb), count(*)
  into v_objects, v_removed_count
  from public.documentos d
  where d.export_batch_id = p_batch_id
    and d.purged_at is null
    and coalesce(d.retain_online, false) = false
    and d.arquivo is not null;

  select count(*) into v_retained_count
  from public.documentos d
  where d.export_batch_id = p_batch_id
    and d.purged_at is null
    and coalesce(d.retain_online, false) = true;

  update public.documentos d
  set archived_original_path = d.arquivo,
      arquivo = null,
      purged_at = v_now,
      archived_storage_size = null
  where d.export_batch_id = p_batch_id
    and d.purged_at is null
    and coalesce(d.retain_online, false) = false;

  update public.document_archive_batches
  set status = 'limpo',
      purged_at = v_now
  where id = p_batch_id;

  return jsonb_build_object(
    'objects', v_objects,
    'count', v_removed_count,
    'retained', v_retained_count,
    'archivePath', v_batch.archive_path,
    'purgedAt', v_now
  );
end;
$$;

revoke all on function public.admin_mark_exported_documents_purged(uuid) from public, anon;
grant execute on function public.admin_mark_exported_documents_purged(uuid) to authenticated, service_role;
