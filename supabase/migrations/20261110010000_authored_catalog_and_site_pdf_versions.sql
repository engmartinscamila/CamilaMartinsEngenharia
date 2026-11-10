-- Catálogo de materiais autorais e histórico dos PDFs protegidos do site.
-- 1) Modo silencioso: alterações internas de arquivos não avisam o cliente (e-mail/notificação),
--    a menos que a administradora escolha avisar.
-- 2) authored_materials: cada guia autoral é enviado uma vez e liberado a vários clientes;
--    cada cliente recebe a própria cópia (documentos), vinculada ao material e à versão.
-- 3) protected_site_pdf_versions: histórico do Portfólio e do Menu de Experiências, com
--    retorno a uma versão anterior. Cada visualização continua gerando cópia protegida.

-- 1) Modo silencioso ----------------------------------------------------------------------
do $mig$
declare v_def text; v_new text;
begin
  v_def := pg_get_functiondef('public.notify_content_created()'::regprocedure);
  if position('cme.silent_client_change' in v_def) = 0 then
    v_new := replace(v_def, 'BEGIN IF TG_TABLE_NAME=''documentos''',
      'BEGIN IF coalesce(current_setting(''cme.silent_client_change'', true), '''') = ''on'' THEN RETURN NEW; END IF; IF TG_TABLE_NAME=''documentos''');
    if v_new = v_def then raise exception 'notify_content_created: trecho esperado não encontrado.'; end if;
    execute v_new;
  end if;

  v_def := pg_get_functiondef('private.queue_client_portal_email()'::regprocedure);
  if position('cme.silent_client_change' in v_def) = 0 then
    v_new := replace(v_def, E'begin\n  if TG_TABLE_NAME<>''clientes'' and exists',
      E'begin\n  if TG_TABLE_NAME<>''clientes'' and coalesce(current_setting(''cme.silent_client_change'', true), '''') = ''on'' then return coalesce(NEW,OLD); end if;\n  if TG_TABLE_NAME<>''clientes'' and exists');
    if v_new = v_def then raise exception 'queue_client_portal_email: trecho esperado não encontrado.'; end if;
    execute v_new;
  end if;
end
$mig$;

-- 2) Catálogo de materiais autorais -----------------------------------------------------
create table if not exists public.authored_materials (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  series text,
  number integer,
  title text not null,
  category text not null default 'Guias de Obra',
  description text,
  current_version integer not null default 1,
  storage_bucket text not null default 'documentos',
  storage_path text not null,
  sha256 text,
  size_bytes bigint,
  original_name text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table if not exists public.authored_material_versions (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.authored_materials(id) on delete cascade,
  version integer not null,
  storage_path text not null,
  sha256 text,
  size_bytes bigint,
  original_name text,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid,
  unique (material_id, version)
);

alter table public.documentos add column if not exists authored_material_id uuid
  references public.authored_materials(id) on delete set null;
alter table public.documentos add column if not exists authored_material_version integer;
create index if not exists idx_documentos_authored_material_id on public.documentos(authored_material_id);

alter table public.authored_materials enable row level security;
alter table public.authored_material_versions enable row level security;
do $p$ begin if not exists (select 1 from pg_policies where schemaname='public' and tablename='authored_materials' and policyname='authored_materials_admin_all') then
  execute $q$create policy authored_materials_admin_all on public.authored_materials
  for all to authenticated using (public.is_portal_admin()) with check (public.is_portal_admin())$q$;
end if; end $p$;
do $p$ begin if not exists (select 1 from pg_policies where schemaname='public' and tablename='authored_material_versions' and policyname='authored_material_versions_admin_all') then
  execute $q$create policy authored_material_versions_admin_all on public.authored_material_versions
  for all to authenticated using (public.is_portal_admin()) with check (public.is_portal_admin())$q$;
end if; end $p$;
grant select, insert, update, delete on public.authored_materials, public.authored_material_versions to authenticated;

create or replace function private.authored_require_admin() returns void
language plpgsql stable security definer set search_path to '' as $f$
begin
  if not public.is_portal_admin() then raise exception 'Acesso administrativo necessário'; end if;
end $f$;
revoke all on function private.authored_require_admin() from public, anon, authenticated;

-- Cria um material (com o primeiro arquivo) ou atualiza os dados de um existente.
create or replace function public.admin_authored_material_save(p jsonb)
returns uuid language plpgsql security definer set search_path to '' as $f$
declare v_id uuid := nullif(p->>'id','')::uuid; v_code text; v_title text;
begin
  perform private.authored_require_admin();
  v_title := btrim(coalesce(p->>'title',''));
  if v_title = '' then raise exception 'Informe o título do material.'; end if;
  v_code := lower(regexp_replace(coalesce(nullif(btrim(p->>'code'),''), v_title), '[^a-zA-Z0-9]+', '-', 'g'));
  v_code := btrim(v_code, '-');
  if v_id is null then
    if coalesce(p->>'storage_path','') !~ '^autorais/.+\.pdf$' then raise exception 'Arquivo do material inválido.'; end if;
    insert into public.authored_materials(code, series, number, title, category, description, storage_path, sha256, size_bytes, original_name, updated_by)
    values (v_code, nullif(p->>'series',''), nullif(p->>'number','')::int, v_title, coalesce(nullif(p->>'category',''),'Guias de Obra'),
            nullif(p->>'description',''), p->>'storage_path', nullif(p->>'sha256',''), nullif(p->>'size_bytes','')::bigint,
            nullif(p->>'original_name',''), auth.uid())
    returning id into v_id;
    insert into public.authored_material_versions(material_id, version, storage_path, sha256, size_bytes, original_name, note, created_by)
    values (v_id, 1, p->>'storage_path', nullif(p->>'sha256',''), nullif(p->>'size_bytes','')::bigint, nullif(p->>'original_name',''), 'Primeira versão', auth.uid());
  else
    update public.authored_materials set title = v_title, code = v_code, series = nullif(p->>'series',''),
      number = nullif(p->>'number','')::int, category = coalesce(nullif(p->>'category',''), category),
      description = nullif(p->>'description',''), updated_at = now(), updated_by = auth.uid()
    where id = v_id;
    if not found then raise exception 'Material não encontrado.'; end if;
  end if;
  return v_id;
end $f$;

-- Registra uma nova versão do arquivo (nova ou restauração de uma anterior).
create or replace function public.admin_authored_material_new_version(
  p_material uuid, p_path text, p_sha text, p_size bigint, p_name text, p_note text)
returns integer language plpgsql security definer set search_path to '' as $f$
declare v_version integer;
begin
  perform private.authored_require_admin();
  if coalesce(p_path,'') !~ '^autorais/.+\.pdf$' then raise exception 'Arquivo do material inválido.'; end if;
  update public.authored_materials set current_version = current_version + 1, storage_path = p_path,
    sha256 = nullif(p_sha,''), size_bytes = p_size, original_name = nullif(p_name,''), updated_at = now(), updated_by = auth.uid()
  where id = p_material returning current_version into v_version;
  if v_version is null then raise exception 'Material não encontrado.'; end if;
  insert into public.authored_material_versions(material_id, version, storage_path, sha256, size_bytes, original_name, note, created_by)
  values (p_material, v_version, p_path, nullif(p_sha,''), p_size, nullif(p_name,''), nullif(p_note,''), auth.uid());
  return v_version;
end $f$;

-- Transfere o original inicial (migrado de um documento de cliente) para a pasta interna.
create or replace function public.admin_authored_material_set_master(p_material uuid, p_path text)
returns void language plpgsql security definer set search_path to '' as $f$
begin
  perform private.authored_require_admin();
  if coalesce(p_path,'') !~ '^autorais/.+\.pdf$' then raise exception 'Arquivo do material inválido.'; end if;
  update public.authored_materials set storage_path = p_path, updated_at = now() where id = p_material and storage_path !~ '^autorais/';
  update public.authored_material_versions v set storage_path = p_path
   from public.authored_materials m
   where m.id = p_material and v.material_id = m.id and v.version = m.current_version and v.storage_path !~ '^autorais/';
end $f$;

-- Atualiza as cópias dos clientes para a versão vigente. Retorna os caminhos antigos para remoção.
create or replace function public.admin_authored_material_apply(p_material uuid, p_items jsonb, p_notify boolean default false)
returns jsonb language plpgsql security definer set search_path to '' as $f$
declare m public.authored_materials; it jsonb; v_old text; v_olds jsonb := '[]'::jsonb; v_count int := 0;
begin
  perform private.authored_require_admin();
  select * into m from public.authored_materials where id = p_material;
  if m.id is null then raise exception 'Material não encontrado.'; end if;
  if not coalesce(p_notify, false) then perform set_config('cme.silent_client_change', 'on', true); end if;
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    if coalesce(it->>'arquivo','') !~ '\.pdf$' then raise exception 'Caminho de cópia inválido.'; end if;
    select arquivo into v_old from public.documentos
     where id = (it->>'document_id')::uuid and authored_material_id = p_material for update;
    if not found then raise exception 'Documento % não pertence a este material.', it->>'document_id'; end if;
    update public.documentos set arquivo = it->>'arquivo', nome = m.title, autoral = true,
      authored_material_version = m.current_version, arquivo_hash = m.sha256, nome_original = m.original_name
     where id = (it->>'document_id')::uuid;
    if v_old is distinct from it->>'arquivo' and v_old is not null then v_olds := v_olds || to_jsonb(v_old); end if;
    v_count := v_count + 1;
  end loop;
  perform set_config('cme.silent_client_change', '', true);
  insert into public.audit_log(user_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'authored_material_apply', 'authored_materials', p_material,
          jsonb_build_object('version', m.current_version, 'documents', v_count, 'notified', coalesce(p_notify,false)));
  return jsonb_build_object('updated', v_count, 'old_paths', v_olds);
end $f$;

-- Libera o material a clientes (uma cópia por cliente). Ignora quem já tem o material.
create or replace function public.admin_authored_material_release(p_material uuid, p_items jsonb, p_notify boolean default false)
returns jsonb language plpgsql security definer set search_path to '' as $f$
declare m public.authored_materials; it jsonb; v_ids jsonb := '[]'::jsonb; v_skipped jsonb := '[]'::jsonb; v_id uuid;
begin
  perform private.authored_require_admin();
  select * into m from public.authored_materials where id = p_material;
  if m.id is null then raise exception 'Material não encontrado.'; end if;
  if not coalesce(p_notify, false) then perform set_config('cme.silent_client_change', 'on', true); end if;
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    if coalesce(it->>'arquivo','') !~ '\.pdf$' then raise exception 'Caminho de cópia inválido.'; end if;
    if exists (select 1 from public.documentos where authored_material_id = p_material and cliente_id = (it->>'cliente_id')::uuid) then
      v_skipped := v_skipped || to_jsonb(it->>'arquivo'); continue;
    end if;
    insert into public.documentos(cliente_id, projeto_id, nome, arquivo, tipo, categoria, descricao, autoral, storage_bucket,
      permitir_download, protection_mode, workflow_status, nome_original, arquivo_hash, authored_material_id, authored_material_version)
    values ((it->>'cliente_id')::uuid, nullif(it->>'projeto_id','')::uuid, m.title, it->>'arquivo', 'outros', 'outros',
      coalesce(m.description,''), true, 'documentos', true, 'administrative', 'arquivo', m.original_name, m.sha256, m.id, m.current_version)
    returning id into v_id;
    v_ids := v_ids || to_jsonb(v_id);
  end loop;
  perform set_config('cme.silent_client_change', '', true);
  insert into public.audit_log(user_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'authored_material_release', 'authored_materials', p_material,
          jsonb_build_object('created', jsonb_array_length(v_ids), 'notified', coalesce(p_notify,false)));
  return jsonb_build_object('created', v_ids, 'skipped_paths', v_skipped);
end $f$;

-- Retira o material de um cliente (sem aviso). Retorna o caminho para remover a cópia.
create or replace function public.admin_authored_material_revoke(p_document uuid)
returns text language plpgsql security definer set search_path to '' as $f$
declare v_path text;
begin
  perform private.authored_require_admin();
  perform set_config('cme.silent_client_change', 'on', true);
  delete from public.documentos where id = p_document and authored_material_id is not null returning arquivo into v_path;
  perform set_config('cme.silent_client_change', '', true);
  if v_path is null then raise exception 'Documento autoral não encontrado.'; end if;
  return v_path;
end $f$;

revoke all on function public.admin_authored_material_save(jsonb) from public, anon;
revoke all on function public.admin_authored_material_new_version(uuid, text, text, bigint, text, text) from public, anon;
revoke all on function public.admin_authored_material_set_master(uuid, text) from public, anon;
revoke all on function public.admin_authored_material_apply(uuid, jsonb, boolean) from public, anon;
revoke all on function public.admin_authored_material_release(uuid, jsonb, boolean) from public, anon;
revoke all on function public.admin_authored_material_revoke(uuid) from public, anon;
grant execute on function public.admin_authored_material_save(jsonb) to authenticated;
grant execute on function public.admin_authored_material_new_version(uuid, text, text, bigint, text, text) to authenticated;
grant execute on function public.admin_authored_material_set_master(uuid, text) to authenticated;
grant execute on function public.admin_authored_material_apply(uuid, jsonb, boolean) to authenticated;
grant execute on function public.admin_authored_material_release(uuid, jsonb, boolean) to authenticated;
grant execute on function public.admin_authored_material_revoke(uuid) to authenticated;

-- Migração dos 23 PDFs autorais existentes: agrupados pelo conteúdo (mesmo arquivo = mesmo
-- material), com título revisado. O original inicial aponta para a cópia mais antiga e é
-- transferido para a pasta interna pela página do catálogo no primeiro acesso.
do $mig$
declare r record; v_id uuid;
begin
  for r in
    with files as (
      select d.id, d.arquivo, d.created_at, d.nome_original, (o.metadata->>'eTag') etag, (o.metadata->>'size')::bigint size
        from public.documentos d
        join storage.objects o on o.bucket_id = coalesce(d.storage_bucket,'documentos') and o.name = d.arquivo
       where d.autoral and d.authored_material_id is null and lower(d.arquivo) like '%.pdf'
    ), titles(etag, code, series, number, title, category) as (values
      ('"70bf511cd05d391124e007c79025ea2d"','interiores-01','Interiores',1,'Guia de Interiores 01 — Estilos de Interiores','Guias de Interiores'),
      ('"d331426562173d1fa133b0eab179d735"','interiores-05','Interiores',5,'Guia de Interiores 05 — Iluminação e Lâmpadas','Guias de Interiores'),
      ('"9197971f2bde3191cd26115ae53b660b"','interiores-08','Interiores',8,'Guia de Interiores 08 — Pisos, Revestimentos e Pedras','Guias de Interiores'),
      ('"4717822f7c7767603147c4127f210756"','interiores-10','Interiores',10,'Guia de Interiores 10 — Banheiros, Cozinhas, Metais e Ralos','Guias de Interiores'),
      ('"9fc29675c7237674e62748cc79806710"','interiores-12','Interiores',12,'Guia de Interiores 12 — Móveis Reais com QR Code','Guias de Interiores'),
      ('"bc2472cd8a24c82619b7099e339c87ce"','interiores-15','Interiores',15,'Guia de Interiores 15 — Guia Complementar de Tecidos','Guias de Interiores'),
      ('"7d067b99af7b9f4294d1b82daf646c7e"','obra-09','Obra',9,'Guia de Obra 09 — Estrutura: Fôrmas, Armaduras e Cobrimento','Guias de Obra'),
      ('"9c08ffd507094e34a2e67e8d9cea3c21"','obra-10','Obra',10,'Guia de Obra 10 — Concretagem de Lajes: Adensamento e Cura','Guias de Obra'),
      ('"858fe65cc8c579843e42ff69adffdf54"','obra-11','Obra',11,'Guia de Obra 11 — Alvenaria: Primeira Fiada, Prumo e Vãos','Guias de Obra'),
      ('"4add5867be2197ce1b8ad849bd5387e3"','obra-12','Obra',12,'Guia de Obra 12 — Vergas, Contravergas, Rasgos e Fissuras','Guias de Obra'),
      ('"63fb2952f3912cb0d9180781bb486f25"','obra-13','Obra',13,'Guia de Obra 13 — Impermeabilização: Banheiros, Varandas e Lajes','Guias de Obra'),
      ('"b4d597fbff4d512e34f5a9228209b1bd"','obra-14','Obra',14,'Guia de Obra 14 — Cobertura: Telhas, Cumeeiras, Rufos e Calhas','Guias de Obra'),
      ('"e3c8ba398f17ede687b298235f843387"','obra-15','Obra',15,'Guia de Obra 15 — Portas, Janelas, Peitoris, Soleiras e Fachadas','Guias de Obra'),
      ('"86db48edc6b7c267174df371f8654a28"','obra-16','Obra',16,'Guia de Obra 16 — Água, Esgoto, Pluvial e Gás: Execução e Testes','Guias de Obra'),
      ('"d7b0aaf3f0eb95a0dd0e6365c74a40af"','obra-17','Obra',17,'Guia de Obra 17 — Elétrica: Eletrodutos, Circuitos e Proteções','Guias de Obra'),
      ('"e55cc3644b59e21e96945c3ca6f7a856"','obra-18','Obra',18,'Guia de Obra 18 — Ar-Condicionado, Ventilação, Exaustão e Fechamentos','Guias de Obra'),
      ('"e22dd478629bb35d0908ef8a3aafc486"','obra-19','Obra',19,'Guia de Obra 19 — Chapisco, Emboço, Reboco, Drywall e Forros','Guias de Obra'),
      ('"0d16f2e7fb5aa8f5ebf64b833c630714"','obra-20','Obra',20,'Guia de Obra 20 — Contrapiso, Caimentos, Pisos e Juntas','Guias de Obra'),
      ('"0187d74425b3102cb0abf9450a1c2316"','obra-21','Obra',21,'Guia de Obra 21 — Pintura: Preparação, Aplicação e Patologias','Guias de Obra'),
      ('"4640aac361e24801ed40e27277bb5823"','obra-22','Obra',22,'Guia de Obra 22 — Louças, Metais, Tomadas, Portas e Ajustes','Guias de Obra'),
      ('"ac92cc78c9e5c38903397d228881f761"','menu-experiencias',null,null,'Menu de Experiências','Outros')
    )
    select t.*, (array_agg(f.arquivo order by f.created_at))[1] first_path, max(f.size) size, array_agg(f.id) doc_ids
      from titles t join files f on f.etag = t.etag group by t.etag, t.code, t.series, t.number, t.title, t.category
  loop
    insert into public.authored_materials(code, series, number, title, category, storage_path, size_bytes, original_name)
    values (r.code, r.series, r.number, r.title, r.category, r.first_path, r.size, regexp_replace(r.first_path, '^.*/\d+-', ''))
    on conflict (code) do nothing returning id into v_id;
    if v_id is null then continue; end if;
    insert into public.authored_material_versions(material_id, version, storage_path, size_bytes, original_name, note)
    values (v_id, 1, r.first_path, r.size, regexp_replace(r.first_path, '^.*/\d+-', ''), 'Versão inicial (migrada)');
    perform set_config('cme.silent_client_change', 'on', true);
    update public.documentos set authored_material_id = v_id, authored_material_version = 1, nome = r.title
     where id = any(r.doc_ids);
    perform set_config('cme.silent_client_change', '', true);
  end loop;
end
$mig$;

-- 3) Histórico dos PDFs protegidos do site ------------------------------------------------
create table if not exists public.protected_site_pdf_versions (
  id uuid primary key default gen_random_uuid(),
  slug text not null references public.protected_site_pdfs(slug) on delete cascade,
  version integer not null,
  storage_path text not null,
  sha256 text,
  size_bytes bigint,
  original_name text,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid,
  unique (slug, version)
);
alter table public.protected_site_pdf_versions enable row level security;
do $p$ begin if not exists (select 1 from pg_policies where schemaname='public' and tablename='protected_site_pdf_versions' and policyname='protected_site_pdf_versions_admin') then
  execute $q$create policy protected_site_pdf_versions_admin on public.protected_site_pdf_versions
  for all to authenticated using (public.is_pdf_admin()) with check (public.is_pdf_admin())$q$;
end if; end $p$;
grant select on public.protected_site_pdf_versions to authenticated;

insert into public.protected_site_pdf_versions(slug, version, storage_path, sha256, size_bytes, note, created_at)
select p.slug, 1, p.original_storage_path, p.original_sha256, (o.metadata->>'size')::bigint, 'Versão inicial', p.updated_at
  from public.protected_site_pdfs p
  left join storage.objects o on o.bucket_id = 'materiais-protegidos' and o.name = p.original_storage_path
 where not exists (select 1 from public.protected_site_pdf_versions v where v.slug = p.slug);

-- Publica um novo original (já enviado ao bucket privado) ou volta a uma versão anterior.
create or replace function public.admin_site_pdf_publish(p_slug text, p_path text, p_sha text, p_size bigint, p_name text, p_note text default null)
returns integer language plpgsql security definer set search_path to '' as $f$
declare v_version integer;
begin
  if not public.is_pdf_admin() then raise exception 'Acesso permitido somente à administradora.'; end if;
  if p_slug !~ '^[a-z0-9-]{2,64}$' or coalesce(p_path,'') !~ ('^site-originais/' || p_slug || '(/[^/]+)?\.pdf$') then
    raise exception 'Arquivo inválido para este PDF.';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'materiais-protegidos' and name = p_path) then
    raise exception 'O arquivo enviado não foi encontrado no armazenamento privado.';
  end if;
  select coalesce(max(version), 0) + 1 into v_version from public.protected_site_pdf_versions where slug = p_slug;
  insert into public.protected_site_pdf_versions(slug, version, storage_path, sha256, size_bytes, original_name, note, created_by)
  values (p_slug, v_version, p_path, nullif(p_sha,''), p_size, nullif(p_name,''), nullif(p_note,''), auth.uid());
  update public.protected_site_pdfs set original_storage_path = p_path, original_sha256 = nullif(p_sha,''),
    active = true, updated_at = now()
   where slug = p_slug;
  if not found then raise exception 'PDF do site não cadastrado.'; end if;
  return v_version;
end $f$;

create or replace function public.admin_site_pdf_restore(p_version uuid)
returns integer language plpgsql security definer set search_path to '' as $f$
declare v public.protected_site_pdf_versions;
begin
  if not public.is_pdf_admin() then raise exception 'Acesso permitido somente à administradora.'; end if;
  select * into v from public.protected_site_pdf_versions where id = p_version;
  if v.id is null then raise exception 'Versão não encontrada.'; end if;
  return public.admin_site_pdf_publish(v.slug, v.storage_path, v.sha256, v.size_bytes, v.original_name, 'Retorno à versão ' || v.version);
end $f$;
revoke all on function public.admin_site_pdf_publish(text, text, text, bigint, text, text) from public, anon;
revoke all on function public.admin_site_pdf_restore(uuid) from public, anon;
grant execute on function public.admin_site_pdf_publish(text, text, text, bigint, text, text) to authenticated;
grant execute on function public.admin_site_pdf_restore(uuid) to authenticated;
