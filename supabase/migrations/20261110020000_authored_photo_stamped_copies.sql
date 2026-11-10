-- Imagens autorais: cópia carimbada gravada na própria imagem (JPG), gerada uma vez por foto
-- no painel da administradora. O cliente recebe essa cópia; o original nunca é entregue.
-- Também permite trocar uma foto entre "autoral" e "comum" sem avisar o cliente.

alter table public.fotos add column if not exists protected_copy_path text;
alter table public.fotos add column if not exists protected_copy_source text;
alter table public.fotos add column if not exists protected_copy_at timestamptz;

-- Fotos autorais com os dados do carimbo (cliente e contrato), iguais aos da emissão.
create or replace function public.admin_photo_stamp_queue()
returns table(id uuid, nome text, storage_bucket text, arquivo text, protection_mode text,
              client_id uuid, client_name text, contract_number text,
              protected_copy_path text, needs_copy boolean, created_at timestamptz)
language plpgsql stable security definer set search_path to '' as $f$
begin
  if not public.is_portal_admin() then raise exception 'Acesso administrativo necessário'; end if;
  return query
  select f.id, f.nome, coalesce(f.storage_bucket, 'fotos'), f.arquivo, f.protection_mode,
         coalesce(f.cliente_id, p.cliente_id),
         coalesce(nullif(btrim(c.nome), ''), 'Cliente'),
         -- Código interno de migração (MIG-…) não é contrato: usa o nome do projeto.
         coalesce(nullif(case when k.contract_number like 'MIG-%' then null else k.contract_number end, ''), nullif(p.numero_contrato, ''), nullif(p.nome, ''), 'Projeto não informado'),
         f.protected_copy_path,
         f.protection_mode = 'authored_photo' and (f.protected_copy_path is null or f.protected_copy_source is distinct from f.arquivo),
         f.created_at
    from public.fotos f
    left join public.projetos p on p.id = f.projeto_id
    left join public.clientes c on c.id = coalesce(f.cliente_id, p.cliente_id)
    left join public.contratos k on k.id = p.contract_id
   where f.arquivo is not null
   order by c.nome nulls last, f.created_at desc;
end $f$;

create or replace function public.admin_photo_set_protected_copy(p_photo uuid, p_path text, p_source text)
returns void language plpgsql security definer set search_path to '' as $f$
begin
  if not public.is_portal_admin() then raise exception 'Acesso administrativo necessário'; end if;
  if coalesce(p_path, '') !~ ('^protegidas/' || p_photo::text || '/[^/]+\.jpg$') then raise exception 'Caminho de cópia inválido.'; end if;
  perform set_config('cme.silent_client_change', 'on', true);
  update public.fotos set protected_copy_path = p_path, protected_copy_source = p_source, protected_copy_at = now()
   where id = p_photo and arquivo = p_source;
  perform set_config('cme.silent_client_change', '', true);
  if not found then raise exception 'Foto não encontrada ou arquivo alterado durante a preparação.'; end if;
end $f$;

create or replace function public.admin_photo_set_protection(p_ids uuid[], p_mode text)
returns integer language plpgsql security definer set search_path to '' as $f$
declare v_count integer;
begin
  if not public.is_portal_admin() then raise exception 'Acesso administrativo necessário'; end if;
  if p_mode not in ('authored_photo', 'administrative') then raise exception 'Tipo de proteção inválido.'; end if;
  perform set_config('cme.silent_client_change', 'on', true);
  update public.fotos set protection_mode = p_mode where id = any(p_ids) and protection_mode is distinct from p_mode;
  get diagnostics v_count = row_count;
  perform set_config('cme.silent_client_change', '', true);
  return v_count;
end $f$;

