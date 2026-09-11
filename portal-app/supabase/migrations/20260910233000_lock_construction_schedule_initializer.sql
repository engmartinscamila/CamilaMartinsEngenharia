revoke execute on function public.admin_initialize_construction_schedule(uuid) from public;
revoke execute on function public.admin_initialize_construction_schedule(uuid) from anon;
grant execute on function public.admin_initialize_construction_schedule(uuid) to authenticated;
