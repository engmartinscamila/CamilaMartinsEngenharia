-- Correção prospectiva do catálogo: NÃO altera contratos ou documentos já emitidos.
-- O Contrato Mestre v1 reserva Bronze/Prata/Ouro aos serviços de projeto (1.7).
-- Registra vínculos de referência; revisões documentais permanecem pendentes.
DO $migration$
DECLARE
  v_body text;
BEGIN
  SELECT body INTO v_body FROM public.contract_master_versions
  WHERE active = true ORDER BY version DESC LIMIT 1;

  -- Fixtures isolados podem não conter Contrato Mestre. Quando houver um
  -- texto ativo, conferir existência das cláusulas antes de vincular serviços.
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
         OR delivery_formats IS DISTINCT FROM '[]'::jsonb
         OR contract_clause_refs IS DISTINCT FROM ARRAY['1.1','1.2','1.7','10.1']::text[]);

  -- Serviços administrativos, visitas, laudos e item personalizado não são,
  -- por si, projetos elegíveis aos níveis de experiência. Preserve prazos,
  -- formatos e revisões específicos desses serviços; altere só a elegibilidade.
  UPDATE public.service_catalog
  SET level_applicable = false, version = version + 1, updated_at = now()
  WHERE code IN ('k','l','m','n','o','p')
    AND active = true AND level_applicable IS DISTINCT FROM false;

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
