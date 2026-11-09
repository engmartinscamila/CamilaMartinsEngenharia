-- Endereço do cliente (cadastro PF/PJ) e endereço da obra são dados diferentes.
-- A conversão de contrato criava ou completava o projeto com CEP, cidade e UF do
-- cadastro do cliente. Agora esses dados só vão para a obra quando o endereço da
-- obra é o mesmo do cadastro (marcado como mesmo endereço).
-- Correção de dados: o projeto "RESIDENCIAL — Tributino..." foi criado pela conversão
-- com dados do cadastro; seus documentos passam ao Empreendimento Cléos (projeto real
-- do CON-2026-10-0002) e ele é arquivado. Nenhum e-mail é enviado ao cliente.

do $mig$
declare v_def text; v_new text;
begin
  v_def := pg_get_functiondef('public.admin_convert_commercial_record(uuid)'::regprocedure);
  if position('mesmo_endereco_cliente' in v_def) = 0 then
    v_new := replace(v_def,
      $a$      area_construida_m2,area_terreno_m2,cep_obra,endereco_obra,
      cidade_obra,estado_obra,contract_id,parceria
    )$a$,
      $a$      area_construida_m2,area_terreno_m2,cep_obra,endereco_obra,
      cidade_obra,estado_obra,contract_id,parceria,mesmo_endereco_cliente
    )$a$);
    v_new := replace(v_new,
      $a$      r.area_construida_m2,r.area_terreno_m2,r.cep,r.property_address,
      r.city,r.state,v_contract,false
    )$a$,
      $a$      r.area_construida_m2,r.area_terreno_m2,
      case when btrim(coalesce(r.property_address,'')) = btrim(coalesce(r.address,'')) then r.cep end,
      r.property_address,
      case when btrim(coalesce(r.property_address,'')) = btrim(coalesce(r.address,'')) then r.city end,
      case when btrim(coalesce(r.property_address,'')) = btrim(coalesce(r.address,'')) then r.state end,
      v_contract,false,
      btrim(coalesce(r.property_address,'')) <> '' and btrim(coalesce(r.property_address,'')) = btrim(coalesce(r.address,''))
    )$a$);
    v_new := replace(v_new,
      $a$      cep_obra=coalesce(nullif(cep_obra,''),nullif(r.cep,'')),
      endereco_obra=coalesce(nullif(endereco_obra,''),nullif(r.property_address,'')),
      cidade_obra=coalesce(nullif(cidade_obra,''),nullif(r.city,'')),
      estado_obra=coalesce(nullif(estado_obra,''),nullif(r.state,''))$a$,
      $a$      endereco_obra=coalesce(nullif(endereco_obra,''),nullif(r.property_address,'')),
      cep_obra=coalesce(nullif(cep_obra,''),case when coalesce(mesmo_endereco_cliente,false) then nullif(r.cep,'') end),
      cidade_obra=coalesce(nullif(cidade_obra,''),case when coalesce(mesmo_endereco_cliente,false) then nullif(r.city,'') end),
      estado_obra=coalesce(nullif(estado_obra,''),case when coalesce(mesmo_endereco_cliente,false) then nullif(r.state,'') end)$a$);
    if (length(v_new) - length(replace(v_new, 'mesmo_endereco_cliente', ''))) / length('mesmo_endereco_cliente') < 4 then
      raise exception 'admin_convert_commercial_record: trechos esperados não encontrados.';
    end if;
    execute v_new;
  end if;

  -- Correção de dados (idempotente)
  if exists (select 1 from public.projetos where id = '70317b13-d39b-4d4b-9e7d-f1c575874b24' and status <> 'arquivado')
     and exists (select 1 from public.projetos where id = 'c9f1e6e3-61f8-4459-9152-86d172e59758') then
    update public.documentos set projeto_id = 'c9f1e6e3-61f8-4459-9152-86d172e59758'
     where projeto_id = '70317b13-d39b-4d4b-9e7d-f1c575874b24';
    update public.projetos set status = 'arquivado'
     where id = '70317b13-d39b-4d4b-9e7d-f1c575874b24';
    update public.client_email_queue set status = 'cancelled'
     where client_id = '0b7ceadb-9f66-41d2-afd4-1e3c99f53f6b' and kind = 'update' and status = 'pending'
       and source_table in ('projetos','documentos') and available_at > now() - interval '5 minutes';
  end if;
end
$mig$;
