
create or replace function public.admin_professional_identity_status()
returns jsonb
language plpgsql
security definer
set search_path = public, vault
as $function$
declare
  v_data jsonb := '{}'::jsonb;
  v_secret text;
  v_cpf text;
  v_rg text;
  v_cnpj text;
  v_has_crea boolean;
  v_document_ready boolean;
  v_contract_ready boolean;
  v_missing jsonb := '[]'::jsonb;
begin
  if not public.is_portal_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name='cme_professional_identity'
  limit 1;

  if nullif(v_secret,'') is not null then
    v_data := v_secret::jsonb;
  end if;

  v_cpf := regexp_replace(coalesce(v_data->>'cpf',''),'\D','','g');
  v_rg := regexp_replace(coalesce(v_data->>'rg',''),'\D','','g');
  v_cnpj := regexp_replace(coalesce(v_data->>'cnpj',''),'\D','','g');

  v_has_crea :=
    nullif(btrim(coalesce(v_data->>'crea_rj','')),'') is not null
    or nullif(btrim(coalesce(v_data->>'crea_sp','')),'') is not null;

  v_document_ready :=
    nullif(btrim(coalesce(v_data->>'full_name','')),'') is not null
    and v_has_crea;

  if nullif(btrim(coalesce(v_data->>'full_name','')),'') is null then
    v_missing := v_missing || '"nome civil completo"'::jsonb;
  end if;
  if not v_has_crea then
    v_missing := v_missing || '"CREA"'::jsonb;
  end if;
  if length(v_cpf) <> 11 then
    v_missing := v_missing || '"CPF"'::jsonb;
  end if;
  if nullif(btrim(coalesce(v_data->>'professional_address','')),'') is null then
    v_missing := v_missing || '"endereço profissional"'::jsonb;
  end if;
  if nullif(btrim(coalesce(v_data->>'email_professional','')),'') is null then
    v_missing := v_missing || '"e-mail profissional"'::jsonb;
  end if;

  v_contract_ready := jsonb_array_length(v_missing) = 0;

  return jsonb_build_object(
    'configured', v_data <> '{}'::jsonb,
    'document_ready', v_document_ready,
    'contract_ready', v_contract_ready,
    'missing_contract_fields', v_missing,
    'full_name', coalesce(v_data->>'full_name',''),
    'professional_title', coalesce(v_data->>'professional_title','Engenheira Civil'),
    'nationality', coalesce(v_data->>'nationality',''),
    'marital_status', coalesce(v_data->>'marital_status',''),
    'crea_rj', coalesce(v_data->>'crea_rj',''),
    'crea_sp', coalesce(v_data->>'crea_sp',''),
    'rg_issuer', coalesce(v_data->>'rg_issuer',''),
    'professional_address', coalesce(v_data->>'professional_address',''),
    'professional_city', coalesce(v_data->>'professional_city',''),
    'professional_state', coalesce(v_data->>'professional_state',''),
    'email_professional', coalesce(v_data->>'email_professional',''),
    'phone_professional', coalesce(v_data->>'phone_professional',''),
    'cpf_set', length(v_cpf) > 0,
    'cpf_masked', case when length(v_cpf) = 11 then '•••.•••.•••-' || right(v_cpf,2) else '' end,
    'rg_set', length(v_rg) > 0,
    'rg_masked', case when length(v_rg) >= 3 then '•••••••' || right(v_rg,2) else '' end,
    'cnpj_set', length(v_cnpj) > 0,
    'cnpj_masked', case when length(v_cnpj) = 14 then '••.•••.•••/••••-' || right(v_cnpj,2) else '' end
  );
end
$function$;

create or replace function public.admin_save_professional_identity(p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, vault
as $function$
declare
  v_id uuid;
  v_secret text;
  v_data jsonb := '{}'::jsonb;
  v_key text;
  v_value text;
  v_cpf text;
  v_cnpj text;
  v_allowed constant text[] := array[
    'full_name',
    'professional_title',
    'nationality',
    'marital_status',
    'cpf',
    'cnpj',
    'rg',
    'rg_issuer',
    'crea_rj',
    'crea_sp',
    'professional_address',
    'professional_city',
    'professional_state',
    'email_professional',
    'phone_professional'
  ];
begin
  if not public.is_portal_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;

  select id,decrypted_secret into v_id,v_secret
  from vault.decrypted_secrets
  where name='cme_professional_identity'
  limit 1;

  if nullif(v_secret,'') is not null then
    v_data := v_secret::jsonb;
  end if;

  foreach v_key in array v_allowed loop
    if p_patch ? v_key then
      v_value := nullif(btrim(p_patch->>v_key),'');
      if v_value is not null then
        v_data := jsonb_set(v_data,array[v_key],to_jsonb(v_value),true);
      end if;
    end if;
  end loop;

  v_cpf := regexp_replace(coalesce(v_data->>'cpf',''),'\D','','g');
  if length(v_cpf) > 0 and length(v_cpf) <> 11 then
    raise exception 'CPF deve conter 11 dígitos';
  end if;

  v_cnpj := regexp_replace(coalesce(v_data->>'cnpj',''),'\D','','g');
  if length(v_cnpj) > 0 and length(v_cnpj) <> 14 then
    raise exception 'CNPJ deve conter 14 dígitos';
  end if;

  if nullif(btrim(v_data->>'crea_rj'),'') is null
     and nullif(btrim(v_data->>'crea_sp'),'') is null then
    raise exception 'Informe ao menos uma inscrição no CREA';
  end if;

  if v_id is null then
    perform vault.create_secret(
      v_data::text,
      'cme_professional_identity',
      'Identidade civil e profissional usada exclusivamente na geração segura de documentos'
    );
  else
    perform vault.update_secret(
      v_id,
      v_data::text,
      'cme_professional_identity',
      'Identidade civil e profissional usada exclusivamente na geração segura de documentos'
    );
  end if;

  insert into public.audit_log(user_id,action,entity_type,details)
  values(
    auth.uid(),
    'update_professional_identity',
    'secure_professional_identity',
    jsonb_build_object(
      'updated_fields',
      (
        select coalesce(jsonb_agg(key),'[]'::jsonb)
        from jsonb_object_keys(p_patch) key
      )
    )
  );

  return public.admin_professional_identity_status();
end
$function$;

revoke all on function public.admin_professional_identity_status() from public, anon;
revoke all on function public.admin_save_professional_identity(jsonb) from public, anon;
grant execute on function public.admin_professional_identity_status() to authenticated;
grant execute on function public.admin_save_professional_identity(jsonb) to authenticated;

-- CNPJ futuro deixa de ficar na configuração comum; passa a ser mantido no Vault.
update public.configuracoes
set cnpj = null
where nullif(btrim(coalesce(cnpj,'')),'') is not null;
