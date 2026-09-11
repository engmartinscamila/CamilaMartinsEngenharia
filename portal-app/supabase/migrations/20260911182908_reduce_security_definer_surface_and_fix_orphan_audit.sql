alter function public.assert_document_governance_ready() security invoker;
alter function public.enrich_commercial_services(jsonb,text) security invoker;
alter function public.admin_contract_master_current() security invoker;
alter function public.admin_document_attention() security invoker;
alter function public.admin_document_governance_status() security invoker;
alter function public.admin_project_document_map(uuid) security invoker;
alter function public.admin_storage_overview() security invoker;
alter function public.admin_system_health() security invoker;
alter function public.mark_admin_notification_read(uuid) security invoker;

create or replace function public.admin_storage_orphan_details()
returns jsonb
language plpgsql
stable
security invoker
set search_path=''
as $$
declare v_metadata jsonb; v_objects jsonb;
begin
  if not public.is_portal_admin() then raise exception 'Acesso administrativo necessário'; end if;

  with metadata as (
    select 'documento'::text kind,d.id::text id,d.nome,d.storage_bucket bucket,d.arquivo path,d.projeto_id
    from public.documentos d where d.arquivo is not null
    union all
    select 'foto'::text,f.id::text,f.nome,f.storage_bucket,f.arquivo,f.projeto_id
    from public.fotos f where f.arquivo is not null
    union all
    select 'biblioteca'::text,b.id::text,b.nome,b.storage_bucket,b.arquivo,f.projeto_id
    from public.biblioteca b
    join lateral (select b.projeto_id) f on true
    where b.arquivo is not null
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'kind',m.kind,'id',m.id,'name',m.nome,'bucket',m.bucket,
        'path',m.path,'projectId',m.projeto_id
      ) order by m.kind,m.nome
    ),
    '[]'::jsonb
  )
  into v_metadata
  from metadata m
  where not exists(
    select 1 from storage.objects o
    where o.bucket_id=m.bucket and o.name=m.path
  );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'bucket',o.bucket_id,
        'path',o.name,
        'size',coalesce((o.metadata->>'size')::bigint,0),
        'createdAt',o.created_at
      ) order by o.created_at desc
    ),
    '[]'::jsonb
  )
  into v_objects
  from storage.objects o
  where o.bucket_id=any(array['documentos','fotos','materiais-protegidos','biblioteca'])
    and not exists(select 1 from public.documentos d where d.storage_bucket=o.bucket_id and d.arquivo=o.name)
    and not exists(select 1 from public.fotos f where f.storage_bucket=o.bucket_id and f.arquivo=o.name)
    and not exists(select 1 from public.biblioteca b where b.storage_bucket=o.bucket_id and b.arquivo=o.name)
    and not exists(select 1 from public.protected_pdf_issues i where o.bucket_id='materiais-protegidos' and i.issued_storage_path=o.name)
    and not exists(select 1 from public.protected_asset_issues i where o.bucket_id='materiais-protegidos' and i.issued_storage_path=o.name)
    and not exists(select 1 from public.protected_site_pdfs p where o.bucket_id='materiais-protegidos' and p.original_storage_path=o.name);

  return jsonb_build_object('orphanMetadata',v_metadata,'orphanObjects',v_objects);
end;
$$;

revoke all on function public.admin_storage_orphan_details() from public, anon;
grant execute on function public.admin_storage_orphan_details() to authenticated;
