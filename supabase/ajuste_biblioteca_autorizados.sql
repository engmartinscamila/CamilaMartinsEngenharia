/*
==========================================================
CAMILA MARTINS ENGENHARIA
AJUSTE COMPLEMENTAR DE SEGURANÇA

Execute este arquivo somente se a migração principal já foi
executada antes de 24/07/2026.
==========================================================
*/

begin;

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

drop policy if exists autenticados_leem_biblioteca
on public.biblioteca;

drop policy if exists clientes_leem_biblioteca
on public.biblioteca;

create policy clientes_leem_biblioteca
on public.biblioteca for select to authenticated
using (private.cliente_atual_id() is not null);

drop policy if exists autenticados_leem_biblioteca_storage
on storage.objects;

drop policy if exists clientes_leem_biblioteca_storage
on storage.objects;

create policy clientes_leem_biblioteca_storage
on storage.objects for select to authenticated
using (
    bucket_id = 'biblioteca'
    and private.cliente_atual_id() is not null
);

commit;

select
    schemaname,
    tablename,
    policyname,
    cmd
from pg_policies
where policyname in (
    'clientes_leem_biblioteca',
    'clientes_leem_biblioteca_storage'
)
order by schemaname, tablename;
