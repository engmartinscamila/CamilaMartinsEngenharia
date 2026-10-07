-- Avoid a second email while initializing the settings of a new project.
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
    if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      if TG_OP='INSERT' or r->>'email' is distinct from o->>'email' then raise exception 'Informe um e-mail válido para enviar o acesso ao cliente.'; end if;
      return NEW;
    end if;
    if TG_OP='INSERT' then
      -- Every supported creation path gets an invitation, including SQL/RPC,
      -- existing Auth accounts, the website, and the mobile administrative app.
      insert into public.client_email_queue(client_id,kind,source_table,source_id,available_at)
      values(v_client,'invite','clientes',v_client::text,now()+interval '30 seconds')
      on conflict(client_id) where kind='invite' and status in ('pending','processing') do nothing;
      return NEW;
    end if;
    if lower(trim(coalesce(o->>'email',''))) is distinct from v_email
      or ((o->>'status') is distinct from 'ativo' and r->>'status'='ativo') then
      update public.client_email_queue set status='cancelled',lease_token=null,lease_until=null,
        payload=payload-'token_hash'-'recipient'-'prepared_email'
      where client_id=v_client and kind='invite' and status in ('pending','processing');
      insert into public.client_email_queue(client_id,kind,source_table,source_id,available_at)
      values(v_client,'invite','clientes',v_client::text,now()+interval '30 seconds');
    end if;
    v_changed:=(r-'auth_id'-'created_at'-'id') is distinct from (o-'auth_id'-'created_at'-'id');
    v_message:='Seu cadastro foi atualizado. Acesse o Portal do Cliente para conferir seus dados.';
  else
    -- Project creation already notifies the client; default visibility setup
    -- is bookkeeping, rather than a second client-visible change.
    if TG_TABLE_NAME='project_portal_settings' and TG_OP='INSERT' then return NEW; end if;
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
