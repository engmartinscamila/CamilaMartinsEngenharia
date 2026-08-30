-- Camila Martins Engenharia — autoria de arquivos, parceria e gestão financeira.

create schema if not exists private;

alter table public.documentos
    add column if not exists autoral boolean not null default false;

alter table public.biblioteca
    add column if not exists autoral boolean not null default false;

alter table public.clientes
    add column if not exists parceria boolean not null default false;

alter table public.projetos
    add column if not exists parceria boolean not null default false;

comment on column public.documentos.autoral is
    'Quando true, o PDF entregue ao cliente recebe cópia personalizada, rastreável e registrada.';

comment on column public.biblioteca.autoral is
    'Quando true, o PDF entregue ao cliente recebe cópia personalizada, rastreável e registrada.';

alter table public.financeiro
    add column if not exists categoria text not null default 'outros',
    add column if not exists status text not null default 'pendente',
    add column if not exists data_vencimento date,
    add column if not exists data_pagamento date,
    add column if not exists forma_pagamento text;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'financeiro_status_valido'
          and conrelid = 'public.financeiro'::regclass
    ) then
        alter table public.financeiro
            add constraint financeiro_status_valido
            check (status in ('previsto', 'pendente', 'pago', 'atrasado', 'cancelado'));
    end if;
end
$$;

create index if not exists financeiro_status_vencimento_idx
    on public.financeiro (status, data_vencimento);

create index if not exists financeiro_projeto_data_idx
    on public.financeiro (projeto_id, data desc);

create or replace function private.aplicar_parceria_cliente_no_projeto()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
    cliente_em_parceria boolean := false;
begin
    if new.cliente_id is not null then
        select coalesce(cliente.parceria, false)
          into cliente_em_parceria
          from public.clientes as cliente
         where cliente.id = new.cliente_id;
    end if;

    if cliente_em_parceria then
        new.parceria := true;
    end if;

    return new;
end;
$$;

drop trigger if exists aplicar_parceria_cliente_no_projeto on public.projetos;

create trigger aplicar_parceria_cliente_no_projeto
before insert or update of cliente_id, parceria
on public.projetos
for each row
execute function private.aplicar_parceria_cliente_no_projeto();

create table if not exists public.notificacoes_envios (
    id uuid primary key default gen_random_uuid(),
    cliente_id uuid references public.clientes(id) on delete set null,
    projeto_id uuid references public.projetos(id) on delete set null,
    tipo text not null,
    canal text not null check (canal in ('email', 'sms')),
    destino_mascarado text,
    status text not null check (status in ('enviado', 'nao_configurado', 'sem_destino', 'falhou')),
    provedor_id text,
    detalhe text,
    created_at timestamptz not null default now()
);

alter table public.notificacoes_envios enable row level security;

drop policy if exists admin_le_notificacoes_envios on public.notificacoes_envios;
create policy admin_le_notificacoes_envios
on public.notificacoes_envios
for select
to authenticated
using (
    exists (
        select 1
        from public.pdf_admins as administrador
        where administrador.user_id = (select auth.uid())
    )
);

create index if not exists notificacoes_envios_cliente_data_idx
    on public.notificacoes_envios (cliente_id, created_at desc);
