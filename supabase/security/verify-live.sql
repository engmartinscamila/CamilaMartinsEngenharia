-- Read-only production verification. Impersonates database roles inside a
-- transaction; returns no customer names, documents, tokens or financial data.
begin read only;
do $audit$
declare t record; c record; n bigint; admin_id uuid; total_docs bigint;
begin
  if exists(select 1 from pg_class cls join pg_namespace s on s.oid=cls.relnamespace
    where s.nspname='public' and cls.relkind in ('r','p') and not cls.relrowsecurity) then
    raise exception 'FAIL: public table without RLS';
  end if;
  if exists(select 1 from storage.buckets where public) then
    raise exception 'FAIL: public Storage bucket';
  end if;
  for t in select p.oid from pg_proc p join pg_namespace s on s.oid=p.pronamespace
    where s.nspname='public' and p.proname in (
      'service_get_professional_identity','service_get_professional_signature',
      'service_internal_secret_get','google_calendar_secret_get','google_calendar_secret_set') loop
    if has_function_privilege('anon',t.oid,'execute') or has_function_privilege('authenticated',t.oid,'execute') then
      raise exception 'FAIL: server-only RPC exposed';
    end if;
  end loop;
  for t in select tablename from pg_tables where schemaname='public' loop
    execute 'set local role anon';
    perform set_config('request.jwt.claim.sub','',true);
    begin
      execute format('select count(*) from public.%I',t.tablename) into n;
      if n<>0 then raise exception 'FAIL: anonymous data access to %',t.tablename; end if;
    exception when insufficient_privilege then null;
    end;
    execute 'reset role';
  end loop;
  for c in select id,auth_id from public.clientes where auth_id is not null
    and coalesce(status,'ativo')='ativo'
    and auth_id not in(select user_id from public.pdf_admins) loop
    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub',c.auth_id::text,true);
    if public.is_portal_admin() then raise exception 'FAIL: client is administrator'; end if;
    if private.cliente_atual_id() is distinct from c.id then raise exception 'FAIL: own profile resolution'; end if;
    for t in select unnest(array['documentos','fotos','biblioteca','cronograma','solicitacoes']) as name loop
      execute format('select count(*) from public.%I where cliente_id is distinct from $1',t.name) into n using c.id;
      if n<>0 then raise exception 'FAIL: cross-client access to %',t.name; end if;
    end loop;
    select count(*) into n from public.financeiro;
    if n<>0 then raise exception 'FAIL: client financial access'; end if;
    select count(*) into n from public.documentos where (document_kind is not null or generated_at is not null)
      and not ((coalesce(client_visible,false) or coalesce(exibir_cliente,false)) and client_released_at is not null);
    if n<>0 then raise exception 'FAIL: unreleased generated document'; end if;
    execute 'reset role';
  end loop;
  select user_id into admin_id from public.pdf_admins limit 1;
  select count(*) into total_docs from public.documentos;
  if admin_id is null then raise exception 'FAIL: no administrator configured'; end if;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  if not public.is_portal_admin() then raise exception 'FAIL: administrator rejected'; end if;
  select count(*) into n from public.documentos;
  if n<>total_docs then raise exception 'FAIL: administrator document visibility'; end if;
  execute 'reset role';
end;
$audit$;
rollback;
select 'PASS: live RLS, anonymous access, client isolation, document release, private buckets and administrator access' as result;
