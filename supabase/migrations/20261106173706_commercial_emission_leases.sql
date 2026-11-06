-- Internal operation control only; no business records are created or modified.
create schema if not exists private;
create table if not exists private.commercial_emission_leases (
 record_id uuid not null references public.commercial_records(id) on delete cascade,
 document_kind text not null check(document_kind in ('contrato','orcamento')),
 lane text not null check(lane in ('finalizer','core')),
 owner_token uuid not null,
 lease_until timestamptz not null,
 updated_at timestamptz not null default now(),
 primary key(record_id,document_kind,lane)
);
alter table private.commercial_emission_leases enable row level security;
revoke all on private.commercial_emission_leases from public,anon,authenticated;
grant usage on schema private to service_role;
grant select,insert,update on private.commercial_emission_leases to service_role;

create or replace function public.service_acquire_commercial_emission(
 p_record_id uuid,p_kind text,p_lane text,p_token uuid,p_parent_token uuid default null
) returns boolean language plpgsql security invoker set search_path='' as $$
declare acquired boolean:=false;
begin
 if current_user not in ('service_role','postgres') then raise exception 'Operação exclusiva do servidor';end if;
 if p_kind not in ('contrato','orcamento') or p_lane not in ('finalizer','core') or p_token is null then
  raise exception 'Controle de emissão inválido';
 end if;
 if not exists(select 1 from public.commercial_records where id=p_record_id) then raise exception 'Registro comercial não encontrado';end if;
 -- Serializes the parent/core ownership decisions inside this short transaction.
 perform pg_advisory_xact_lock(hashtextextended(p_record_id::text||':'||p_kind,0));
 if p_lane='finalizer' then
  if exists(select 1 from private.commercial_emission_leases where record_id=p_record_id
    and document_kind=p_kind and lane='core' and lease_until>clock_timestamp()) then return false;end if;
 else
  if p_parent_token is null or not exists(select 1 from private.commercial_emission_leases
    where record_id=p_record_id and document_kind=p_kind and lane='finalizer'
      and owner_token=p_parent_token and lease_until>clock_timestamp()) then return false;end if;
 end if;
 -- 900 seconds exceeds the hosted worker wall-clock maximum (400 seconds).
 -- A vanished worker cannot block the record forever or outlive a replacement.
 insert into private.commercial_emission_leases(record_id,document_kind,lane,owner_token,lease_until)
 values(p_record_id,p_kind,p_lane,p_token,clock_timestamp()+interval '900 seconds')
 on conflict(record_id,document_kind,lane) do update
  set owner_token=excluded.owner_token,lease_until=excluded.lease_until,updated_at=clock_timestamp()
  where private.commercial_emission_leases.lease_until<=clock_timestamp()
 returning true into acquired;
 return coalesce(acquired,false);
end;$$;

create or replace function public.service_release_commercial_emission(
 p_record_id uuid,p_kind text,p_lane text,p_token uuid
) returns boolean language plpgsql security invoker set search_path='' as $$
declare released boolean:=false;
begin
 if current_user not in ('service_role','postgres') then raise exception 'Operação exclusiva do servidor';end if;
 update private.commercial_emission_leases set lease_until=least(lease_until,clock_timestamp()),updated_at=clock_timestamp()
 where record_id=p_record_id and document_kind=p_kind and lane=p_lane and owner_token=p_token
 returning true into released;
 return coalesce(released,false);
end;$$;
revoke all on function public.service_acquire_commercial_emission(uuid,text,text,uuid,uuid) from public,anon,authenticated;
revoke all on function public.service_release_commercial_emission(uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.service_acquire_commercial_emission(uuid,text,text,uuid,uuid) to service_role;
grant execute on function public.service_release_commercial_emission(uuid,text,text,uuid) to service_role;

