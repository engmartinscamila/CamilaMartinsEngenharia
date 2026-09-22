-- Revisões/aditivos de cronograma: cada reprogramação usa um NOVO schedule_id.
-- A versão anterior, suas medições, publicações e baselines continuam imutáveis.
-- Migration preparada somente na PR #19; exige homologação equivalente antes de produção.

ALTER TABLE public.construction_schedules
  ADD COLUMN IF NOT EXISTS revision_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS supersedes_schedule_id uuid REFERENCES public.construction_schedules(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS revision_reason text;

ALTER TABLE public.construction_schedules
  DROP CONSTRAINT IF EXISTS construction_schedules_project_id_key;

ALTER TABLE public.construction_schedules
  DROP CONSTRAINT IF EXISTS construction_schedule_revision_number_valid;
ALTER TABLE public.construction_schedules
  ADD CONSTRAINT construction_schedule_revision_number_valid CHECK (revision_number >= 1);

ALTER TABLE public.construction_schedules
  DROP CONSTRAINT IF EXISTS construction_schedule_revision_parent_valid;
ALTER TABLE public.construction_schedules
  ADD CONSTRAINT construction_schedule_revision_parent_valid CHECK (
    supersedes_schedule_id IS NULL OR supersedes_schedule_id <> id
  );

ALTER TABLE public.construction_schedules
  DROP CONSTRAINT IF EXISTS construction_schedule_revision_reason_valid;
ALTER TABLE public.construction_schedules
  ADD CONSTRAINT construction_schedule_revision_reason_valid CHECK (
    revision_number = 1 OR char_length(btrim(coalesce(revision_reason, ''))) BETWEEN 10 AND 2000
  );

CREATE UNIQUE INDEX IF NOT EXISTS construction_schedules_project_revision_uidx
  ON public.construction_schedules(project_id, revision_number);
CREATE UNIQUE INDEX IF NOT EXISTS construction_schedules_current_project_uidx
  ON public.construction_schedules(project_id)
  WHERE is_current IS TRUE;
CREATE INDEX IF NOT EXISTS construction_schedules_revision_chain_idx
  ON public.construction_schedules(project_id, revision_number DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS construction_schedules_supersedes_idx
  ON public.construction_schedules(supersedes_schedule_id)
  WHERE supersedes_schedule_id IS NOT NULL;

-- Metadados de revisão também ficam congelados quando a versão é aprovada.
CREATE OR REPLACE FUNCTION public.guard_construction_schedule_revision_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $guard$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.activation_status = 'approved' AND (
    NEW.revision_number IS DISTINCT FROM OLD.revision_number OR
    NEW.supersedes_schedule_id IS DISTINCT FROM OLD.supersedes_schedule_id OR
    NEW.revision_reason IS DISTINCT FROM OLD.revision_reason
  ) THEN
    RAISE EXCEPTION 'Metadados de uma revisão aprovada são imutáveis';
  END IF;

  IF NEW.revision_number = 1 AND NEW.supersedes_schedule_id IS NOT NULL THEN
    RAISE EXCEPTION 'A revisão inicial não pode substituir outro cronograma';
  END IF;
  IF NEW.revision_number > 1 AND NEW.supersedes_schedule_id IS NULL THEN
    RAISE EXCEPTION 'Revisões posteriores precisam identificar a versão substituída';
  END IF;

  IF NEW.supersedes_schedule_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
      FROM public.construction_schedules prior
     WHERE prior.id = NEW.supersedes_schedule_id
       AND prior.project_id = NEW.project_id
       AND prior.revision_number = NEW.revision_number - 1
       AND prior.activation_status = 'approved'
  ) THEN
    RAISE EXCEPTION 'A revisão deve suceder a versão aprovada imediatamente anterior do mesmo projeto';
  END IF;

  RETURN NEW;
END;
$guard$;

DROP TRIGGER IF EXISTS construction_schedule_revision_metadata_guard
  ON public.construction_schedules;
CREATE TRIGGER construction_schedule_revision_metadata_guard
BEFORE INSERT OR UPDATE OF revision_number, supersedes_schedule_id, revision_reason, project_id
ON public.construction_schedules
FOR EACH ROW EXECUTE FUNCTION public.guard_construction_schedule_revision_metadata();

-- Abre um rascunho de revisão sem copiar custos, medições ou progresso realizado.
-- O novo plano precisa ser novamente conferido e salvo pelo fluxo normal.
CREATE OR REPLACE FUNCTION public.admin_begin_full_schedule_revision(
  p_schedule_id uuid,
  p_quote_record_id uuid,
  p_contract_record_id uuid,
  p_reason text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $revision$
DECLARE
  v_previous public.construction_schedules%ROWTYPE;
  v_scope jsonb;
  v_new_id uuid;
  v_next_revision integer;
  v_existing_draft uuid;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT public.is_portal_admin() THEN
    RAISE EXCEPTION 'Acesso administrativo necessário';
  END IF;
  IF char_length(btrim(coalesce(p_reason, ''))) NOT BETWEEN 10 AND 2000 THEN
    RAISE EXCEPTION 'Informe o motivo auditável da reprogramação/aditivo (10 a 2000 caracteres)';
  END IF;

  SELECT * INTO v_previous
    FROM public.construction_schedules
   WHERE id = p_schedule_id
   FOR UPDATE;

  IF v_previous.id IS NULL OR v_previous.activation_status IS DISTINCT FROM 'approved'
     OR v_previous.is_current IS NOT TRUE OR v_previous.activation_status = 'legacy' THEN
    RAISE EXCEPTION 'A revisão deve partir do cronograma vigente e aprovado';
  END IF;

  -- Evita dois rascunhos concorrentes para a mesma cadeia.
  SELECT s.id INTO v_existing_draft
    FROM public.construction_schedules s
   WHERE s.project_id = v_previous.project_id
     AND s.activation_status = 'draft'
     AND s.revision_number > v_previous.revision_number
   ORDER BY s.revision_number DESC
   LIMIT 1
   FOR UPDATE;
  IF v_existing_draft IS NOT NULL THEN
    RAISE EXCEPTION 'Já existe uma revisão em rascunho para este projeto';
  END IF;

  v_scope := public.assert_full_schedule_commercial_link(
    v_previous.project_id, p_quote_record_id, p_contract_record_id
  );

  SELECT coalesce(max(revision_number), 0) + 1 INTO v_next_revision
    FROM public.construction_schedules
   WHERE project_id = v_previous.project_id;
  IF v_next_revision IS DISTINCT FROM v_previous.revision_number + 1 THEN
    RAISE EXCEPTION 'Cadeia de revisões inconsistente; não criar nova versão automaticamente';
  END IF;

  INSERT INTO public.construction_schedules(
    project_id, client_id, contract_id,
    quote_record_id, contract_record_id, source_scope_snapshot,
    title, reference_date, planned_start, planned_finish,
    activation_status, revision_number, is_current,
    supersedes_schedule_id, revision_reason, notes
  ) VALUES (
    v_previous.project_id, v_previous.client_id, v_previous.contract_id,
    p_quote_record_id, p_contract_record_id, v_scope,
    regexp_replace(v_previous.title, '\s+—\s+revisão\s+[0-9]+$', '', 'i') || ' — revisão ' || v_next_revision,
    current_date, NULL, NULL,
    'draft', v_next_revision, false,
    v_previous.id, btrim(p_reason),
    'Reprogramação criada a partir da revisão ' || v_previous.revision_number ||
      '. Custos, datas, pesos e atividades exigem nova conferência.'
  ) RETURNING id INTO v_new_id;

  INSERT INTO public.audit_log(user_id, action, entity_type, entity_id, details)
  VALUES(
    (SELECT auth.uid()),
    'begin_construction_schedule_revision',
    'construction_schedules',
    v_new_id,
    jsonb_build_object(
      'project_id', v_previous.project_id,
      'supersedes_schedule_id', v_previous.id,
      'previous_revision', v_previous.revision_number,
      'new_revision', v_next_revision,
      'reason', btrim(p_reason)
    )
  );

  RETURN v_new_id;
END;
$revision$;

REVOKE ALL ON FUNCTION public.admin_begin_full_schedule_revision(uuid,uuid,uuid,text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_begin_full_schedule_revision(uuid,uuid,uuid,text)
  TO authenticated;

-- Só uma revisão APROVADA pode assumir o marcador de vigente.
-- A anterior é preservada, apenas deixa de ser a versão operacional corrente.
CREATE OR REPLACE FUNCTION public.promote_approved_construction_schedule_revision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $promote$
BEGIN
  IF NEW.activation_status = 'approved'
     AND OLD.activation_status IS DISTINCT FROM 'approved'
     AND NEW.revision_number > 1 THEN
    IF NEW.supersedes_schedule_id IS NULL THEN
      RAISE EXCEPTION 'Revisão aprovada sem versão anterior';
    END IF;

    UPDATE public.construction_schedules
       SET is_current = false,
           updated_at = now()
     WHERE id = NEW.supersedes_schedule_id
       AND project_id = NEW.project_id
       AND revision_number = NEW.revision_number - 1
       AND is_current IS TRUE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'A versão anterior vigente não foi localizada; promoção cancelada';
    END IF;

    UPDATE public.construction_schedules
       SET is_current = true,
           updated_at = now()
     WHERE id = NEW.id
       AND is_current IS FALSE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Não foi possível marcar a nova revisão como vigente';
    END IF;
  END IF;
  RETURN NEW;
END;
$promote$;

DROP TRIGGER IF EXISTS zz_promote_approved_construction_schedule_revision
  ON public.construction_schedules;
CREATE TRIGGER zz_promote_approved_construction_schedule_revision
AFTER UPDATE OF activation_status
ON public.construction_schedules
FOR EACH ROW EXECUTE FUNCTION public.promote_approved_construction_schedule_revision();

-- Compatibilidade: leituras legadas passam a buscar somente a versão vigente.
CREATE OR REPLACE FUNCTION public.admin_initialize_construction_schedule(p_project_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $legacy$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_portal_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  SELECT id INTO v_id
    FROM public.construction_schedules
   WHERE project_id = p_project_id AND is_current IS TRUE
   ORDER BY revision_number DESC
   LIMIT 1;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Cronograma completo não contratado ou não inicializado. Selecione orçamento e contrato vinculados.';
  END IF;
  RETURN v_id;
END;
$legacy$;

-- O inicializador de primeira versão não sobrescreve uma versão aprovada.
CREATE OR REPLACE FUNCTION public.admin_initialize_construction_schedule(
  p_project_id uuid, p_quote_record_id uuid, p_contract_record_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $verified$
DECLARE v_id uuid; v_project public.projetos%ROWTYPE; v_status text; v_revision integer;
BEGIN
  IF NOT public.is_portal_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  PERFORM public.assert_full_schedule_commercial_link(
    p_project_id,p_quote_record_id,p_contract_record_id);
  SELECT * INTO v_project FROM public.projetos WHERE id=p_project_id;

  SELECT id,activation_status,revision_number INTO v_id,v_status,v_revision
    FROM public.construction_schedules
   WHERE project_id=p_project_id AND is_current IS TRUE
   ORDER BY revision_number DESC
   LIMIT 1
   FOR UPDATE;

  IF v_id IS NOT NULL THEN
    IF v_status='draft' AND v_revision=1 AND EXISTS (
      SELECT 1 FROM public.construction_schedules
       WHERE id=v_id AND quote_record_id=p_quote_record_id AND contract_record_id=p_contract_record_id
    ) THEN
      RETURN v_id;
    END IF;
    IF v_status='approved' THEN
      RAISE EXCEPTION 'Projeto já possui cronograma aprovado vigente; abra uma revisão/aditivo com justificativa';
    END IF;
    RAISE EXCEPTION 'Projeto já possui cronograma incompatível; não sobrescreva o histórico';
  END IF;

  INSERT INTO public.construction_schedules(
    project_id,client_id,contract_id,quote_record_id,contract_record_id,
    title,planned_start,planned_finish,reference_date,activation_status,
    revision_number,is_current)
  VALUES (v_project.id,v_project.cliente_id,v_project.contract_id,
    p_quote_record_id,p_contract_record_id,
    'Cronograma físico-financeiro — '||coalesce(v_project.nome,'Obra'),
    NULL,NULL,current_date,'draft',1,true)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$verified$;

REVOKE ALL ON FUNCTION public.guard_construction_schedule_revision_metadata() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.promote_approved_construction_schedule_revision() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.admin_initialize_construction_schedule(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_initialize_construction_schedule(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_initialize_construction_schedule(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_initialize_construction_schedule(uuid,uuid,uuid) TO authenticated;
