grant insert on table public.audit_log to authenticated;

drop policy if exists audit_log_admin_insert_app on public.audit_log;
create policy audit_log_admin_insert_app
on public.audit_log
for insert
to authenticated
with check (public.is_portal_admin());
