-- Solicitações com responsável correto, notificações internas automáticas e base para push.
-- Migração aditiva e idempotente para o ambiente existente.

BEGIN;

ALTER TABLE public.solicitacoes
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'cliente';

ALTER TABLE public.notificacoes
  ADD COLUMN IF NOT EXISTS destinatario text NOT NULL DEFAULT 'cliente',
  ADD COLUMN IF NOT EXISTS referencia_tipo text,
  ADD COLUMN IF NOT EXISTS referencia_id uuid,
  ADD COLUMN IF NOT EXISTS push_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS push_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS notificacoes_destinatario_lida_idx
  ON public.notificacoes(destinatario, lida, created_at DESC);
CREATE INDEX IF NOT EXISTS notificacoes_referencia_idx
  ON public.notificacoes(referencia_tipo, referencia_id);
CREATE INDEX IF NOT EXISTS solicitacoes_origem_status_idx
  ON public.solicitacoes(origem, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.app_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_push_token text NOT NULL UNIQUE,
  platform text NOT NULL CHECK (platform IN ('android', 'ios')),
  device_name text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_push_tokens_user_active_idx
  ON public.app_push_tokens(user_id, active);

ALTER TABLE public.app_push_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_push_tokens FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_push_tokens TO service_role;

CREATE OR REPLACE FUNCTION public.register_own_push_token(
  p_token text,
  p_platform text,
  p_device_name text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão necessária';
  END IF;
  IF p_platform NOT IN ('android', 'ios') THEN
    RAISE EXCEPTION 'Plataforma inválida';
  END IF;
  IF length(btrim(coalesce(p_token, ''))) NOT BETWEEN 20 AND 300
     OR btrim(p_token) !~ '^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$' THEN
    RAISE EXCEPTION 'Token inválido';
  END IF;

  INSERT INTO public.app_push_tokens(user_id, expo_push_token, platform, device_name)
  VALUES (
    auth.uid(),
    btrim(p_token),
    p_platform,
    nullif(left(btrim(coalesce(p_device_name, '')), 120), '')
  )
  ON CONFLICT (expo_push_token) DO UPDATE
  SET user_id = auth.uid(),
      platform = EXCLUDED.platform,
      device_name = EXCLUDED.device_name,
      active = true,
      updated_at = now(),
      last_seen_at = now();
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.register_own_push_token(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_own_push_token(text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_own_notification_read(p_notificacao_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.notificacoes n
  SET lida = true
  WHERE n.id = p_notificacao_id
    AND n.destinatario = 'cliente'
    AND (
      n.cliente_id = public.current_client_id()
      OR (n.projeto_id IS NOT NULL AND public.can_access_project(n.projeto_id))
    );
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_admin_notification_read(p_notificacao_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_portal_admin() THEN
    RAISE EXCEPTION 'Acesso administrativo necessário';
  END IF;
  UPDATE public.notificacoes
  SET lida = true
  WHERE id = p_notificacao_id AND destinatario = 'admin';
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_received_notification_read(p_notificacao_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.is_portal_admin() THEN
    UPDATE public.notificacoes
    SET lida = true
    WHERE id = p_notificacao_id AND destinatario = 'admin';
  ELSE
    UPDATE public.notificacoes n
    SET lida = true
    WHERE n.id = p_notificacao_id
      AND n.destinatario = 'cliente'
      AND (
        n.cliente_id = public.current_client_id()
        OR (n.projeto_id IS NOT NULL AND public.can_access_project(n.projeto_id))
      );
  END IF;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_admin_notification_read(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_received_notification_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_admin_notification_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_received_notification_read(uuid) TO authenticated;

DROP POLICY IF EXISTS notifications_read ON public.notificacoes;
CREATE POLICY notifications_read ON public.notificacoes FOR SELECT TO authenticated
USING (
  public.is_portal_admin()
  OR (
    destinatario = 'cliente'
    AND (
      cliente_id = public.current_client_id()
      OR (projeto_id IS NOT NULL AND public.can_access_project(projeto_id))
    )
  )
);

CREATE OR REPLACE FUNCTION public.reply_to_own_request(
  p_solicitacao_id uuid,
  p_mensagem text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
  v_cliente uuid;
  v_origem text;
  v_status text;
BEGIN
  IF length(btrim(coalesce(p_mensagem, ''))) NOT BETWEEN 1 AND 4000 THEN
    RAISE EXCEPTION 'Mensagem inválida';
  END IF;

  SELECT s.cliente_id, s.origem, s.status
  INTO v_cliente, v_origem, v_status
  FROM public.solicitacoes s
  WHERE s.id = p_solicitacao_id
    AND s.projeto_id IS NOT NULL
    AND public.can_access_project(s.projeto_id)
  FOR UPDATE;

  IF v_cliente IS NULL OR v_cliente <> public.current_client_id() THEN
    RAISE EXCEPTION 'Solicitação indisponível';
  END IF;
  IF coalesce(v_origem, 'cliente') NOT IN ('admin', 'administrador')
     OR v_status <> 'aguardando_cliente' THEN
    RAISE EXCEPTION 'Esta solicitação não aguarda uma resposta do cliente';
  END IF;

  INSERT INTO public.solicitacao_respostas(solicitacao_id, cliente_id, autor, mensagem)
  VALUES (p_solicitacao_id, v_cliente, 'cliente', btrim(p_mensagem))
  RETURNING id INTO v_id;

  UPDATE public.solicitacoes
  SET status = 'em_analise', updated_at = now()
  WHERE id = p_solicitacao_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_request(
  p_cliente_id uuid,
  p_projeto_id uuid,
  p_categoria text,
  p_titulo text,
  p_mensagem text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_portal_admin() THEN
    RAISE EXCEPTION 'Acesso administrativo necessário';
  END IF;
  IF length(btrim(coalesce(p_titulo, ''))) NOT BETWEEN 3 AND 120
     OR length(btrim(coalesce(p_mensagem, ''))) NOT BETWEEN 5 AND 4000 THEN
    RAISE EXCEPTION 'Solicitação incompleta';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.projetos p
    WHERE p.id = p_projeto_id AND p.cliente_id = p_cliente_id
  ) THEN
    RAISE EXCEPTION 'Projeto e cliente incompatíveis';
  END IF;

  INSERT INTO public.solicitacoes(
    cliente_id, projeto_id, categoria, titulo, mensagem, status, origem
  )
  VALUES (
    p_cliente_id,
    p_projeto_id,
    coalesce(nullif(btrim(p_categoria), ''), 'outros'),
    btrim(p_titulo),
    btrim(p_mensagem),
    'aguardando_cliente',
    'administrador'
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_request_status(
  p_solicitacao_id uuid,
  p_status text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cliente uuid;
  v_projeto uuid;
  v_titulo text;
BEGIN
  IF NOT public.is_portal_admin() THEN
    RAISE EXCEPTION 'Acesso administrativo necessário';
  END IF;
  IF p_status NOT IN ('nova','em_analise','aguardando_cliente','em_execucao','concluida','cancelada') THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;

  SELECT cliente_id, projeto_id, titulo
  INTO v_cliente, v_projeto, v_titulo
  FROM public.solicitacoes
  WHERE id = p_solicitacao_id
    AND status NOT IN ('concluida', 'cancelada')
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação encerrada ou não encontrada';
  END IF;

  UPDATE public.solicitacoes
  SET status = p_status, updated_at = now()
  WHERE id = p_solicitacao_id;

  INSERT INTO public.notificacoes(
    cliente_id, projeto_id, titulo, mensagem, tipo, lida, link_path,
    destinatario, referencia_tipo, referencia_id
  )
  VALUES (
    v_cliente, v_projeto, 'Solicitação atualizada', v_titulo,
    'solicitacao_status', false, '/(client)/requests',
    'cliente', 'solicitacao', p_solicitacao_id
  );
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reply_request(
  p_solicitacao_id uuid,
  p_mensagem text,
  p_status text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
  v_cliente uuid;
BEGIN
  IF NOT public.is_portal_admin() THEN
    RAISE EXCEPTION 'Acesso administrativo necessário';
  END IF;
  IF p_status NOT IN ('nova','em_analise','aguardando_cliente','em_execucao','concluida','cancelada') THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;
  IF length(btrim(coalesce(p_mensagem, ''))) NOT BETWEEN 1 AND 4000 THEN
    RAISE EXCEPTION 'Mensagem inválida';
  END IF;

  SELECT cliente_id INTO v_cliente
  FROM public.solicitacoes
  WHERE id = p_solicitacao_id
    AND status NOT IN ('concluida', 'cancelada')
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação encerrada ou não encontrada';
  END IF;

  INSERT INTO public.solicitacao_respostas(solicitacao_id, cliente_id, autor, mensagem)
  VALUES (p_solicitacao_id, v_cliente, 'administrador', btrim(p_mensagem))
  RETURNING id INTO v_id;

  UPDATE public.solicitacoes
  SET status = p_status, updated_at = now()
  WHERE id = p_solicitacao_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reply_to_own_request(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_create_request(uuid, uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_request_status(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_reply_request(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reply_to_own_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_request(uuid, uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_request_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reply_request(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_request_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF coalesce(NEW.origem, 'cliente') IN ('admin', 'administrador') THEN
    INSERT INTO public.notificacoes(
      cliente_id, projeto_id, titulo, mensagem, tipo, lida, link_path,
      destinatario, referencia_tipo, referencia_id
    ) VALUES (
      NEW.cliente_id, NEW.projeto_id, 'Nova solicitação da equipe', NEW.titulo,
      'solicitacao_equipe', false, '/(client)/requests',
      'cliente', 'solicitacao', NEW.id
    );
  ELSE
    INSERT INTO public.notificacoes(
      cliente_id, projeto_id, titulo, mensagem, tipo, lida, link_path,
      destinatario, referencia_tipo, referencia_id
    ) VALUES (
      NEW.cliente_id, NEW.projeto_id, 'Nova solicitação de cliente', NEW.titulo,
      'solicitacao_cliente', false, '/admin/requests',
      'admin', 'solicitacao', NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS solicitacoes_notify_insert ON public.solicitacoes;
CREATE TRIGGER solicitacoes_notify_insert
AFTER INSERT ON public.solicitacoes
FOR EACH ROW EXECUTE FUNCTION public.notify_request_created();

CREATE OR REPLACE FUNCTION public.notify_request_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.solicitacoes%ROWTYPE;
BEGIN
  SELECT * INTO v_request
  FROM public.solicitacoes
  WHERE id = NEW.solicitacao_id;

  INSERT INTO public.notificacoes(
    cliente_id, projeto_id, titulo, mensagem, tipo, lida, link_path,
    destinatario, referencia_tipo, referencia_id
  ) VALUES (
    v_request.cliente_id,
    v_request.projeto_id,
    CASE WHEN NEW.autor = 'administrador' THEN 'Nova resposta da equipe' ELSE 'Resposta do cliente' END,
    v_request.titulo,
    'solicitacao_resposta',
    false,
    CASE WHEN NEW.autor = 'administrador' THEN '/(client)/requests' ELSE '/admin/requests' END,
    CASE WHEN NEW.autor = 'administrador' THEN 'cliente' ELSE 'admin' END,
    'solicitacao',
    NEW.solicitacao_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS solicitacao_respostas_notify_insert ON public.solicitacao_respostas;
CREATE TRIGGER solicitacao_respostas_notify_insert
AFTER INSERT ON public.solicitacao_respostas
FOR EACH ROW EXECUTE FUNCTION public.notify_request_reply();

CREATE OR REPLACE FUNCTION public.notify_approval_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notificacoes(
      cliente_id, projeto_id, titulo, mensagem, tipo, lida, link_path,
      destinatario, referencia_tipo, referencia_id
    ) VALUES (
      NEW.cliente_id, NEW.projeto_id, 'Nova aprovação pendente', NEW.titulo,
      'aprovacao_pendente', false, '/(client)/approvals',
      'cliente', 'aprovacao', NEW.id
    );
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'aguardando' THEN
    INSERT INTO public.notificacoes(
      cliente_id, projeto_id, titulo, mensagem, tipo, lida, link_path,
      destinatario, referencia_tipo, referencia_id
    ) VALUES (
      NEW.cliente_id, NEW.projeto_id, 'Aprovação respondida', NEW.titulo,
      'aprovacao_respondida', false, '/admin/approvals',
      'admin', 'aprovacao', NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aprovacoes_notify_change ON public.aprovacoes;
CREATE TRIGGER aprovacoes_notify_change
AFTER INSERT OR UPDATE OF status ON public.aprovacoes
FOR EACH ROW EXECUTE FUNCTION public.notify_approval_event();

CREATE OR REPLACE FUNCTION public.notify_agenda_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notificacoes(
      cliente_id, projeto_id, titulo, mensagem, tipo, lida, link_path,
      destinatario, referencia_tipo, referencia_id
    ) VALUES (
      NEW.cliente_id, NEW.projeto_id, 'Novo compromisso', NEW.titulo,
      'agenda_nova', false, '/(client)/agenda',
      'cliente', 'agenda', NEW.id
    );
  ELSIF NEW.cancelado IS TRUE AND NEW.cancelado IS DISTINCT FROM OLD.cancelado THEN
    INSERT INTO public.notificacoes(
      cliente_id, projeto_id, titulo, mensagem, tipo, lida, link_path,
      destinatario, referencia_tipo, referencia_id
    ) VALUES (
      NEW.cliente_id, NEW.projeto_id, 'Compromisso cancelado', NEW.titulo,
      'agenda_cancelada', false, '/(client)/agenda',
      'cliente', 'agenda', NEW.id
    );
  ELSIF NEW.status_convite IS DISTINCT FROM OLD.status_convite THEN
    INSERT INTO public.notificacoes(
      cliente_id, projeto_id, titulo, mensagem, tipo, lida, link_path,
      destinatario, referencia_tipo, referencia_id
    ) VALUES (
      NEW.cliente_id, NEW.projeto_id, 'Compromisso respondido', NEW.titulo,
      'agenda_respondida', false, '/admin/agenda',
      'admin', 'agenda', NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS agenda_notify_change ON public.agenda;
CREATE TRIGGER agenda_notify_change
AFTER INSERT OR UPDATE OF status_convite ON public.agenda
FOR EACH ROW EXECUTE FUNCTION public.notify_agenda_event();

CREATE OR REPLACE FUNCTION public.notify_content_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_title text;
  v_type text;
  v_link text;
BEGIN
  IF TG_TABLE_NAME = 'documentos' THEN
    v_title := 'Novo documento'; v_type := 'documento_novo'; v_link := '/(client)/documents';
  ELSIF TG_TABLE_NAME = 'fotos' THEN
    v_title := 'Nova foto da obra'; v_type := 'foto_nova'; v_link := '/(client)/photos';
  ELSE
    v_title := 'Novo material na biblioteca'; v_type := 'biblioteca_nova'; v_link := '/(client)/library';
  END IF;

  INSERT INTO public.notificacoes(
    cliente_id, projeto_id, titulo, mensagem, tipo, lida, link_path,
    destinatario, referencia_tipo, referencia_id
  ) VALUES (
    NEW.cliente_id, NEW.projeto_id, v_title, NEW.nome,
    v_type, false, v_link,
    'cliente', TG_TABLE_NAME, NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS documentos_notify_insert ON public.documentos;
DROP TRIGGER IF EXISTS fotos_notify_insert ON public.fotos;
DROP TRIGGER IF EXISTS biblioteca_notify_insert ON public.biblioteca;
CREATE TRIGGER documentos_notify_insert AFTER INSERT ON public.documentos
FOR EACH ROW EXECUTE FUNCTION public.notify_content_created();
CREATE TRIGGER fotos_notify_insert AFTER INSERT ON public.fotos
FOR EACH ROW EXECUTE FUNCTION public.notify_content_created();
CREATE TRIGGER biblioteca_notify_insert AFTER INSERT ON public.biblioteca
FOR EACH ROW EXECUTE FUNCTION public.notify_content_created();

CREATE OR REPLACE FUNCTION public.notify_schedule_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notificacoes(
      cliente_id, projeto_id, titulo, mensagem, tipo, lida, link_path,
      destinatario, referencia_tipo, referencia_id
    ) VALUES (
      NEW.cliente_id, NEW.projeto_id, 'Nova etapa do cronograma',
      NEW.nome, 'cronograma_atualizado', false, '/(client)/schedule',
      'cliente', 'cronograma', NEW.id
    );
  ELSIF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.percentual_conclusao IS DISTINCT FROM OLD.percentual_conclusao THEN
    INSERT INTO public.notificacoes(
      cliente_id, projeto_id, titulo, mensagem, tipo, lida, link_path,
      destinatario, referencia_tipo, referencia_id
    ) VALUES (
      NEW.cliente_id, NEW.projeto_id,
      'Cronograma atualizado',
      NEW.nome, 'cronograma_atualizado', false, '/(client)/schedule',
      'cliente', 'cronograma', NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cronograma_notify_change ON public.cronograma;
CREATE TRIGGER cronograma_notify_change
AFTER INSERT OR UPDATE OF status, percentual_conclusao ON public.cronograma
FOR EACH ROW EXECUTE FUNCTION public.notify_schedule_event();

CREATE OR REPLACE FUNCTION public.notify_project_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.progress_percent IS DISTINCT FROM OLD.progress_percent THEN
    INSERT INTO public.notificacoes(
      cliente_id, projeto_id, titulo, mensagem, tipo, lida, link_path,
      destinatario, referencia_tipo, referencia_id
    ) VALUES (
      NEW.cliente_id, NEW.id, 'Projeto atualizado', NEW.nome,
      'projeto_atualizado', false, '/(client)/project',
      'cliente', 'projeto', NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS projetos_notify_update ON public.projetos;
CREATE TRIGGER projetos_notify_update
AFTER UPDATE OF status, progress_percent ON public.projetos
FOR EACH ROW EXECUTE FUNCTION public.notify_project_update();

COMMIT;

SELECT 'APROVADO' AS status_solicitacoes_notificacoes;
