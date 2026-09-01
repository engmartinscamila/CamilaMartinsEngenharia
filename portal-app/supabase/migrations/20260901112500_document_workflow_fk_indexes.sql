BEGIN;
CREATE INDEX IF NOT EXISTS aprovacoes_cliente_id_idx ON public.aprovacoes(cliente_id);
CREATE INDEX IF NOT EXISTS aprovacoes_projeto_id_idx ON public.aprovacoes(projeto_id);
CREATE INDEX IF NOT EXISTS aprovacoes_schedule_stage_id_idx ON public.aprovacoes(schedule_stage_id) WHERE schedule_stage_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS aprovacoes_formal_notice_document_id_idx ON public.aprovacoes(formal_notice_document_id) WHERE formal_notice_document_id IS NOT NULL;
COMMIT;
