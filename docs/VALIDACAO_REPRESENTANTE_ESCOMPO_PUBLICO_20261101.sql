BEGIN;
CREATE OR REPLACE FUNCTION public.assert_commercial_party_ready(p_document text,p_terms jsonb)
RETURNS void LANGUAGE plpgsql STABLE SET search_path TO 'public' AS $body$
DECLARE r jsonb; digits text;
BEGIN
 IF length(regexp_replace(coalesce(p_document,''),'[^0-9]','','g'))<>14 THEN RETURN; END IF;
 r:=p_terms->'legal_representative';
 IF coalesce(jsonb_typeof(r),'')<>'object' THEN
   RAISE EXCEPTION 'Preencha os dados do representante legal da empresa antes da emissão.';
 END IF;
 digits:=regexp_replace(coalesce(r->>'cpf',''),'[^0-9]','','g');
 IF length(btrim(coalesce(r->>'name','')))<5
   OR length(digits)<>11
   OR length(btrim(coalesce(r->>'role','')))<3
   OR length(btrim(coalesce(r->>'powers','')))<10 THEN
   RAISE EXCEPTION 'Identifique nome completo, CPF, cargo e poderes do representante legal da pessoa jurídica.';
 END IF;
END;
$body$;
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
    IF v_code IN ('k','l','m') AND lower(btrim(coalesce(v_entry->>'deliverables',''))) ~ '^(alvar[aá]( de constru[cç][aã]o)?|habite[ -]?se)[.!]?
    IF coalesce(v_entry->>'days','') !~ '^[0-9]{1,4}$' OR (v_entry->>'days')::integer NOT BETWEEN 1 AND 3650 THEN RAISE EXCEPTION 'Informe prazo em dias para a atividade %.',v_code;END IF;
    IF coalesce(v_entry->>'revisions','') !~ '^[0-9]{1,3}$' THEN RAISE EXCEPTION 'Indique quantas revisões estão incluídas na atividade %, inclusive zero.',v_code;END IF;
    IF nullif(v_entry->>'visits','') IS NOT NULL AND v_entry->>'visits' !~ '^[0-9]{1,3}$' THEN RAISE EXCEPTION 'Visitas inválidas na atividade %.',v_code; END IF;
  END LOOP;
