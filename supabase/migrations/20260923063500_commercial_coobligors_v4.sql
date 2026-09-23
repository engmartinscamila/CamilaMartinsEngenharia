-- Coobrigados estruturados para o Contrato Mestre v4.
alter table public.commercial_records
  add column if not exists coobligors jsonb not null default '[]'::jsonb;

alter table public.commercial_records
  drop constraint if exists commercial_records_coobligors_array;
alter table public.commercial_records
  add constraint commercial_records_coobligors_array
  check (jsonb_typeof(coobligors)='array');

create or replace function public.validate_commercial_coobligors(p_coobligors jsonb)
returns jsonb
language plpgsql
immutable
set search_path=public
as $$
declare
  v_result jsonb := '[]'::jsonb;
  item jsonb;
  v_kind text;
  v_name text;
  v_cpf text;
  v_role text;
begin
  if p_coobligors is null then return '[]'::jsonb; end if;
  if jsonb_typeof(p_coobligors)<>'array' then
    raise exception 'Coobrigados devem ser enviados como lista';
  end if;
  if jsonb_array_length(p_coobligors)>4 then
    raise exception 'Máximo de 4 coobrigados por contrato';
  end if;

  for item in select * from jsonb_array_elements(p_coobligors)
  loop
    v_kind:=lower(btrim(coalesce(item->>'kind','')));
    v_name:=btrim(coalesce(item->>'name',''));
    v_cpf:=regexp_replace(coalesce(item->>'cpf',''),'\D','','g');
    v_role:=nullif(btrim(coalesce(item->>'role','')),'');

    if v_kind not in ('spouse_companion','company_guarantor','other_guarantor') then
      raise exception 'Tipo de coobrigado inválido';
    end if;
    if length(v_name)<3 then
      raise exception 'Informe o nome completo do coobrigado';
    end if;
    if length(v_cpf)<>11 then
      raise exception 'Informe CPF com 11 dígitos para o coobrigado %',v_name;
    end if;

    v_result:=v_result||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'kind',v_kind,
      'name',v_name,
      'cpf',v_cpf,
      'role',v_role
    )));
  end loop;

  return v_result;
end;
$$;

revoke all on function public.validate_commercial_coobligors(jsonb) from public,anon;
grant execute on function public.validate_commercial_coobligors(jsonb) to authenticated,service_role;

create or replace function public.admin_set_commercial_coobligors(p_record_id uuid,p_coobligors jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_valid jsonb;
  v_frozen boolean;
begin
  if not public.is_portal_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;

  select exists(
    select 1
    from public.commercial_records r
    join public.document_emission_snapshots s
      on s.document_id in (r.quote_document_id,r.contract_document_id)
    where r.id=p_record_id
  ) into v_frozen;

  if v_frozen then
    raise exception 'Documento já possui snapshot emitido. Crie uma nova versão antes de alterar coobrigados';
  end if;

  v_valid:=public.validate_commercial_coobligors(coalesce(p_coobligors,'[]'::jsonb));

  update public.commercial_records
  set coobligors=v_valid,updated_at=now()
  where id=p_record_id;

  if not found then raise exception 'Registro comercial não encontrado'; end if;

  insert into public.audit_log(user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'set_commercial_coobligors','commercial_records',p_record_id,
    jsonb_build_object('count',jsonb_array_length(v_valid)));

  return v_valid;
end;
$$;

revoke all on function public.admin_set_commercial_coobligors(uuid,jsonb) from public,anon;
grant execute on function public.admin_set_commercial_coobligors(uuid,jsonb) to authenticated;

insert into public.audit_log(user_id,action,entity_type,details)
values(null,'enable_contract_v4_coobligors','commercial_records',
  jsonb_build_object('contract_master_version',4,'structured',true,'max_coobligors',4));
