-- Complementa vínculos descritivos q/r com cláusulas existentes, sem alterar
-- o texto do Contrato Mestre e SEM aprovar revisões de governança documental.
-- Aplicar somente após revisão contratual explícita e testes completos da PR.
DO $migration$
DECLARE
  v_master_version integer;
  v_master_body text;
BEGIN
  SELECT version, body INTO v_master_version, v_master_body
  FROM public.contract_master_versions
  WHERE active = true
  ORDER BY version DESC LIMIT 1;
  IF v_master_version IS NULL THEN
    RAISE EXCEPTION 'Contrato Mestre ativo não encontrado; vínculos não alterados.';
  END IF;
  IF NOT (
    position('1.1.' in v_master_body) > 0 AND
    position('1.2.' in v_master_body) > 0 AND
    position('1.7.' in v_master_body) > 0 AND
    position('10.1.' in v_master_body) > 0
  ) THEN
    RAISE EXCEPTION 'Cláusulas de objeto, exclusões e obrigações divergentes; revisar manualmente.';
  END IF;
  IF (SELECT count(*) FROM public.service_catalog WHERE code IN ('q','r') AND active) <> 2 THEN
    RAISE EXCEPTION 'Serviços q/r ausentes ou inativos; migração interrompida.';
  END IF;
  UPDATE public.service_catalog
  SET contract_clause_refs = ARRAY['1.1','1.2','1.7','10.1']::text[],
      last_contract_master_version = v_master_version,
      version = version + 1,
      updated_at = now()
  WHERE code IN ('q','r')
    AND active
    AND cardinality(contract_clause_refs) = 0
    AND last_contract_master_version IS NULL;
  -- As revisões geradas/pendentes por governança continuam pendentes. Nenhum
  -- UPDATE em document_rule_reviews; elas exigem conferência independente.
END;
$migration$;
