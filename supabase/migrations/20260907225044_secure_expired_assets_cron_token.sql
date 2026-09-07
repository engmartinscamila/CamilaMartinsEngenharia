-- Protege a rotina automática de limpeza de ativos expirados com token interno do Vault.
do $$
declare
  v_jobid bigint;
  v_command text;
  v_apikey text;
  v_new_command text;
begin
  select jobid, command
    into v_jobid, v_command
  from cron.job
  where jobname = 'cme-expired-assets-cleanup'
  limit 1;

  if v_jobid is null then
    raise exception 'Cron cme-expired-assets-cleanup não encontrado';
  end if;

  v_apikey := substring(v_command from '"apikey":"([^"]+)"');
  if nullif(v_apikey, '') is null then
    raise exception 'API key pública do cron não encontrada';
  end if;

  v_new_command := format($cmd$
select net.http_post(
  url := 'https://hghtwlopqztfcosfxafd.supabase.co/functions/v1/cleanup-expired-assets',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'apikey', %L,
    'x-cleanup-token', (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'cme_cleanup_expired_assets_token'
      limit 1
    )
  ),
  body := '{}'::jsonb
);$cmd$, v_apikey);

  perform cron.alter_job(v_jobid, command := v_new_command);
end $$;
