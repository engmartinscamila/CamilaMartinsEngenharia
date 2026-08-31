-- Notificações push gratuitas para o Portal do Cliente.
-- Firebase Cloud Messaging (FCM) substitui o canal SMS pago.

create table if not exists public.push_dispositivos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  auth_user_id uuid not null,
  token text not null unique,
  plataforma text,
  user_agent text,
  ativo boolean not null default true,
  ultimo_uso timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_dispositivos_cliente_ativo_idx
  on public.push_dispositivos (cliente_id, ativo);
create index if not exists push_dispositivos_auth_idx
  on public.push_dispositivos (auth_user_id);

alter table public.push_dispositivos enable row level security;

drop policy if exists "cliente_le_push_proprio" on public.push_dispositivos;
create policy "cliente_le_push_proprio"
on public.push_dispositivos for select to authenticated
using (
  auth_user_id = (select auth.uid())
  and exists (
    select 1 from public.clientes c
    where c.id = cliente_id
      and c.auth_id = (select auth.uid())
  )
);

drop policy if exists "cliente_insere_push_proprio" on public.push_dispositivos;
create policy "cliente_insere_push_proprio"
on public.push_dispositivos for insert to authenticated
with check (
  auth_user_id = (select auth.uid())
  and exists (
    select 1 from public.clientes c
    where c.id = cliente_id
      and c.auth_id = (select auth.uid())
  )
);

drop policy if exists "cliente_atualiza_push_proprio" on public.push_dispositivos;
create policy "cliente_atualiza_push_proprio"
on public.push_dispositivos for update to authenticated
using (
  auth_user_id = (select auth.uid())
  and exists (
    select 1 from public.clientes c
    where c.id = cliente_id
      and c.auth_id = (select auth.uid())
  )
)
with check (
  auth_user_id = (select auth.uid())
  and exists (
    select 1 from public.clientes c
    where c.id = cliente_id
      and c.auth_id = (select auth.uid())
  )
);

drop policy if exists "cliente_remove_push_proprio" on public.push_dispositivos;
create policy "cliente_remove_push_proprio"
on public.push_dispositivos for delete to authenticated
using (
  auth_user_id = (select auth.uid())
  and exists (
    select 1 from public.clientes c
    where c.id = cliente_id
      and c.auth_id = (select auth.uid())
  )
);

drop policy if exists "admin_le_push" on public.push_dispositivos;
create policy "admin_le_push"
on public.push_dispositivos for select to authenticated
using (
  exists (
    select 1 from public.pdf_admins p
    where p.user_id = (select auth.uid())
  )
);

create or replace function public.registrar_push_token(
  p_cliente_id uuid,
  p_token text,
  p_plataforma text default null,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Sessão ausente';
  end if;

  if not exists (
    select 1 from public.clientes c
    where c.id = p_cliente_id
      and c.auth_id = v_uid
  ) then
    raise exception 'Cliente não autorizado';
  end if;

  if p_token is null or length(trim(p_token)) < 20 then
    raise exception 'Token inválido';
  end if;

  delete from public.push_dispositivos where token = p_token;

  insert into public.push_dispositivos (
    cliente_id, auth_user_id, token, plataforma, user_agent,
    ativo, ultimo_uso, updated_at
  )
  values (
    p_cliente_id, v_uid, p_token,
    nullif(left(coalesce(p_plataforma,''),120),''),
    nullif(left(coalesce(p_user_agent,''),500),''),
    true, now(), now()
  );
end;
$$;

revoke all on function public.registrar_push_token(uuid,text,text,text) from public;
grant execute on function public.registrar_push_token(uuid,text,text,text) to authenticated;

create or replace function public.desativar_push_token(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.push_dispositivos
  set ativo=false, updated_at=now()
  where token=p_token
    and auth_user_id=auth.uid();
$$;

revoke all on function public.desativar_push_token(text) from public;
grant execute on function public.desativar_push_token(text) to authenticated;
