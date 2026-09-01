BEGIN;

ALTER TABLE public.aprovacoes ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
ALTER TABLE public.aprovacoes ADD COLUMN IF NOT EXISTS approval_due_at timestamptz;
ALTER TABLE public.aprovacoes ADD COLUMN IF NOT EXISTS schedule_stage_id uuid;
ALTER TABLE public.aprovacoes ADD COLUMN IF NOT EXISTS formal_notice_document_id uuid;
ALTER TABLE public.aprovacoes ADD COLUMN IF NOT EXISTS admin_warning_dismissed_at timestamptz;

ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS contract_id uuid;
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS approval_id uuid;
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS document_kind text;
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS workflow_status text NOT NULL DEFAULT 'arquivo';
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS generated_data jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS optional_document boolean NOT NULL DEFAULT false;
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS generated_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'aprovacoes_schedule_stage_id_fkey' AND conrelid = 'public.aprovacoes'::regclass) THEN
    ALTER TABLE public.aprovacoes ADD CONSTRAINT aprovacoes_schedule_stage_id_fkey FOREIGN KEY (schedule_stage_id) REFERENCES public.cronograma(id) ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documentos_contract_id_fkey' AND conrelid = 'public.documentos'::regclass) THEN
    ALTER TABLE public.documentos ADD CONSTRAINT documentos_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contratos(id) ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documentos_approval_id_fkey' AND conrelid = 'public.documentos'::regclass) THEN
    ALTER TABLE public.documentos ADD CONSTRAINT documentos_approval_id_fkey FOREIGN KEY (approval_id) REFERENCES public.aprovacoes(id) ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'aprovacoes_formal_notice_document_id_fkey' AND conrelid = 'public.aprovacoes'::regclass) THEN
    ALTER TABLE public.aprovacoes ADD CONSTRAINT aprovacoes_formal_notice_document_id_fkey FOREIGN KEY (formal_notice_document_id) REFERENCES public.documentos(id) ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documentos_workflow_status_valid' AND conrelid = 'public.documentos'::regclass) THEN
    ALTER TABLE public.documentos ADD CONSTRAINT documentos_workflow_status_valid CHECK (workflow_status IN ('arquivo','rascunho','gerado','enviado','assinado','aceito','cancelado')) NOT VALID;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS aprovacoes_due_pending_idx ON public.aprovacoes(approval_due_at) WHERE status = 'aguardando';
CREATE INDEX IF NOT EXISTS documentos_contract_kind_idx ON public.documentos(contract_id, document_kind, created_at DESC);
CREATE INDEX IF NOT EXISTS documentos_approval_idx ON public.documentos(approval_id) WHERE approval_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.contract_scope_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  service_code text NOT NULL,
  service_name text NOT NULL,
  included boolean NOT NULL DEFAULT true,
  acceptance_required boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contract_scope_items_service_code_not_blank CHECK (length(btrim(service_code)) > 0),
  CONSTRAINT contract_scope_items_service_name_not_blank CHECK (length(btrim(service_name)) > 0),
  CONSTRAINT contract_scope_items_contract_code_unique UNIQUE (contract_id, service_code)
);

CREATE INDEX IF NOT EXISTS contract_scope_items_contract_included_idx ON public.contract_scope_items(contract_id, included, display_order);
ALTER TABLE public.contract_scope_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='contract_scope_items' AND policyname='contract_scope_read') THEN
    CREATE POLICY contract_scope_read ON public.contract_scope_items FOR SELECT TO authenticated USING (public.can_access_contract(contract_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='contract_scope_items' AND policyname='contract_scope_admin_manage') THEN
    CREATE POLICY contract_scope_admin_manage ON public.contract_scope_items FOR ALL TO authenticated USING (public.is_portal_admin()) WITH CHECK (public.is_portal_admin());
  END IF;
END;
$$;

REVOKE ALL ON public.contract_scope_items FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_scope_items TO authenticated;

CREATE OR REPLACE FUNCTION public.set_approval_contractual_deadline()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.delivered_at IS NULL THEN NEW.delivered_at := COALESCE(NEW.created_at, now()); END IF;
  IF NEW.approval_due_at IS NULL OR (TG_OP = 'UPDATE' AND NEW.delivered_at IS DISTINCT FROM OLD.delivered_at) THEN
    NEW.approval_due_at := NEW.delivered_at + interval '10 days';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='set_approval_contractual_deadline_trigger') THEN
    CREATE TRIGGER set_approval_contractual_deadline_trigger
      BEFORE INSERT OR UPDATE OF delivered_at ON public.aprovacoes
      FOR EACH ROW EXECUTE FUNCTION public.set_approval_contractual_deadline();
  END IF;
END;
$$;

