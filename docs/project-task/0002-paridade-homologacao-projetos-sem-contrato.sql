-- Aplicar APENAS no banco de homologação legado: banco de produção já não possui o trigger legado.
-- Corrige validação circular identificada em homologação em 08/11/2026.
CREATE OR REPLACE FUNCTION public.enforce_project_contract_client()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_client_id uuid;
BEGIN
  IF NEW.contract_id IS NULL THEN
    IF NEW.cliente_id IS NULL THEN
      RAISE EXCEPTION 'Selecione o cliente antes de cadastrar o projeto';
    END IF;
    RETURN NEW;
  END IF;
  SELECT cliente_id INTO v_client_id FROM public.contratos WHERE id=NEW.contract_id;
  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Contrato inválido'; END IF;
  IF NEW.cliente_id IS NULL THEN NEW.cliente_id := v_client_id;
  ELSIF NEW.cliente_id <> v_client_id THEN
    RAISE EXCEPTION 'Projeto e contrato pertencem a clientes diferentes';
  END IF;
  RETURN NEW;
END;
$function$;
-- Testado em homologação: projeto vinculado a cliente sem contrato, modelo ativo/inativo,
-- bloqueio de usuário não administrador e ROLLBACK dos dados sintéticos.
