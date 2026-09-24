-- Finalização administrativa: aprovações guiadas, equipe do diário e taxa horária configurável.
-- A migração é aditiva e preserva dados/fluxos existentes.

alter table public.aprovacoes
  add column if not exists approval_object text,
  add column if not exists related_document_id uuid references public.documentos(id) on delete set null;

create index if not exists aprovacoes_related_document_idx
  on public.aprovacoes (related_document_id)
  where related_document_id is not null;

alter table public.work_diary_entries
  add column if not exists team_breakdown jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'work_diary_team_breakdown_array'
       and conrelid = 'public.work_diary_entries'::regclass
  ) then
    alter table public.work_diary_entries
      add constraint work_diary_team_breakdown_array
      check (jsonb_typeof(team_breakdown) = 'array');
  end if;
end
$$;

create table if not exists public.admin_financial_preferences (
  singleton_id smallint primary key default 1 check (singleton_id = 1),
  default_hourly_rate numeric(12,2),
  effective_from date,
  reference_note text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint admin_financial_preferences_rate_nonnegative
    check (default_hourly_rate is null or default_hourly_rate >= 0)
);

alter table public.admin_financial_preferences enable row level security;
alter table public.admin_financial_preferences force row level security;

drop policy if exists admin_financial_preferences_select on public.admin_financial_preferences;
create policy admin_financial_preferences_select
on public.admin_financial_preferences
for select
to authenticated
using ((select public.is_portal_admin()));

drop policy if exists admin_financial_preferences_insert on public.admin_financial_preferences;
create policy admin_financial_preferences_insert
on public.admin_financial_preferences
for insert
to authenticated
with check ((select public.is_portal_admin()));

drop policy if exists admin_financial_preferences_update on public.admin_financial_preferences;
create policy admin_financial_preferences_update
on public.admin_financial_preferences
for update
to authenticated
using ((select public.is_portal_admin()))
with check ((select public.is_portal_admin()));

revoke all on table public.admin_financial_preferences from anon;
grant select, insert, update on table public.admin_financial_preferences to authenticated;

comment on table public.admin_financial_preferences is
  'Preferências financeiras administrativas. A taxa horária é informada pela administradora e nunca inferida pelo sistema.';
comment on column public.admin_financial_preferences.default_hourly_rate is
  'Referência padrão configurável para novos apontamentos; pode ser alterada em cada lançamento.';
comment on column public.work_diary_entries.team_breakdown is
  'Detalhamento opcional da equipe no formato [{role, quantity}], preservando team_count como total.';
