-- Escopo específico para a opção Outros. Apenas novas propostas e alterações
-- explícitas de serviços são normalizadas; não reescreve documentos emitidos.
-- O mesmo snapshot de services é consumido pelo orçamento e pelo contrato.
CREATE OR REPLACE FUNCTION public.normalize_commercial_other_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_item jsonb;
  v_result jsonb := '[]'::jsonb;
  v_spec text := nullif(btrim(coalesce(NEW.custom_service, '')), '');
  v_description text;
BEGIN
  IF jsonb_typeof(NEW.services) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'A seleção de serviços deve ser uma lista válida.';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(NEW.services)
  LOOP
    IF jsonb_typeof(v_item) = 'object'
       AND lower(coalesce(v_item->>'code', '')) IN ('p', 'outro', 'outros')
       AND lower(coalesce(v_item->>'included', 'false')) = 'true' THEN
      IF v_spec IS NULL OR length(v_spec) < 12
         OR lower(v_spec) IN ('outro', 'outros', 'a definir', 'serviço técnico', 'servico tecnico') THEN
        RAISE EXCEPTION 'Para a atividade Outros, descreva o serviço específico com pelo menos 12 caracteres antes de criar o orçamento.';
      END IF;

      v_description := format(
        'Atividade específica solicitada: %s. A prestação abrange exclusivamente esta atividade e os resultados expressamente descritos e aprovados no orçamento e no Anexo I. Quantidades, formato de entrega, visitas, revisões, prazo e etapas somente serão considerados incluídos quando definidos expressamente; acréscimos exigem aprovação e contratação prévias.',
        v_spec
      );
      v_item := jsonb_set(v_item, '{name}', to_jsonb('Serviço técnico personalizado'::text), true);
      v_item := jsonb_set(v_item, '{description}', to_jsonb(v_description), true);
      -- Não prometer formatos, revisões ou entregáveis não especificados.
      v_item := jsonb_set(v_item, '{deliverables}', '[]'::jsonb, true);
      v_item := jsonb_set(v_item, '{deliveryFormats}',
        to_jsonb(ARRAY['Conforme formato acordado no orçamento e no Anexo I']::text[]), true);
      v_item := jsonb_set(v_item, '{revisions}', 'null'::jsonb, true);
      v_item := jsonb_set(v_item, '{planningReference}',
        to_jsonb('Prazo e marcos a definir expressamente no orçamento e no Anexo I.'::text), true);
    END IF;
    v_result := v_result || jsonb_build_array(v_item);
  END LOOP;

  NEW.services := v_result;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_normalize_commercial_other_scope ON public.commercial_records;
CREATE TRIGGER trg_normalize_commercial_other_scope
BEFORE INSERT OR UPDATE OF services, custom_service ON public.commercial_records
FOR EACH ROW EXECUTE FUNCTION public.normalize_commercial_other_scope();

COMMENT ON FUNCTION public.normalize_commercial_other_scope() IS
  'Bloqueia Outros sem objeto identificável e preserva a descrição específica no snapshot de serviços do orçamento/contrato.';
