-- =====================================================
-- CAMILA MARTINS ENGENHARIA
-- ESTRUTURA COMPLETA SUPABASE
-- PARTE 1/4
-- =====================================================


-- EXTENSÃO UUID

create extension if not exists "uuid-ossp";



-- =====================================================
-- CLIENTES
-- =====================================================


create table if not exists public.clientes (

    id uuid primary key default uuid_generate_v4(),

    nome text not null,

    cpf_cnpj text,

    telefone text,

    email text,

    endereco text,

    cidade text,

    estado text,

    cep text,

    status text default 'ativo',

    observacoes text,

    created_at timestamp with time zone default now()

);



-- =====================================================
-- PROJETOS
-- =====================================================


create table if not exists public.projetos (

    id uuid primary key default uuid_generate_v4(),

    cliente_id uuid references public.clientes(id)
    on delete cascade,

    nome text not null,

    tipo text,

    status text default 'em_andamento',

    descricao text,

    created_at timestamp with time zone default now()

);



-- =====================================================
-- DOCUMENTOS
-- =====================================================


create table if not exists public.documentos (

    id uuid primary key default uuid_generate_v4(),

    cliente_id uuid references public.clientes(id)
    on delete cascade,


    projeto_id uuid references public.projetos(id)
    on delete cascade,


    nome text,

    arquivo text,

    tipo text,

    created_at timestamp with time zone default now()

);



-- =====================================================
-- FOTOS
-- =====================================================


create table if not exists public.fotos (

    id uuid primary key default uuid_generate_v4(),


    cliente_id uuid references public.clientes(id)
    on delete cascade,


    projeto_id uuid references public.projetos(id)
    on delete cascade,


    nome text,

    arquivo text,

    descricao text,

    created_at timestamp with time zone default now()

);
-- =====================================================
-- BIBLIOTECA
-- =====================================================


create table if not exists public.biblioteca (

    id uuid primary key default uuid_generate_v4(),

    nome text,

    categoria text,

    arquivo text,

    tipo text,

    descricao text,

    created_at timestamp with time zone default now()

);




-- =====================================================
-- CRONOGRAMA
-- =====================================================


create table if not exists public.cronograma (

    id uuid primary key default uuid_generate_v4(),


    projeto_id uuid references public.projetos(id)
    on delete cascade,


    etapa text,


    data_inicio date,


    data_fim date,


    status text default 'pendente',


    created_at timestamp with time zone default now()

);




-- =====================================================
-- FINANCEIRO
-- =====================================================


create table if not exists public.financeiro (

    id uuid primary key default uuid_generate_v4(),


    projeto_id uuid references public.projetos(id)
    on delete cascade,


    descricao text,


    tipo text,


    valor numeric(12,2),


    data date,


    created_at timestamp with time zone default now()

);




-- =====================================================
-- AGENDA
-- =====================================================


create table if not exists public.agenda (

    id uuid primary key default uuid_generate_v4(),


    titulo text,


    descricao text,


    data date,


    horario time,


    created_at timestamp with time zone default now()

);
-- =====================================================
-- CONFIGURAÇÕES
-- =====================================================


create table if not exists public.configuracoes (

    id uuid primary key default uuid_generate_v4(),

    nome_empresa text,

    logo text,

    telefone text,

    email text,

    endereco text,

    created_at timestamp with time zone default now()

);




-- =====================================================
-- ATIVAR RLS
-- =====================================================


alter table public.clientes enable row level security;

alter table public.projetos enable row level security;

alter table public.documentos enable row level security;

alter table public.fotos enable row level security;

alter table public.biblioteca enable row level security;

alter table public.cronograma enable row level security;

alter table public.financeiro enable row level security;

alter table public.agenda enable row level security;

alter table public.configuracoes enable row level security;




-- =====================================================
-- POLICIES - USUÁRIO AUTENTICADO
-- =====================================================


create policy "usuarios autenticados clientes"
on public.clientes
for all
to authenticated
using (true)
with check (true);



create policy "usuarios autenticados projetos"
on public.projetos
for all
to authenticated
using (true)
with check (true);



create policy "usuarios autenticados documentos"
on public.documentos
for all
to authenticated
using (true)
with check (true);



create policy "usuarios autenticados fotos"
on public.fotos
for all
to authenticated
using (true)
with check (true);



create policy "usuarios autenticados biblioteca"
on public.biblioteca
for all
to authenticated
using (true)
with check (true);
-- =====================================================
-- POLICIES RESTANTES
-- =====================================================


create policy "usuarios autenticados cronograma"
on public.cronograma
for all
to authenticated
using (true)
with check (true);



create policy "usuarios autenticados financeiro"
on public.financeiro
for all
to authenticated
using (true)
with check (true);



create policy "usuarios autenticados agenda"
on public.agenda
for all
to authenticated
using (true)
with check (true);



create policy "usuarios autenticados configuracoes"
on public.configuracoes
for all
to authenticated
using (true)
with check (true);




-- =====================================================
-- STORAGE BUCKETS
-- =====================================================


insert into storage.buckets
(id, name, public)


values

('documentos', 'documentos', true),

('fotos', 'fotos', true),

('biblioteca', 'biblioteca', true)


on conflict (id) do nothing;




-- =====================================================
-- STORAGE POLICIES
-- =====================================================


create policy "usuarios autenticados upload documentos"
on storage.objects
for insert
to authenticated
with check (
bucket_id = 'documentos'
);



create policy "usuarios autenticados visualizar documentos"
on storage.objects
for select
to authenticated
using (
bucket_id = 'documentos'
);



create policy "usuarios autenticados upload fotos"
on storage.objects
for insert
to authenticated
with check (
bucket_id = 'fotos'
);



create policy "usuarios autenticados visualizar fotos"
on storage.objects
for select
to authenticated
using (
bucket_id = 'fotos'
);



create policy "usuarios autenticados upload biblioteca"
on storage.objects
for insert
to authenticated
with check (
bucket_id = 'biblioteca'
);



create policy "usuarios autenticados visualizar biblioteca"
on storage.objects
for select
to authenticated
using (
bucket_id = 'biblioteca'
);
