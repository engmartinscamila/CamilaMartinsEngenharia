/*
  Camila Martins Engenharia — segurança, administração e Storage.

  Pré-requisito: 20260811220000_foundation_contracts_members.sql.
  Esta migração não deve ser aplicada diretamente em produção. Execute primeiro
  em backup restaurado ou branch, rode os testes em supabase/tests e revise
  public.app_security_status().
*/

BEGIN;

-- ---------------------------------------------------------------------------
-- Funções de identidade
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_client_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT c.id
  FROM public.clientes c
  WHERE c.auth_id = auth.uid() AND c.status = 'ativo'
  ORDER BY c.created_at, c.id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_client_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_client_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.can_access_project(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT public.is_portal_admin()
    OR EXISTS (
      SELECT 1
      FROM public.project_members pm
      LEFT JOIN public.projetos p ON p.id = pm.project_id
      LEFT JOIN public.clientes c ON c.id = p.cliente_id AND c.auth_id = pm.user_id
      WHERE pm.project_id = p_project_id
        AND pm.user_id = auth.uid()
        AND pm.active = true
        AND (pm.role <> 'client' OR c.status = 'ativo')
    );
$$;

CREATE OR REPLACE FUNCTION public.can_access_contract(p_contract_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT public.is_portal_admin()
    OR EXISTS (
      SELECT 1 FROM public.projetos p
      WHERE p.contract_id = p_contract_id
        AND public.can_access_project(p.id)
    );
$$;

REVOKE ALL ON FUNCTION public.can_access_project(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_contract(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_project(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_contract(uuid) TO authenticated;

-- E-mail e vínculo Auth não podem apontar para mais de um perfil. Dados
-- legados ambíguos viram pendência explícita em vez de serem mesclados.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.clientes
    WHERE email IS NOT NULL AND btrim(email) <> ''
    GROUP BY lower(btrim(email)) HAVING count(*) > 1
  ) THEN
    INSERT INTO public.app_migration_issues(issue_key,entity_type,issue_type,details)
    VALUES ('duplicate-client-emails','clientes','duplicate_normalized_email','{"action":"review_before_invites"}'::jsonb)
    ON CONFLICT (issue_key) DO UPDATE SET resolved_at=NULL,details=EXCLUDED.details;
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS clientes_email_unique_ci
      ON public.clientes(lower(btrim(email)))
      WHERE email IS NOT NULL AND btrim(email) <> '';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.clientes WHERE auth_id IS NOT NULL
    GROUP BY auth_id HAVING count(*) > 1
  ) THEN
    INSERT INTO public.app_migration_issues(issue_key,entity_type,issue_type,details)
    VALUES ('duplicate-client-auth-links','clientes','duplicate_auth_id','{"action":"review_before_access"}'::jsonb)
    ON CONFLICT (issue_key) DO UPDATE SET resolved_at=NULL,details=EXCLUDED.details;
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS clientes_auth_id_unique
      ON public.clientes(auth_id) WHERE auth_id IS NOT NULL;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS: nenhuma tabela de negócio fica aberta apenas por estar autenticado.
-- ---------------------------------------------------------------------------

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fotos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biblioteca ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cronograma ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitacao_respostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aprovacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extrato_financeiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdf_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protected_site_pdfs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protected_pdf_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

ALTER POLICY members_read_own ON public.project_members
  USING ((user_id = auth.uid() AND active = true) OR public.is_portal_admin());

-- Políticas RLS são permissivas entre si (OR). Para impedir que uma regra
-- legada mais aberta sobreviva à atualização, neutralizamos as regras antigas
-- sem apagar objetos e criamos abaixo o conjunto final auditado.
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, cmd
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY(ARRAY[
        'clientes','projetos','documentos','fotos','biblioteca','agenda',
        'cronograma','solicitacoes','solicitacao_respostas','notificacoes',
        'aprovacoes','financeiro','extrato_financeiro','configuracoes',
        'usuarios','pdf_admins','protected_site_pdfs',
        'protected_pdf_issues','audit_log'
      ])
      AND policyname <> ALL(ARRAY[
        'clients_read_own_or_admin','clients_admin_manage','clients_admin_update',
        'projects_members_read','projects_admin_manage','documents_project_read',
        'documents_admin_manage','photos_project_read','photos_admin_manage',
        'library_scoped_read','library_admin_manage','agenda_project_read',
        'agenda_admin_manage','schedule_project_read','schedule_admin_manage',
        'requests_project_read','requests_client_insert','requests_admin_manage',
        'request_replies_read','request_replies_admin_manage','notifications_read',
        'notifications_admin_manage','approvals_project_read','approvals_admin_manage',
        'finance_admin_only','ledger_admin_only','settings_authenticated_read',
        'settings_admin_manage','users_self_read','users_admin_manage',
        'pdf_admins_self_read','pdf_admins_admin_manage','protected_pdfs_read',
        'protected_pdfs_admin_manage','protected_issues_read',
        'protected_issues_admin_manage','audit_admin_read'
      ])
  LOOP
    IF p.cmd IN ('SELECT','DELETE') THEN
      EXECUTE format('ALTER POLICY %I ON %I.%I USING (false)', p.policyname, p.schemaname, p.tablename);
    ELSIF p.cmd = 'INSERT' THEN
      EXECUTE format('ALTER POLICY %I ON %I.%I WITH CHECK (false)', p.policyname, p.schemaname, p.tablename);
    ELSE
      EXECUTE format('ALTER POLICY %I ON %I.%I USING (false) WITH CHECK (false)', p.policyname, p.schemaname, p.tablename);
    END IF;
  END LOOP;
END;
$$;

CREATE POLICY clients_read_own_or_admin ON public.clientes FOR SELECT TO authenticated
  USING ((auth_id = auth.uid() AND status = 'ativo') OR public.is_portal_admin());
CREATE POLICY clients_admin_manage ON public.clientes FOR INSERT TO authenticated
  WITH CHECK (public.is_portal_admin());
CREATE POLICY clients_admin_update ON public.clientes FOR UPDATE TO authenticated
  USING (public.is_portal_admin()) WITH CHECK (public.is_portal_admin());
-- Não há DELETE direto: a exclusão integral passa por função/Edge Function.

CREATE POLICY projects_members_read ON public.projetos FOR SELECT TO authenticated
  USING (public.can_access_project(id));
CREATE POLICY projects_admin_manage ON public.projetos FOR ALL TO authenticated
  USING (public.is_portal_admin()) WITH CHECK (public.is_portal_admin());

CREATE POLICY documents_project_read ON public.documentos FOR SELECT TO authenticated
  USING (projeto_id IS NOT NULL AND public.can_access_project(projeto_id));
CREATE POLICY documents_admin_manage ON public.documentos FOR ALL TO authenticated
  USING (public.is_portal_admin()) WITH CHECK (public.is_portal_admin());

CREATE POLICY photos_project_read ON public.fotos FOR SELECT TO authenticated
  USING (projeto_id IS NOT NULL AND public.can_access_project(projeto_id));
CREATE POLICY photos_admin_manage ON public.fotos FOR ALL TO authenticated
  USING (public.is_portal_admin()) WITH CHECK (public.is_portal_admin());

CREATE POLICY library_scoped_read ON public.biblioteca FOR SELECT TO authenticated
  USING (
    public.is_portal_admin()
    OR (projeto_id IS NOT NULL AND public.can_access_project(projeto_id))
    OR (projeto_id IS NULL AND cliente_id = public.current_client_id())
    OR (projeto_id IS NULL AND cliente_id IS NULL AND public.current_client_id() IS NOT NULL)
  );
CREATE POLICY library_admin_manage ON public.biblioteca FOR ALL TO authenticated
  USING (public.is_portal_admin()) WITH CHECK (public.is_portal_admin());

CREATE POLICY agenda_project_read ON public.agenda FOR SELECT TO authenticated
  USING (
    (projeto_id IS NOT NULL AND public.can_access_project(projeto_id))
    OR (projeto_id IS NULL AND cliente_id = public.current_client_id())
  );
CREATE POLICY agenda_admin_manage ON public.agenda FOR ALL TO authenticated
  USING (public.is_portal_admin()) WITH CHECK (public.is_portal_admin());

CREATE POLICY schedule_project_read ON public.cronograma FOR SELECT TO authenticated
  USING (projeto_id IS NOT NULL AND public.can_access_project(projeto_id));
CREATE POLICY schedule_admin_manage ON public.cronograma FOR ALL TO authenticated
  USING (public.is_portal_admin()) WITH CHECK (public.is_portal_admin());

CREATE POLICY requests_project_read ON public.solicitacoes FOR SELECT TO authenticated
  USING (projeto_id IS NOT NULL AND public.can_access_project(projeto_id));
CREATE POLICY requests_client_insert ON public.solicitacoes FOR INSERT TO authenticated
  WITH CHECK (
    cliente_id = public.current_client_id()
    AND projeto_id IS NOT NULL
    AND public.can_access_project(projeto_id)
    AND origem = 'cliente'
    AND status = 'nova'
  );
CREATE POLICY requests_admin_manage ON public.solicitacoes FOR ALL TO authenticated
  USING (public.is_portal_admin()) WITH CHECK (public.is_portal_admin());

CREATE POLICY request_replies_read ON public.solicitacao_respostas FOR SELECT TO authenticated
  USING (
    public.is_portal_admin()
    OR EXISTS (
      SELECT 1 FROM public.solicitacoes s
      WHERE s.id = solicitacao_id
        AND s.projeto_id IS NOT NULL
        AND public.can_access_project(s.projeto_id)
    )
  );
CREATE POLICY request_replies_admin_manage ON public.solicitacao_respostas FOR ALL TO authenticated
  USING (public.is_portal_admin()) WITH CHECK (public.is_portal_admin());

CREATE POLICY notifications_read ON public.notificacoes FOR SELECT TO authenticated
  USING (
    public.is_portal_admin()
    OR cliente_id = public.current_client_id()
    OR (projeto_id IS NOT NULL AND public.can_access_project(projeto_id))
  );
CREATE POLICY notifications_admin_manage ON public.notificacoes FOR ALL TO authenticated
  USING (public.is_portal_admin()) WITH CHECK (public.is_portal_admin());

CREATE POLICY approvals_project_read ON public.aprovacoes FOR SELECT TO authenticated
  USING (projeto_id IS NOT NULL AND public.can_access_project(projeto_id));
CREATE POLICY approvals_admin_manage ON public.aprovacoes FOR ALL TO authenticated
  USING (public.is_portal_admin()) WITH CHECK (public.is_portal_admin());

CREATE POLICY finance_admin_only ON public.financeiro FOR ALL TO authenticated
  USING (public.is_portal_admin()) WITH CHECK (public.is_portal_admin());
CREATE POLICY ledger_admin_only ON public.extrato_financeiro FOR ALL TO authenticated
  USING (public.is_portal_admin()) WITH CHECK (public.is_portal_admin());

CREATE POLICY settings_authenticated_read ON public.configuracoes FOR SELECT TO authenticated USING (true);
CREATE POLICY settings_admin_manage ON public.configuracoes FOR ALL TO authenticated
  USING (public.is_portal_admin()) WITH CHECK (public.is_portal_admin());

CREATE POLICY users_self_read ON public.usuarios FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_portal_admin());
CREATE POLICY users_admin_manage ON public.usuarios FOR ALL TO authenticated
  USING (public.is_portal_admin()) WITH CHECK (public.is_portal_admin());

CREATE POLICY pdf_admins_self_read ON public.pdf_admins FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_portal_admin());
CREATE POLICY pdf_admins_admin_manage ON public.pdf_admins FOR ALL TO authenticated
  USING (public.is_portal_admin()) WITH CHECK (public.is_portal_admin());

CREATE POLICY protected_pdfs_read ON public.protected_site_pdfs FOR SELECT TO authenticated USING (active = true OR public.is_portal_admin());
CREATE POLICY protected_pdfs_admin_manage ON public.protected_site_pdfs FOR ALL TO authenticated
  USING (public.is_portal_admin()) WITH CHECK (public.is_portal_admin());

CREATE POLICY protected_issues_read ON public.protected_pdf_issues FOR SELECT TO authenticated
  USING (public.is_portal_admin() OR user_id = auth.uid() OR client_id = public.current_client_id());
CREATE POLICY protected_issues_admin_manage ON public.protected_pdf_issues FOR ALL TO authenticated
  USING (public.is_portal_admin()) WITH CHECK (public.is_portal_admin());

CREATE POLICY audit_admin_read ON public.audit_log FOR SELECT TO authenticated USING (public.is_portal_admin());

-- Privilégios de tabela e RLS trabalham em conjunto. O papel authenticated
-- recebe os verbos necessários; as políticas acima limitam linha por linha.
REVOKE ALL ON public.clientes, public.projetos, public.documentos, public.fotos,
  public.biblioteca, public.agenda, public.cronograma, public.solicitacoes,
  public.solicitacao_respostas, public.notificacoes, public.aprovacoes,
  public.financeiro, public.extrato_financeiro, public.configuracoes,
  public.usuarios, public.pdf_admins, public.protected_site_pdfs,
  public.protected_pdf_issues, public.audit_log FROM PUBLIC, anon;
REVOKE ALL ON public.contratos, public.project_members, public.app_migration_issues
  FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes, public.projetos,
  public.documentos, public.fotos, public.biblioteca, public.agenda,
  public.cronograma, public.solicitacoes, public.solicitacao_respostas,
  public.notificacoes, public.aprovacoes, public.financeiro,
  public.extrato_financeiro, public.configuracoes, public.usuarios,
  public.pdf_admins, public.protected_site_pdfs, public.protected_pdf_issues
  TO authenticated;
GRANT SELECT ON public.audit_log TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.audit_log FROM authenticated;

-- Tokens OAuth nunca são acessados pelo aplicativo, nem por administradores.
REVOKE ALL ON public.google_calendar_tokens FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Funções estreitas para ações de cliente/admin.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.app_admin_rate_limits (
  actor_id uuid NOT NULL,
  action text NOT NULL,
  window_start timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 1,
  PRIMARY KEY (actor_id, action, window_start)
);
ALTER TABLE public.app_admin_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_admin_rate_limits FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_admin_rate_limit(p_action text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_limit integer; v_seconds integer; v_window timestamptz; v_attempts integer;
BEGIN
  IF NOT public.is_portal_admin() THEN RAISE EXCEPTION 'Acesso administrativo necessário'; END IF;
  CASE p_action
    WHEN 'admin-invite-client' THEN v_limit := 10; v_seconds := 600;
    WHEN 'admin-delete-client' THEN v_limit := 3; v_seconds := 3600;
    ELSE RAISE EXCEPTION 'Ação de limite inválida';
  END CASE;
  v_window := to_timestamp(floor(extract(epoch FROM now()) / v_seconds) * v_seconds);
  INSERT INTO public.app_admin_rate_limits(actor_id, action, window_start, attempts)
  VALUES (auth.uid(), p_action, v_window, 1)
  ON CONFLICT (actor_id, action, window_start)
  DO UPDATE SET attempts = public.app_admin_rate_limits.attempts + 1
  RETURNING attempts INTO v_attempts;
  IF v_attempts > v_limit THEN RAISE EXCEPTION 'Limite temporário excedido'; END IF;
  DELETE FROM public.app_admin_rate_limits WHERE window_start < now() - interval '2 days';
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_admin_rate_limit(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_admin_rate_limit(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_own_notification_read(p_notificacao_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.notificacoes n SET lida = true
  WHERE n.id = p_notificacao_id
    AND (n.cliente_id = public.current_client_id() OR (n.projeto_id IS NOT NULL AND public.can_access_project(n.projeto_id)));
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_to_own_approval(p_aprovacao_id uuid, p_status text, p_comentario text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_status NOT IN ('aprovado', 'rejeitado') THEN RAISE EXCEPTION 'Status inválido'; END IF;
  IF p_status = 'rejeitado' AND length(btrim(coalesce(p_comentario, ''))) < 3 THEN RAISE EXCEPTION 'Comentário obrigatório'; END IF;
  UPDATE public.aprovacoes a
  SET status = p_status, comentario = nullif(btrim(coalesce(p_comentario, '')), ''), respondido_at = now()
  WHERE a.id = p_aprovacao_id AND a.status = 'aguardando'
    AND a.projeto_id IS NOT NULL AND public.can_access_project(a.projeto_id);
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.reply_to_own_request(p_solicitacao_id uuid, p_mensagem text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid; v_cliente uuid;
BEGIN
  IF length(btrim(coalesce(p_mensagem, ''))) NOT BETWEEN 1 AND 4000 THEN RAISE EXCEPTION 'Mensagem inválida'; END IF;
  SELECT s.cliente_id INTO v_cliente FROM public.solicitacoes s
  WHERE s.id = p_solicitacao_id AND s.projeto_id IS NOT NULL AND public.can_access_project(s.projeto_id) FOR UPDATE;
  IF v_cliente IS NULL OR v_cliente <> public.current_client_id() THEN RAISE EXCEPTION 'Solicitação inválida'; END IF;
  INSERT INTO public.solicitacao_respostas(solicitacao_id, cliente_id, autor, mensagem)
  VALUES (p_solicitacao_id, v_cliente, 'cliente', btrim(p_mensagem)) RETURNING id INTO v_id;
  UPDATE public.solicitacoes SET status = 'nova', updated_at = now() WHERE id = p_solicitacao_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reply_request(p_solicitacao_id uuid, p_mensagem text, p_status text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid; v_cliente uuid;
BEGIN
  IF NOT public.is_portal_admin() THEN RAISE EXCEPTION 'Acesso administrativo necessário'; END IF;
  IF p_status NOT IN ('nova','em_analise','aguardando_cliente','em_execucao','concluida','cancelada') THEN RAISE EXCEPTION 'Status inválido'; END IF;
  IF length(btrim(coalesce(p_mensagem, ''))) NOT BETWEEN 1 AND 4000 THEN RAISE EXCEPTION 'Mensagem inválida'; END IF;
  SELECT cliente_id INTO v_cliente FROM public.solicitacoes WHERE id = p_solicitacao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
  INSERT INTO public.solicitacao_respostas(solicitacao_id, cliente_id, autor, mensagem)
  VALUES (p_solicitacao_id, v_cliente, 'administrador', btrim(p_mensagem)) RETURNING id INTO v_id;
  UPDATE public.solicitacoes SET status = p_status, updated_at = now() WHERE id = p_solicitacao_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_contract_project(
  p_cliente_id uuid, p_contract_number text, p_project_name text, p_service_type text,
  p_city text DEFAULT NULL, p_state text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_contract uuid; v_project uuid; v_auth uuid;
BEGIN
  IF NOT public.is_portal_admin() THEN RAISE EXCEPTION 'Acesso administrativo necessário'; END IF;
  IF length(btrim(p_contract_number)) < 2 OR length(btrim(p_project_name)) < 3 OR length(btrim(p_service_type)) < 3 THEN RAISE EXCEPTION 'Dados incompletos'; END IF;
  SELECT auth_id INTO v_auth FROM public.clientes WHERE id = p_cliente_id AND status = 'ativo';
  IF NOT FOUND THEN RAISE EXCEPTION 'Cliente ativo não encontrado'; END IF;
  INSERT INTO public.contratos(cliente_id, contract_number, service_type, status)
  VALUES (p_cliente_id, btrim(p_contract_number), btrim(p_service_type), 'ativo') RETURNING id INTO v_contract;
  INSERT INTO public.projetos(cliente_id, contract_id, numero_contrato, nome, tipo, status, cidade_obra, estado_obra)
  VALUES (p_cliente_id, v_contract, btrim(p_contract_number), btrim(p_project_name), btrim(p_service_type), 'ativo', nullif(btrim(coalesce(p_city,'')),''), upper(nullif(btrim(coalesce(p_state,'')),'')))
  RETURNING id INTO v_project;
  IF v_auth IS NOT NULL THEN
    INSERT INTO public.project_members(project_id, user_id, role, active) VALUES (v_project, v_auth, 'client', true)
    ON CONFLICT (project_id, user_id) DO UPDATE SET active = true, role = 'client', updated_at = now();
  END IF;
  RETURN jsonb_build_object('contract_id', v_contract, 'project_id', v_project);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_client_status(p_cliente_id uuid, p_status text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_auth uuid; v_updated boolean;
BEGIN
  IF NOT public.is_portal_admin() THEN RAISE EXCEPTION 'Acesso administrativo necessário'; END IF;
  IF p_status NOT IN ('ativo','arquivado','acesso_revogado') THEN RAISE EXCEPTION 'Status inválido'; END IF;
  UPDATE public.clientes SET status = p_status WHERE id = p_cliente_id RETURNING auth_id INTO v_auth;
  v_updated := FOUND;
  IF NOT v_updated THEN RETURN false; END IF;
  IF v_auth IS NOT NULL THEN
    UPDATE public.project_members pm
    SET active = (p_status = 'ativo'), updated_at = now()
    FROM public.projetos p
    WHERE p.id = pm.project_id
      AND p.cliente_id = p_cliente_id
      AND pm.user_id = v_auth
      AND pm.role = 'client';
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_project_for_contract(
  p_contract_id uuid, p_project_name text, p_city text DEFAULT NULL, p_state text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_project uuid; v_client uuid; v_auth uuid; v_number text; v_service text;
BEGIN
  IF NOT public.is_portal_admin() THEN RAISE EXCEPTION 'Acesso administrativo necessário'; END IF;
  IF length(btrim(coalesce(p_project_name,''))) < 3 THEN RAISE EXCEPTION 'Nome do projeto inválido'; END IF;
  SELECT c.cliente_id,c.contract_number,c.service_type,cl.auth_id
  INTO v_client,v_number,v_service,v_auth
  FROM public.contratos c
  JOIN public.clientes cl ON cl.id=c.cliente_id
  WHERE c.id=p_contract_id AND c.status NOT IN ('cancelado','arquivado');
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrato ativo não encontrado'; END IF;
  INSERT INTO public.projetos(cliente_id,contract_id,numero_contrato,nome,tipo,status,cidade_obra,estado_obra)
  VALUES (v_client,p_contract_id,v_number,btrim(p_project_name),v_service,'ativo',nullif(btrim(coalesce(p_city,'')),''),upper(nullif(btrim(coalesce(p_state,'')),'')))
  RETURNING id INTO v_project;
  IF v_auth IS NOT NULL THEN
    INSERT INTO public.project_members(project_id,user_id,role,active)
    VALUES (v_project,v_auth,'client',true)
    ON CONFLICT (project_id,user_id) DO UPDATE SET active=true,role='client',updated_at=now();
  END IF;
  RETURN v_project;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_own_notification_read(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_to_own_approval(uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reply_to_own_request(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_reply_request(uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_create_contract_project(uuid,text,text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_client_status(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_create_project_for_contract(uuid,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_own_notification_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_own_approval(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reply_to_own_request(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reply_request(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_contract_project(uuid,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_client_status(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_project_for_contract(uuid,text,text,text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Storage privado autorizado pelos metadados e pelo projeto.
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets(id, name, public, file_size_limit)
VALUES
  ('documentos','documentos',false,52428800),
  ('fotos','fotos',false,52428800),
  ('materiais-protegidos','materiais-protegidos',false,52428800),
  ('biblioteca','biblioteca',false,52428800),
  ('projetos','projetos',false,52428800),
  ('cronograma','cronograma',false,52428800),
  ('clientes','clientes',false,52428800)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit;

CREATE OR REPLACE FUNCTION public.can_read_portal_object(p_bucket text, p_name text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT public.is_portal_admin()
  OR EXISTS (SELECT 1 FROM public.documentos d WHERE d.storage_bucket=p_bucket AND d.arquivo=p_name AND d.projeto_id IS NOT NULL AND public.can_access_project(d.projeto_id))
  OR EXISTS (SELECT 1 FROM public.fotos f WHERE f.storage_bucket=p_bucket AND f.arquivo=p_name AND f.projeto_id IS NOT NULL AND public.can_access_project(f.projeto_id))
  OR EXISTS (SELECT 1 FROM public.biblioteca b WHERE b.storage_bucket=p_bucket AND b.arquivo=p_name AND (
       (b.projeto_id IS NOT NULL AND public.can_access_project(b.projeto_id))
       OR (b.projeto_id IS NULL AND b.cliente_id=public.current_client_id())
       OR (b.projeto_id IS NULL AND b.cliente_id IS NULL AND public.current_client_id() IS NOT NULL)
  ))
  OR EXISTS (SELECT 1 FROM public.protected_pdf_issues i WHERE p_bucket='materiais-protegidos' AND i.issued_storage_path=p_name AND (i.user_id=auth.uid() OR i.client_id=public.current_client_id()) AND (i.expires_at IS NULL OR i.expires_at>now()));
$$;

REVOKE ALL ON FUNCTION public.can_read_portal_object(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_portal_object(text,text) TO authenticated;

DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname, cmd
    FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = ANY(ARRAY[
        'authenticated_read_documentos','authenticated_read_fotos',
        'authenticated_read_biblioteca','authenticated_read_materiais_protegidos',
        'authenticated_read_projetos','authenticated_read_cronograma',
        'authenticated_read_clientes','admin_write_documentos',
        'admin_delete_documentos','admin_write_fotos','admin_delete_fotos',
        'admin_write_biblioteca','admin_delete_biblioteca',
        'admin_write_materiais_protegidos','admin_delete_materiais_protegidos',
        'admin_write_projetos','admin_delete_projetos','admin_write_cronograma',
        'admin_delete_cronograma','admin_write_clientes','admin_delete_clientes',
        'scoped_client_file_read','admin_manage_portal_storage_insert',
        'admin_manage_portal_storage_update','admin_manage_portal_storage_delete'
      ])
  LOOP
    IF p.cmd IN ('SELECT','DELETE') THEN
      EXECUTE format('ALTER POLICY %I ON storage.objects USING (false)', p.policyname);
    ELSIF p.cmd = 'INSERT' THEN
      EXECUTE format('ALTER POLICY %I ON storage.objects WITH CHECK (false)', p.policyname);
    ELSE
      EXECUTE format('ALTER POLICY %I ON storage.objects USING (false) WITH CHECK (false)', p.policyname);
    END IF;
  END LOOP;
END;
$$;
CREATE POLICY portal_object_read ON storage.objects FOR SELECT TO authenticated
  USING (public.can_read_portal_object(bucket_id, name));
CREATE POLICY portal_admin_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    public.is_portal_admin()
    AND bucket_id = ANY(ARRAY['documentos','fotos','materiais-protegidos','biblioteca','projetos','cronograma','clientes'])
    AND lower(name) !~ '\.(apk|app|bat|bin|cmd|com|dll|dmg|exe|hta|jar|js|jse|msi|ps1|scr|sh|vbs|wsf)$'
  );
CREATE POLICY portal_admin_update ON storage.objects FOR UPDATE TO authenticated
  USING (public.is_portal_admin())
  WITH CHECK (
    public.is_portal_admin()
    AND bucket_id = ANY(ARRAY['documentos','fotos','materiais-protegidos','biblioteca','projetos','cronograma','clientes'])
    AND lower(name) !~ '\.(apk|app|bat|bin|cmd|com|dll|dmg|exe|hta|jar|js|jse|msi|ps1|scr|sh|vbs|wsf)$'
  );
CREATE POLICY portal_admin_delete ON storage.objects FOR DELETE TO authenticated
  USING (public.is_portal_admin() AND bucket_id = ANY(ARRAY['documentos','fotos','materiais-protegidos','biblioteca','projetos','cronograma','clientes']));

CREATE OR REPLACE FUNCTION public.admin_storage_overview()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = '' AS $$
DECLARE v_buckets jsonb; v_projects jsonb; v_objects bigint; v_bytes bigint; v_orphans bigint; v_orphan_objects bigint;
BEGIN
  IF NOT public.is_portal_admin() THEN RAISE EXCEPTION 'Acesso administrativo necessário'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('bucketId',x.bucket_id,'objectCount',x.object_count,'bytes',x.bytes) ORDER BY x.bucket_id),'[]'::jsonb),
         coalesce(sum(x.object_count),0), coalesce(sum(x.bytes),0)
  INTO v_buckets,v_objects,v_bytes
  FROM (SELECT o.bucket_id,count(*)::bigint object_count,coalesce(sum((o.metadata->>'size')::bigint),0)::bigint bytes FROM storage.objects o GROUP BY o.bucket_id) x;
  SELECT count(*) INTO v_orphans FROM (
    SELECT d.storage_bucket bucket,d.arquivo path FROM public.documentos d WHERE d.arquivo IS NOT NULL
    UNION ALL SELECT f.storage_bucket,f.arquivo FROM public.fotos f WHERE f.arquivo IS NOT NULL
    UNION ALL SELECT b.storage_bucket,b.arquivo FROM public.biblioteca b WHERE b.arquivo IS NOT NULL
  ) m WHERE NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id=m.bucket AND o.name=m.path);
  WITH metadata AS (
    SELECT d.projeto_id,d.storage_bucket bucket,d.arquivo path FROM public.documentos d WHERE d.arquivo IS NOT NULL
    UNION ALL SELECT f.projeto_id,f.storage_bucket,f.arquivo FROM public.fotos f WHERE f.arquivo IS NOT NULL
    UNION ALL SELECT b.projeto_id,b.storage_bucket,b.arquivo FROM public.biblioteca b WHERE b.arquivo IS NOT NULL
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'projectId',x.project_id,'projectName',x.project_name,'clientName',x.client_name,
      'contractNumber',x.contract_number,'objectCount',x.object_count,'bytes',x.bytes
    ) ORDER BY x.bytes DESC),'[]'::jsonb)
  INTO v_projects
  FROM (
    SELECT p.id project_id,p.nome project_name,cl.nome client_name,
      coalesce(c.contract_number,p.numero_contrato,'Sem contrato') contract_number,
      count(o.id)::bigint object_count,coalesce(sum((o.metadata->>'size')::bigint),0)::bigint bytes
    FROM metadata m
    JOIN storage.objects o ON o.bucket_id=m.bucket AND o.name=m.path
    JOIN public.projetos p ON p.id=m.projeto_id
    LEFT JOIN public.clientes cl ON cl.id=p.cliente_id
    LEFT JOIN public.contratos c ON c.id=p.contract_id
    GROUP BY p.id,p.nome,cl.nome,c.contract_number,p.numero_contrato
    LIMIT 200
  ) x;
  SELECT count(*) INTO v_orphan_objects
  FROM storage.objects o
  WHERE o.bucket_id = ANY(ARRAY['documentos','fotos','materiais-protegidos','biblioteca'])
    AND NOT EXISTS (SELECT 1 FROM public.documentos d WHERE d.storage_bucket=o.bucket_id AND d.arquivo=o.name)
    AND NOT EXISTS (SELECT 1 FROM public.fotos f WHERE f.storage_bucket=o.bucket_id AND f.arquivo=o.name)
    AND NOT EXISTS (SELECT 1 FROM public.biblioteca b WHERE b.storage_bucket=o.bucket_id AND b.arquivo=o.name)
    AND NOT EXISTS (SELECT 1 FROM public.protected_pdf_issues i WHERE o.bucket_id='materiais-protegidos' AND i.issued_storage_path=o.name)
    AND NOT EXISTS (SELECT 1 FROM public.protected_site_pdfs p WHERE o.bucket_id='materiais-protegidos' AND p.original_storage_path=o.name);
  RETURN jsonb_build_object('buckets',v_buckets,'projects',v_projects,'totalObjects',v_objects,'totalBytes',v_bytes,'orphanMetadata',v_orphans,'orphanObjects',v_orphan_objects);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_storage_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_storage_overview() TO authenticated;

-- ---------------------------------------------------------------------------
-- Exclusão integral após a Edge Function remover os objetos do Storage.
-- Retorna o auth_id para que a função do servidor remova o usuário do Auth.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_purge_client_database(p_cliente_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_auth uuid; v_projects uuid[];
BEGIN
  IF NOT public.is_portal_admin() THEN RAISE EXCEPTION 'Acesso administrativo necessário'; END IF;
  SELECT auth_id INTO v_auth FROM public.clientes WHERE id=p_cliente_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cliente não encontrado'; END IF;
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
  DELETE FROM public.projetos WHERE id=ANY(v_projects);
  DELETE FROM public.contratos WHERE cliente_id=p_cliente_id;
  UPDATE public.extrato_financeiro SET cliente_id=NULL,projeto_id=NULL WHERE cliente_id=p_cliente_id OR projeto_id=ANY(v_projects);
  DELETE FROM public.clientes WHERE id=p_cliente_id;
  RETURN v_auth;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_purge_client_database(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_purge_client_database(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Auditoria de alterações administrativas sem copiar campos pessoais.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.portal_audit_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row jsonb; v_id uuid;
BEGIN
  IF NOT public.is_portal_admin() THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  v_row := CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  v_id := nullif(v_row->>'id','')::uuid;
  INSERT INTO public.audit_log(user_id,action,entity_type,entity_id,details)
  VALUES (auth.uid(),lower(TG_OP),TG_TABLE_NAME,v_id,jsonb_strip_nulls(jsonb_build_object('project_id',v_row->>'projeto_id','client_id',v_row->>'cliente_id','status',v_row->>'status')));
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['clientes','contratos','projetos','documentos','fotos','biblioteca','agenda','cronograma','solicitacoes','solicitacao_respostas','aprovacoes','notificacoes'] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger tr
      JOIN pg_class c ON c.oid = tr.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE tr.tgname = 'portal_audit_change_trigger'
        AND n.nspname = 'public'
        AND c.relname = t
    ) THEN
      EXECUTE format('CREATE TRIGGER portal_audit_change_trigger AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.portal_audit_change()',t);
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.app_security_status()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = '' AS $$
BEGIN
  IF NOT public.is_portal_admin() THEN RAISE EXCEPTION 'Acesso administrativo necessário'; END IF;
  RETURN jsonb_build_object(
    'open_migration_issues',(SELECT count(*) FROM public.app_migration_issues WHERE resolved_at IS NULL),
    'projects_without_contract',(SELECT count(*) FROM public.projetos WHERE contract_id IS NULL),
    'projects_without_members',(SELECT count(*) FROM public.projetos p WHERE NOT EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id=p.id AND pm.active=true)),
    'files_without_project',(
      (SELECT count(*) FROM public.documentos WHERE projeto_id IS NULL)+
      (SELECT count(*) FROM public.fotos WHERE projeto_id IS NULL)+
      (SELECT count(*) FROM public.biblioteca WHERE projeto_id IS NULL AND cliente_id IS NOT NULL)
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.app_security_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_security_status() TO authenticated;

COMMIT;