revoke all on function public.admin_photo_stamp_queue() from public, anon;
revoke all on function public.admin_photo_set_protected_copy(uuid, text, text) from public, anon;
revoke all on function public.admin_photo_set_protection(uuid[], text) from public, anon;
grant execute on function public.admin_photo_stamp_queue() to authenticated;
grant execute on function public.admin_photo_set_protected_copy(uuid, text, text) to authenticated;
grant execute on function public.admin_photo_set_protection(uuid[], text) to authenticated;

-- Cópia autenticada: qualquer pessoa confere, pelo código impresso, se a cópia é verdadeira,
-- qual é o material, para quem foi emitida e quando. Códigos: CME-… (PDFs do site e guias),
-- CM-… (documentos do portal) e CME-F-… (imagens autorais).
create or replace function public.public_verify_copy(p_code text)
returns jsonb language plpgsql stable security definer set search_path to '' as $f$
declare v_code text := upper(btrim(coalesce(p_code, ''))); r record;
begin
  if v_code !~ '^(CME|CM)-[A-Z0-9-]{6,20}$' then return jsonb_build_object('valid', false); end if;

  if v_code ~ '^CME-F-[0-9A-F]{8}$' then
    select f.nome, f.protected_copy_at, coalesce(nullif(btrim(c.nome), ''), 'Cliente') client_name,
           coalesce(nullif(case when k.contract_number like 'MIG-%' then null else k.contract_number end, ''), nullif(p.numero_contrato, ''), p.nome) reference
      into r
      from public.fotos f
      left join public.projetos p on p.id = f.projeto_id
      left join public.clientes c on c.id = coalesce(f.cliente_id, p.cliente_id)
      left join public.contratos k on k.id = p.contract_id
     where replace(f.id::text, '-', '') like lower(substr(v_code, 7)) || '%'
       and f.protection_mode = 'authored_photo' and f.protected_copy_path is not null
     limit 1;
    if found then
      return jsonb_build_object('valid', true, 'kind', 'Imagem autoral', 'title', r.nome, 'licensed_to', r.client_name,
                                'reference', r.reference, 'issued_at', r.protected_copy_at);
    end if;
    return jsonb_build_object('valid', false);
  end if;

  select i.issue_code, i.licensed_to, i.created_at, i.source_type,
         coalesce(s.title, d.nome, b.nome, 'Documento') title
    into r
    from public.protected_pdf_issues i
    left join public.protected_site_pdfs s on i.source_type = 'site' and s.slug = i.source_slug
    left join public.documentos d on i.source_type = 'documentos' and d.id::text = i.source_record_id
    left join public.biblioteca b on i.source_type = 'biblioteca' and b.id::text = i.source_record_id
   where i.issue_code = v_code and i.status in ('generated', 'purged')
   limit 1;
  if found then
    return jsonb_build_object('valid', true, 'kind', case when r.source_type = 'site' then 'PDF do site' else 'Documento autoral' end,
                              'title', r.title, 'licensed_to', r.licensed_to, 'issued_at', r.created_at);
  end if;

  select a.tracking_code, a.created_at, a.contract_number, a.asset_kind,
         coalesce(d.nome, f.nome, 'Arquivo') title, coalesce(nullif(btrim(c.nome), ''), 'Cliente') client_name
    into r
    from public.protected_asset_issues a
    left join public.documentos d on a.asset_kind = 'document' and d.id = a.asset_id
    left join public.fotos f on a.asset_kind = 'photo' and f.id = a.asset_id
    left join public.clientes c on c.id = a.client_id
   where a.tracking_code = v_code
   limit 1;
  if found then
    return jsonb_build_object('valid', true, 'kind', case when r.asset_kind = 'photo' then 'Imagem autoral' else 'Documento do portal' end,
                              'title', r.title, 'licensed_to', r.client_name, 'reference', r.contract_number, 'issued_at', r.created_at);
  end if;
  return jsonb_build_object('valid', false);
end $f$;
revoke all on function public.public_verify_copy(text) from public;
grant execute on function public.public_verify_copy(text) to anon, authenticated;
