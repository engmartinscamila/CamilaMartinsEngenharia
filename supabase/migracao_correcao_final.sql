/*
==========================================================
CAMILA MARTINS ENGENHARIA
MIGRAÇÃO FINAL DO SUPABASE

Execute este arquivo inteiro no SQL Editor do Supabase.
As alterações são executadas em uma única transação.
==========================================================
*/

begin;

-- ========================================================
-- 1. REMOVER POLÍTICAS ANTIGAS E DUPLICADAS
-- ========================================================

do $$
declare
    politica record;
begin
    for politica in
        select schemaname, tablename, policyname
        from pg_policies
        where schemaname = 'public'
          and tablename = any(array[
              'agenda',
              'biblioteca',
              'clientes',
              'configuracoes',
              'cronograma',
              'documentos',
              'financeiro',
              'fotos',
              'projetos',
              'solicitacoes',
              'usuarios'
          ])
    loop
        execute format(
            'drop policy if exists %I on %I.%I',
            politica.policyname,
            politica.schemaname,
            politica.tablename
        );
    end loop;

    for politica in
        select schemaname, tablename, policyname
        from pg_policies
        where schemaname = 'storage'
          and tablename = 'objects'
    loop
        execute format(
            'drop policy if exists %I on %I.%I',
            politica.policyname,
            politica.schemaname,
            politica.tablename
        );
    end loop;
end
$$;

-- ========================================================
-- 2. ALINHAR AS COLUNAS AO SITE
-- ========================================================

alter table public.clientes
    add column if not exists auth_id uuid;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'clientes_auth_id_fkey'
          and conrelid = 'public.clientes'::regclass
    ) then
        alter table public.clientes
            add constraint clientes_auth_id_fkey
            foreign key (auth_id)
            references auth.users(id)
            on delete set null;
    end if;
end
$$;

create unique index if not exists clientes_auth_id_unico
    on public.clientes(auth_id)
    where auth_id is not null;

create unique index if not exists clientes_email_unico
    on public.clientes(lower(email))
    where email is not null and btrim(email) <> '';

alter table public.projetos
    add column if not exists data_inicio date,
    add column if not exists data_fim date;

alter table public.documentos
    add column if not exists descricao text;

alter table public.agenda
    add column if not exists tipo text default 'reuniao';

alter table public.financeiro
    add column if not exists observacoes text;

alter table public.configuracoes
    add column if not exists cnpj text,
    add column if not exists crea text,
    add column if not exists cidade text,
    add column if not exists estado text,
    add column if not exists descricao text,
    add column if not exists tema text,
    add column if not exists cor_principal text,
    add column if not exists notificacoes boolean default true;

alter table public.cronograma
    alter column created_at set default now(),
    alter column status set default 'Pendente';

alter table public.solicitacoes
    alter column created_at set default now(),
    alter column status set default 'Aberta';

alter table public.cronograma
    drop constraint if exists cronograma_cliente_id_fkey,
    drop constraint if exists cronograma_projeto_id_fkey;

alter table public.solicitacoes
    drop constraint if exists solicitacoes_cliente_id_fkey,
    drop constraint if exists solicitacoes_projeto_id_fkey;

-- As tabelas estavam vazias quando foram auditadas. A trava
-- abaixo impede qualquer conversão que possa apagar vínculos.
do $$
declare
    tipo_coluna text;
