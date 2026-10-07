-- Additive transactional outbox. Credentials and temporary invitation tokens
-- are accessible only to service_role, never to portal clients or anonymous API.
create table if not exists public.client_email_queue (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clientes(id) on delete cascade,
  project_id uuid references public.projetos(id) on delete cascade,
  kind text not null check (kind in ('invite','update')),
  source_table text not null,
  source_id text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed','cancelled')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  lease_until timestamptz,
  lease_token uuid,
  provider_id text,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table public.client_email_queue enable row level security;
revoke all on public.client_email_queue from public,anon,authenticated;
grant select,insert,update,delete on public.client_email_queue to service_role;
create index if not exists client_email_queue_due_idx on public.client_email_queue(status,available_at) where status in ('pending','processing');
create index if not exists client_email_queue_client_idx on public.client_email_queue(client_id,created_at desc);
create index if not exists client_email_queue_project_idx on public.client_email_queue(project_id);
create unique index if not exists client_email_queue_invite_pending_idx on public.client_email_queue(client_id) where kind='invite' and status in ('pending','processing');

create or replace function public.enqueue_client_invitation(p_client_id uuid)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid;
begin
  insert into public.client_email_queue(client_id,kind,source_table,source_id)
  values(p_client_id,'invite','clientes',p_client_id::text)
  on conflict(client_id) where kind='invite' and status in ('pending','processing') do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.client_email_queue where client_id=p_client_id and kind='invite' and status in ('pending','processing');
  end if;
  return v_id;
end $$;

create or replace function public.claim_client_email_jobs(p_limit integer default 10,p_job_id uuid default null)
returns setof public.client_email_queue language sql security invoker set search_path='' as $$
  with due as (
    select id from public.client_email_queue
    where ((status='pending' and (available_at<=now() or p_job_id is not null))
      or (status='processing' and lease_until<now()))
      and (p_job_id is null or id=p_job_id)
    order by case when kind='invite' then 0 else 1 end,created_at
    limit greatest(1,least(coalesce(p_limit,10),10))
    for update skip locked
  )
  update public.client_email_queue q set status='processing',attempts=q.attempts+1,
    lease_until=now()+interval '5 minutes',lease_token=gen_random_uuid()
  from due where q.id=due.id returning q.*;
$$;

create or replace function public.finish_client_email_job(p_job_id uuid,p_lease_token uuid,p_provider_id text,p_error text)
returns void language plpgsql security invoker set search_path='' as $$
begin
  update public.client_email_queue set
    status=case when p_provider_id is not null then 'sent' when attempts>=12 then 'failed' else 'pending' end,
    provider_id=coalesce(p_provider_id,provider_id),
    sent_at=case when p_provider_id is not null then now() else sent_at end,
    last_error=case when p_provider_id is not null then null else left(p_error,500) end,
    available_at=now()+make_interval(secs=>least(3600,power(2,least(attempts,12))::integer*30)),
    lease_token=null,lease_until=null,
    payload=case when p_provider_id is not null then payload-'token_hash'-'recipient'-'prepared_email' else payload end
  where id=p_job_id and status='processing' and lease_token=p_lease_token;
  if not found then raise exception 'Envio não pertence a esta execução.'; end if;
end $$;
revoke all on function public.enqueue_client_invitation(uuid),public.claim_client_email_jobs(integer,uuid),public.finish_client_email_job(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.enqueue_client_invitation(uuid),public.claim_client_email_jobs(integer,uuid),public.finish_client_email_job(uuid,uuid,text,text) to service_role;

-- The legacy meeting sender can enrich the same queued event with its calendar
-- attachment. It shares the lease/idempotency key with the automatic worker.
create or replace function public.prepare_client_update_email(p_client_id uuid,p_project_id uuid,p_source_table text,p_source_id text,p_email jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid; v_status text;
begin
  select id,status into v_id,v_status from public.client_email_queue
  where client_id=p_client_id and kind='update' and source_table=p_source_table
    and project_id is not distinct from p_project_id
    and (p_source_id is null or source_id=p_source_id)
    and created_at>now()-interval '2 minutes' and status in ('pending','processing','sent')
  order by created_at desc limit 1 for update;
  if v_id is null then
    insert into public.client_email_queue(client_id,project_id,kind,source_table,source_id,payload)
    values(p_client_id,p_project_id,'update',p_source_table,p_source_id,jsonb_build_object('prepared_email',p_email)) returning id into v_id;
  elsif v_status='pending' then
    update public.client_email_queue set payload=payload||jsonb_build_object('prepared_email',p_email) where id=v_id;
  end if;
  return v_id;
end $$;
revoke all on function public.prepare_client_update_email(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.prepare_client_update_email(uuid,uuid,text,text,jsonb) to service_role;

create or replace function private.queue_client_portal_email()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  r jsonb; o jsonb; v_client uuid; v_project uuid; v_email text; v_auth uuid;
  v_message text; v_flag text; v_settings jsonb; v_visible boolean;
  v_changed boolean; v_status text;
begin
  r:=case when TG_OP='DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end;
  o:=case when TG_OP='INSERT' then '{}'::jsonb else to_jsonb(OLD) end;
  if TG_TABLE_NAME='clientes' then
    if TG_OP='DELETE' then return OLD; end if;
    v_client:=(r->>'id')::uuid;
    v_email:=lower(trim(coalesce(r->>'email','')));
    if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then return NEW; end if;
    if TG_OP='INSERT' then
      -- Every supported creation path gets an invitation, including SQL/RPC,
      -- existing Auth accounts, the website, and the mobile administrative app.
      insert into public.client_email_queue(client_id,kind,source_table,source_id,available_at)
      values(v_client,'invite','clientes',v_client::text,now()+interval '30 seconds')
      on conflict(client_id) where kind='invite' and status in ('pending','processing') do nothing;
      return NEW;
    end if;
    v_changed:=(r-'auth_id'-'created_at'-'id') is distinct from (o-'auth_id'-'created_at'-'id');
    v_message:='Seu cadastro foi atualizado. Acesse o Portal do Cliente para conferir seus dados.';
  else
    v_project:=nullif(coalesce(r->>'projeto_id',r->>'project_id'),'')::uuid;
    v_client:=nullif(r->>'cliente_id','')::uuid;
    if TG_TABLE_NAME='projetos' then v_project:=(r->>'id')::uuid; end if;
    if TG_TABLE_NAME='solicitacao_respostas' then
      select cliente_id,projeto_id into v_client,v_project from public.solicitacoes where id=(r->>'solicitacao_id')::uuid;
      if r->>'autor'<>'administrador' then return NEW; end if;
    end if;
    if v_project is not null then
      select cliente_id into v_client from public.projetos where id=v_project;
    end if;
    if v_client is null then return coalesce(NEW,OLD); end if;
    select auth_id,email,status into v_auth,v_email,v_status from public.clientes where id=v_client;
    if v_status<>'ativo' or v_email is null or (auth.uid() is not null and auth.uid()=v_auth) then return coalesce(NEW,OLD); end if;
    -- Do not mail about unpublished documents or hidden portal modules.
    v_flag:=case TG_TABLE_NAME when 'documentos' then 'show_documents' when 'fotos' then 'show_photos' when 'biblioteca' then 'show_library' when 'agenda' then 'show_agenda' when 'cronograma' then 'show_schedule' when 'construction_schedule_publications' then 'show_schedule' when 'aprovacoes' then 'show_approvals' when 'solicitacoes' then 'show_requests' when 'solicitacao_respostas' then 'show_requests' end;
    if v_project is not null and v_flag is not null then
      select to_jsonb(s) into v_settings from public.project_portal_settings s where s.project_id=v_project;
      if coalesce((v_settings->>v_flag)::boolean,true)=false then return coalesce(NEW,OLD); end if;
    end if;
    if TG_TABLE_NAME='documentos' then
      v_visible:=(r->>'document_kind' is null and r->>'generated_at' is null)
        or ((coalesce((r->>'client_visible')::boolean,false) or coalesce((r->>'exibir_cliente')::boolean,false)) and r->>'client_released_at' is not null);
      if not v_visible then return coalesce(NEW,OLD); end if;
      -- Scheduled contractual documents already have their reliable dispatcher.
      if exists(select 1 from public.notificacoes where referencia_id=r->>'id' and tipo='documento_contratual' and delivery_status in ('scheduled','sent','read')) then return coalesce(NEW,OLD); end if;
    end if;
    -- Ignore read markers, access linking, Google sync bookkeeping and audit data.
    v_changed:=TG_OP<>'UPDATE' or
      (r-'updated_at'-'created_at'-'google_event_id'-'google_calendar_id'-'google_sync_status'-'google_sync_error'-'google_synced_at'-'generated_data'-'arquivo_hash'-'client_released_by')
      is distinct from
      (o-'updated_at'-'created_at'-'google_event_id'-'google_calendar_id'-'google_sync_status'-'google_sync_error'-'google_synced_at'-'generated_data'-'arquivo_hash'-'client_released_by');
    v_message:=case TG_TABLE_NAME
      when 'projetos' then 'Há uma atualização no seu projeto. Acesse o portal para conferir.'
      when 'documentos' then 'Há uma atualização nos documentos do seu projeto. Acesse o portal para conferir.'
      when 'fotos' then 'Há uma atualização nas fotos do seu projeto. Acesse o portal para conferir.'
      when 'biblioteca' then 'Há uma atualização na biblioteca do seu projeto. Acesse o portal para conferir.'
      when 'agenda' then 'Há uma atualização na sua agenda. Acesse o portal para conferir.'
      when 'cronograma' then 'Há uma atualização no cronograma do seu projeto. Acesse o portal para conferir.'
      when 'construction_schedule_publications' then 'Um cronograma atualizado foi publicado no seu portal. Acesse para conferir.'
      when 'aprovacoes' then 'Há uma atualização nas aprovações do seu projeto. Acesse o portal para conferir.'
      when 'solicitacoes' then 'Há uma atualização nas suas solicitações. Acesse o portal para conferir.'
      when 'solicitacao_respostas' then 'A equipe respondeu à sua solicitação. Acesse o portal para conferir.'
      else 'Há uma atualização disponível no seu Portal do Cliente. Acesse para conferir.' end;
  end if;
  if v_changed then
    insert into public.client_email_queue(client_id,project_id,kind,source_table,source_id,payload,available_at)
    values(v_client,v_project,'update',TG_TABLE_NAME,r->>'id',jsonb_build_object('message',v_message,'operation',TG_OP),now()+interval '30 seconds');
  end if;
  return coalesce(NEW,OLD);
end $$;
revoke all on function private.queue_client_portal_email() from public,anon,authenticated;

do $$ declare v_table text;
begin
  foreach v_table in array array['clientes','projetos','documentos','fotos','biblioteca','agenda','cronograma','aprovacoes','solicitacoes','solicitacao_respostas','construction_schedule_publications','project_portal_settings'] loop
    if to_regclass('public.'||v_table) is not null and not exists(select 1 from pg_trigger where tgrelid=to_regclass('public.'||v_table) and tgname='cme_queue_portal_email') then
      execute format('create trigger cme_queue_portal_email after insert or update or delete on public.%I for each row execute function private.queue_client_portal_email()',v_table);
    end if;
  end loop;
end $$;

-- Reuse the established scheduler/Vault authentication without extracting any
-- secret into the migration, repository, tool output, or a browser session.
do $$ begin
  if not exists(select 1 from cron.job where jobname='cme-client-email-dispatch') then
    perform cron.schedule('cme-client-email-dispatch','* * * * *',$cron$
      select net.http_post(
        url:='https://hghtwlopqztfcosfxafd.supabase.co/functions/v1/dispatch-client-emails',
        headers:=jsonb_build_object('Content-Type','application/json','x-document-dispatch-token',
          (select decrypted_secret from vault.decrypted_secrets where name='cme_document_dispatch_token' limit 1)),
        body:='{}'::jsonb,timeout_milliseconds:=120000);
    $cron$);
  end if;
end $$;
