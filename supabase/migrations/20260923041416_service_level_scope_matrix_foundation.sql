-- Fundação aditiva da matriz serviço x nível.
-- Homologada primeiro no projeto camila-martins-homologacao.
-- Não altera snapshots/documentos históricos e não ativa textos novos automaticamente.

alter table public.service_catalog
  add column if not exists aliases text[] not null default '{}'::text[],
  add column if not exists synonyms text[] not null default '{}'::text[],
  add column if not exists keywords text[] not null default '{}'::text[];

create table if not exists public.service_level_scope_catalog (
  service_code text not null references public.service_catalog(code) on update cascade on delete restrict,
  level_code text not null references public.service_level_catalog(code) on update cascade on delete restrict,
  applicable boolean not null default true,
  budget_description text,
  contract_scope text,
  annex_scope text,
  included_deliverables jsonb not null default '[]'::jsonb,
  excluded_deliverables jsonb not null default '[]'::jsonb,
  parameters jsonb not null default '[]'::jsonb,
  revisions_included integer,
  visits_included integer,
  detail_level text,
  delivery_formats jsonb not null default '[]'::jsonb,
  inherit_legacy_catalog boolean not null default true,
  review_status text not null default 'pending'
    check (review_status in ('pending','approved','rejected')),
  source_service_version integer not null,
  source_level_version integer not null,
  version integer not null default 1 check (version > 0),
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (service_code, level_code),
  check (revisions_included is null or revisions_included >= 0),
  check (visits_included is null or visits_included >= 0),
  check (jsonb_typeof(included_deliverables) = 'array'),
  check (jsonb_typeof(excluded_deliverables) = 'array'),
  check (jsonb_typeof(parameters) = 'array'),
  check (jsonb_typeof(delivery_formats) = 'array')
);

create table if not exists public.service_level_scope_versions (
  id uuid primary key default gen_random_uuid(),
  service_code text not null,
  level_code text not null,
  version integer not null check (version > 0),
  snapshot jsonb not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique(service_code, level_code, version),
  foreign key (service_code, level_code)
    references public.service_level_scope_catalog(service_code, level_code)
    on update cascade on delete restrict
);

create index if not exists service_level_scope_catalog_active_idx
  on public.service_level_scope_catalog(active, service_code, level_code);
create index if not exists service_level_scope_catalog_review_idx
  on public.service_level_scope_catalog(review_status)
  where active = true;
create index if not exists service_level_scope_versions_lookup_idx
  on public.service_level_scope_versions(service_code, level_code, version desc);

alter table public.service_level_scope_catalog enable row level security;
alter table public.service_level_scope_versions enable row level security;

drop policy if exists service_level_scope_catalog_admin_read on public.service_level_scope_catalog;
create policy service_level_scope_catalog_admin_read
  on public.service_level_scope_catalog
  for select
  to authenticated
  using (public.is_portal_admin());

drop policy if exists service_level_scope_versions_admin_read on public.service_level_scope_versions;
create policy service_level_scope_versions_admin_read
  on public.service_level_scope_versions
  for select
  to authenticated
  using (public.is_portal_admin());

revoke all on public.service_level_scope_catalog from public, anon, authenticated;
revoke all on public.service_level_scope_versions from public, anon, authenticated;
grant select on public.service_level_scope_catalog to authenticated;
grant select on public.service_level_scope_versions to authenticated;

insert into public.service_level_scope_catalog (
  service_code, level_code, applicable,
  included_deliverables, excluded_deliverables, parameters,
  revisions_included, visits_included, detail_level, delivery_formats,
  inherit_legacy_catalog, review_status,
  source_service_version, source_level_version, version, active
)
select
  s.code,
  l.code,
  s.level_applicable,
  s.deliverables,
  (s.exclusions || l.exclusions),
  '[]'::jsonb,
  s.default_revisions,
  null,
  case l.code
    when 'bronze' then 'essencial'
    when 'prata' then 'ampliado'
    when 'ouro' then 'completo'
  end,
  s.delivery_formats,
  true,
  'pending',
  s.version,
  l.version,
  1,
  true
from public.service_catalog s
cross join public.service_level_catalog l
where s.active = true and l.active = true
on conflict (service_code, level_code) do nothing;