begin
    select data_type
      into tipo_coluna
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'cronograma'
       and column_name = 'cliente_id';

    if tipo_coluna <> 'uuid' then
        if exists (
            select 1
            from public.cronograma
            where cliente_id is not null
        ) then
            raise exception
                'A migração foi interrompida: cronograma.cliente_id possui dados.';
        end if;

        execute
            'alter table public.cronograma
             alter column cliente_id drop default,
             alter column cliente_id type uuid using null::uuid';
    end if;

    select data_type
      into tipo_coluna
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'cronograma'
       and column_name = 'projeto_id';

    if tipo_coluna <> 'uuid' then
        if exists (
            select 1
            from public.cronograma
            where projeto_id is not null
        ) then
            raise exception
                'A migração foi interrompida: cronograma.projeto_id possui dados.';
        end if;

        execute
            'alter table public.cronograma
             alter column projeto_id drop default,
             alter column projeto_id type uuid using null::uuid';
    end if;

    select data_type
      into tipo_coluna
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'solicitacoes'
       and column_name = 'cliente_id';

    if tipo_coluna <> 'uuid' then
        if exists (
            select 1
            from public.solicitacoes
            where cliente_id is not null
        ) then
            raise exception
                'A migração foi interrompida: solicitacoes.cliente_id possui dados.';
        end if;

        execute
            'alter table public.solicitacoes
             alter column cliente_id drop default,
             alter column cliente_id type uuid using null::uuid';
    end if;

    select data_type
      into tipo_coluna
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'solicitacoes'
       and column_name = 'projeto_id';

    if tipo_coluna <> 'uuid' then
        if exists (
            select 1
            from public.solicitacoes
            where projeto_id is not null
        ) then
            raise exception
                'A migração foi interrompida: solicitacoes.projeto_id possui dados.';
        end if;

        execute
            'alter table public.solicitacoes
             alter column projeto_id drop default,
             alter column projeto_id type uuid using null::uuid';
    end if;
end
$$;

alter table public.cronograma
    alter column cliente_id drop default,
    alter column projeto_id drop default;

alter table public.solicitacoes
    alter column cliente_id drop default,
    alter column projeto_id drop default;

alter table public.cronograma
    add constraint cronograma_cliente_id_fkey
        foreign key (cliente_id)
        references public.clientes(id)
        on delete cascade,
    add constraint cronograma_projeto_id_fkey
        foreign key (projeto_id)
        references public.projetos(id)
        on delete cascade;

alter table public.solicitacoes
    add constraint solicitacoes_cliente_id_fkey
        foreign key (cliente_id)
        references public.clientes(id)
        on delete cascade,
    add constraint solicitacoes_projeto_id_fkey
        foreign key (projeto_id)
        references public.projetos(id)
        on delete cascade;

-- Garantir IDs automáticos nas tabelas bigint.
do $$
declare
    identidade text;
    padrao text;
begin
    select is_identity, column_default
      into identidade, padrao
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'biblioteca'
       and column_name = 'id';

    if identidade = 'NO' and padrao is null then
        execute
            'alter table public.biblioteca
             alter column id add generated by default as identity';
    end if;

    select is_identity, column_default
      into identidade, padrao
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'solicitacoes'
       and column_name = 'id';

    if identidade = 'NO' and padrao is null then
        execute
            'alter table public.solicitacoes
             alter column id add generated by default as identity';
    end if;
end
$$;

create index if not exists projetos_cliente_id_idx
    on public.projetos(cliente_id);
create index if not exists documentos_cliente_id_idx
    on public.documentos(cliente_id);
create index if not exists documentos_projeto_id_idx
    on public.documentos(projeto_id);
create index if not exists fotos_cliente_id_idx
    on public.fotos(cliente_id);
create index if not exists fotos_projeto_id_idx
    on public.fotos(projeto_id);
create index if not exists cronograma_cliente_id_idx
    on public.cronograma(cliente_id);
create index if not exists cronograma_projeto_id_idx
    on public.cronograma(projeto_id);
create index if not exists solicitacoes_cliente_id_idx
    on public.solicitacoes(cliente_id);
create index if not exists solicitacoes_projeto_id_idx
    on public.solicitacoes(projeto_id);

-- ========================================================
-- 3. FUNÇÕES SEGURAS DE IDENTIFICAÇÃO
-- ========================================================

drop function if exists public.vincular_cliente_atual();
drop function if exists public.cliente_atual_id();
drop function if exists public.eh_administradora();

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.eh_administradora()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select (select auth.uid()) =
        '5c9d7a0e-0495-4e96-8561-1d7f220be154'::uuid;
$$;

create or replace function private.cliente_atual_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
    select id
    from public.clientes
    where auth_id = (select auth.uid())
    limit 1;
$$;

