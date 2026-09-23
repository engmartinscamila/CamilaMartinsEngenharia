-- Alinha nomes prospectivos usados em formulários e Word com o Contrato Mestre v3.
-- Não altera snapshots ou documentos emitidos e não resolve revisões automaticamente.
-- O trigger existente reabre as verificações de compatibilidade pertinentes.
DO $migration$
DECLARE
  v_master public.contract_master_versions%rowtype;
  v_updated integer;
BEGIN
  SELECT * INTO v_master FROM public.contract_master_versions
  WHERE active=true ORDER BY version DESC LIMIT 1 FOR SHARE;
  IF v_master.version IS DISTINCT FROM 3
     OR position('PRATA (Ampliado)' in v_master.body)=0
     OR position('OURO (Completo)' in v_master.body)=0 THEN
    RAISE EXCEPTION 'Contrato Mestre ativo não corresponde à v3 esperada; alteração cancelada';
  END IF;

  IF (SELECT count(*) FROM public.service_level_catalog
      WHERE active AND ((code='prata' AND subtitle='Visual' AND version=2)
                     OR (code='ouro' AND subtitle='Imersivo' AND version=2)))<>2 THEN
    RAISE EXCEPTION 'Catálogo de pacotes mudou; revisar subtítulos e versões antes da atualização';
  END IF;

  UPDATE public.service_level_catalog
  SET subtitle=CASE code WHEN 'prata' THEN 'Ampliado' WHEN 'ouro' THEN 'Completo' END,
      version=version+1,
      last_contract_master_version=NULL,
      updated_at=now()
  WHERE active AND ((code='prata' AND subtitle='Visual')
                OR (code='ouro' AND subtitle='Imersivo'));
  GET DIAGNOSTICS v_updated=ROW_COUNT;
  IF v_updated<>2 THEN
    RAISE EXCEPTION 'Atualização esperava dois níveis; % modificados. Reverter.',v_updated;
  END IF;

  IF (SELECT count(*) FROM public.service_level_catalog
      WHERE active AND ((code='prata' AND subtitle='Ampliado' AND version=3)
                     OR (code='ouro' AND subtitle='Completo' AND version=3)))<>2 THEN
    RAISE EXCEPTION 'Os subtítulos ou versões não foram gravados corretamente';
  END IF;

  INSERT INTO public.audit_log(user_id,action,entity_type,details)
  VALUES (NULL,'align_level_subtitles_master_v3','service_level_catalog',
      jsonb_build_object('master_version',3,'changed_codes',jsonb_build_array('prata','ouro'),
      'historical_snapshots_modified',false,'reviews_auto_approved',false));
END;
$migration$;
