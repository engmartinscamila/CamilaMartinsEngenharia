CREATE OR REPLACE FUNCTION public.admin_create_commercial_record(p_data jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_quote text;
  v_area_terreno numeric;
  v_area_construida numeric;
  v_total numeric;
  v_raw text;
BEGIN
  IF NOT public.is_portal_admin() THEN RAISE EXCEPTION 'Acesso administrativo necessário'; END IF;
  IF nullif(btrim(p_data->>'prospect_name'),'') IS NULL THEN RAISE EXCEPTION 'Nome do prospect é obrigatório'; END IF;

  v_raw := nullif(btrim(p_data->>'area_terreno_m2'),'');
  IF v_raw IS NOT NULL THEN
    v_area_terreno := CASE WHEN v_raw LIKE '%,%' THEN replace(replace(v_raw,'.',''),',','.')::numeric ELSE replace(v_raw,' ','')::numeric END;
  END IF;
  v_raw := nullif(btrim(p_data->>'area_construida_m2'),'');
  IF v_raw IS NOT NULL THEN
    v_area_construida := CASE WHEN v_raw LIKE '%,%' THEN replace(replace(v_raw,'.',''),',','.')::numeric ELSE replace(v_raw,' ','')::numeric END;
  END IF;
  v_raw := nullif(btrim(p_data->>'total_value'),'');
  IF v_raw IS NOT NULL THEN
    v_total := CASE WHEN v_raw LIKE '%,%' THEN replace(replace(v_raw,'.',''),',','.')::numeric ELSE replace(v_raw,' ','')::numeric END;
  END IF;

  v_quote := public.admin_next_commercial_number('ORC');
  INSERT INTO public.commercial_records(
    quote_number, prospect_name, cpf_cnpj, email, phone, cep, address, city, state,
    property_address, property_type, area_terreno_m2, area_construida_m2, construction_standard,
    experience_level, services, custom_service, total_value, payment_terms, valid_until, notes
  ) VALUES (
    v_quote, btrim(p_data->>'prospect_name'), nullif(btrim(p_data->>'cpf_cnpj'),''), nullif(btrim(p_data->>'email'),''),
    nullif(btrim(p_data->>'phone'),''), nullif(btrim(p_data->>'cep'),''), nullif(btrim(p_data->>'address'),''),
    nullif(btrim(p_data->>'city'),''), nullif(btrim(p_data->>'state'),''), nullif(btrim(p_data->>'property_address'),''),
    nullif(btrim(p_data->>'property_type'),''), v_area_terreno, v_area_construida,
    nullif(btrim(p_data->>'construction_standard'),''), nullif(btrim(p_data->>'experience_level'),''),
    coalesce(p_data->'services','[]'::jsonb), nullif(btrim(p_data->>'custom_service'),''), v_total,
    coalesce(p_data->'payment_terms','[]'::jsonb), coalesce(nullif(p_data->>'valid_until','')::date, current_date + 15), nullif(btrim(p_data->>'notes'),'')
  ) RETURNING id INTO v_id;
  INSERT INTO public.audit_log(user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'create_commercial_record', 'commercial_records', v_id, jsonb_build_object('quote_number', v_quote));
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_create_commercial_record(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_commercial_record(jsonb) TO authenticated;
