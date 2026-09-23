-- Reuso controlado de clientes existentes na criação de orçamento.
-- Não altera silenciosamente o cadastro de clientes: apenas usa os dados atuais como snapshot
-- do novo registro comercial e grava linked_client_id para rastreabilidade.

create or replace function public.admin_search_existing_clients(
  p_query text,
  p_limit integer default 10
)
returns table(
  id uuid,
  nome text,
  cpf_cnpj text,
  email text,
  telefone text,
  endereco text,
  cidade text,
  estado text,
  cep text
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_query text;
  v_digits text;
  v_limit integer;
begin
  if not public.is_portal_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;

  v_query := translate(
    lower(btrim(coalesce(p_query, ''))),
    'áàâãäéèêëíìîïóòôõöúùûüç',
    'aaaaaeeeeiiiiooooouuuuc'
  );
  v_digits := regexp_replace(coalesce(p_query, ''), '\D', '', 'g');
  v_limit := least(greatest(coalesce(p_limit, 10), 1), 20);

  if length(v_query) < 2 and length(v_digits) < 3 then
    return;
  end if;

  return query
  select
    c.id,
    c.nome,
    c.cpf_cnpj,
    c.email,
    c.telefone,
    c.endereco,
    c.cidade,
    c.estado,
    c.cep
  from public.clientes c
  where coalesce(c.status, 'ativo') <> 'inativo'
    and (
      translate(
        lower(coalesce(c.nome, '')),
        'áàâãäéèêëíìîïóòôõöúùûüç',
        'aaaaaeeeeiiiiooooouuuuc'
      ) like '%' || v_query || '%'
      or (
        length(v_digits) >= 3
        and regexp_replace(coalesce(c.cpf_cnpj, ''), '\D', '', 'g') like '%' || v_digits || '%'
      )
    )
  order by
    case
      when v_digits <> '' and regexp_replace(coalesce(c.cpf_cnpj, ''), '\D', '', 'g') = v_digits then 0
      when translate(lower(coalesce(c.nome, '')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') = v_query then 1
      when translate(lower(coalesce(c.nome, '')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') like v_query || '%' then 2
      else 3
    end,
    c.nome
  limit v_limit;
end;
$$;

revoke all on function public.admin_search_existing_clients(text, integer) from public, anon;
grant execute on function public.admin_search_existing_clients(text, integer) to authenticated;

create or replace function public.admin_create_commercial_record_from_client(
  p_client_id uuid,
  p_data jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_client public.clientes%rowtype;
  v_data jsonb;
  v_id uuid;
begin
  if not public.is_portal_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;

  select * into v_client
  from public.clientes
  where id = p_client_id
    and coalesce(status, 'ativo') <> 'inativo';

  if not found then
    raise exception 'Cliente existente não localizado ou inativo';
  end if;

  -- Dados digitados têm precedência para o snapshot do documento.
  -- O cadastro do cliente NÃO é atualizado por esta operação.
  v_data := coalesce(p_data, '{}'::jsonb) || jsonb_build_object(
    'prospect_name', coalesce(nullif(btrim(p_data->>'prospect_name'), ''), v_client.nome),
    'cpf_cnpj', coalesce(nullif(btrim(p_data->>'cpf_cnpj'), ''), v_client.cpf_cnpj, ''),
    'email', coalesce(nullif(btrim(p_data->>'email'), ''), v_client.email, ''),
    'phone', coalesce(nullif(btrim(p_data->>'phone'), ''), v_client.telefone, ''),
    'cep', coalesce(nullif(btrim(p_data->>'cep'), ''), v_client.cep, ''),
    'address', coalesce(nullif(btrim(p_data->>'address'), ''), v_client.endereco, ''),
    'city', coalesce(nullif(btrim(p_data->>'city'), ''), v_client.cidade, ''),
    'state', coalesce(nullif(btrim(p_data->>'state'), ''), v_client.estado, '')
  );

  v_id := public.admin_create_commercial_record(v_data);

  update public.commercial_records
  set linked_client_id = p_client_id,
      updated_at = now()
  where id = v_id;

  insert into public.audit_log(user_id, action, entity_type, entity_id, details)
  values(
    auth.uid(),
    'link_existing_client_to_commercial_record',
    'commercial_records',
    v_id,
    jsonb_build_object('linked_client_id', p_client_id, 'client_record_changed', false)
  );

  return v_id;
end;
$$;

revoke all on function public.admin_create_commercial_record_from_client(uuid, jsonb) from public, anon;
grant execute on function public.admin_create_commercial_record_from_client(uuid, jsonb) to authenticated;
