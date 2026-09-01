BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'documentos_document_kind_valid'
      AND conrelid = 'public.documentos'::regclass
  ) THEN
    ALTER TABLE public.documentos
      ADD CONSTRAINT documentos_document_kind_valid
      CHECK (document_kind IS NULL OR document_kind IN (
        'notificacao_formal','anexo_i','termo_aceite','estudo_preliminar','levantamento_tecnico',
        'servico_adicional','autorizacao_imagem','quitacao_encerramento'
      )) NOT VALID;
  END IF;
END;
$$;
COMMIT;
