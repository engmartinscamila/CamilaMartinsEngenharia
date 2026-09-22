-- Ponte segura entre a tela de reprogramação e o formulário guiado existente.
-- A autorização é temporária, vinculada a usuário/projeto/versão/orçamento/contrato
-- e é consumida atomicamente quando o novo plano é salvo.

CREATE TABLE IF NOT EXISTS public.construction_schedule_revision_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE RESTRICT,
  previous_schedule_id uuid NOT NULL REFERENCES public.construction_schedules(id) ON DELETE RESTRICT,
  quote_record_id uuid NOT NULL REFERENCES public.commercial_records(id) ON DELETE RESTRICT,
  contract_record_id uuid NOT NULL REFERENCES public.commercial_records(id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 10 AND 2000),
  requested_by uuid NOT NULL DEFAULT auth.uid(),
  requested_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  consumed_at timestamptz,
  consumed_schedule_id uuid REFERENCES public.construction_schedules(id) ON DELETE RESTRICT,
  CONSTRAINT revision_request_consumption_consistent CHECK (
    (consumed_at IS NULL AND consumed_schedule_id IS NULL) OR
    (consumed_at IS NOT NULL AND consumed_schedule_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS construction_revision_request_open_project_uidx
  ON public.construction_schedule_revision_requests(project_id)
  WHERE consumed_at IS NULL;
CREATE INDEX IF NOT EXISTS construction_revision_request_user_idx
  ON public.construction_schedule_revision_requests(requested_by,requested_at DESC);
ALTER TABLE public.construction_schedule_revision_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.construction_schedule_revision_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.construction_schedule_revision_requests TO authenticated;

DROP POLICY IF EXISTS construction_revision_request_admin_select ON public.construction_schedule_revision_requests;
CREATE POLICY construction_revision_request_admin_select
  ON public.construction_schedule_revision_requests FOR SELECT TO authenticated
  USING (public.is_portal_admin());
DROP POLICY IF EXISTS construction_revision_request_admin_insert ON public.construction_schedule_revision_requests;
CREATE POLICY construction_revision_request_admin_insert
  ON public.construction_schedule_revision_requests FOR INSERT TO authenticated
  WITH CHECK (public.is_portal_admin() AND requested_by=(SELECT auth.uid()));
DROP POLICY IF EXISTS construction_revision_request_admin_update ON public.construction_schedule_revision_requests;
CREATE POLICY construction_revision_request_admin_update
  ON public.construction_schedule_revision_requests FOR UPDATE TO authenticated
  USING (public.is_portal_admin()) WITH CHECK (public.is_portal_admin());

CREATE OR REPLACE FUNCTION public.admin_prepare_full_schedule_revision(
  p_previous_schedule_id uuid,
  p_quote_record_id uuid,
  p_contract_record_id uuid,
  p_reason text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $prepare$
DECLARE
  v_previous public.construction_schedules%ROWTYPE;
  v_id uuid;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT public.is_portal_admin() THEN
    RAISE EXCEPTION 'Acesso administrativo necessário';
  END IF;
  IF char_length(btrim(coalesce(p_reason,''))) NOT BETWEEN 10 AND 2000 THEN
    RAISE EXCEPTION 'Informe justificativa auditável da reprogramação';
  END IF;

  SELECT * INTO v_previous
  FROM public.construction_schedules
  WHERE id=p_previous_schedule_id
  FOR UPDATE;
  IF v_previous.id IS NULL OR v_previous.activation_status IS DISTINCT FROM 'approved'
     OR v_previous.is_current IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Selecione a revisão vigente e aprovada';
  END IF;

  PERFORM public.assert_full_schedule_commercial_link(
    v_previous.project_id,p_quote_record_id,p_contract_record_id
  );

  -- Uma nova preparação substitui somente outra preparação ainda não consumida.
  UPDATE public.construction_schedule_revision_requests
  SET consumed_at=now(),consumed_schedule_id=previous_schedule_id
  WHERE project_id=v_previous.project_id AND consumed_at IS NULL;

  INSERT INTO public.construction_schedule_revision_requests(
    project_id,previous_schedule_id,quote_record_id,contract_record_id,reason,requested_by
  ) VALUES (
    v_previous.project_id,v_previous.id,p_quote_record_id,p_contract_record_id,
    btrim(p_reason),(SELECT auth.uid())
  ) RETURNING id INTO v_id;

  INSERT INTO public.audit_log(user_id,action,entity_type,entity_id,details)
  VALUES((SELECT auth.uid()),'prepare_construction_schedule_revision',
    'construction_schedule_revision_requests',v_id,
    jsonb_build_object('project_id',v_previous.project_id,
      'previous_schedule_id',v_previous.id,'previous_revision',v_previous.revision_number));
  RETURN v_id;
END;
$prepare$;

-- Substitui o wrapper canônico: primeira versão continua igual; se o projeto já
-- tiver versão vigente aprovada, exige pedido temporário exatamente compatível.
CREATE OR REPLACE FUNCTION public.admin_initialize_and_save_full_schedule(
 p_project_id uuid,p_quote_record_id uuid,p_contract_record_id uuid,p_plan jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $atomic$
DECLARE
  v_schedule_id uuid;
  v_current public.construction_schedules%ROWTYPE;
  v_request public.construction_schedule_revision_requests%ROWTYPE;
BEGIN
 IF (SELECT auth.uid()) IS NULL OR NOT public.is_portal_admin() THEN
  RAISE EXCEPTION 'Acesso administrativo necessário';
 END IF;

 SELECT * INTO v_current
 FROM public.construction_schedules
 WHERE project_id=p_project_id AND is_current IS TRUE
 ORDER BY revision_number DESC LIMIT 1
 FOR UPDATE;

 IF v_current.id IS NULL OR (v_current.activation_status='draft' AND v_current.revision_number=1) THEN
   v_schedule_id := public.admin_initialize_construction_schedule(
     p_project_id,p_quote_record_id,p_contract_record_id);
   -- Preservar integralmente a versão anterior do wrapper: plano, feriados e
   -- pesos físicos são a MESMA transação também no primeiro cronograma.
   PERFORM public.admin_save_full_schedule_plan(v_schedule_id,p_plan);
   PERFORM public.admin_set_construction_schedule_holidays(
     v_schedule_id,coalesce(p_plan->'holidays','[]'::jsonb));
   PERFORM public.admin_set_full_schedule_physical_weights(
     v_schedule_id,coalesce(p_plan->'physical_weights','[]'::jsonb));
   RETURN v_schedule_id;
 END IF;

 IF v_current.activation_status IS DISTINCT FROM 'approved' THEN
   RAISE EXCEPTION 'Cronograma vigente incompatível; não sobrescrever histórico';
 END IF;

 SELECT * INTO v_request
 FROM public.construction_schedule_revision_requests r
 WHERE r.project_id=p_project_id
   AND r.previous_schedule_id=v_current.id
   AND r.quote_record_id=p_quote_record_id
   AND r.contract_record_id=p_contract_record_id
   AND r.requested_by=(SELECT auth.uid())
   AND r.consumed_at IS NULL
   AND r.expires_at>now()
 ORDER BY r.requested_at DESC LIMIT 1
 FOR UPDATE;

 IF v_request.id IS NULL THEN
   RAISE EXCEPTION 'Projeto possui cronograma aprovado; prepare uma reprogramação/aditivo antes de salvar novo plano';
 END IF;

 v_schedule_id := public.admin_begin_and_save_full_schedule_revision(
   v_current.id,p_quote_record_id,p_contract_record_id,v_request.reason,p_plan
 );
 UPDATE public.construction_schedule_revision_requests
 SET consumed_at=now(),consumed_schedule_id=v_schedule_id
 WHERE id=v_request.id;

 RETURN v_schedule_id;
END;
$atomic$;

REVOKE ALL ON FUNCTION public.admin_prepare_full_schedule_revision(uuid,uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_prepare_full_schedule_revision(uuid,uuid,uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_initialize_and_save_full_schedule(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_initialize_and_save_full_schedule(uuid,uuid,uuid,jsonb) TO authenticated;
