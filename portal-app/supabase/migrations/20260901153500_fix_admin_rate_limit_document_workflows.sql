create or replace function public.consume_admin_rate_limit(p_action text)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_limit integer;
  v_seconds integer;
  v_window timestamptz;
  v_attempts integer;
begin
  if not public.is_portal_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;

  case p_action
    when 'admin-invite-client' then v_limit := 10; v_seconds := 600;
    when 'admin-delete-client' then v_limit := 3; v_seconds := 3600;
    when 'admin-delete-client-preview' then v_limit := 20; v_seconds := 600;
    when 'admin-delete-client-delete' then v_limit := 3; v_seconds := 3600;

    when 'contract-document-generate' then v_limit := 60; v_seconds := 600;
    when 'contract-document-send' then v_limit := 30; v_seconds := 600;
    when 'commercial-document-orcamento' then v_limit := 60; v_seconds := 600;
    when 'commercial-document-contrato' then v_limit := 60; v_seconds := 600;
    when 'document-delivery-download' then v_limit := 90; v_seconds := 600;
    when 'document-delivery-archive' then v_limit := 60; v_seconds := 600;
    when 'commercial-lookup-cep' then v_limit := 60; v_seconds := 600;
    when 'commercial-lookup-cnpj' then v_limit := 30; v_seconds := 600;
    when 'document-archive-preview' then v_limit := 60; v_seconds := 600;
    when 'document-archive-retain' then v_limit := 60; v_seconds := 600;
    when 'document-archive-export' then v_limit := 10; v_seconds := 3600;
    when 'document-archive-purge' then v_limit := 5; v_seconds := 3600;
    when 'document-archive-restore' then v_limit := 10; v_seconds := 3600;
    else
      raise exception 'Ação de limite inválida';
  end case;

  v_window := to_timestamp(floor(extract(epoch from now()) / v_seconds) * v_seconds);

  insert into public.app_admin_rate_limits(actor_id, action, window_start, attempts)
  values ((select auth.uid()), p_action, v_window, 1)
  on conflict (actor_id, action, window_start)
  do update set attempts = public.app_admin_rate_limits.attempts + 1
  returning attempts into v_attempts;

  if v_attempts > v_limit then
    raise exception 'Limite temporário excedido';
  end if;

  delete from public.app_admin_rate_limits
  where window_start < now() - interval '2 days';

  return true;
end;
$function$;

revoke all on function public.consume_admin_rate_limit(text) from public, anon;
grant execute on function public.consume_admin_rate_limit(text) to authenticated;
