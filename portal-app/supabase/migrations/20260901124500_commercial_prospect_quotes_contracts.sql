BEGIN;

CREATE TABLE IF NOT EXISTS public.document_number_counters (
  kind text NOT NULL,
  year integer NOT NULL,
  month integer NOT NULL,
  last_value integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, year, month),
  CONSTRAINT document_number_counters_kind_valid CHECK (kind IN ('ORC','CON')),
  CONSTRAINT document_number_counters_month_valid CHECK (month BETWEEN 1 AND 12),
  CONSTRAINT document_number_counters_value_valid CHECK (last_value >= 0)
);
ALTER TABLE public.document_number_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.document_number_counters FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.document_number_counters TO authenticated;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='document_number_counters' AND policyname='document_number_counters_admin') THEN
    CREATE POLICY document_number_counters_admin ON public.document_number_counters FOR ALL TO authenticated USING (public.is_portal_admin()) WITH CHECK (public.is_portal_admin());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.commercial_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number text NOT NULL,
  contract_number text,
  status text NOT NULL DEFAULT 'rascunho_orcamento',
  prospect_name text NOT NULL,
  cpf_cnpj text,
  email text,
  phone text,
  cep text,
  address text,
  city text,
  state text,
  property_address text,
  property_type text,
  area_terreno_m2 numeric,
  area_construida_m2 numeric,
  construction_standard text,
  experience_level text,
  services jsonb NOT NULL DEFAULT '[]'::jsonb,
  custom_service text,
  total_value numeric,
  payment_terms jsonb NOT NULL DEFAULT '[]'::jsonb,
  valid_until date NOT NULL DEFAULT (current_date + 15),
  notes text,
  quote_document_id uuid REFERENCES public.documentos(id) ON DELETE SET NULL,
  contract_document_id uuid REFERENCES public.documentos(id) ON DELETE SET NULL,
  linked_client_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  linked_contract_id uuid REFERENCES public.contratos(id) ON DELETE SET NULL,
  linked_project_id uuid REFERENCES public.projetos(id) ON DELETE SET NULL,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commercial_records_quote_number_not_blank CHECK (length(btrim(quote_number)) > 0),
  CONSTRAINT commercial_records_prospect_name_not_blank CHECK (length(btrim(prospect_name)) > 0),
  CONSTRAINT commercial_records_total_value_nonnegative CHECK (total_value IS NULL OR total_value >= 0),
  CONSTRAINT commercial_records_status_valid CHECK (status IN ('rascunho_orcamento','orcamento_gerado','orcamento_aceito','contrato_gerado','convertido','cancelado'))
);
CREATE UNIQUE INDEX IF NOT EXISTS commercial_records_quote_number_unique_ci ON public.commercial_records(upper(btrim(quote_number)));
CREATE UNIQUE INDEX IF NOT EXISTS commercial_records_contract_number_unique_ci ON public.commercial_records(upper(btrim(contract_number))) WHERE contract_number IS NOT NULL AND btrim(contract_number) <> '';
CREATE INDEX IF NOT EXISTS commercial_records_created_idx ON public.commercial_records(created_at DESC);
CREATE INDEX IF NOT EXISTS commercial_records_status_idx ON public.commercial_records(status, created_at DESC);
ALTER TABLE public.commercial_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.commercial_records FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.commercial_records TO authenticated;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='commercial_records' AND policyname='commercial_records_admin') THEN
    CREATE POLICY commercial_records_admin ON public.commercial_records FOR ALL TO authenticated USING (public.is_portal_admin()) WITH CHECK (public.is_portal_admin());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_next_commercial_number(p_kind text)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE v_kind text := upper(btrim(p_kind)); v_year integer; v_month integer; v_value integer;
