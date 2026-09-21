-- A função anterior alimentava jsonb_object_agg com 25 linhas sem número.
-- Corrigir apenas o filtro, preservando a expressão de classificação existente.
CREATE OR REPLACE FUNCTION public.document_contract_clause_map(p_body text)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $function$
  WITH lines AS (
    SELECT regexp_replace(btrim(raw_line), '[[:space:]]+', ' ', 'g') AS line
    FROM regexp_split_to_table(coalesce(p_body,''), E'\\r?\\n') AS split(raw_line)
  ), numbered AS (
    SELECT parts[1] AS clause_ref, line
    FROM lines
    CROSS JOIN LATERAL regexp_match(line, '^([0-9]+([.][0-9]+)*)[.][[:space:]]*') AS matched(parts)
    WHERE parts[1] IS NOT NULL
  )
  SELECT coalesce(jsonb_object_agg(clause_ref,line ORDER BY clause_ref),'{}'::jsonb)
  FROM numbered
$function$;