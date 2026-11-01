BEGIN;
CREATE OR REPLACE FUNCTION public.assert_commercial_terms_ready(p_terms jsonb, p_total numeric, p_services jsonb)
 RETURNS void
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE v_installments jsonb;v_schedule jsonb;v_scope jsonb;v_entry jsonb;v_sum numeric:=0;v_n integer:=0;v_code text;v_amount numeric;v_count integer;
BEGIN
  IF p_total IS NULL OR p_total<=0 THEN RAISE EXCEPTION 'Informe o valor total do contrato antes de emitir a revisão.'; END IF;
  IF p_terms IS NULL OR jsonb_typeof(p_terms)<>'object' THEN RAISE EXCEPTION 'Preencha Condições comerciais e cronograma antes de gerar o contrato ou Anexo I.';END IF;
  v_installments:=p_terms->'installments'; v_schedule:=p_terms->'schedule'; v_scope:=p_terms->'scope';
  IF coalesce(jsonb_typeof(v_installments),'')<>'array' OR jsonb_array_length(v_installments) NOT BETWEEN 1 AND 24 THEN RAISE EXCEPTION 'Cadastre de 1 a 24 parcelas no editor de condições comerciais.';END IF;
  FOR v_entry IN SELECT value FROM jsonb_array_elements(v_installments) LOOP
    v_n:=v_n+1;
    IF coalesce(v_entry->>'amount','') !~ '^[0-9]+([.][0-9]{1,2})?$' THEN RAISE EXCEPTION 'Informe o valor monetário válido da parcela %.',v_n; END IF;
    v_amount:=(v_entry->>'amount')::numeric;
    IF v_amount<=0 THEN RAISE EXCEPTION 'A parcela % deve ser positiva.',v_n;END IF;
    IF nullif(btrim(coalesce(v_entry->>'due_date','')),'') IS NULL AND length(btrim(coalesce(v_entry->>'due_event','')))<5 THEN RAISE EXCEPTION 'Informe a data ou o evento de vencimento da parcela %.',v_n;END IF;
    IF nullif(v_entry->>'due_date','') IS NOT NULL THEN
      IF v_entry->>'due_date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'Data da parcela % inválida.',v_n; END IF;
      PERFORM (v_entry->>'due_date')::date;
    END IF;
    v_sum:=v_sum+v_amount;
  END LOOP;
  IF abs(v_sum-p_total)>0.009 THEN RAISE EXCEPTION 'A soma das parcelas (R$ %) difere do valor contratado (R$ %).',v_sum,p_total;END IF;
  IF length(btrim(coalesce(p_terms->>'payment_method','')))<2 THEN RAISE EXCEPTION 'Selecione a forma de pagamento.';END IF;
  IF jsonb_typeof(v_schedule)<>'object' OR length(btrim(coalesce(v_schedule->>'start_trigger','')))<6 THEN RAISE EXCEPTION 'Informe o evento de início da contagem do prazo.';END IF;
  IF coalesce(v_schedule->>'days','') !~ '^[0-9]{1,4}$' OR (v_schedule->>'days')::integer NOT BETWEEN 1 AND 3650 THEN RAISE EXCEPTION 'Informe um prazo total entre 1 e 3650 dias.';END IF;
  IF coalesce(v_schedule->>'day_type','') NOT IN ('uteis','corridos') THEN RAISE EXCEPTION 'Escolha dias úteis ou corridos.';END IF;
  IF coalesce(jsonb_typeof(v_scope),'')<>'array' THEN RAISE EXCEPTION 'Preencha quantidades e prazos de cada atividade.'; END IF;
  FOR v_entry IN SELECT value FROM jsonb_array_elements(coalesce(p_services,'[]'::jsonb)) WHERE coalesce((value->>'included')::boolean,false)=true LOOP
    v_code:=v_entry->>'code';
    SELECT count(*) INTO v_count FROM jsonb_array_elements(v_scope) i WHERE i->>'code'=v_code;
    IF v_count<>1 THEN RAISE EXCEPTION 'Preencha uma linha de quantitativos para a atividade %.',coalesce(v_entry->>'name',v_code);END IF;
  END LOOP;
  FOR v_entry IN SELECT value FROM jsonb_array_elements(v_scope) LOOP
    v_code:=v_entry->>'code';
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(p_services,'[]'::jsonb)) i WHERE i->>'code'=v_code AND coalesce((i->>'included')::boolean,false)=true) THEN
       RAISE EXCEPTION 'A atividade % não está incluída no contrato.',v_code;
    END IF;
    IF coalesce(v_entry->>'quantity','') !~ '^[0-9]+([.][0-9]{1,3})?$' OR (v_entry->>'quantity')::numeric<=0 THEN RAISE EXCEPTION 'Defina quantidade positiva para a atividade %.',v_code;END IF;
    IF length(btrim(coalesce(v_entry->>'unit','')))<1 OR length(btrim(coalesce(v_entry->>'deliverables','')))<5 THEN RAISE EXCEPTION 'Indique unidade e entregáveis específicos para a atividade %.',v_code;END IF;
    IF v_code IN ('k','l','m') AND lower(btrim(coalesce(v_entry->>'deliverables',''))) ~ '^(alvar[aá]( de constru[cç][aã]o)?|habite[ -]?se)[.!]?$' THEN
      RAISE EXCEPTION 'Especifique protocolo e acompanhamento na atividade %. Alvará/Habite-se são expedidos pela Prefeitura, não constituem entrega garantida.',v_code;
    END IF;
    IF v_code IN ('k','l','m') AND v_entry->>'deadline_type'='municipal' THEN
      IF coalesce(v_entry->>'days','')<>'' THEN RAISE EXCEPTION 'Não informe prazo numérico de tramitação municipal na atividade %.',v_code; END IF;
      IF length(btrim(coalesce(v_entry->>'deliverables','')))<100 OR
         lower(v_entry->>'deliverables') NOT LIKE '%prefeitura%' OR
         lower(v_entry->>'deliverables') NOT LIKE '%acompanhamento%' OR
         lower(v_entry->>'deliverables') NOT LIKE '%sem garantia%' THEN
        RAISE EXCEPTION 'O escopo municipal da atividade % precisa conter o texto padrão de tramitação, responsabilidades e ausência de garantia.',v_code;
      END IF;
      IF length(coalesce(v_entry->>'municipal_notes',''))>2000 THEN RAISE EXCEPTION 'Observações da atividade % devem ter até 2000 caracteres.',v_code; END IF;
    ELSE
      IF coalesce(v_entry->>'days','') !~ '^[0-9]{1,4}
    IF coalesce(v_entry->>'revisions','') !~ '^[0-9]{1,3}$' THEN RAISE EXCEPTION 'Indique quantas revisões estão incluídas na atividade %, inclusive zero.',v_code;END IF;
    IF nullif(v_entry->>'visits','') IS NOT NULL AND v_entry->>'visits' !~ '^[0-9]{1,3}$' THEN RAISE EXCEPTION 'Visitas inválidas na atividade %.',v_code; END IF;
  END LOOP;
END;
$function$
 OR (v_entry->>'days')::integer NOT BETWEEN 1 AND 3650 THEN RAISE EXCEPTION 'Informe prazo técnico em dias para a atividade %.',v_code; END IF;
    END IF;
    IF coalesce(v_entry->>'revisions','') !~ '^[0-9]{1,3}$' THEN RAISE EXCEPTION 'Indique quantas revisões estão incluídas na atividade %, inclusive zero.',v_code;END IF;
    IF nullif(v_entry->>'visits','') IS NOT NULL AND v_entry->>'visits' !~ '^[0-9]{1,3}$' THEN RAISE EXCEPTION 'Visitas inválidas na atividade %.',v_code; END IF;
  END LOOP;
END;
$function$;
COMMIT;
