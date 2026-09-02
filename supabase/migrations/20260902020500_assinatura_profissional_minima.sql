
create or replace function public.service_get_professional_signature()
returns jsonb
language plpgsql
security definer
set search_path = public, vault
as $function$
declare
  v_secret text;
  v_data jsonb := '{}'::jsonb;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name='cme_professional_identity'
  limit 1;

  if nullif(v_secret,'') is not null then
    v_data := v_secret::jsonb;
  end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'full_name', nullif(btrim(v_data->>'full_name'),''),
    'professional_title', nullif(btrim(v_data->>'professional_title'),''),
    'crea_rj', nullif(btrim(v_data->>'crea_rj'),''),
    'crea_sp', nullif(btrim(v_data->>'crea_sp'),'')
  ));
end
$function$;

revoke all on function public.service_get_professional_signature()
from public, anon, authenticated;

grant execute on function public.service_get_professional_signature()
to service_role;
