BEGIN;

-- Mantém a versão anterior válida durante a transição e registra a nova
-- versão separadamente. Registros existentes permanecem imutáveis.
CREATE OR REPLACE FUNCTION public.accept_current_legal_documents(
  p_terms_version text,
  p_privacy_version text,
  p_app_version text,
  p_platform text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_acceptance public.legal_acceptances%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sessão autenticada necessária';
  END IF;

  IF NOT (
    (p_terms_version = '2026.08.12-1' AND p_privacy_version = '2026.08.12-1')
    OR
    (p_terms_version = '2026.08.12-2' AND p_privacy_version = '2026.08.12-2')
  ) THEN
    RAISE EXCEPTION 'Versão de documento inválida';
  END IF;

  IF nullif(btrim(p_app_version), '') IS NULL
    OR p_platform NOT IN ('android', 'ios', 'web', 'unknown') THEN
    RAISE EXCEPTION 'Informações do aplicativo inválidas';
  END IF;

  INSERT INTO public.legal_acceptances (
    user_id, terms_version, privacy_version, app_version, platform
  )
  VALUES (
    v_user_id, p_terms_version, p_privacy_version, p_app_version, p_platform
  )
  ON CONFLICT (user_id, terms_version, privacy_version) DO NOTHING;

  SELECT *
    INTO v_acceptance
    FROM public.legal_acceptances
   WHERE user_id = v_user_id
     AND terms_version = p_terms_version
     AND privacy_version = p_privacy_version;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Não foi possível registrar o aceite';
  END IF;

  INSERT INTO public.audit_log (user_id, action, entity_type, entity_id, details)
  SELECT
    v_user_id,
    'accept',
    'legal_documents',
    v_acceptance.id,
    jsonb_build_object(
      'terms_version', p_terms_version,
      'privacy_version', p_privacy_version,
      'app_version', p_app_version,
      'platform', p_platform
    )
  WHERE NOT EXISTS (
    SELECT 1
      FROM public.audit_log
     WHERE user_id = v_user_id
       AND action = 'accept'
       AND entity_type = 'legal_documents'
       AND entity_id = v_acceptance.id
  );

  RETURN jsonb_build_object(
    'id', v_acceptance.id,
    'accepted_at', v_acceptance.accepted_at,
    'terms_version', v_acceptance.terms_version,
    'privacy_version', v_acceptance.privacy_version
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_current_legal_documents(text, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_current_legal_documents(text, text, text, text)
  TO authenticated;

COMMENT ON FUNCTION public.accept_current_legal_documents(text, text, text, text) IS
  'Registra aceite dos Termos e ciência da Política, preservando versões anteriores durante a transição.';

COMMIT;
