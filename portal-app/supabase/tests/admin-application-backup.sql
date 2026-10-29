-- Privileged test runner only. All claims/role changes are rolled back.
begin;
do $$
declare admin_id uuid; packet jsonb; denied boolean; entry record; actual_count bigint;
begin
  if has_function_privilege('anon','public.admin_export_application_backup()','execute') then
    raise exception 'Anonymous role must not execute exports';
  end if;
  select user_id into admin_id from public.pdf_admins limit 1;
  if admin_id is null then raise exception 'Admin fixture unavailable'; end if;
  perform set_config('request.jwt.claims','{}',true);
  denied:=false;
  begin perform public.admin_export_application_backup(); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Missing identity must fail'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','role','authenticated')::text,true);
  denied:=false;
  begin perform public.admin_export_application_backup(); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Non-admin identity must fail'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  packet:=public.admin_export_application_backup();
  if packet->>'version'<>'3' or not ((packet->'tables') ? 'payment_receipts') then raise exception 'Incomplete export'; end if;
  if (packet->'tables') ?| array['client_email_queue','prospect_access_links','app_push_tokens','google_calendar_oauth_states'] then raise exception 'Secret-bearing tables included'; end if;
  execute 'reset role';
  for entry in select key,value from jsonb_each(packet->'tables') loop
    execute format('select count(*) from public.%I',entry.key) into actual_count;
    if jsonb_array_length(entry.value)<>actual_count or (packet->'counts'->>entry.key)::bigint<>actual_count then raise exception 'Incomplete table: %',entry.key; end if;
  end loop;
end $$;
rollback;
