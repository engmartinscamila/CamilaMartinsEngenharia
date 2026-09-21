-- Alinha SOMENTE novas seleções do catálogo ao Contrato Mestre 1.7.
-- Não modifica snapshots nem documentos comerciais antigos.
DO $migration$
DECLARE v_rows integer;
BEGIN
 IF (SELECT version FROM public.contract_master_versions WHERE active ORDER BY version DESC LIMIT 1)<>2 THEN
   RAISE EXCEPTION 'Versão contratual inesperada; revisão necessária';
 END IF;
 UPDATE public.service_catalog
 SET level_applicable=false,
     default_revisions=CASE WHEN code='j' THEN NULL ELSE default_revisions END,
     version=version+1,
     last_contract_master_version=NULL,
     updated_at=now()
 WHERE active=true AND code IN ('e','f','g','j','r') AND level_applicable=true;
 GET DIAGNOSTICS v_rows=ROW_COUNT;
 IF v_rows<>5 THEN RAISE EXCEPTION 'Esperados cinco serviços elegíveis inconsistentes; encontrados %. Operação revertida.',v_rows; END IF;
 INSERT INTO public.audit_log(user_id,action,entity_type,details)
 VALUES(NULL,'align_service_tier_eligibility','service_catalog',jsonb_build_object(
  'codes',jsonb_build_array('e','f','g','j','r'),
  'scope','new catalog snapshots only',
  'contract_master_version',2,
  'existing_document_snapshots_modified',false,
  'approval_status','pending governed review'));
END;
$migration$;