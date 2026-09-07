-- Keep password-recovery anti-abuse state inaccessible through the public Data API.
drop policy if exists "deny_direct_api_access" on public.client_password_link_rate_limits;

create policy "deny_direct_api_access"
on public.client_password_link_rate_limits
for all
to anon, authenticated
using (false)
with check (false);

revoke all on table public.client_password_link_rate_limits from anon, authenticated;
