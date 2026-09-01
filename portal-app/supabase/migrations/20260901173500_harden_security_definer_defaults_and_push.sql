BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.desativar_push_token(text)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.desativar_push_token(text) SET search_path = ''''';
  END IF;
  IF to_regprocedure('public.registrar_push_diagnostico(uuid,text,text,text,text,text)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.registrar_push_diagnostico(uuid,text,text,text,text,text) SET search_path = ''''';
  END IF;
  IF to_regprocedure('public.registrar_push_token(uuid,text,text,text)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.registrar_push_token(uuid,text,text,text) SET search_path = ''''';
  END IF;
END $$;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;

COMMIT;
