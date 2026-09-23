-- Sem mudança em contratos ou aprovações. O painel de governança e o guard
-- agora usam o mesmo conjunto de textos obrigatórios.
CREATE OR REPLACE FUNCTION public.admin_document_governance_status()
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public'
AS $fn$
DECLARE
 v_contract jsonb;v_master integer;v_body text;v_pending integer;
 v_outdated_services integer;v_outdated_levels integer;v_outdated_texts integer;
 v_missing_refs integer;v_unresolved integer;v_missing_required integer;
BEGIN
 IF NOT public.is_portal_admin() THEN RAISE EXCEPTION 'Acesso administrativo necessario'; END IF;
 SELECT to_jsonb(c)-'body',c.version,c.body INTO v_contract,v_master,v_body
 FROM public.contract_master_versions c WHERE c.active=true ORDER BY c.version DESC LIMIT 1;
 SELECT count(*) INTO v_unresolved FROM regexp_matches(coalesce(v_body,''),'\[[^]]+\]','g') AS matches;
 SELECT count(*) INTO v_pending FROM public.document_rule_reviews WHERE contract_master_version=v_master AND status='pending';
 SELECT count(*) INTO v_outdated_services FROM public.service_catalog WHERE active AND last_contract_master_version IS DISTINCT FROM v_master;
 SELECT count(*) INTO v_outdated_levels FROM public.service_level_catalog WHERE active AND last_contract_master_version IS DISTINCT FROM v_master;
 SELECT count(*) INTO v_outdated_texts FROM public.document_text_catalog WHERE active AND last_contract_master_version IS DISTINCT FROM v_master;
 SELECT (SELECT count(*) FROM public.service_catalog WHERE active AND cardinality(contract_clause_refs)=0)
  +(SELECT count(*) FROM public.service_level_catalog WHERE active AND cardinality(contract_clause_refs)=0)
  +(SELECT count(*) FROM public.document_text_catalog WHERE active AND cardinality(contract_clause_refs)=0)
 INTO v_missing_refs;
 SELECT count(*) INTO v_missing_required FROM unnest(array[
 'proposal_scope_governance','proposal_revision_rule','proposal_timeline_rule',
 'proposal_client_inputs_rule','anexo_scope_governance','anexo_revision_rule',
 'anexo_timeline_rule','acceptance_rule','additional_service_rule','notification_rule',
 'study_prelim_limit','survey_limit','image_authorization_conditions',
 'closing_release_rule','level_scope_rule','scope_limits_rule'
 ]) AS required(code)
 WHERE NOT EXISTS (SELECT 1 FROM public.document_text_catalog t WHERE t.code=required.code AND t.active);
 RETURN jsonb_build_object(
 'contract',coalesce(v_contract,'{}'::jsonb),
 'pending_reviews',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.source_type,r.source_code) FROM public.document_rule_reviews r WHERE r.status='pending' AND r.contract_master_version=v_master),'[]'::jsonb),
 'services',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.code) FROM public.service_catalog s WHERE s.active),'[]'::jsonb),
 'levels',coalesce((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.code) FROM public.service_level_catalog l WHERE l.active),'[]'::jsonb),
 'texts',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.document_kind,t.code) FROM public.document_text_catalog t WHERE t.active),'[]'::jsonb),
 'preflight',jsonb_build_object(
 'ready',v_master IS NOT NULL AND v_unresolved=0 AND v_pending=0 AND
  v_outdated_services=0 AND v_outdated_levels=0 AND v_outdated_texts=0 AND
  v_missing_refs=0 AND v_missing_required=0,
 'unresolved_contract_fields',v_unresolved,
 'pending_total',v_pending,
 'pending_by_type',coalesce((SELECT jsonb_object_agg(source_type,total)
  FROM (SELECT source_type,count(*) total FROM public.document_rule_reviews
   WHERE contract_master_version=v_master AND status='pending' GROUP BY source_type) grouped),'{}'::jsonb),
 'outdated_services',v_outdated_services,'outdated_levels',v_outdated_levels,
 'outdated_texts',v_outdated_texts,'items_without_clause_refs',v_missing_refs,
 'missing_required_texts',v_missing_required));
END;
$fn$;
