/*
  Fase 7 — retenção financeira, prévia de exclusão e diagnóstico do Storage.

  Esta migração é aditiva e deve ser aplicada SOMENTE na homologação antes da
  produção. O histórico preservado não possui chaves estrangeiras destrutivas:
  contratos e lançamentos continuam identificáveis após excluir um cliente.
*/

BEGIN;

ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS contract_value numeric(14,2);
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'BRL';
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS protection_mode text NOT NULL DEFAULT 'administrative';
ALTER TABLE public.fotos ADD COLUMN IF NOT EXISTS protection_mode text NOT NULL DEFAULT 'authored_photo';
ALTER TABLE public.solicitacoes ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'outros';

-- O extrato nunca é liberado para clientes. FORCE RLS protege inclusive contra
-- consultas feitas por funções comuns sem a verificação administrativa.
ALTER TABLE public.financeiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro FORCE ROW LEVEL SECURITY;
ALTER TABLE public.extrato_financeiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extrato_financeiro FORCE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname='public' AND tablename IN ('financeiro','extrato_financeiro')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END;
$$;

CREATE POLICY finance_admin_only ON public.financeiro FOR ALL TO authenticated
  USING (public.is_portal_admin()) WITH CHECK (public.is_portal_admin());
CREATE POLICY ledger_admin_only ON public.extrato_financeiro FOR ALL TO authenticated
  USING (public.is_portal_admin()) WITH CHECK (public.is_portal_admin());
REVOKE ALL ON public.financeiro, public.extrato_financeiro FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro, public.extrato_financeiro TO authenticated;

