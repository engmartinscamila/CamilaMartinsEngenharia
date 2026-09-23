-- The recovery endpoint's deny policy and atomic limiter both require this table.
-- Existing production installations already have it; this is additive and idempotent.
create table if not exists public.client_password_link_rate_limits (
  key_hash text primary key,
  window_started_at timestamptz not null default now(),
  last_requested_at timestamptz not null default now(),
  request_count integer not null default 1
);

alter table public.client_password_link_rate_limits enable row level security;
revoke all on table public.client_password_link_rate_limits from public, anon, authenticated;
grant select, insert, update on table public.client_password_link_rate_limits to service_role;
