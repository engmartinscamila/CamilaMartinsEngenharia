-- Diagnóstico seguro de ativação do Web Push.
create table if not exists public.push_diagnosticos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  auth_user_id uuid not null,
  etapa text not null,
  codigo text,
  mensagem text,
  permissao text,
  navegador text,
  created_at timestamptz not null default now()
);

create index if not exists push_diagnosticos_cliente_created_idx
  on public.push_diagnosticos (cliente_id, created_at desc);

alter table public.push_diagnosticos enable row level security;

drop policy if exists "cliente_insere_diagnostico_push" on public.push_diagnosticos;
create policy "cliente_insere_diagnostico_push"
on public.push_diagnosticos for insert to authenticated
with check (
  auth_user_id = (select auth.uid())
  and exists (
    select 1 from public.clientes c
    where c.id = cliente_id
      and c.auth_id = (select auth.uid())
  )
);

drop policy if exists "admin_le_diagnostico_push" on public.push_diagnosticos;
create policy "admin_le_diagnostico_push"
on public.push_diagnosticos for select to authenticated
using (
  exists (
    select 1 from public.pdf_admins p
    where p.user_id = (select auth.uid())
  )
);

create or replace function public.registrar_push_diagnostico(
  p_cliente_id uuid,
  p_etapa text,
  p_codigo text default null,
  p_mensagem text default null,
  p_permissao text default null,
  p_navegador text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return; end if;

  if not exists (
    select 1 from public.clientes c
    where c.id = p_cliente_id and c.auth_id = v_uid
  ) then return; end if;

  insert into public.push_diagnosticos(
    cliente_id, auth_user_id, etapa, codigo, mensagem, permissao, navegador
  )
  values(
    p_cliente_id,
    v_uid,
    left(coalesce(p_etapa,'desconhecida'),80),
    nullif(left(coalesce(p_codigo,''),120),''),
    nullif(left(coalesce(p_mensagem,''),300),''),
    nullif(left(coalesce(p_permissao,''),30),''),
    nullif(left(coalesce(p_navegador,''),500),'')
  );
end;
$$;

revoke all on function public.registrar_push_diagnostico(uuid,text,text,text,text,text) from public;
grant execute on function public.registrar_push_diagnostico(uuid,text,text,text,text,text) to authenticated;