END;
$function$
 THEN
      RAISE EXCEPTION 'Descreva o escopo de protocolo e acompanhamento da atividade %. Alvará e Habite-se são expedidos pela Prefeitura, não constituem entrega garantida.',v_code;
    END IF;
    IF coalesce(v_entry->>'days','') !~ '^[0-9]{1,4}$' OR (v_entry->>'days')::integer NOT BETWEEN 1 AND 3650 THEN RAISE EXCEPTION 'Informe prazo em dias para a atividade %.',v_code;END IF;
    IF coalesce(v_entry->>'revisions','') !~ '^[0-9]{1,3}$' THEN RAISE EXCEPTION 'Indique quantas revisões estão incluídas na atividade %, inclusive zero.',v_code;END IF;
    IF nullif(v_entry->>'visits','') IS NOT NULL AND v_entry->>'visits' !~ '^[0-9]{1,3}$' THEN RAISE EXCEPTION 'Visitas inválidas na atividade %.',v_code; END IF;
  END LOOP;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.admin_save_commercial_terms(p_record_id uuid, p_terms jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r public.commercial_records%rowtype;v_new jsonb;v_pay jsonb;
BEGIN
  IF NOT public.is_portal_admin() THEN RAISE EXCEPTION 'Acesso administrativo necessário';END IF;
  SELECT * INTO r FROM public.commercial_records WHERE id=p_record_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrato/orçamento não localizado';END IF;
  IF r.record_kind='contrato' THEN PERFORM public.assert_commercial_terms_ready(p_terms,r.total_value,r.services);PERFORM public.assert_commercial_party_ready(r.cpf_cnpj,p_terms);END IF;
  v_new:=p_terms || jsonb_build_object('saved_at',now(),'schema_version',1);
  SELECT coalesce(jsonb_agg(jsonb_build_object('method',p_terms->>'payment_method','label',coalesce(nullif(i->>'label',''), 'Parcela '||ord::text),'value',i->>'amount','due',coalesce(nullif(i->>'due_date',''),i->>'due_event')) ORDER BY ord),'[]'::jsonb)
  INTO v_pay FROM jsonb_array_elements(coalesce(p_terms->'installments','[]'::jsonb)) WITH ORDINALITY a(i,ord);
  UPDATE public.commercial_records SET commercial_terms=v_new,payment_terms=v_pay,
    notes=CASE WHEN btrim(coalesce(notes,''))~*'^(em parcelas[, ]+)?a combinar[.]?$' THEN null ELSE notes END,
    updated_at=now() WHERE id=p_record_id;
  INSERT INTO public.audit_log(user_id,action,entity_type,entity_id,details)
    VALUES (auth.uid(),'save_commercial_terms','commercial_records',p_record_id,
      jsonb_build_object('installment_count',jsonb_array_length(coalesce(v_new->'installments','[]'::jsonb)),'scope_count',jsonb_array_length(coalesce(v_new->'scope','[]'::jsonb))));
  RETURN v_new;
END;$function$
;
CREATE OR REPLACE FUNCTION public.admin_prepare_commercial_scope_for_generation(p_record_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r public.commercial_records%rowtype;
  v_services jsonb;
  v_bad integer;
begin
  if coalesce(auth.role(),'') <> 'service_role' and not public.is_portal_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;

  select * into r
  from public.commercial_records
  where id=p_record_id
  for update;

  if not found then
    raise exception 'Registro comercial não encontrado';
  end if;

  v_services := public.enrich_commercial_services(coalesce(r.services,'[]'::jsonb),r.experience_level);

  if r.record_kind='contrato' then
    perform public.assert_commercial_terms_ready(r.commercial_terms,r.total_value,r.services);
    perform public.assert_commercial_party_ready(r.cpf_cnpj,r.commercial_terms);
  end if;

  -- Todo serviço com nível aplicável precisa de texto aprovado para os três documentos.
  select count(*) into v_bad
  from jsonb_array_elements(v_services) item
  where coalesce((item->>'included')::boolean,false)=true
    and coalesce((item->>'levelApplicable')::boolean,false)=true
    and not (
      (
        lower(coalesce(item->>'code',''))='p'
        and length(btrim(coalesce(item->>'customDescription','')))>=12
        and length(btrim(coalesce(item->>'budgetDescription','')))>=20
        and length(btrim(coalesce(item->>'contractScope','')))>=20
        and length(btrim(coalesce(item->>'annexScope','')))>=20
      )
      or
      (
        item->>'levelScopeReviewStatus'='approved'
        and nullif(item->>'levelScopeVersion','') is not null
        and length(btrim(coalesce(item->>'budgetDescription','')))>=20
        and length(btrim(coalesce(item->>'contractScope','')))>=20
        and length(btrim(coalesce(item->>'annexScope','')))>=20
      )
    );

  if v_bad>0 then
    raise exception 'Existem atividades/níveis ainda não aprovados para Orçamento, Contrato e Anexo I. Revise a matriz Serviço x Bronze/Prata/Ouro antes da emissão oficial';
  end if;

  -- Proíbe placeholders e instruções internas em qualquer texto que possa chegar ao cliente.
  select count(*) into v_bad
  from jsonb_array_elements(v_services) item
  cross join lateral unnest(array[
    coalesce(item->>'description',''),
    coalesce(item->>'budgetDescription',''),
    coalesce(item->>'contractScope',''),
    coalesce(item->>'annexScope',''),
    coalesce(item->>'customDescription','')
  ]) txt
  where coalesce((item->>'included')::boolean,false)=true
    and (
      lower(txt) ~ '(aqui.{0,30}descr|descri[cç][aã]o.{0,20}servi[cç]o.{0,20}outro|inserir.{0,20}descri[cç][aã]o|preencher.{0,20}atividade|ser[aá].{0,20}informad[ao].{0,20}atividade)'
      or txt ~ '\{\{[^}]+\}\}'
    );

  if v_bad>0 then
    raise exception 'Documento bloqueado: foi encontrado placeholder ou instrução interna no escopo do cliente';
  end if;

  update public.commercial_records
  set services=v_services,
      updated_at=now()
  where id=r.id;

  insert into public.audit_log(user_id,action,entity_type,entity_id,details)
  values(
    auth.uid(),
    'prepare_commercial_scope_for_generation',
    'commercial_records',
    r.id,
    jsonb_build_object(
      'record_kind',r.record_kind,
      'service_count',(select count(*) from jsonb_array_elements(v_services) x where coalesce((x->>'included')::boolean,false)),
      'approved_service_level_scope_required',true
    )
  );

  return v_services;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.admin_prepare_contract_document(p_project_id uuid, p_document_kind text, p_approval_id uuid DEFAULT NULL::uuid, p_extra_data jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_project record;
  v_approval public.aprovacoes%rowtype;
  v_document_id uuid;
  v_title text;
  v_optional boolean := true;
  v_data jsonb;
  v_commercial record;
  v_level jsonb := null;
  v_scope_snapshot jsonb := '[]'::jsonb;
  v_text_snapshot jsonb := '{}'::jsonb;
  v_master_id uuid;
  v_master_version integer;
begin
  if not public.is_portal_admin() then raise exception 'Acesso administrativo necessário'; end if;

  if p_document_kind not in (
    'anexo_i','termo_aceite','estudo_preliminar','levantamento_tecnico',
    'servico_adicional','autorizacao_imagem','quitacao_encerramento'
  ) then raise exception 'Tipo de documento não suportado'; end if;

  select
    p.id,c.cliente_id,c.id as contract_id,coalesce(p.nome,c.service_type) as project_name,coalesce(p.tipo,c.service_type) as project_type,
    p.area_construida_m2,p.area_terreno_m2,p.endereco_obra,p.numero_obra,
    p.complemento_obra,p.bairro_obra,p.cidade_obra,p.estado_obra,p.descricao as project_description,
    c.contract_number,c.signed_at,c.contract_value,c.currency,c.notes as contract_notes,
    cl.nome as client_name,cl.email as client_email,cl.telefone as client_phone,
    cl.cpf_cnpj as client_cpf_cnpj
  into v_project
  from public.contratos c
  left join public.projetos p on p.contract_id=c.id and p.id=p_project_id
  left join public.clientes cl on cl.id=c.cliente_id
  where (p_project_id is not null and p.id=p_project_id) or (p_project_id is null and c.id=nullif(p_extra_data->>'contract_id','')::uuid);

  if not found then raise exception 'Projeto/contrato não encontrado'; end if;

  select
    cr.id,cr.experience_level,cr.services,cr.notes,cr.quote_number,cr.contract_number,cr.cpf_cnpj,
    cr.payment_terms,cr.total_value,cr.commercial_terms,cr.contract_master_id,cr.contract_master_version,cr.smart_texts
  into v_commercial
  from public.commercial_records cr
  where cr.linked_contract_id=v_project.contract_id or cr.linked_project_id=p_project_id
  order by (cr.record_kind='contrato') desc,cr.updated_at desc
  limit 1;

  if p_document_kind='anexo_i' and v_commercial.id is not null then
    perform public.assert_commercial_terms_ready(v_commercial.commercial_terms,v_commercial.total_value,v_commercial.services);
    perform public.assert_commercial_party_ready(v_commercial.cpf_cnpj,v_commercial.commercial_terms);
  end if;

  if v_commercial.contract_master_id is not null then
    v_master_id := v_commercial.contract_master_id;
    v_master_version := v_commercial.contract_master_version;
  else
    select id,version into v_master_id,v_master_version
    from public.contract_master_versions where active=true order by version desc limit 1;
  end if;

  v_text_snapshot := case
    when v_commercial.smart_texts is not null and v_commercial.smart_texts <> '{}'::jsonb
      then v_commercial.smart_texts
    else public.current_document_text_snapshot_all()
  end;

  select item->'level'
  into v_level
  from jsonb_array_elements(coalesce(v_commercial.services,'[]'::jsonb)) item
  where jsonb_typeof(item->'level')='object'
  limit 1;

  if v_level is null
     and nullif(btrim(coalesce(v_commercial.experience_level,'')),'') is not null then
    select jsonb_build_object(
      'code',l.code,'label',l.label,'subtitle',l.subtitle,'description',l.description,
      'features',l.features,'exclusions',l.exclusions,
      'contractClauses',to_jsonb(l.contract_clause_refs),'catalogVersion',l.version
    ) into v_level
    from public.service_level_catalog l
    where l.code=lower(v_commercial.experience_level) and l.active=true;
  end if;

  select coalesce(jsonb_agg(
    (
      coalesce(
        (
          select item
          from jsonb_array_elements(coalesce(v_commercial.services,'[]'::jsonb)) item
          where item->>'code'=s.service_code limit 1
        ),
        jsonb_build_object(
          'code',s.service_code,'name',coalesce(sc.name,s.service_name),
          'description',sc.description,'deliverables',coalesce(sc.deliverables,'[]'::jsonb),
          'exclusions',coalesce(sc.exclusions,'[]'::jsonb),
          'clientInputs',coalesce(sc.client_inputs,'[]'::jsonb),
          'revisions',sc.default_revisions,
          'deliveryFormats',coalesce(sc.delivery_formats,'["PDF"]'::jsonb),
          'planningReference',sc.planning_reference,
          'contractClauses',to_jsonb(coalesce(sc.contract_clause_refs,'{}'::text[])),
          'catalogVersion',sc.version,'levelApplicable',coalesce(sc.level_applicable,false),
          'level',case when coalesce(sc.level_applicable,false) and v_level is not null then v_level else null end
        )
      )
      || jsonb_build_object(
        'included',s.included,'acceptanceRequired',s.acceptance_required,
        'displayOrder',s.display_order,'notes',s.notes
      )
    ) order by s.display_order
  ),'[]'::jsonb)
  into v_scope_snapshot
  from public.contract_scope_items s
  left join public.service_catalog sc on sc.code=s.service_code
  where s.contract_id=v_project.contract_id;

  if p_document_kind='termo_aceite' then
    if p_approval_id is null then raise exception 'Selecione uma aprovação para gerar o Termo de Aceite'; end if;
    select * into v_approval from public.aprovacoes
    where id=p_approval_id and projeto_id=p_project_id;
    if not found then raise exception 'Aprovação não encontrada para este projeto'; end if;
  end if;

  v_title := case p_document_kind
    when 'anexo_i' then 'Anexo I — Escopo de Serviços, Proposta Comercial e Cronograma'
    when 'termo_aceite' then 'Termo de Aceite de Etapa — ' || coalesce(v_approval.titulo,'Etapa')
    when 'estudo_preliminar' then 'Estudo Preliminar'
    when 'levantamento_tecnico' then 'Ficha de Levantamento Técnico / Vistoria'
    when 'servico_adicional' then 'Termo de Aprovação de Orçamento — Serviço Adicional'
    when 'autorizacao_imagem' then 'Autorização de Uso de Imagem e Divulgação do Projeto'
    when 'quitacao_encerramento' then 'Termo de Quitação e Encerramento de Contrato'
  end;

  v_optional := p_document_kind not in ('anexo_i','termo_aceite');

  v_data := jsonb_build_object(
    'contract_number',v_project.contract_number,'contract_signed_at',v_project.signed_at,
    'contract_value',v_project.contract_value,'currency',v_project.currency,
    'contract_notes',v_project.contract_notes,'client_name',v_project.client_name,
    'client_email',v_project.client_email,'client_phone',v_project.client_phone,
    'client_cpf_cnpj',v_project.client_cpf_cnpj,'project_name',v_project.project_name,
    'project_type',v_project.project_type,'project_description',v_project.project_description,
    'area_construida_m2',v_project.area_construida_m2,'area_terreno_m2',v_project.area_terreno_m2,
    'property_address',concat_ws(', ',
      nullif(v_project.endereco_obra,''),nullif(v_project.numero_obra,''),
      nullif(v_project.complemento_obra,''),nullif(v_project.bairro_obra,''),
      nullif(v_project.cidade_obra,''),nullif(v_project.estado_obra,'')
    ),
    'experience_level',v_commercial.experience_level,'service_level',v_level,
    'scope_snapshot',v_scope_snapshot,'smart_texts',v_text_snapshot,
    'contract_master_id',v_master_id,'contract_master_version',v_master_version,
    'source_quote_number',v_commercial.quote_number,'commercial_notes',v_commercial.notes,
    'payment_terms',v_commercial.payment_terms,'commercial_terms',v_commercial.commercial_terms,
    'outside_contracted_scope',case
      when p_document_kind='estudo_preliminar' then not exists(
        select 1 from public.contract_scope_items s
        where s.contract_id=v_project.contract_id and s.service_code='a' and s.included=true
      )
      else false
    end
  ) || coalesce(p_extra_data,'{}'::jsonb);

  if p_document_kind='termo_aceite' then
    v_data := v_data || jsonb_build_object(
      'approval_id',v_approval.id,'approval_type',v_approval.tipo,'approval_title',v_approval.titulo,
      'approval_description',v_approval.descricao,'delivered_at',v_approval.delivered_at,
      'approval_due_at',v_approval.approval_due_at,'approval_status',v_approval.status
    );
  end if;

  if p_document_kind='anexo_i' then
    v_data := v_data || jsonb_build_object('scope_items',v_scope_snapshot);
  end if;

  insert into public.documentos(
    cliente_id,projeto_id,contract_id,approval_id,nome,tipo,categoria,versao,
    storage_bucket,permitir_download,protection_mode,document_kind,workflow_status,
    generated_data,optional_document
  ) values (
    v_project.cliente_id,v_project.id,v_project.contract_id,p_approval_id,v_title,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'Contratual','1.0','documentos',true,'administrative',p_document_kind,'rascunho',
    v_data,v_optional
  ) returning id into v_document_id;

  insert into public.audit_log(user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'prepare_contract_document','documentos',v_document_id,
    jsonb_build_object(
      'document_kind',p_document_kind,'project_id',p_project_id,'catalog_snapshot',true,
      'experience_level',v_commercial.experience_level,'contract_master_version',v_master_version,
      'smart_text_snapshot',true
    ));

  return v_document_id;
end
$function$
;
COMMIT;
