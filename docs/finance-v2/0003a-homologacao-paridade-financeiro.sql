-- Exclusivo homologação: três colunas já existentes na produção, faltantes no ambiente de testes.
-- A tabela financeiro de homologação não possuía linhas nesta conferência.
alter table public.financeiro
 add column if not exists cliente_id uuid references public.clientes(id),
 add column if not exists contract_id uuid references public.contratos(id),
 add column if not exists client_request_id uuid;
create unique index if not exists financeiro_client_request_id_hml_idx
 on public.financeiro(client_request_id) where client_request_id is not null;
