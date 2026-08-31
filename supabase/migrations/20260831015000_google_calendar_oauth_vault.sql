
create table if not exists public.google_calendar_oauth_states (
  id uuid primary key default gen_random_uuid(),
  state text not null unique,
  user_id uuid not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.google_calendar_oauth_states enable row level security;

create index if not exists google_calendar_oauth_states_expires_idx
  on public.google_calendar_oauth_states (expires_at);

create or replace function public.google_calendar_secret_get(p_name text)
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'not authorized';
  end if;

  select decrypted_secret
    into v_secret
  from vault.decrypted_secrets
  where name = p_name
  order by created_at desc
  limit 1;

  return v_secret;
end;
$$;

create or replace function public.google_calendar_secret_set(
  p_name text,
  p_value text,
  p_description text default null
)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'not authorized';
  end if;

  if coalesce(trim(p_name), '') = '' or coalesce(p_value, '') = '' then
    raise exception 'invalid secret';
  end if;

  select id
    into v_id
  from vault.secrets
  where name = p_name
  order by created_at desc
  limit 1;

  if v_id is null then
    perform vault.create_secret(p_value, p_name, p_description, null);
  else
    perform vault.update_secret(v_id, p_value, p_name, p_description, null);
  end if;
end;
$$;

revoke all on function public.google_calendar_secret_get(text) from public, anon, authenticated;
revoke all on function public.google_calendar_secret_set(text,text,text) from public, anon, authenticated;
grant execute on function public.google_calendar_secret_get(text) to service_role;
grant execute on function public.google_calendar_secret_set(text,text,text) to service_role;
