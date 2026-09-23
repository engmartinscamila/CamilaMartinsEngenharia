-- Rate limiting complementar para impedir abuso da recuperação de senha por rotação de e-mails.
-- A chave recebida já é SHA-256 de um fingerprint de rede; nenhum IP é persistido em claro.
create or replace function public.service_consume_password_link_network_rate_limit(p_key_hash text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  accepted boolean := false;
  requested_at timestamptz := clock_timestamp();
begin
  if p_key_hash is null or p_key_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid rate limit key' using errcode='22023';
  end if;

  insert into public.client_password_link_rate_limits as limits
    (key_hash,window_started_at,last_requested_at,request_count)
  values (p_key_hash,requested_at,requested_at,1)
  on conflict (key_hash) do update set
    window_started_at = case
      when limits.window_started_at <= requested_at - interval '1 hour'
      then requested_at else limits.window_started_at end,
    last_requested_at = requested_at,
    request_count = case
      when limits.window_started_at <= requested_at - interval '1 hour'
      then 1 else limits.request_count + 1 end
  where limits.last_requested_at <= requested_at - interval '10 seconds'
    and (
      limits.window_started_at <= requested_at - interval '1 hour'
      or limits.request_count < 30
    )
  returning true into accepted;

  return coalesce(accepted,false);
end;
$$;

revoke all on function public.service_consume_password_link_network_rate_limit(text)
from public, anon, authenticated;
grant execute on function public.service_consume_password_link_network_rate_limit(text)
to service_role;
