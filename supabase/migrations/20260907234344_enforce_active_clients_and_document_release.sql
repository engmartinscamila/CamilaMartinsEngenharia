-- Preserve the existing administrator, project memberships and manually uploaded
-- documents. Enforce suspension and publication decisions in the database.
create or replace function private.cliente_atual_id()
returns uuid language sql stable security definer set search_path = ''
as $$ select public.current_client_id(); $$;

create or replace function public.can_access_project(p_project_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_portal_admin() or (
    (select auth.uid()) is not null
    and not exists (
      select 1 from public.clientes c where c.auth_id = (select auth.uid())
      and coalesce(c.status, 'ativo') <> 'ativo'
    )
    and (
      exists (select 1 from public.projetos p where p.id = p_project_id
              and p.cliente_id = public.current_client_id())
      or exists (select 1 from public.project_members m
                 where m.project_id = p_project_id
                 and m.user_id = (select auth.uid()) and m.active)
    )
  );
$$;

create or replace function public.user_has_project_access(p_project_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select public.can_access_project(p_project_id); $$;

revoke all on function private.cliente_atual_id() from public, anon;
grant execute on function private.cliente_atual_id() to authenticated, service_role;
revoke all on function public.can_access_project(uuid) from public, anon;
revoke all on function public.user_has_project_access(uuid) from public, anon;
grant execute on function public.can_access_project(uuid), public.user_has_project_access(uuid)
to authenticated, service_role;

-- This read-only RPC must obey the same metadata RLS as direct API queries.
alter function public.client_document_map(uuid) security invoker;

-- Permissive policies establish ownership. These RESTRICTIVE policies narrow
-- that access (AND), never grant access to a different customer's project.
do $migration$
declare item record; predicate text;
begin
  for item in select * from (values
    ('documentos','show_documents'), ('fotos','show_photos'),
    ('biblioteca','show_library'), ('agenda','show_agenda'),
    ('cronograma','show_schedule'), ('aprovacoes','show_approvals'),
    ('solicitacoes','show_requests')
  ) as modules(table_name, flag) loop
    predicate := format(
      'public.is_portal_admin() or (projeto_id is null or (public.can_access_project(projeto_id) and coalesce((select s.%I from public.project_portal_settings s where s.project_id = %I.projeto_id), true)))',
      item.flag, item.table_name);
    if not exists (select 1 from pg_policies where schemaname='public'
      and tablename=item.table_name and policyname='security_module_visibility') then
      execute format('create policy security_module_visibility on public.%I as restrictive for select to authenticated using (%s)', item.table_name, predicate);
    else
      execute format('alter policy security_module_visibility on public.%I using (%s)', item.table_name, predicate);
    end if;
  end loop;
  if not exists (select 1 from pg_policies where schemaname='public'
      and tablename='documentos' and policyname='security_document_release') then
    create policy security_document_release on public.documentos as restrictive
      for select to authenticated using (
        public.is_portal_admin() or (
          (document_kind is null and generated_at is null)
          or ((coalesce(client_visible,false) or coalesce(exibir_cliente,false))
              and client_released_at is not null)
        )
      );
  end if;
end;
$migration$;

-- Client-created requests cannot impersonate the engineering team or select a
-- privileged workflow state. Retain the statuses used by both existing clients.
alter policy solicitacoes_insert_access on public.solicitacoes with check (
  private.eh_administradora() or (
    cliente_id = private.cliente_atual_id()
    and origem = 'cliente'
    and lower(status) in ('nova','aberta','pendente')
    and (projeto_id is null or exists (
      select 1 from public.projetos p where p.id = solicitacoes.projeto_id
      and p.cliente_id = private.cliente_atual_id()
    ))
  )
);

-- A folder name alone must not grant the original file: consult metadata under
-- RLS so hidden drafts, other clients and authored originals remain inaccessible.
-- issue-protected-asset uses the same metadata RLS and emits a short-lived copy.
alter policy cliente_le_documentos_storage_proprios on storage.objects using (
  bucket_id = 'documentos' and exists (
    select 1 from public.documentos d
    where d.arquivo = storage.objects.name
    and coalesce(d.storage_bucket,'documentos') = storage.objects.bucket_id
    and coalesce(d.protection_mode,'administrative') <> 'authored_pdf'
  )
);
alter policy cliente_le_fotos_storage_proprias on storage.objects using (
  bucket_id = 'fotos' and exists (
    select 1 from public.fotos f
    where f.arquivo = storage.objects.name
    and coalesce(f.storage_bucket,'fotos') = storage.objects.bucket_id
    and f.protection_mode = 'administrative'
  )
);
alter policy cliente_le_biblioteca_storage_propria on storage.objects using (
  bucket_id = 'biblioteca' and exists (
    select 1 from public.biblioteca b
    where b.arquivo = storage.objects.name
    and coalesce(b.storage_bucket,'biblioteca') = storage.objects.bucket_id
  )
);

-- Remove inherited PUBLIC execution on the two remaining administrative
-- overloads; authenticated administrators retain their existing RPC interface.
revoke execute on function public.admin_create_independent_contract(jsonb,uuid[],uuid)
  from public, anon;
grant execute on function public.admin_create_independent_contract(jsonb,uuid[],uuid)
  to authenticated, service_role;
revoke execute on function public.admin_document_archive_reminder(integer) from public, anon;
grant execute on function public.admin_document_archive_reminder(integer) to authenticated, service_role;
