-- Existing account balances keep an unknown reference date until the admin
-- confirms it. Never invent historical balances or rewrite existing entries.
alter table public.financial_accounts add column if not exists opening_balance_date date;
alter table public.financeiro add column if not exists client_request_id uuid;
create unique index if not exists financeiro_client_request_id_unique
  on public.financeiro(client_request_id) where client_request_id is not null;
