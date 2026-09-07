-- Endurecimento de funções privilegiadas e segredos internos.
-- Impede EXECUTE implícito a PUBLIC em futuras funções do schema public.
alter default privileges for role postgres in schema public revoke execute on functions from public;

-- Funções de serviço que leem o Vault: somente service_role.
do $$
begin
  if to_regprocedure('public.service_get_professional_identity()') is not null then
    execute 'revoke all on function public.service_get_professional_identity() from public, anon, authenticated';
    execute 'grant execute on function public.service_get_professional_identity() to service_role';
  end if;

  if to_regprocedure('public.service_get_professional_signature()') is not null then
    execute 'revoke all on function public.service_get_professional_signature() from public, anon, authenticated';
    execute 'grant execute on function public.service_get_professional_signature() to service_role';
  end if;

  if to_regprocedure('public.google_calendar_secret_get(text)') is not null then
    execute 'revoke all on function public.google_calendar_secret_get(text) from public, anon, authenticated';
    execute 'grant execute on function public.google_calendar_secret_get(text) to service_role';
  end if;

  if to_regprocedure('public.google_calendar_secret_set(text,text,text)') is not null then
    execute 'revoke all on function public.google_calendar_secret_set(text,text,text) from public, anon, authenticated';
    execute 'grant execute on function public.google_calendar_secret_set(text,text,text) to service_role';
  end if;
end $$;

-- Funções exclusivas de trigger não devem ficar expostas como RPC.
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and format_type(p.prorettype, null) in ('trigger','event_trigger')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.fn);
  end loop;
end $$;

-- Segredos independentes para assinatura de links e rotinas internas.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'cme_agenda_ics_hmac_secret') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(48), 'hex'),
      'cme_agenda_ics_hmac_secret',
      'Segredo exclusivo para assinatura HMAC dos links ICS da agenda'
    );
  end if;

  if not exists (select 1 from vault.secrets where name = 'cme_cleanup_expired_assets_token') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(48), 'hex'),
      'cme_cleanup_expired_assets_token',
      'Token exclusivo para autorizar a rotina automática de limpeza de ativos expirados'
    );
  end if;
end $$;

create or replace function public.service_internal_secret_get(p_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_secret text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'not authorized';
  end if;

  if p_name not in ('cme_agenda_ics_hmac_secret','cme_cleanup_expired_assets_token') then
    raise exception 'invalid secret name';
  end if;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = p_name
  limit 1;

  if nullif(v_secret, '') is null then
    raise exception 'secret not configured';
  end if;

  return v_secret;
end
$function$;

revoke all on function public.service_internal_secret_get(text) from public, anon, authenticated;
grant execute on function public.service_internal_secret_get(text) to service_role;
