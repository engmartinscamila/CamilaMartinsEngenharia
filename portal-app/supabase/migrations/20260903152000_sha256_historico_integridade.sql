alter table public.document_emission_snapshots add column if not exists hash_algorithm text not null default 'sha256';
alter table public.document_emission_snapshots add column if not exists legacy_backfill boolean not null default false;

alter table public.document_emission_snapshots disable trigger user;
update public.document_emission_snapshots
set snapshot_hash = encode(digest(convert_to(snapshot::text,'UTF8'),'sha256'),'hex'),
    hash_algorithm = 'sha256'
where snapshot_hash is distinct from encode(digest(convert_to(snapshot::text,'UTF8'),'sha256'),'hex')
   or hash_algorithm is distinct from 'sha256';
alter table public.document_emission_snapshots enable trigger user;

insert into public.document_emission_snapshots(document_id, document_kind, version, version_reason, snapshot, snapshot_hash, emitted_at, created_by, hash_algorithm, legacy_backfill)
select d.id,
       coalesce(d.document_kind, d.categoria, 'historico'),
       coalesce(d.version, '1.0'),
       coalesce(d.version_reason, 'Documento anterior à implantação da trilha imutável'),
       jsonb_build_object(
         'legacy_backfill', true,
         'source', 'historical_reference',
         'document_id', d.id,
         'document_name', d.nome,
         'document_kind', d.document_kind,
         'category', d.categoria,
         'project_id', d.projeto_id,
         'version', coalesce(d.version, '1.0'),
         'generated_at', d.generated_at,
         'created_at', d.created_at,
         'note', 'Referência histórica criada após a emissão original; não representa captura contemporânea da emissão.'
       ),
       encode(digest(convert_to(jsonb_build_object(
         'legacy_backfill', true,
         'source', 'historical_reference',
         'document_id', d.id,
         'document_name', d.nome,
         'document_kind', d.document_kind,
         'category', d.categoria,
         'project_id', d.projeto_id,
         'version', coalesce(d.version, '1.0'),
         'generated_at', d.generated_at,
         'created_at', d.created_at,
         'note', 'Referência histórica criada após a emissão original; não representa captura contemporânea da emissão.'
       )::text,'UTF8'),'sha256'),'hex'),
       coalesce(d.generated_at,d.created_at,now()),
       null,
       'sha256',
       true
from public.documentos d
left join public.document_emission_snapshots s on s.document_id=d.id
where s.document_id is null and d.generated_at is not null;

create or replace function public.admin_system_health()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_admin boolean;
  v_result jsonb;
begin
  select exists(select 1 from public.profiles p where p.id=v_uid and p.role='admin') into v_is_admin;
  if not v_is_admin then raise exception 'Acesso negado'; end if;
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
end $$;
revoke all on function public.admin_system_health() from public, anon;
grant execute on function public.admin_system_health() to authenticated;
