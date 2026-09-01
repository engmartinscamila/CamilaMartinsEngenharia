BEGIN;
REVOKE ALL ON FUNCTION public.admin_prepare_contract_document(uuid,text,uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_prepare_contract_document(uuid,text,uuid,jsonb) TO authenticated;
COMMIT;