UPDATE public.aprovacoes
SET delivered_at = COALESCE(delivered_at, created_at, now()),
    approval_due_at = COALESCE(approval_due_at, COALESCE(delivered_at, created_at, now()) + interval '10 days')
WHERE status = 'aguardando';

CREATE OR REPLACE FUNCTION public.admin_document_attention()
RETURNS TABLE (
  approval_id uuid, project_id uuid, client_id uuid, contract_id uuid, contract_number text,
  client_name text, project_name text, approval_type text, approval_title text,
  delivered_at timestamptz, due_at timestamptz, days_remaining integer,
  attention_level text, formal_notice_recommended boolean, formal_notice_document_id uuid
)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = '' AS $$
BEGIN
  IF NOT public.is_portal_admin() THEN RAISE EXCEPTION 'Acesso administrativo necessário'; END IF;
  RETURN QUERY
  SELECT a.id, a.projeto_id, a.cliente_id, p.contract_id, c.contract_number, cl.nome, p.nome,
    a.tipo, a.titulo, a.delivered_at, a.approval_due_at,
    CEIL(EXTRACT(EPOCH FROM (a.approval_due_at - now())) / 86400.0)::integer,
    CASE WHEN a.approval_due_at < now() THEN 'overdue' WHEN a.approval_due_at <= now() + interval '3 days' THEN 'warning' ELSE 'normal' END,
    a.approval_due_at <= now(), a.formal_notice_document_id
  FROM public.aprovacoes a
  JOIN public.projetos p ON p.id = a.projeto_id
  JOIN public.contratos c ON c.id = p.contract_id
  LEFT JOIN public.clientes cl ON cl.id = a.cliente_id
  WHERE a.status = 'aguardando' AND a.approval_due_at IS NOT NULL
  ORDER BY a.approval_due_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_document_attention() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_document_attention() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_prepare_formal_notice(p_approval_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_approval record; v_document_id uuid;
BEGIN
  IF NOT public.is_portal_admin() THEN RAISE EXCEPTION 'Acesso administrativo necessário'; END IF;
  SELECT a.*, p.contract_id, p.nome AS project_name, p.endereco_obra, p.numero_obra, p.complemento_obra,
    p.bairro_obra, p.cidade_obra, p.estado_obra, c.contract_number, cl.nome AS client_name
  INTO v_approval
  FROM public.aprovacoes a
  JOIN public.projetos p ON p.id = a.projeto_id
  JOIN public.contratos c ON c.id = p.contract_id
  LEFT JOIN public.clientes cl ON cl.id = a.cliente_id
  WHERE a.id = p_approval_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Aprovação não encontrada'; END IF;
  IF v_approval.status <> 'aguardando' THEN RAISE EXCEPTION 'A aprovação já possui manifestação'; END IF;
  IF v_approval.formal_notice_document_id IS NOT NULL THEN RETURN v_approval.formal_notice_document_id; END IF;

  INSERT INTO public.documentos (cliente_id, projeto_id, contract_id, approval_id, nome, tipo, categoria, versao,
    storage_bucket, permitir_download, protection_mode, document_kind, workflow_status, generated_data, optional_document)
  VALUES (v_approval.cliente_id, v_approval.projeto_id, v_approval.contract_id, v_approval.id,
    'Notificação Formal — ' || v_approval.titulo,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Contratual', '1.0', 'documentos', true,
    'administrative', 'notificacao_formal', 'rascunho',
    jsonb_build_object(
      'contract_number', v_approval.contract_number, 'client_name', v_approval.client_name,
      'project_name', v_approval.project_name, 'approval_title', v_approval.titulo,
      'approval_type', v_approval.tipo, 'approval_description', v_approval.descricao,
      'delivered_at', v_approval.delivered_at, 'approval_due_at', v_approval.approval_due_at,
      'notification_reason', 'Ausência de manifestação sobre etapa entregue, dentro do prazo contratual de 10 dias corridos.',
      'regularization_days', 3,
      'consequences', jsonb_build_array('Suspensão da contagem dos prazos de execução enquanto perdurar a pendência.'),
      'property_address', concat_ws(', ', nullif(v_approval.endereco_obra,''), nullif(v_approval.numero_obra,''), nullif(v_approval.complemento_obra,''), nullif(v_approval.bairro_obra,''), nullif(v_approval.cidade_obra,''), nullif(v_approval.estado_obra,''))
    ), true)
  RETURNING id INTO v_document_id;
  UPDATE public.aprovacoes SET formal_notice_document_id = v_document_id WHERE id = p_approval_id;
  INSERT INTO public.audit_log(user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'prepare_formal_notice', 'aprovacoes', p_approval_id, jsonb_build_object('document_id', v_document_id));
  RETURN v_document_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_prepare_formal_notice(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_prepare_formal_notice(uuid) TO authenticated;

COMMIT;