/*
O acesso continua exclusivo, mas o cliente pode criar a própria senha:
1. A administradora cadastra o cliente no painel.
2. O cliente usa o mesmo e-mail no primeiro acesso, ou a administradora
   convida esse e-mail pelo Authentication.
3. Os gatilhos abaixo vinculam os cadastros e rejeitam e-mails que não
   tenham sido previamente autorizados na tabela clientes.
*/
create or replace function private.vincular_cliente_por_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    cliente_vinculado uuid;
begin
    if new.id =
       '5c9d7a0e-0495-4e96-8561-1d7f220be154'::uuid then
        return new;
    end if;

    if new.email is null then
        raise exception 'Cadastro sem e-mail não autorizado.';
    end if;

    select id
      into cliente_vinculado
      from public.clientes
     where auth_id = new.id
     limit 1;

    if cliente_vinculado is not null then
        update public.clientes
           set email = new.email
         where id = cliente_vinculado;

        return new;
    end if;

    update public.clientes
       set auth_id = new.id
     where auth_id is null
       and lower(email) = lower(new.email)
    returning id into cliente_vinculado;

    if cliente_vinculado is null then
        raise exception
            'E-mail não autorizado. Cadastre o cliente antes de criar o acesso.';
    end if;

    return new;
end;
$$;

create or replace function private.preencher_cliente_auth_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if new.auth_id is null and new.email is not null then
        select id
          into new.auth_id
         from auth.users
         where lower(email) = lower(new.email)
           and id <>
               '5c9d7a0e-0495-4e96-8561-1d7f220be154'::uuid
         limit 1;
    end if;

    return new;
end;
$$;

drop trigger if exists vincular_cliente_por_auth
on auth.users;

create trigger vincular_cliente_por_auth
after insert or update of email
on auth.users
for each row
execute function private.vincular_cliente_por_auth();

drop trigger if exists preencher_cliente_auth_id
on public.clientes;

create trigger preencher_cliente_auth_id
before insert or update of email
on public.clientes
for each row
execute function private.preencher_cliente_auth_id();

-- Vincular também os cadastros que já existiam antes da migração.
update public.clientes as cliente
   set auth_id = usuario.id
  from auth.users as usuario
 where cliente.auth_id is null
   and cliente.email is not null
   and usuario.id <>
       '5c9d7a0e-0495-4e96-8561-1d7f220be154'::uuid
   and lower(cliente.email) = lower(usuario.email);

revoke all on function private.eh_administradora() from public, anon;
revoke all on function private.cliente_atual_id() from public, anon;
revoke all on function private.vincular_cliente_por_auth() from public, anon;
revoke all on function private.preencher_cliente_auth_id() from public, anon;

grant execute on function private.eh_administradora() to authenticated;
grant execute on function private.cliente_atual_id() to authenticated;

-- ========================================================
-- 4. RLS DAS TABELAS
-- ========================================================

alter table public.agenda enable row level security;
alter table public.biblioteca enable row level security;
alter table public.clientes enable row level security;
alter table public.configuracoes enable row level security;
alter table public.cronograma enable row level security;
alter table public.documentos enable row level security;
alter table public.financeiro enable row level security;
alter table public.fotos enable row level security;
alter table public.projetos enable row level security;
alter table public.solicitacoes enable row level security;
alter table public.usuarios enable row level security;

create policy admin_total_agenda
on public.agenda for all to authenticated
using (private.eh_administradora())
with check (private.eh_administradora());

create policy admin_total_biblioteca
on public.biblioteca for all to authenticated
using (private.eh_administradora())
with check (private.eh_administradora());

create policy admin_total_clientes
on public.clientes for all to authenticated
using (private.eh_administradora())
with check (private.eh_administradora());

create policy admin_total_configuracoes
on public.configuracoes for all to authenticated
using (private.eh_administradora())
with check (private.eh_administradora());

create policy admin_total_cronograma
on public.cronograma for all to authenticated
using (private.eh_administradora())
with check (private.eh_administradora());

create policy admin_total_documentos
on public.documentos for all to authenticated
using (private.eh_administradora())
with check (private.eh_administradora());

