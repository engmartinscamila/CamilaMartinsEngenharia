BEGIN;
CREATE INDEX IF NOT EXISTS commercial_records_quote_document_id_idx ON public.commercial_records(quote_document_id) WHERE quote_document_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS commercial_records_contract_document_id_idx ON public.commercial_records(contract_document_id) WHERE contract_document_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS commercial_records_linked_client_id_idx ON public.commercial_records(linked_client_id) WHERE linked_client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS commercial_records_linked_contract_id_idx ON public.commercial_records(linked_contract_id) WHERE linked_contract_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS commercial_records_linked_project_id_idx ON public.commercial_records(linked_project_id) WHERE linked_project_id IS NOT NULL;
DO $$
BEGIN
  IF to_regclass('public.aprovacoes_cliente_idx') IS NOT NULL AND to_regclass('public.aprovacoes_cliente_id_idx') IS NOT NULL THEN
    DROP INDEX public.aprovacoes_cliente_id_idx;
  END IF;
END;
$$;
COMMIT;
