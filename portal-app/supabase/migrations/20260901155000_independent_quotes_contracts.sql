-- ORC e CON passam a ser fluxos independentes, preservando registros legados.
alter table public.commercial_records add column if not exists record_kind text not null default 'orcamento';
alter table public.commercial_records add column if not exists source_mode text not null default 'manual';
create table if not exists public.commercial_contract_quote_links (
  contract_record_id uuid not null references public.commercial_records(id) on delete cascade,
  quote_record_id uuid not null references public.commercial_records(id) on delete restrict,
  created_at timestamptz not null default now(), created_by uuid not null default auth.uid(),
  primary key(contract_record_id,quote_record_id), check(contract_record_id<>quote_record_id)
);
alter table public.commercial_contract_quote_links enable row level security;
create policy "admin_manage_commercial_contract_quote_links" on public.commercial_contract_quote_links for all to authenticated using(public.is_portal_admin()) with check(public.is_portal_admin());
create index if not exists idx_commercial_records_record_kind_created on public.commercial_records(record_kind,created_at desc);
create index if not exists idx_commercial_contract_quote_links_quote on public.commercial_contract_quote_links(quote_record_id);
-- As funções admin_create_independent_contract e admin_convert_commercial_record são instaladas pela migração aplicada no ambiente e mantêm CON independente, vínculo opcional 0..N ORCs e formalização somente a partir de um registro contratual.
