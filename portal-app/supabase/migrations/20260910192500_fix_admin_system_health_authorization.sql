create or replace function public.admin_system_health()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.is_portal_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;

  select jsonb_build_object(
    'database','ok',
    'checked_at',now(),
    'documents_total',(select count(*) from public.documentos),
    'snapshots_total',(select count(*) from public.document_emission_snapshots),
    'legacy_snapshots',(select count(*) from public.document_emission_snapshots where legacy_backfill),
    'sha256_snapshots',(select count(*) from public.document_emission_snapshots where hash_algorithm='sha256' and length(snapshot_hash)=64),
    'pending_acceptances',(select count(*) from public.documentos where workflow_status='enviado'),
    'latest_document_generated_at',(select max(generated_at) from public.documentos),
    'latest_snapshot_at',(select max(emitted_at) from public.document_emission_snapshots)
  ) into v_result;

  return v_result;
end
$$;

revoke all on function public.admin_system_health() from public, anon;
grant execute on function public.admin_system_health() to authenticated, service_role;
