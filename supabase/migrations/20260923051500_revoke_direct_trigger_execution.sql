-- Funções de trigger não precisam ser invocadas diretamente pela API.
-- Revoga EXECUTE das roles expostas sem remover os gatilhos existentes.
-- Compatível com ambientes onde parte dessas funções não existe.

do $$
declare
  r record;
  v_missing text[];
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname in (
        'enforce_project_contract_client','notify_agenda_event','notify_approval_event',
        'notify_content_created','notify_project_update','notify_request_created',
        'notify_request_reply','notify_schedule_event','portal_audit_change'
      )
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.signature);
  end loop;

  select array_agg(p.oid::regprocedure::text order by p.oid::regprocedure::text)
  into v_missing
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname in (
      'enforce_project_contract_client','notify_agenda_event','notify_approval_event',
      'notify_content_created','notify_project_update','notify_request_created',
      'notify_request_reply','notify_schedule_event','portal_audit_change'
    )
    and has_function_privilege('authenticated',p.oid,'EXECUTE');

  if coalesce(array_length(v_missing,1),0)>0 then
    raise exception 'Funções de trigger ainda executáveis por authenticated: %',v_missing;
  end if;
end $$;