-- Configurações internas não são necessárias no aplicativo do cliente.
DROP POLICY IF EXISTS settings_authenticated_read ON public.configuracoes;
DROP POLICY IF EXISTS settings_admin_manage ON public.configuracoes;
CREATE POLICY settings_admin_only ON public.configuracoes FOR ALL TO authenticated
  USING (public.is_portal_admin()) WITH CHECK (public.is_portal_admin());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contratos_contract_value_nonnegative'
      AND conrelid = 'public.contratos'::regclass
  ) THEN
    ALTER TABLE public.contratos
      ADD CONSTRAINT contratos_contract_value_nonnegative
      CHECK (contract_value IS NULL OR contract_value >= 0) NOT VALID;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='documentos_protection_mode_valid' AND conrelid='public.documentos'::regclass) THEN
    ALTER TABLE public.documentos ADD CONSTRAINT documentos_protection_mode_valid
      CHECK(protection_mode IN ('administrative','authored_pdf')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fotos_protection_mode_valid' AND conrelid='public.fotos'::regclass) THEN
    ALTER TABLE public.fotos ADD CONSTRAINT fotos_protection_mode_valid
      CHECK(protection_mode IN ('administrative','authored_photo')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='solicitacoes_categoria_valid' AND conrelid='public.solicitacoes'::regclass) THEN
    ALTER TABLE public.solicitacoes ADD CONSTRAINT solicitacoes_categoria_valid
      CHECK(categoria IN ('duvida','alteracao_projeto','documento','financeiro','agendamento','obra','suporte','outros')) NOT VALID;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.protected_asset_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_kind text NOT NULL CHECK(asset_kind IN ('document','photo')),
  asset_id uuid NOT NULL,
  user_id uuid NOT NULL,
  client_id uuid,
  project_id uuid,
  contract_number text,
  tracking_code text NOT NULL,
  issued_storage_path text NOT NULL,
  action text NOT NULL DEFAULT 'view',
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS protected_asset_issues_user_idx ON public.protected_asset_issues(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS protected_asset_issues_asset_idx ON public.protected_asset_issues(asset_kind,asset_id,created_at DESC);
ALTER TABLE public.protected_asset_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protected_asset_issues FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS protected_asset_issues_read ON public.protected_asset_issues;
CREATE POLICY protected_asset_issues_read ON public.protected_asset_issues FOR SELECT TO authenticated
  USING(user_id=auth.uid() OR public.is_portal_admin());
REVOKE ALL ON public.protected_asset_issues FROM anon,authenticated;
GRANT SELECT ON public.protected_asset_issues TO authenticated;

CREATE OR REPLACE FUNCTION public.can_read_portal_object(p_bucket text, p_name text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT public.is_portal_admin()
  OR EXISTS (SELECT 1 FROM public.documentos d WHERE d.storage_bucket=p_bucket AND d.arquivo=p_name AND d.protection_mode='administrative' AND d.projeto_id IS NOT NULL AND public.can_access_project(d.projeto_id))
  OR EXISTS (SELECT 1 FROM public.fotos f WHERE f.storage_bucket=p_bucket AND f.arquivo=p_name AND f.protection_mode='administrative' AND f.projeto_id IS NOT NULL AND public.can_access_project(f.projeto_id))
  OR EXISTS (SELECT 1 FROM public.biblioteca b WHERE b.storage_bucket=p_bucket AND b.arquivo=p_name AND (
       (b.projeto_id IS NOT NULL AND public.can_access_project(b.projeto_id))
       OR (b.projeto_id IS NULL AND b.cliente_id=public.current_client_id())
       OR (b.projeto_id IS NULL AND b.cliente_id IS NULL AND public.current_client_id() IS NOT NULL)
  ))
  OR EXISTS (SELECT 1 FROM public.protected_pdf_issues i WHERE p_bucket='materiais-protegidos' AND i.issued_storage_path=p_name AND (i.user_id=auth.uid() OR i.client_id=public.current_client_id()) AND (i.expires_at IS NULL OR i.expires_at>now()))
  OR EXISTS (SELECT 1 FROM public.protected_asset_issues i WHERE p_bucket='materiais-protegidos' AND i.issued_storage_path=p_name AND i.user_id=auth.uid() AND i.expires_at>now());
$$;
REVOKE ALL ON FUNCTION public.can_read_portal_object(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_read_portal_object(text,text) TO authenticated;

CREATE TABLE IF NOT EXISTS public.client_financial_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table text NOT NULL,
  source_row_id text NOT NULL,
  original_client_id uuid,
  original_contract_id uuid,
  original_project_id uuid,
  client_name_snapshot text NOT NULL,
  client_email_snapshot text,
  contract_number_snapshot text,
  service_type_snapshot text,
  contract_value_snapshot numeric(14,2),
  currency text NOT NULL DEFAULT 'BRL',
  transaction_type text,
  description text,
  amount numeric(14,2),
  occurred_on date,
  source_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  archived_reason text NOT NULL,
  archived_by uuid,
  archived_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_financial_archive_source_unique UNIQUE(source_table, source_row_id)
);

CREATE INDEX IF NOT EXISTS client_financial_archive_contract_idx
  ON public.client_financial_archive(contract_number_snapshot);
CREATE INDEX IF NOT EXISTS client_financial_archive_client_idx
  ON public.client_financial_archive(original_client_id);
CREATE INDEX IF NOT EXISTS client_financial_archive_archived_at_idx
  ON public.client_financial_archive(archived_at DESC);

ALTER TABLE public.client_financial_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_financial_archive FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS financial_archive_admin_read ON public.client_financial_archive;
CREATE POLICY financial_archive_admin_read ON public.client_financial_archive
  FOR SELECT TO authenticated USING (public.is_portal_admin());
REVOKE ALL ON public.client_financial_archive FROM anon, authenticated;
GRANT SELECT ON public.client_financial_archive TO authenticated;

CREATE OR REPLACE FUNCTION public.archive_json_numeric(p_value text)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE
    WHEN btrim(coalesce(p_value,'')) ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN btrim(p_value)::numeric
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.archive_json_date(p_value text)
RETURNS date LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE
    WHEN btrim(coalesce(p_value,'')) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      THEN btrim(p_value)::date
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.admin_archive_client_financial_history(
  p_cliente_id uuid,
  p_reason text DEFAULT 'client_deletion'
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_client public.clientes%ROWTYPE;
  v_projects uuid[];
  v_contracts bigint := 0;
  v_finance bigint := 0;
  v_ledger bigint := 0;
BEGIN
  IF NOT public.is_portal_admin() THEN RAISE EXCEPTION 'Acesso administrativo necessário'; END IF;
  SELECT * INTO v_client FROM public.clientes WHERE id = p_cliente_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cliente não encontrado'; END IF;

  SELECT coalesce(array_agg(id), '{}'::uuid[])
  INTO v_projects FROM public.projetos WHERE cliente_id = p_cliente_id;

  INSERT INTO public.client_financial_archive(
    source_table, source_row_id, original_client_id, original_contract_id,
    client_name_snapshot, client_email_snapshot, contract_number_snapshot,
    service_type_snapshot, contract_value_snapshot, currency, transaction_type,
    description, amount, source_snapshot, archived_reason, archived_by
  )
  SELECT 'contratos', c.id::text, c.cliente_id, c.id,
    v_client.nome, v_client.email, c.contract_number, c.service_type,
    c.contract_value, coalesce(c.currency,'BRL'), 'contract_value',
    'Valor contratado', c.contract_value, to_jsonb(c), p_reason, auth.uid()
  FROM public.contratos c WHERE c.cliente_id = p_cliente_id
  ON CONFLICT (source_table, source_row_id) DO NOTHING;
  GET DIAGNOSTICS v_contracts = ROW_COUNT;

  INSERT INTO public.client_financial_archive(
    source_table, source_row_id, original_client_id, original_contract_id,
    original_project_id, client_name_snapshot, client_email_snapshot,
    contract_number_snapshot, service_type_snapshot, contract_value_snapshot,
    currency, transaction_type, description, amount, occurred_on,
    source_snapshot, archived_reason, archived_by
  )
  SELECT 'financeiro', coalesce(to_jsonb(f)->>'id', md5(to_jsonb(f)::text)),
    p_cliente_id, c.id, p.id, v_client.nome, v_client.email,
    coalesce(c.contract_number,p.numero_contrato), coalesce(c.service_type,p.tipo),
    c.contract_value, coalesce(c.currency,'BRL'), to_jsonb(f)->>'tipo',
    coalesce(to_jsonb(f)->>'descricao','Lançamento financeiro'),
    public.archive_json_numeric(to_jsonb(f)->>'valor'),
    public.archive_json_date(to_jsonb(f)->>'data'),
    to_jsonb(f), p_reason, auth.uid()
  FROM public.financeiro f
  JOIN public.projetos p ON p.id = f.projeto_id
  LEFT JOIN public.contratos c ON c.id = p.contract_id
  WHERE p.cliente_id = p_cliente_id
  ON CONFLICT (source_table, source_row_id) DO NOTHING;
  GET DIAGNOSTICS v_finance = ROW_COUNT;

  INSERT INTO public.client_financial_archive(
    source_table, source_row_id, original_client_id, original_contract_id,
    original_project_id, client_name_snapshot, client_email_snapshot,
    contract_number_snapshot, service_type_snapshot, contract_value_snapshot,
    currency, transaction_type, description, amount, occurred_on,
    source_snapshot, archived_reason, archived_by
  )
  SELECT 'extrato_financeiro', coalesce(to_jsonb(e)->>'id', md5(to_jsonb(e)::text)),
    p_cliente_id, c.id, e.projeto_id, v_client.nome, v_client.email,
    coalesce(c.contract_number,p.numero_contrato,to_jsonb(e)->>'numero_contrato_snapshot'),
    coalesce(c.service_type,p.tipo,to_jsonb(e)->>'servico_snapshot'), c.contract_value, coalesce(c.currency,'BRL'),
    'ledger_snapshot',
    concat_ws(' • ',
      coalesce(nullif(to_jsonb(e)->>'observacoes',''),'Extrato consolidado'),
      'Recebido: ' || coalesce(to_jsonb(e)->>'valor_recebido','0'),
      'Saldo: ' || coalesce(to_jsonb(e)->>'saldo','0')
    ),
    public.archive_json_numeric(to_jsonb(e)->>'valor_contratado'),
    coalesce(public.archive_json_date(to_jsonb(e)->>'data_contratacao'), public.archive_json_date(to_jsonb(e)->>'data_ultimo_recebimento')),
    to_jsonb(e), p_reason, auth.uid()
  FROM public.extrato_financeiro e
  LEFT JOIN public.projetos p ON p.id = e.projeto_id
  LEFT JOIN public.contratos c ON c.id = p.contract_id
  WHERE e.cliente_id = p_cliente_id OR e.projeto_id = ANY(v_projects)
  ON CONFLICT (source_table, source_row_id) DO NOTHING;
  GET DIAGNOSTICS v_ledger = ROW_COUNT;

  RETURN jsonb_build_object(
    'contracts', v_contracts,
    'financialEntries', v_finance,
    'ledgerEntries', v_ledger,
    'totalArchived', v_contracts + v_finance + v_ledger
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_archive_client_financial_history(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_archive_client_financial_history(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.prevent_financial_archive_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'O histórico financeiro preservado é imutável';
END;
$$;

DROP TRIGGER IF EXISTS prevent_financial_archive_mutation_trigger ON public.client_financial_archive;
CREATE TRIGGER prevent_financial_archive_mutation_trigger
  BEFORE UPDATE OR DELETE ON public.client_financial_archive
  FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_archive_mutation();

CREATE OR REPLACE FUNCTION public.admin_client_deletion_preview(p_cliente_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = '' AS $$
DECLARE v_projects uuid[]; v_client jsonb;
BEGIN
  IF NOT public.is_portal_admin() THEN RAISE EXCEPTION 'Acesso administrativo necessário'; END IF;
  SELECT jsonb_build_object('id',id,'name',nome,'email',email,'status',status)
    INTO v_client FROM public.clientes WHERE id=p_cliente_id;
  IF v_client IS NULL THEN RAISE EXCEPTION 'Cliente não encontrado'; END IF;
  SELECT coalesce(array_agg(id),'{}'::uuid[]) INTO v_projects
    FROM public.projetos WHERE cliente_id=p_cliente_id;
  RETURN v_client || jsonb_build_object(
    'contracts',(SELECT count(*) FROM public.contratos WHERE cliente_id=p_cliente_id),
    'projects',coalesce(array_length(v_projects,1),0),
    'documents',(SELECT count(*) FROM public.documentos WHERE cliente_id=p_cliente_id OR projeto_id=ANY(v_projects)),
    'photos',(SELECT count(*) FROM public.fotos WHERE cliente_id=p_cliente_id OR projeto_id=ANY(v_projects)),
    'libraryItems',(SELECT count(*) FROM public.biblioteca WHERE cliente_id=p_cliente_id OR projeto_id=ANY(v_projects)),
    'financialEntries',(SELECT count(*) FROM public.financeiro WHERE projeto_id=ANY(v_projects)),
    'ledgerEntries',(SELECT count(*) FROM public.extrato_financeiro WHERE cliente_id=p_cliente_id OR projeto_id=ANY(v_projects)),
    'contractedValue',(SELECT coalesce(sum(contract_value),0) FROM public.contratos WHERE cliente_id=p_cliente_id),
    'alreadyArchived',(SELECT count(*) FROM public.client_financial_archive WHERE original_client_id=p_cliente_id)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_client_deletion_preview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_client_deletion_preview(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_create_contract_project_v2(
  p_cliente_id uuid, p_contract_number text, p_project_name text,
  p_service_type text, p_contract_value numeric,
  p_city text DEFAULT NULL, p_state text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_contract uuid; v_project uuid; v_auth uuid;
BEGIN
  IF NOT public.is_portal_admin() THEN RAISE EXCEPTION 'Acesso administrativo necessário'; END IF;
  IF length(btrim(p_contract_number)) < 2 OR length(btrim(p_project_name)) < 3
    OR length(btrim(p_service_type)) < 3 OR p_contract_value IS NULL OR p_contract_value <= 0
  THEN RAISE EXCEPTION 'Dados incompletos ou valor contratado inválido'; END IF;
  SELECT auth_id INTO v_auth FROM public.clientes WHERE id=p_cliente_id AND status='ativo';
  IF NOT FOUND THEN RAISE EXCEPTION 'Cliente ativo não encontrado'; END IF;
  INSERT INTO public.contratos(cliente_id,contract_number,service_type,contract_value,currency,status)
  VALUES(p_cliente_id,btrim(p_contract_number),btrim(p_service_type),p_contract_value,'BRL','ativo')
  RETURNING id INTO v_contract;
  INSERT INTO public.projetos(cliente_id,contract_id,numero_contrato,nome,tipo,status,cidade_obra,estado_obra)
  VALUES(p_cliente_id,v_contract,btrim(p_contract_number),btrim(p_project_name),btrim(p_service_type),'ativo',
    nullif(btrim(coalesce(p_city,'')),''),upper(nullif(btrim(coalesce(p_state,'')),'')))
  RETURNING id INTO v_project;
  IF v_auth IS NOT NULL THEN
    INSERT INTO public.project_members(project_id,user_id,role,active)
    VALUES(v_project,v_auth,'client',true)
    ON CONFLICT(project_id,user_id) DO UPDATE SET active=true,role='client',updated_at=now();
  END IF;
  RETURN jsonb_build_object('contract_id',v_contract,'project_id',v_project);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_create_contract_project_v2(uuid,text,text,text,numeric,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_contract_project_v2(uuid,text,text,text,numeric,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_contract_value(p_contract_id uuid, p_value numeric)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_portal_admin() THEN RAISE EXCEPTION 'Acesso administrativo necessário'; END IF;
  IF p_value IS NULL OR p_value <= 0 THEN RAISE EXCEPTION 'Valor contratado inválido'; END IF;
  UPDATE public.contratos SET contract_value=p_value,currency='BRL',updated_at=now() WHERE id=p_contract_id;
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_update_contract_value(uuid,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_contract_value(uuid,numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.reply_to_own_request(p_solicitacao_id uuid, p_mensagem text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid; v_cliente uuid;
BEGIN
  IF length(btrim(coalesce(p_mensagem,''))) NOT BETWEEN 1 AND 4000 THEN RAISE EXCEPTION 'Mensagem inválida'; END IF;
  SELECT s.cliente_id INTO v_cliente FROM public.solicitacoes s
  WHERE s.id=p_solicitacao_id
    AND s.status NOT IN ('concluida','cancelada')
    AND s.projeto_id IS NOT NULL AND public.can_access_project(s.projeto_id)
  FOR UPDATE;
  IF v_cliente IS NULL OR v_cliente<>public.current_client_id() THEN RAISE EXCEPTION 'Solicitação indisponível'; END IF;
  INSERT INTO public.solicitacao_respostas(solicitacao_id,cliente_id,autor,mensagem)
  VALUES(p_solicitacao_id,v_cliente,'cliente',btrim(p_mensagem)) RETURNING id INTO v_id;
  UPDATE public.solicitacoes SET status='nova',updated_at=now() WHERE id=p_solicitacao_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.reply_to_own_request(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reply_to_own_request(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_storage_orphan_details()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = '' AS $$
DECLARE v_metadata jsonb; v_objects jsonb;
BEGIN
  IF NOT public.is_portal_admin() THEN RAISE EXCEPTION 'Acesso administrativo necessário'; END IF;
  WITH metadata AS (
    SELECT 'documento' kind,d.id,d.nome,d.storage_bucket bucket,d.arquivo path,d.projeto_id FROM public.documentos d WHERE d.arquivo IS NOT NULL
    UNION ALL SELECT 'foto',f.id,f.nome,f.storage_bucket,f.arquivo,f.projeto_id FROM public.fotos f WHERE f.arquivo IS NOT NULL
    UNION ALL SELECT 'biblioteca',b.id,b.nome,b.storage_bucket,b.arquivo,b.projeto_id FROM public.biblioteca b WHERE b.arquivo IS NOT NULL
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('kind',m.kind,'id',m.id,'name',m.nome,'bucket',m.bucket,'path',m.path,'projectId',m.projeto_id) ORDER BY m.kind,m.nome),'[]'::jsonb)
  INTO v_metadata FROM metadata m
  WHERE NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id=m.bucket AND o.name=m.path);

  SELECT coalesce(jsonb_agg(jsonb_build_object('bucket',o.bucket_id,'path',o.name,'size',coalesce((o.metadata->>'size')::bigint,0),'createdAt',o.created_at) ORDER BY o.created_at DESC),'[]'::jsonb)
  INTO v_objects FROM storage.objects o
  WHERE o.bucket_id=ANY(ARRAY['documentos','fotos','materiais-protegidos','biblioteca'])
    AND NOT EXISTS(SELECT 1 FROM public.documentos d WHERE d.storage_bucket=o.bucket_id AND d.arquivo=o.name)
    AND NOT EXISTS(SELECT 1 FROM public.fotos f WHERE f.storage_bucket=o.bucket_id AND f.arquivo=o.name)
    AND NOT EXISTS(SELECT 1 FROM public.biblioteca b WHERE b.storage_bucket=o.bucket_id AND b.arquivo=o.name)
    AND NOT EXISTS(SELECT 1 FROM public.protected_pdf_issues i WHERE o.bucket_id='materiais-protegidos' AND i.issued_storage_path=o.name)
    AND NOT EXISTS(SELECT 1 FROM public.protected_asset_issues i WHERE o.bucket_id='materiais-protegidos' AND i.issued_storage_path=o.name)
    AND NOT EXISTS(SELECT 1 FROM public.protected_site_pdfs p WHERE o.bucket_id='materiais-protegidos' AND p.original_storage_path=o.name);
  RETURN jsonb_build_object('orphanMetadata',v_metadata,'orphanObjects',v_objects);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_storage_orphan_details() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_storage_orphan_details() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_purge_client_database(p_cliente_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_auth uuid; v_projects uuid[];
BEGIN
  IF NOT public.is_portal_admin() THEN RAISE EXCEPTION 'Acesso administrativo necessário'; END IF;
  SELECT auth_id INTO v_auth FROM public.clientes WHERE id=p_cliente_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cliente não encontrado'; END IF;
  PERFORM public.admin_archive_client_financial_history(p_cliente_id,'client_deletion');
  SELECT coalesce(array_agg(id),'{}'::uuid[]) INTO v_projects FROM public.projetos WHERE cliente_id=p_cliente_id;
  DELETE FROM public.solicitacao_respostas WHERE cliente_id=p_cliente_id OR solicitacao_id IN (SELECT id FROM public.solicitacoes WHERE cliente_id=p_cliente_id OR projeto_id=ANY(v_projects));
  DELETE FROM public.solicitacoes WHERE cliente_id=p_cliente_id OR projeto_id=ANY(v_projects);
  DELETE FROM public.aprovacoes WHERE cliente_id=p_cliente_id OR projeto_id=ANY(v_projects);
  DELETE FROM public.agenda WHERE cliente_id=p_cliente_id OR projeto_id=ANY(v_projects);
  DELETE FROM public.cronograma WHERE cliente_id=p_cliente_id OR projeto_id=ANY(v_projects);
  DELETE FROM public.documentos WHERE cliente_id=p_cliente_id OR projeto_id=ANY(v_projects);
  DELETE FROM public.fotos WHERE cliente_id=p_cliente_id OR projeto_id=ANY(v_projects);
  DELETE FROM public.biblioteca WHERE cliente_id=p_cliente_id OR projeto_id=ANY(v_projects);
  DELETE FROM public.financeiro WHERE projeto_id=ANY(v_projects);
  DELETE FROM public.notificacoes WHERE cliente_id=p_cliente_id OR projeto_id=ANY(v_projects);
  DELETE FROM public.protected_pdf_issues WHERE client_id=p_cliente_id;
  DELETE FROM public.protected_asset_issues WHERE client_id=p_cliente_id;
  UPDATE public.extrato_financeiro SET cliente_id=NULL,projeto_id=NULL WHERE cliente_id=p_cliente_id OR projeto_id=ANY(v_projects);
  DELETE FROM public.projetos WHERE id=ANY(v_projects);
  DELETE FROM public.contratos WHERE cliente_id=p_cliente_id;
  DELETE FROM public.clientes WHERE id=p_cliente_id;
  RETURN v_auth;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_purge_client_database(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_purge_client_database(uuid) TO authenticated;

-- Portal, aplicativo e versão web usam as mesmas tabelas. O Realtime apenas
-- avisa que houve mudança; cada nova leitura continua passando pelas RLS.
-- Tabelas financeiras não são publicadas para reduzir a superfície de exposição.
DO $$
DECLARE v_table text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
    FOREACH v_table IN ARRAY ARRAY[
      'clientes','contratos','projetos','project_members','documentos','fotos','biblioteca',
      'agenda','cronograma','aprovacoes','solicitacoes','solicitacao_respostas','notificacoes'
    ] LOOP
      IF to_regclass(format('public.%I',v_table)) IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM pg_publication_tables
           WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=v_table
         )
      THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',v_table);
      END IF;
    END LOOP;

    FOREACH v_table IN ARRAY ARRAY[
      'financeiro','extrato_financeiro','client_financial_archive','protected_asset_issues'
    ] LOOP
      IF EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=v_table
      )
      THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I',v_table);
      END IF;
    END LOOP;
  END IF;
END;
$$;

COMMIT;
