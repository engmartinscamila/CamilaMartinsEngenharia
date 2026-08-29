/*
  Camila Martins Engenharia — fundação de contratos e acesso por projeto.

  Características desta migração:
  - aditiva e idempotente;
  - não apaga tabelas, colunas, políticas, arquivos ou registros;
  - preserva as colunas antigas para manter compatibilidade com o Portal;
  - cria vínculos para dados legados quando há informação suficiente;
  - registra pendências em app_migration_issues;
  - não torna colunas antigas NOT NULL antes de zerar as pendências.

  IMPORTANTE: revisar o resultado de public.app_foundation_status() antes de
  aplicar a futura migração de restrições definitivas.
*/

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.app_migration_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_key text NOT NULL UNIQUE,
  entity_type text NOT NULL,
  entity_id uuid,
  issue_type text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.contratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  contract_number text NOT NULL,
  legacy_contract_number text,
  service_type text,
  status text NOT NULL DEFAULT 'ativo',
  signed_at date,
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contratos_contract_number_not_blank CHECK (length(btrim(contract_number)) > 0),
  CONSTRAINT contratos_dates_valid CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE UNIQUE INDEX IF NOT EXISTS contratos_contract_number_unique_ci
  ON public.contratos (upper(btrim(contract_number)));
CREATE UNIQUE INDEX IF NOT EXISTS contratos_cliente_legacy_unique
  ON public.contratos (cliente_id, upper(btrim(legacy_contract_number)))
  WHERE legacy_contract_number IS NOT NULL AND btrim(legacy_contract_number) <> '';
CREATE INDEX IF NOT EXISTS contratos_cliente_id_idx ON public.contratos(cliente_id);
CREATE INDEX IF NOT EXISTS contratos_status_idx ON public.contratos(status);

ALTER TABLE public.projetos ADD COLUMN IF NOT EXISTS contract_id uuid;
ALTER TABLE public.projetos ADD COLUMN IF NOT EXISTS progress_percent numeric;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'projetos_contract_id_fkey'
      AND conrelid = 'public.projetos'::regclass
  ) THEN
    ALTER TABLE public.projetos
      ADD CONSTRAINT projetos_contract_id_fkey
      FOREIGN KEY (contract_id) REFERENCES public.contratos(id)
      ON DELETE RESTRICT NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'projetos_progress_percent_range'
      AND conrelid = 'public.projetos'::regclass
  ) THEN
    ALTER TABLE public.projetos
      ADD CONSTRAINT projetos_progress_percent_range
      CHECK (progress_percent IS NULL OR (progress_percent >= 0 AND progress_percent <= 100))
      NOT VALID;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS projetos_contract_id_idx ON public.projetos(contract_id);

CREATE TABLE IF NOT EXISTS public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'client',
  active boolean NOT NULL DEFAULT true,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_members_role_valid CHECK (role IN ('client', 'collaborator', 'viewer')),
  CONSTRAINT project_members_project_user_unique UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS project_members_user_active_idx
  ON public.project_members(user_id, active);
CREATE INDEX IF NOT EXISTS project_members_project_active_idx
  ON public.project_members(project_id, active);

-- Campos de Storage e versionamento necessários para o aplicativo. Os objetos
-- continuam privados e a URL assinada nunca é persistida nestas tabelas.
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS storage_bucket text DEFAULT 'documentos';
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS categoria text;
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS versao text;
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS permitir_download boolean NOT NULL DEFAULT true;
ALTER TABLE public.fotos ADD COLUMN IF NOT EXISTS storage_bucket text DEFAULT 'fotos';
ALTER TABLE public.fotos ADD COLUMN IF NOT EXISTS categoria text;
ALTER TABLE public.biblioteca ADD COLUMN IF NOT EXISTS storage_bucket text DEFAULT 'materiais-protegidos';
ALTER TABLE public.notificacoes ADD COLUMN IF NOT EXISTS projeto_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notificacoes_projeto_id_fkey'
      AND conrelid = 'public.notificacoes'::regclass
  ) THEN
    ALTER TABLE public.notificacoes
      ADD CONSTRAINT notificacoes_projeto_id_fkey
      FOREIGN KEY (projeto_id) REFERENCES public.projetos(id)
      ON DELETE CASCADE NOT VALID;
  END IF;
