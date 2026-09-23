-- Corrige somente catálogo prospectivo; preserva snapshots e documentos existentes.
DO $migration$ DECLARE n integer; BEGIN
 IF (SELECT version FROM public.contract_master_versions WHERE active ORDER BY version DESC LIMIT 1)<>2 THEN
  RAISE EXCEPTION 'Contrato Mestre alterado; revisar migração'; END IF;
 UPDATE public.service_catalog
 SET default_revisions=NULL,version=version+1,last_contract_master_version=NULL,updated_at=now()
 WHERE active AND code IN ('k','l','m','o') AND default_revisions IS NOT NULL;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>4 THEN RAISE EXCEPTION 'Esperados quatro serviços com revisão presumida, encontrados %; revertido.',n; END IF;
 INSERT INTO public.audit_log(user_id,action,entity_type,details)
 VALUES(NULL,'remove_uncontracted_nonproject_revisions','service_catalog',jsonb_build_object(
 'codes',jsonb_build_array('k','l','m','o'),
 'historical_documents_changed',false,'new_catalog_versions',true,'review_approval',false));
END $migration$;
