-- Dispara automaticamente documentos agendados sem expor credenciais no frontend.
-- O cron usa um token aleatório guardado no Vault; a Edge Function valida esse token
-- por uma RPC disponível somente ao service_role.

do $$
begin
  if not exists (select 1 from vault.secrets where name='cme_document_dispatch_token') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32),'hex'),
      'cme_document_dispatch_token',
      'Token interno do cron de documentos contratuais'
    );
  end if;
end $$;

create or replace function public.verify_internal_document_dispatch_token(p_token text)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists(
    select 1
    from vault.decrypted_secrets
    where name='cme_document_dispatch_token'
      and decrypted_secret=p_token
  );
$$;

revoke all on function public.verify_internal_document_dispatch_token(text) from public,anon,authenticated;
grant execute on function public.verify_internal_document_dispatch_token(text) to service_role;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname='cme-document-notification-dispatch' limit 1;
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'cme-document-notification-dispatch',
    '* * * * *',
    $cron$
      select net.http_post(
        url := 'https://hghtwlopqztfcosfxafd.supabase.co/functions/v1/dispatch-document-notifications',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'x-document-dispatch-token',(
            select decrypted_secret
            from vault.decrypted_secrets
            where name='cme_document_dispatch_token'
            limit 1
          )
        ),
        body := '{}'::jsonb
      );
    $cron$
  );
end $$;
