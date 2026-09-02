
-- Identidade profissional sigilosa para geração de documentos.
-- Os dados ficam criptografados pelo Supabase Vault e nunca são salvos
-- em generated_data, localStorage ou nas tabelas comuns do portal.

do $$
declare
  v_existing uuid;
  v_cfg public.configuracoes%rowtype;
  v_crea_rj text;
  v_crea_sp text;
  v_seed jsonb;
begin
  select id into v_existing
  from vault.decrypted_secrets
  where name = 'cme_professional_identity'
  limit 1;

  if v_existing is null then
    select * into v_cfg from public.configuracoes limit 1;

    v_crea_rj := nullif(
      (regexp_match(coalesce(v_cfg.crea,''), 'CREA[- ]?RJ\s*([0-9]+)', 'i'))[1],
      ''
    );
    v_crea_sp := nullif(
      (regexp_match(coalesce(v_cfg.crea,''), 'CREA[- ]?SP\s*([0-9]+)', 'i'))[1],
      ''
    );

    v_seed := jsonb_strip_nulls(jsonb_build_object(
      'professional_title', 'Engenheira Civil',
      'crea_rj', v_crea_rj,
      'crea_sp', v_crea_sp,
      'email_professional', nullif(btrim(v_cfg.email),''),
      'phone_professional', nullif(btrim(v_cfg.telefone),'')
    ));

    perform vault.create_secret(
      v_seed::text,
      'cme_professional_identity',
      'Identidade civil e profissional usada exclusivamente na geração segura de documentos'
    );
  end if;
end $$;

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

  return jsonb_build_object(
    'configured', v_data <> '{}'::jsonb,
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
    'cpf_masked', case when length(v_cpf) >= 4 then '•••.•••.•••-' || right(v_cpf,2) else '' end,
    'rg_set', length(v_rg) > 0,
    'rg_masked', case when length(v_rg) >= 3 then '•••••••' || right(v_rg,2) else '' end
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
  v_allowed constant text[] := array[
    'full_name',
    'professional_title',
    'nationality',
    'marital_status',
    'cpf',
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

  if nullif(btrim(v_data->>'cpf'),'') is not null
     and length(regexp_replace(v_data->>'cpf','\D','','g')) <> 11 then
    raise exception 'CPF deve conter 11 dígitos';
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

create or replace function public.service_get_professional_identity()
returns jsonb
language plpgsql
security definer
set search_path = public, vault
as $function$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name='cme_professional_identity'
  limit 1;

  return coalesce(nullif(v_secret,'')::jsonb,'{}'::jsonb);
end
$function$;

revoke all on function public.admin_professional_identity_status() from public, anon;
revoke all on function public.admin_save_professional_identity(jsonb) from public, anon;
revoke all on function public.service_get_professional_identity() from public, anon, authenticated;

grant execute on function public.admin_professional_identity_status() to authenticated;
grant execute on function public.admin_save_professional_identity(jsonb) to authenticated;
grant execute on function public.service_get_professional_identity() to service_role;

-- O CREA deixa de ser armazenado no registro comum de configurações.
-- A identidade jurídica/profissional passa a ser mantida somente no Vault.
update public.configuracoes
set crea = null
where crea is not null;