END;
$$;

UPDATE public.documentos SET storage_bucket = 'documentos' WHERE storage_bucket IS NULL;
UPDATE public.fotos SET storage_bucket = 'fotos' WHERE storage_bucket IS NULL;
UPDATE public.biblioteca SET storage_bucket = 'materiais-protegidos' WHERE storage_bucket IS NULL;

-- Gera contratos de migração para projetos antigos. Números vazios recebem um
-- identificador MIG estável. Um mesmo número usado por clientes diferentes
-- recebe um sufixo do UUID do cliente para preservar a unicidade global.
WITH legacy_projects AS (
  SELECT
    p.id AS project_id,
    p.cliente_id,
    NULLIF(btrim(p.numero_contrato), '') AS legacy_number,
    p.tipo AS service_type,
    p.status,
    p.created_at
  FROM public.projetos p
  WHERE p.contract_id IS NULL
    AND p.cliente_id IS NOT NULL
),
number_collisions AS (
  SELECT upper(legacy_number) AS normalized_number,
         count(DISTINCT cliente_id) AS client_count
  FROM legacy_projects
  WHERE legacy_number IS NOT NULL
  GROUP BY upper(legacy_number)
),
prepared AS (
  SELECT DISTINCT ON (lp.cliente_id, coalesce(upper(lp.legacy_number), lp.project_id::text))
    lp.project_id,
    lp.cliente_id,
    lp.legacy_number,
    CASE
      WHEN lp.legacy_number IS NULL THEN 'MIG-' || upper(substr(lp.project_id::text, 1, 8))
      WHEN nc.client_count > 1 THEN lp.legacy_number || '-' || upper(substr(lp.cliente_id::text, 1, 8))
      ELSE lp.legacy_number
    END AS generated_number,
    lp.service_type,
    lp.status,
    lp.created_at
  FROM legacy_projects lp
  LEFT JOIN number_collisions nc ON nc.normalized_number = upper(lp.legacy_number)
  ORDER BY lp.cliente_id, coalesce(upper(lp.legacy_number), lp.project_id::text), lp.created_at, lp.project_id
)
INSERT INTO public.contratos (
  cliente_id,
  contract_number,
  legacy_contract_number,
  service_type,
  status,
  created_at,
  updated_at
)
SELECT
  cliente_id,
  generated_number,
  legacy_number,
  service_type,
  CASE WHEN status = 'arquivado' THEN 'arquivado' ELSE 'ativo' END,
  coalesce(created_at, now()),
  now()
FROM prepared
ON CONFLICT DO NOTHING;

UPDATE public.projetos p
SET contract_id = c.id
FROM public.contratos c
WHERE p.contract_id IS NULL
  AND p.cliente_id = c.cliente_id
  AND (
    (
      NULLIF(btrim(p.numero_contrato), '') IS NOT NULL
      AND upper(btrim(c.legacy_contract_number)) = upper(btrim(p.numero_contrato))
    )
    OR (
      NULLIF(btrim(p.numero_contrato), '') IS NULL
      AND upper(c.contract_number) = 'MIG-' || upper(substr(p.id::text, 1, 8))
    )
  );

-- Mantém o cliente do projeto coerente com o cliente do contrato para novas
-- inserções e alterações de contrato, sem bloquear a simples leitura/edição de
-- um registro legado ainda listado como pendência.
CREATE OR REPLACE FUNCTION public.enforce_project_contract_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_client_id uuid;
BEGIN
  IF TG_OP = 'INSERT' OR NEW.contract_id IS DISTINCT FROM OLD.contract_id THEN
    IF NEW.contract_id IS NULL THEN
      RAISE EXCEPTION 'Todo novo projeto precisa de um contrato';
    END IF;

    SELECT cliente_id INTO v_client_id
    FROM public.contratos
    WHERE id = NEW.contract_id;

    IF v_client_id IS NULL THEN
      RAISE EXCEPTION 'Contrato inválido';
    END IF;

    IF NEW.cliente_id IS NULL THEN
      NEW.cliente_id := v_client_id;
    ELSIF NEW.cliente_id <> v_client_id THEN
      RAISE EXCEPTION 'Projeto e contrato pertencem a clientes diferentes';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'enforce_project_contract_client_trigger') THEN
    CREATE TRIGGER enforce_project_contract_client_trigger
      BEFORE INSERT OR UPDATE OF contract_id, cliente_id ON public.projetos
      FOR EACH ROW EXECUTE FUNCTION public.enforce_project_contract_client();
  END IF;