create policy admin_total_financeiro
on public.financeiro for all to authenticated
using (private.eh_administradora())
with check (private.eh_administradora());

create policy admin_total_fotos
on public.fotos for all to authenticated
using (private.eh_administradora())
with check (private.eh_administradora());

create policy admin_total_projetos
on public.projetos for all to authenticated
using (private.eh_administradora())
with check (private.eh_administradora());

create policy admin_total_solicitacoes
on public.solicitacoes for all to authenticated
using (private.eh_administradora())
with check (private.eh_administradora());

create policy admin_total_usuarios
on public.usuarios for all to authenticated
using (private.eh_administradora())
with check (private.eh_administradora());

create policy cliente_le_proprio_cadastro
on public.clientes for select to authenticated
using (auth_id = auth.uid());

create policy cliente_le_proprios_projetos
on public.projetos for select to authenticated
using (cliente_id = private.cliente_atual_id());

create policy cliente_le_proprios_documentos
on public.documentos for select to authenticated
using (cliente_id = private.cliente_atual_id());

create policy cliente_le_proprias_fotos
on public.fotos for select to authenticated
using (cliente_id = private.cliente_atual_id());

create policy cliente_le_proprio_cronograma
on public.cronograma for select to authenticated
using (cliente_id = private.cliente_atual_id());

create policy cliente_le_solicitacoes
on public.solicitacoes for select to authenticated
using (cliente_id = private.cliente_atual_id());

create policy cliente_cria_solicitacao
on public.solicitacoes for insert to authenticated
with check (
    cliente_id = private.cliente_atual_id()
    and (
        projeto_id is null
        or exists (
            select 1
            from public.projetos
            where projetos.id = solicitacoes.projeto_id
              and projetos.cliente_id = private.cliente_atual_id()
        )
    )
);

create policy clientes_leem_biblioteca
on public.biblioteca for select to authenticated
using (private.cliente_atual_id() is not null);

revoke all on table public.agenda from anon;
revoke all on table public.biblioteca from anon;
revoke all on table public.clientes from anon;
revoke all on table public.configuracoes from anon;
revoke all on table public.cronograma from anon;
revoke all on table public.documentos from anon;
revoke all on table public.financeiro from anon;
revoke all on table public.fotos from anon;
revoke all on table public.projetos from anon;
revoke all on table public.solicitacoes from anon;
revoke all on table public.usuarios from anon;

grant select, insert, update, delete on table public.agenda to authenticated;
grant select, insert, update, delete on table public.biblioteca to authenticated;
grant select, insert, update, delete on table public.clientes to authenticated;
grant select, insert, update, delete on table public.configuracoes to authenticated;
grant select, insert, update, delete on table public.cronograma to authenticated;
grant select, insert, update, delete on table public.documentos to authenticated;
grant select, insert, update, delete on table public.financeiro to authenticated;
grant select, insert, update, delete on table public.fotos to authenticated;
grant select, insert, update, delete on table public.projetos to authenticated;
grant select, insert, update, delete on table public.solicitacoes to authenticated;
grant select, insert, update, delete on table public.usuarios to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ========================================================
-- 5. STORAGE PRIVADO E SEM POLÍTICAS DUPLICADAS
-- ========================================================

update storage.buckets
   set public = false
 where id in ('documentos', 'fotos', 'biblioteca');

create policy admin_total_storage
on storage.objects for all to authenticated
using (private.eh_administradora())
with check (private.eh_administradora());

create policy clientes_leem_biblioteca_storage
on storage.objects for select to authenticated
using (
    bucket_id = 'biblioteca'
    and private.cliente_atual_id() is not null
);

create policy cliente_le_documentos_storage
on storage.objects for select to authenticated
using (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] =
        private.cliente_atual_id()::text
);

create policy cliente_le_fotos_storage
on storage.objects for select to authenticated
using (
    bucket_id = 'fotos'
    and (storage.foldername(name))[1] =
        private.cliente_atual_id()::text
);

commit;

-- ========================================================
-- VERIFICAÇÃO
-- ========================================================

select
    schemaname,
    tablename,
    policyname,
    cmd
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;