BEGIN
  IF NOT public.is_portal_admin() THEN RAISE EXCEPTION 'Acesso administrativo necessário'; END IF;
  IF v_kind NOT IN ('ORC','CON') THEN RAISE EXCEPTION 'Tipo de numeração inválido'; END IF;
  v_year := extract(year from timezone('America/Sao_Paulo', now()))::integer;
  v_month := extract(month from timezone('America/Sao_Paulo', now()))::integer;
  INSERT INTO public.document_number_counters(kind, year, month, last_value)
  VALUES (v_kind, v_year, v_month, 1)
  ON CONFLICT (kind, year, month) DO UPDATE SET last_value = public.document_number_counters.last_value + 1, updated_at = now()
  RETURNING last_value INTO v_value;
  RETURN format('%s-%s-%s-%s', v_kind, v_year, lpad(v_month::text,2,'0'), lpad(v_value::text,4,'0'));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_next_commercial_number(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_next_commercial_number(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_create_commercial_record(p_data jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE v_id uuid; v_quote text;
BEGIN
  IF NOT public.is_portal_admin() THEN RAISE EXCEPTION 'Acesso administrativo necessário'; END IF;
  IF nullif(btrim(p_data->>'prospect_name'),'') IS NULL THEN RAISE EXCEPTION 'Nome do prospect é obrigatório'; END IF;
  v_quote := public.admin_next_commercial_number('ORC');
  INSERT INTO public.commercial_records(
    quote_number, prospect_name, cpf_cnpj, email, phone, cep, address, city, state,
    property_address, property_type, area_terreno_m2, area_construida_m2, construction_standard,
    experience_level, services, custom_service, total_value, payment_terms, valid_until, notes
  ) VALUES (
    v_quote, btrim(p_data->>'prospect_name'), nullif(btrim(p_data->>'cpf_cnpj'),''), nullif(btrim(p_data->>'email'),''),
    nullif(btrim(p_data->>'phone'),''), nullif(btrim(p_data->>'cep'),''), nullif(btrim(p_data->>'address'),''),
    nullif(btrim(p_data->>'city'),''), nullif(btrim(p_data->>'state'),''), nullif(btrim(p_data->>'property_address'),''),
    nullif(btrim(p_data->>'property_type'),''), nullif(p_data->>'area_terreno_m2','')::numeric, nullif(p_data->>'area_construida_m2','')::numeric,
    nullif(btrim(p_data->>'construction_standard'),''), nullif(btrim(p_data->>'experience_level'),''),
    coalesce(p_data->'services','[]'::jsonb), nullif(btrim(p_data->>'custom_service'),''), nullif(p_data->>'total_value','')::numeric,
    coalesce(p_data->'payment_terms','[]'::jsonb), coalesce(nullif(p_data->>'valid_until','')::date, current_date + 15), nullif(btrim(p_data->>'notes'),'')
  ) RETURNING id INTO v_id;
  INSERT INTO public.audit_log(user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'create_commercial_record', 'commercial_records', v_id, jsonb_build_object('quote_number', v_quote));
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_create_commercial_record(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_commercial_record(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_assign_commercial_contract_number(p_record_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE v_number text;
BEGIN
  IF NOT public.is_portal_admin() THEN RAISE EXCEPTION 'Acesso administrativo necessário'; END IF;
  SELECT contract_number INTO v_number FROM public.commercial_records WHERE id=p_record_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registro comercial não encontrado'; END IF;
  IF v_number IS NULL OR btrim(v_number)='' THEN
    v_number := public.admin_next_commercial_number('CON');
    UPDATE public.commercial_records SET contract_number=v_number, updated_at=now() WHERE id=p_record_id;
  END IF;
  RETURN v_number;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_assign_commercial_contract_number(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_assign_commercial_contract_number(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_convert_commercial_record(p_record_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE r public.commercial_records%ROWTYPE; v_client uuid; v_contract uuid; v_project uuid; v_project_name text; item jsonb; v_code text; v_name text;
BEGIN
  IF NOT public.is_portal_admin() THEN RAISE EXCEPTION 'Acesso administrativo necessário'; END IF;
  SELECT * INTO r FROM public.commercial_records WHERE id=p_record_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registro comercial não encontrado'; END IF;
  IF r.linked_project_id IS NOT NULL THEN RETURN jsonb_build_object('client_id',r.linked_client_id,'contract_id',r.linked_contract_id,'project_id',r.linked_project_id); END IF;

  IF r.email IS NOT NULL THEN SELECT id INTO v_client FROM public.clientes WHERE lower(btrim(email))=lower(btrim(r.email)) LIMIT 1; END IF;
  IF v_client IS NULL AND r.cpf_cnpj IS NOT NULL THEN SELECT id INTO v_client FROM public.clientes WHERE regexp_replace(coalesce(cpf_cnpj,''),'\D','','g')=regexp_replace(r.cpf_cnpj,'\D','','g') LIMIT 1; END IF;
  IF v_client IS NULL THEN
    INSERT INTO public.clientes(nome,cpf_cnpj,telefone,email,endereco,cidade,estado,cep,status,parceria)
    VALUES(r.prospect_name,r.cpf_cnpj,r.phone,r.email,r.address,r.city,r.state,r.cep,'ativo',false) RETURNING id INTO v_client;
  END IF;

  IF r.contract_number IS NULL THEN r.contract_number := public.admin_next_commercial_number('CON'); END IF;
  INSERT INTO public.contratos(cliente_id,contract_number,service_type,status,contract_value,currency,notes)
  VALUES(v_client,r.contract_number,coalesce(r.custom_service,r.property_type),'ativo',r.total_value,'BRL',concat_ws(' | ','Originado do orçamento '||r.quote_number, r.notes))
  RETURNING id INTO v_contract;

  v_project_name := coalesce(nullif(r.property_type,''),'Projeto') || ' — ' || r.prospect_name;
  INSERT INTO public.projetos(cliente_id,nome,tipo,status,numero_contrato,numero_orcamento,area_construida_m2,area_terreno_m2,cep_obra,endereco_obra,cidade_obra,estado_obra,contract_id,parceria)
  VALUES(v_client,v_project_name,r.property_type,'ativo',r.contract_number,r.quote_number,r.area_construida_m2,r.area_terreno_m2,r.cep,r.property_address,r.city,r.state,v_contract,false)
  RETURNING id INTO v_project;

  FOR item IN SELECT * FROM jsonb_array_elements(coalesce(r.services,'[]'::jsonb)) LOOP
    IF coalesce((item->>'included')::boolean,true) THEN
      v_code := nullif(btrim(item->>'code'),''); v_name := nullif(btrim(item->>'name'),'');
      IF v_code IS NOT NULL AND v_name IS NOT NULL THEN
        INSERT INTO public.contract_scope_items(contract_id,service_code,service_name,included,acceptance_required,display_order,notes)
        VALUES(v_contract,v_code,v_name,true,coalesce((item->>'acceptanceRequired')::boolean,true),coalesce((item->>'displayOrder')::integer,0),nullif(item->>'notes',''))
        ON CONFLICT (contract_id,service_code) DO UPDATE SET service_name=excluded.service_name,included=true,acceptance_required=excluded.acceptance_required,display_order=excluded.display_order,notes=excluded.notes,updated_at=now();
      END IF;
    END IF;
  END LOOP;

  UPDATE public.commercial_records SET contract_number=r.contract_number, linked_client_id=v_client, linked_contract_id=v_contract, linked_project_id=v_project, status='convertido', updated_at=now() WHERE id=r.id;
  UPDATE public.documentos SET cliente_id=v_client, projeto_id=v_project, contract_id=v_contract WHERE id IN (r.quote_document_id,r.contract_document_id) AND id IS NOT NULL;
  INSERT INTO public.audit_log(user_id, action, entity_type, entity_id, details)
  VALUES(auth.uid(),'convert_commercial_record','commercial_records',r.id,jsonb_build_object('client_id',v_client,'contract_id',v_contract,'project_id',v_project));
  RETURN jsonb_build_object('client_id',v_client,'contract_id',v_contract,'project_id',v_project);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_convert_commercial_record(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_convert_commercial_record(uuid) TO authenticated;

COMMIT;