END;
$$;

-- Reutiliza o vínculo Auth já existente para criar o acesso por projeto.
INSERT INTO public.project_members (project_id, user_id, role, active)
SELECT p.id, c.auth_id, 'client', true
FROM public.projetos p
JOIN public.clientes c ON c.id = p.cliente_id
WHERE c.auth_id IS NOT NULL
  AND c.status = 'ativo'
ON CONFLICT (project_id, user_id) DO UPDATE
SET active = EXCLUDED.active,
    role = EXCLUDED.role,
    updated_at = now();

CREATE OR REPLACE FUNCTION public.is_portal_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pdf_admins WHERE user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid() AND tipo = 'administrador'
  );
$$;

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
      WHERE pm.project_id = p_project_id
        AND pm.user_id = auth.uid()
        AND pm.active = true
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
      SELECT 1
      FROM public.projetos p
      JOIN public.project_members pm ON pm.project_id = p.id
      WHERE p.contract_id = p_contract_id
        AND pm.user_id = auth.uid()
        AND pm.active = true
    );
$$;

REVOKE ALL ON FUNCTION public.is_portal_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_project(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_contract(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_portal_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_project(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_contract(uuid) TO authenticated;

ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_migration_issues ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contratos' AND policyname = 'contract_members_read') THEN
    CREATE POLICY contract_members_read ON public.contratos
      FOR SELECT TO authenticated
      USING (public.can_access_contract(id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contratos' AND policyname = 'contract_admin_manage') THEN
    CREATE POLICY contract_admin_manage ON public.contratos
      FOR ALL TO authenticated
      USING (public.is_portal_admin())
      WITH CHECK (public.is_portal_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'project_members' AND policyname = 'members_read_own') THEN
    CREATE POLICY members_read_own ON public.project_members
      FOR SELECT TO authenticated
      USING (user_id = auth.uid() OR public.is_portal_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'project_members' AND policyname = 'members_admin_manage') THEN
    CREATE POLICY members_admin_manage ON public.project_members
      FOR ALL TO authenticated
      USING (public.is_portal_admin())
      WITH CHECK (public.is_portal_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'app_migration_issues' AND policyname = 'migration_issues_admin_only') THEN
    CREATE POLICY migration_issues_admin_only ON public.app_migration_issues
      FOR ALL TO authenticated
      USING (public.is_portal_admin())
      WITH CHECK (public.is_portal_admin());
  END IF;
END;
$$;

REVOKE ALL ON public.contratos FROM anon;
REVOKE ALL ON public.project_members FROM anon;
REVOKE ALL ON public.app_migration_issues FROM anon;
GRANT SELECT ON public.contratos TO authenticated;
GRANT SELECT ON public.project_members TO authenticated;
GRANT SELECT ON public.app_migration_issues TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.contratos TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.project_members TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_migration_issues TO authenticated;

-- Pendências explícitas: elas bloqueiam a futura etapa de NOT NULL, mas não
-- interrompem esta migração nem inventam relacionamentos.
INSERT INTO public.app_migration_issues (issue_key, entity_type, entity_id, issue_type, details)
SELECT
  'project-without-client:' || p.id,
  'project',
  p.id,
  'missing_client',
  jsonb_build_object('project_name', p.nome)
FROM public.projetos p
WHERE p.cliente_id IS NULL
ON CONFLICT (issue_key) DO UPDATE SET details = EXCLUDED.details, resolved_at = NULL;

INSERT INTO public.app_migration_issues (issue_key, entity_type, entity_id, issue_type, details)
SELECT
  'project-without-contract:' || p.id,
  'project',
  p.id,
  'missing_contract',
  jsonb_build_object('project_name', p.nome, 'legacy_contract_number', p.numero_contrato)
FROM public.projetos p
WHERE p.contract_id IS NULL
ON CONFLICT (issue_key) DO UPDATE SET details = EXCLUDED.details, resolved_at = NULL;

INSERT INTO public.app_migration_issues (issue_key, entity_type, entity_id, issue_type, details)
SELECT
  'generated-contract-review:' || c.id,
  'contract',
  c.id,
  'generated_contract_number_review',
  jsonb_build_object('contract_number', c.contract_number, 'legacy_contract_number', c.legacy_contract_number)
FROM public.contratos c
WHERE c.contract_number LIKE 'MIG-%'
ON CONFLICT (issue_key) DO UPDATE SET details = EXCLUDED.details, resolved_at = NULL;

INSERT INTO public.app_migration_issues (issue_key, entity_type, entity_id, issue_type, details)
SELECT 'document-without-project:' || id, 'document', id, 'missing_project', '{}'::jsonb
FROM public.documentos WHERE projeto_id IS NULL
ON CONFLICT (issue_key) DO UPDATE SET resolved_at = NULL;

INSERT INTO public.app_migration_issues (issue_key, entity_type, entity_id, issue_type, details)
SELECT 'photo-without-project:' || id, 'photo', id, 'missing_project', '{}'::jsonb
FROM public.fotos WHERE projeto_id IS NULL
ON CONFLICT (issue_key) DO UPDATE SET resolved_at = NULL;

INSERT INTO public.app_migration_issues (issue_key, entity_type, entity_id, issue_type, details)
SELECT 'library-without-project:' || id, 'library', id, 'missing_project', '{}'::jsonb
FROM public.biblioteca WHERE projeto_id IS NULL
ON CONFLICT (issue_key) DO UPDATE SET resolved_at = NULL;

INSERT INTO public.app_migration_issues (issue_key, entity_type, entity_id, issue_type, details)
SELECT 'agenda-without-project:' || id, 'agenda', id, 'missing_project', '{}'::jsonb
FROM public.agenda WHERE projeto_id IS NULL
ON CONFLICT (issue_key) DO UPDATE SET resolved_at = NULL;

INSERT INTO public.app_migration_issues (issue_key, entity_type, entity_id, issue_type, details)
SELECT 'timeline-without-project:' || id, 'timeline', id, 'missing_project', '{}'::jsonb
FROM public.cronograma WHERE projeto_id IS NULL
ON CONFLICT (issue_key) DO UPDATE SET resolved_at = NULL;

INSERT INTO public.app_migration_issues (issue_key, entity_type, entity_id, issue_type, details)
SELECT 'request-without-project:' || id, 'request', id, 'missing_project', '{}'::jsonb
FROM public.solicitacoes WHERE projeto_id IS NULL
ON CONFLICT (issue_key) DO UPDATE SET resolved_at = NULL;

INSERT INTO public.app_migration_issues (issue_key, entity_type, entity_id, issue_type, details)
SELECT 'approval-without-project:' || id, 'approval', id, 'missing_project', '{}'::jsonb
FROM public.aprovacoes WHERE projeto_id IS NULL
ON CONFLICT (issue_key) DO UPDATE SET resolved_at = NULL;

CREATE OR REPLACE FUNCTION public.app_foundation_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_portal_admin() THEN
    RAISE EXCEPTION 'Acesso administrativo necessário';
  END IF;

  RETURN jsonb_build_object(
    'contracts', (SELECT count(*) FROM public.contratos),
    'projects_without_contract', (SELECT count(*) FROM public.projetos WHERE contract_id IS NULL),
    'active_project_members', (SELECT count(*) FROM public.project_members WHERE active = true),
    'open_migration_issues', (SELECT count(*) FROM public.app_migration_issues WHERE resolved_at IS NULL),
    'generated_contracts_to_review', (
      SELECT count(*) FROM public.app_migration_issues
      WHERE issue_type = 'generated_contract_number_review' AND resolved_at IS NULL
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.app_foundation_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_foundation_status() TO authenticated;

COMMIT;
