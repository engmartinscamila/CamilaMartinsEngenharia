-- Server-only operational queue. Existing commercial and document rows remain
-- the sole source of business data; this table contains execution checkpoints.
create table if not exists public.commercial_document_jobs (
 id uuid primary key default gen_random_uuid(),
 record_id uuid not null references public.commercial_records(id),
 requested_by uuid not null references auth.users(id),
 token_hash text not null,
 expected_source_token text not null,
 original_contract_document_id uuid not null references public.documentos(id),
 contract_document_id uuid references public.documentos(id),
 annex_document_id uuid references public.documentos(id),
 phase text not null default 'queued',
 status text not null default 'pending' check(status in('pending','processing','failed','completed')),
 attempts integer not null default 0,
 expires_at timestamptz not null default now()+interval '1 day',
 lease_until timestamptz,
 original_manifest jsonb,
 result jsonb,
 last_error text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.commercial_document_jobs enable row level security;
revoke all on public.commercial_document_jobs from public,anon,authenticated;
grant select,insert,update on public.commercial_document_jobs to service_role;
create unique index if not exists commercial_document_jobs_one_active_record
 on public.commercial_document_jobs(record_id) where status in('pending','processing');

create or replace function public.service_validate_commercial_document_job(p_id uuid,p_token text)
returns public.commercial_document_jobs language plpgsql security invoker set search_path='' as $$
declare j public.commercial_document_jobs;
begin
 if current_user not in('service_role','postgres') then raise exception 'Operação exclusiva do servidor' using errcode='42501';end if;
 select * into j from public.commercial_document_jobs where id=p_id;
 if j.id is null or length(coalesce(p_token,''))<>64
  or j.token_hash<>encode(pg_catalog.sha256(convert_to(p_token,'UTF8')),'hex')
  or j.expires_at<=clock_timestamp()
  or not exists(select 1 from public.pdf_admins where user_id=j.requested_by)
 then raise exception 'Execução não autorizada' using errcode='42501';end if;
 return j;
end;$$;

create or replace function public.service_claim_commercial_document_job(p_id uuid,p_token text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare j public.commercial_document_jobs;diagnosis jsonb;
begin
 j:=public.service_validate_commercial_document_job(p_id,p_token);
 select * into j from public.commercial_document_jobs where id=p_id for update;
 if j.status='completed' then return to_jsonb(j)-'token_hash';end if;
 if j.status='processing' and j.lease_until>clock_timestamp() then raise exception 'Execução em andamento' using errcode='55P03';end if;
 if j.attempts>=5 then raise exception 'Limite de novas tentativas atingido';end if;
 perform set_config('request.jwt.claim.sub',j.requested_by::text,true);
 if j.phase='queued' then
  diagnosis:=public.admin_commercial_closure(j.record_id);
  if diagnosis->>'token' is distinct from j.expected_source_token
    or diagnosis->>'documentId' is distinct from j.original_contract_document_id::text
    or jsonb_array_length(coalesce(diagnosis->'issues','[]'))>0
    or coalesce((diagnosis->>'emissionPending')::boolean,false)
    or not coalesce((diagnosis->>'revisionRequired')::boolean,false)
  then raise exception 'Cadastro alterado ou revisão não elegível; confira antes de emitir';end if;
 end if;
 update public.commercial_document_jobs set status='processing',attempts=attempts+1,
  lease_until=clock_timestamp()+interval '900 seconds',updated_at=clock_timestamp(),last_error=null
 where id=p_id returning * into j;
 return to_jsonb(j)-'token_hash';
end;$$;

-- A trusted job may delegate only the RPCs required by this exact document
-- chain. The identity is transaction-local; no Auth session or token is created.
create or replace function public.service_commercial_document_job_rpc(p_id uuid,p_token text,p_name text,p_args jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare j public.commercial_document_jobs;r public.commercial_records;doc uuid;outcome jsonb;
begin
 j:=public.service_validate_commercial_document_job(p_id,p_token);
 if j.status<>'processing' or j.lease_until<=clock_timestamp() then raise exception 'Execução inativa' using errcode='42501';end if;
 select * into r from public.commercial_records where id=j.record_id;
 if r.record_kind<>'contrato' then raise exception 'Execução requer contrato comercial';end if;
 perform set_config('request.jwt.claim.sub',j.requested_by::text,true);
 if p_name='consume_admin_rate_limit' then
  if p_args->>'p_action' not in('commercial-document-contrato','contract-document-generate','document-delivery-archive')
    or p_args->>'p_action' is null then raise exception 'Ação não permitida';end if;
  return to_jsonb(public.consume_admin_rate_limit(p_args->>'p_action'));
 elsif p_name='admin_assign_commercial_contract_number' then
  if p_args->>'p_record_id' is distinct from j.record_id::text then raise exception 'Cadastro não permitido';end if;
  select to_jsonb(public.admin_assign_commercial_contract_number(j.record_id)) into outcome;
  return outcome;
 elsif p_name='admin_commercial_closure' then
  return public.admin_commercial_closure(j.record_id);
 elsif p_name='admin_prepare_contract_document' then
  if j.contract_document_id is null or r.contract_document_id is distinct from j.contract_document_id then raise exception 'Contrato emitido precisa ser concluído antes do Anexo I';end if;
  -- Serialize preparation/checkpoint together; lost HTTP replies reuse this ID.
  select * into j from public.commercial_document_jobs where id=p_id for update;
  if j.annex_document_id is not null then return to_jsonb(j.annex_document_id);end if;
  doc:=public.admin_prepare_contract_document(r.linked_project_id,'anexo_i',null,
   jsonb_build_object('contract_id',r.linked_contract_id,'maintenance_job_id',j.id));
  update public.commercial_document_jobs set annex_document_id=doc,phase='annex_prepared',updated_at=clock_timestamp() where id=j.id;
  return to_jsonb(doc);
 else raise exception 'RPC não permitida' using errcode='42501';end if;
end;$$;

revoke all on function public.service_validate_commercial_document_job(uuid,text),
 public.service_claim_commercial_document_job(uuid,text),
 public.service_commercial_document_job_rpc(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.service_validate_commercial_document_job(uuid,text),
 public.service_claim_commercial_document_job(uuid,text),
 public.service_commercial_document_job_rpc(uuid,text,text,jsonb) to service_role;
