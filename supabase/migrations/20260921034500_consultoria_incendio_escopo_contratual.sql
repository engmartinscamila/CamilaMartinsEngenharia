-- Correção prospectiva do catálogo: NÃO altera contratos ou documentos já emitidos.
-- O Contrato Mestre v1 reserva Bronze/Prata/Ouro a serviços de projeto (cláusula 1.7).
-- Apenas vínculos de referência são registrados; revisões documentais seguem pendentes.
DO $migration$
DECLARE
  v_body text;
BEGIN
  SELECT body INTO v_body FROM public.contract_master_versions
  WHERE active = true ORDER BY version DESC LIMIT 1;

  -- O fixture isolado de segurança pode não conter um Contrato Mestre. No banco
  -- real, só associar referências cuja numeração já esteja presente no texto.
  IF v_body IS NOT NULL AND NOT (
    position('1.1.' in v_body) > 0 AND
    position('1.2.' in v_body) > 0 AND
    position('1.3.' in v_body) > 0 AND
    position('1.7.' in v_body) > 0 AND
    position('10.1.' in v_body) > 0 AND
    position('10.2.' in v_body) > 0
  ) THEN
    RAISE EXCEPTION 'Contrato Mestre não contém todas as cláusulas referenciadas; revisão necessária.';
  END IF;

  UPDATE public.service_catalog
  SET level_applicable = false,
      default_revisions = NULL,
      delivery_formats = '[]'::jsonb,
      planning_reference = 'Prazo, formato, quantidade de consultas, visitas e revisões somente conforme orçamento e Anexo I aprovados.',
      contract_clause_refs = ARRAY['1.1','1.2','1.7','10.1']::text[],
      version = version + 1,
      updated_at = now()
  WHERE code = 'q' AND active = true
    AND (level_applicable IS DISTINCT FROM false
         OR default_revisions IS NOT NULL
         OR delivery_formats <> '[]'::jsonb
         OR contract_clause_refs IS DISTINCT FROM ARRAY['1.1','1.2','1.7','10.1']::text[]);

  UPDATE public.service_catalog
  SET contract_clause_refs = ARRAY['1.1','1.2','1.3','1.7','10.1','10.2']::text[],
      version = version + 1,
      updated_at = now()
  WHERE code = 'r' AND active = true
    AND contract_clause_refs IS DISTINCT FROM ARRAY['1.1','1.2','1.3','1.7','10.1','10.2']::text[];

  -- Deliberadamente NÃO marca last_contract_master_version e NÃO resolve
  -- document_rule_reviews. A aprovação exige verificação explícita da redação.
END;
$migration$;
