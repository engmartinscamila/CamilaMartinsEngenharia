-- Cronograma simples integrado ao contrato e aos documentos (10/11/2026)
--
-- 1. O escopo contratado (contract_scope_items) passa a espelhar sempre o
--    contrato emitido (commercial_records.services). Antes ele só era gravado
--    na formalização e nunca removia serviços retirados numa revisão; o Termo
--    de Aceite lia esse escopo desatualizado.
-- 2. O cronograma simples nasce do contrato: "Assinatura do contrato", uma
--    etapa por serviço contratado (e por serviço adicional aceito) e
--    "Entrega final e encerramento". As etapas genéricas por tipo de projeto
--    sem avanço são substituídas; etapas com avanço e etapas manuais ficam.
-- 3. As etapas se atualizam sozinhas pelos documentos: contrato assinado,
--    Termo de Aceite aceito pelo cliente (aceite vinculado à etapa), entregas
--    enviadas, quitação. A conclusão manual continua disponível, e uma etapa
--    reaberta manualmente só volta a concluir com evidência nova.
-- 4. Situação e percentual da etapa ficam sempre coerentes.

-- ---------------------------------------------------------------- colunas
alter table public.cronograma
  add column if not exists origem text not null default 'manual',
  add column if not exists chave_automatica text,
  add column if not exists servico_codigo text,
  add column if not exists exige_aceite boolean not null default false,
  add column if not exists conclusao_tipo text,
  add column if not exists concluida_em timestamptz,
  add column if not exists conclusao_motivo text,
  add column if not exists documento_conclusao_id uuid references public.documentos(id) on delete set null,
  add column if not exists reaberta_em timestamptz;

do $$ begin
  alter table public.cronograma add constraint cronograma_origem_check check (origem in ('manual','contrato'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.cronograma add constraint cronograma_conclusao_tipo_check check (conclusao_tipo is null or conclusao_tipo in ('automatica','manual'));
exception when duplicate_object then null; end $$;

create unique index if not exists cronograma_chave_automatica_uniq
  on public.cronograma(projeto_id, chave_automatica) where chave_automatica is not null;
create index if not exists cronograma_documento_conclusao_idx on public.cronograma(documento_conclusao_id);

-- Entrega enviada pelo upload que conclui uma etapa escolhida pela administradora.
alter table public.documentos
  add column if not exists conclui_etapa_id uuid references public.cronograma(id) on delete set null;
create index if not exists documentos_conclui_etapa_idx on public.documentos(conclui_etapa_id);
create index if not exists aprovacoes_schedule_stage_idx on public.aprovacoes(schedule_stage_id);

-- ------------------------------------------------------- auxiliares
create or replace function private.cronograma_concluido(p_status text)
returns boolean language sql immutable set search_path = ''
as $$ select lower(btrim(coalesce(p_status,''))) in ('concluído','concluido','concluída','concluida','completed','done') $$;

-- Notificações do cronograma respeitam o modo silencioso (ajustes internos).
create or replace function public.notify_schedule_event()
returns trigger language plpgsql security definer set search_path = ''
as $function$
begin
  if coalesce(current_setting('cme.silent_client_change', true), '') = 'on' then return new; end if;
  if tg_op='INSERT' or new.status is distinct from old.status or new.percentual_conclusao is distinct from old.percentual_conclusao then
    insert into public.notificacoes(cliente_id,projeto_id,titulo,mensagem,tipo,lida,link_path,destinatario,referencia_tipo,referencia_id)
    values(new.cliente_id,new.projeto_id,
      case when tg_op='INSERT' then 'Nova etapa do cronograma'
           when private.cronograma_concluido(new.status) and not private.cronograma_concluido(old.status) then 'Etapa concluída'
           else 'Cronograma atualizado' end,
      new.nome,'cronograma_atualizado',false,'/(client)/schedule','cliente','cronograma',new.id::text);
  end if;
  return new;
end
$function$;

-- --------------------------------------- coerência situação x percentual
create or replace function private.cronograma_coerencia()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare
  v_auto boolean := coalesce(current_setting('cme.cronograma_auto', true), '') = 'on';
  v_old_done boolean := false;
  v_done boolean;
  v_st boolean := true;
  v_pct boolean := true;
begin
  new.percentual_conclusao := greatest(0, least(100, coalesce(new.percentual_conclusao, 0)));
  if tg_op = 'UPDATE' then
    v_old_done := private.cronograma_concluido(old.status);
    v_st := new.status is distinct from old.status;
    v_pct := new.percentual_conclusao is distinct from old.percentual_conclusao;
  end if;
  v_done := private.cronograma_concluido(new.status);

  if v_done then
    if tg_op = 'UPDATE' and v_pct and not v_st and new.percentual_conclusao < 100 then
      -- percentual reduzido numa etapa concluída: ela volta a andamento
      new.status := case when new.percentual_conclusao > 0 then 'Em andamento' else 'Pendente' end;
      v_done := false;
    else
      new.status := 'Concluído';
      new.percentual_conclusao := 100;
    end if;
  elsif new.percentual_conclusao >= 100 then
    if tg_op = 'UPDATE' and v_st and not v_pct then
      new.percentual_conclusao := 0;          -- reaberta pela situação
    else
      new.status := 'Concluído';
      v_done := true;
    end if;
  end if;

  if not v_done then
    if nullif(btrim(coalesce(new.status, '')), '') is null then new.status := 'Pendente'; end if;
    if new.percentual_conclusao > 0 and lower(btrim(new.status)) = 'pendente' then new.status := 'Em andamento'; end if;
  end if;

  if v_done and not v_old_done then
    new.concluida_em := case when v_auto then coalesce(new.concluida_em, now()) else now() end;
    if v_auto then
      new.conclusao_tipo := 'automatica';
    else
      new.conclusao_tipo := 'manual';
      new.conclusao_motivo := 'Concluída manualmente';
      new.documento_conclusao_id := null;
    end if;
  elsif not v_done then
    if v_old_done and not v_auto then new.reaberta_em := now(); end if;
    new.concluida_em := null;
    new.conclusao_tipo := null;
    new.conclusao_motivo := null;
    new.documento_conclusao_id := null;
  end if;
  return new;
end
$function$;

drop trigger if exists a05_cronograma_coerencia on public.cronograma;
create trigger a05_cronograma_coerencia
  before insert or update on public.cronograma
  for each row execute function private.cronograma_coerencia();

-- ------------------------------------- escopo contratado = contrato emitido
create or replace function private.sincronizar_escopo_contrato(p_contract_id uuid)
returns integer language plpgsql security definer set search_path = ''
as $function$
declare v_n integer := 0; v_m integer := 0;
begin
  if p_contract_id is null then return 0; end if;
  -- Só contratos emitidos pelo módulo comercial; contratos migrados ficam como estão.
  if not exists (
    select 1 from public.commercial_records c
    where c.record_kind = 'contrato' and c.status in ('contrato_gerado','convertido')
      and c.linked_contract_id = p_contract_id
  ) then return 0; end if;

  with servicos as (
    select distinct on (btrim(s->>'code'))
      btrim(s->>'code') code, btrim(s->>'name') nome,
      case when lower(s->>'acceptanceRequired') = 'false' then false else true end aceite,
      case when s->>'displayOrder' ~ '^-?[0-9]+$' then (s->>'displayOrder')::integer else 0 end ordem,
      nullif(s->>'notes','') notas
    from public.commercial_records c
    cross join lateral jsonb_array_elements(coalesce(c.services,'[]'::jsonb)) s
    where c.record_kind = 'contrato' and c.status in ('contrato_gerado','convertido')
      and c.linked_contract_id = p_contract_id
      and coalesce(lower(s->>'included'),'true') = 'true'
      and nullif(btrim(s->>'code'),'') is not null and nullif(btrim(s->>'name'),'') is not null
    order by btrim(s->>'code'), c.updated_at desc
  ), gravados as (
    insert into public.contract_scope_items(contract_id,service_code,service_name,included,acceptance_required,display_order,notes)
    select p_contract_id, code, nome, true, aceite, ordem, notas from servicos
    on conflict (contract_id, service_code) do update set
      service_name = excluded.service_name, included = true,
      acceptance_required = excluded.acceptance_required,
      display_order = excluded.display_order, notes = excluded.notes, updated_at = now()
    where (contract_scope_items.service_name, contract_scope_items.included, contract_scope_items.acceptance_required,
           contract_scope_items.display_order, contract_scope_items.notes)
      is distinct from (excluded.service_name, true, excluded.acceptance_required, excluded.display_order, excluded.notes)
    returning 1
  )
  select count(*) into v_n from gravados;

  update public.contract_scope_items i set included = false, updated_at = now()
  where i.contract_id = p_contract_id and i.included
    and not exists (
      select 1 from public.commercial_records c
      cross join lateral jsonb_array_elements(coalesce(c.services,'[]'::jsonb)) s
      where c.record_kind = 'contrato' and c.status in ('contrato_gerado','convertido')
        and c.linked_contract_id = p_contract_id
        and coalesce(lower(s->>'included'),'true') = 'true'
        and btrim(s->>'code') = i.service_code
    );
  get diagnostics v_m = row_count;
  return v_n + v_m;
end
$function$;

-- --------------------------------------- etapas nascidas do contrato
create or replace function private.cronograma_basico_sincronizar(p_projeto uuid)
returns integer language plpgsql security definer set search_path = ''
as $function$
declare
  v_proj public.projetos%rowtype;
  v_contract uuid;
  v_itens jsonb;
  v_item jsonb;
  v_qtd_serv integer;
  v_idx_serv integer := 0;
  v_peso numeric;
  v_soma numeric := 0;
  v_i integer := 0;
  v_novas integer := 0;
  v_tinha_auto boolean;
  v_silent text := coalesce(current_setting('cme.silent_client_change', true), '');
  v_id uuid;
  v_inserida boolean;
  v_modelos text[] := array['Briefing e levantamento','Estudo preliminar','Anteprojeto','Aprovação do cliente','Detalhamento','Entrega final','Conferência do escopo','Compatibilização','Detalhamento técnico','Especificações','Revisão e entrega','Levantamento de cargas','Pontos e circuitos','Dimensionamento','Diagramas e detalhes','Levantamento','Lançamento das redes','Briefing e referências','Modelagem','Materiais e iluminação','Prévia e ajustes','Entrega','Documentos','Projeto e adequações','Protocolo','Exigências','Aprovação','Medidas de segurança','Desenvolvimento','Memoriais','Protocolo e aprovação','Escopo técnico','Concepção','Diagnóstico','Análise técnica','Recomendações','Relatório e entrega','Vistoria','Análise','Elaboração','ART e entrega','Planejamento','Fundações e estrutura','Vedações e cobertura','Instalações','Revestimentos','Acabamentos','Estudo de soluções','Definição do escopo','Revisão'];
begin
  select * into v_proj from public.projetos where id = p_projeto;
  if v_proj.id is null or lower(coalesce(v_proj.status,'')) = 'arquivado' then return 0; end if;

  select c.linked_contract_id into v_contract
  from public.commercial_records c
  where c.record_kind = 'contrato' and c.status in ('contrato_gerado','convertido')
    and c.linked_contract_id is not null
    and (c.linked_project_id = p_projeto or c.linked_contract_id = v_proj.contract_id)
  order by (c.linked_project_id = p_projeto) desc, c.updated_at desc
  limit 1;
  if v_contract is null then return 0; end if;

  select jsonb_agg(x order by (x->>'grupo')::integer, (x->>'ord')::numeric, x->>'chave') into v_itens
  from (
    select jsonb_build_object('grupo',0,'ord',0,'chave','contrato:assinatura','nome','Assinatura do contrato',
      'codigo',null,'aceite',false,
      'descricao','Concluída automaticamente quando o contrato assinado é registrado no portal.') x
    union all
    select jsonb_build_object('grupo',1,'ord',coalesce(s.display_order,0),'chave','servico:'||s.service_code,
      'nome',s.service_name,'codigo',s.service_code,'aceite',s.acceptance_required,
      'descricao',case when s.acceptance_required
        then 'Serviço contratado. Concluído com o aceite formal da entrega (Termo de Aceite).'
        else 'Serviço contratado. Concluído com o registro da entrega.' end)
    from public.contract_scope_items s
    where s.contract_id = v_contract and s.included
    union all
    select jsonb_build_object('grupo',2,'ord',extract(epoch from d.created_at),'chave','adicional:'||d.id,
      'nome','Serviço adicional — '||coalesce(
         nullif(d.generated_data#>>'{document_options,additional_service_name}',''),
         nullif(d.generated_data->>'additional_service_name',''),'conforme termo aceito'),
      'codigo',lower(coalesce(nullif(d.generated_data#>>'{document_options,additional_service_code}',''),
         nullif(d.generated_data->>'additional_service_code',''))),
      'aceite',true,'descricao','Serviço adicional aceito pelo cliente. Concluído com o aceite formal da entrega.')
    from public.documentos d
    where d.projeto_id = p_projeto and d.document_kind = 'servico_adicional' and d.superseded_by is null
      and exists (select 1 from public.document_acceptances a
                  where a.document_id = d.id and a.decision in ('accepted','accepted_with_notes'))
    union all
    select jsonb_build_object('grupo',3,'ord',0,'chave','encerramento','nome','Entrega final e encerramento',
      'codigo',null,'aceite',false,
      'descricao','Concluída com o Termo de Quitação e Encerramento do contrato.')
  ) t;

  v_qtd_serv := (select count(*) from jsonb_array_elements(v_itens) x where (x->>'grupo')::integer in (1,2));
  v_tinha_auto := exists (select 1 from public.cronograma where projeto_id = p_projeto and chave_automatica is not null);

  perform set_config('cme.silent_client_change', 'on', true);

  if not v_tinha_auto then
    -- Etapas genéricas criadas pelo tipo do projeto e ainda sem avanço dão lugar às do contrato.
    delete from public.cronograma c
    where c.projeto_id = p_projeto and c.chave_automatica is null
      and coalesce(c.percentual_conclusao,0) = 0 and not private.cronograma_concluido(c.status)
      and c.data_inicio is null and c.data_fim is null
      and c.nome = any(v_modelos);
  end if;

  for v_item in select value from jsonb_array_elements(v_itens) loop
    v_i := v_i + 1;
    if (v_item->>'grupo')::integer in (1,2) then
      v_idx_serv := v_idx_serv + 1;
      v_peso := case when v_idx_serv = v_qtd_serv then round(90 - v_soma, 2) else round(90.0 / v_qtd_serv, 2) end;
      v_soma := v_soma + v_peso;
    else
      v_peso := case when v_qtd_serv = 0 then 50 else 5 end;
    end if;

    insert into public.cronograma(cliente_id,projeto_id,nome,descricao,status,percentual_conclusao,peso_percentual,
                                  ordem,origem,chave_automatica,servico_codigo,exige_aceite)
    values (v_proj.cliente_id,p_projeto,v_item->>'nome',v_item->>'descricao','Pendente',0,v_peso,
            v_i*10,'contrato',v_item->>'chave',nullif(v_item->>'codigo',''),coalesce((v_item->>'aceite')::boolean,false))
    on conflict (projeto_id, chave_automatica) where chave_automatica is not null do update set
      peso_percentual = excluded.peso_percentual, ordem = excluded.ordem,
      servico_codigo = excluded.servico_codigo, exige_aceite = excluded.exige_aceite
    where (cronograma.peso_percentual, cronograma.ordem, cronograma.servico_codigo, cronograma.exige_aceite)
      is distinct from (excluded.peso_percentual, excluded.ordem, excluded.servico_codigo, excluded.exige_aceite)
    returning id, (xmax = 0) into v_id, v_inserida;
    if coalesce(v_inserida,false) then v_novas := v_novas + 1; end if;
  end loop;

  -- Serviço retirado do contrato: some a etapa que ainda não teve avanço.
  delete from public.cronograma c
  where c.projeto_id = p_projeto and c.origem = 'contrato' and c.chave_automatica is not null
    and not exists (select 1 from jsonb_array_elements(v_itens) x where x->>'chave' = c.chave_automatica)
    and coalesce(c.percentual_conclusao,0) = 0 and not private.cronograma_concluido(c.status);

  perform set_config('cme.silent_client_change', v_silent, true);

  if v_novas > 0 and v_silent <> 'on' then
    insert into public.notificacoes(cliente_id,projeto_id,titulo,mensagem,tipo,lida,link_path,destinatario,referencia_tipo,referencia_id)
    values (v_proj.cliente_id,p_projeto,'Cronograma do projeto atualizado',
            'As etapas dos serviços contratados já estão disponíveis no seu portal.',
            'cronograma_atualizado',false,'/(client)/schedule','cliente','projeto',p_projeto::text);
  end if;
  return v_novas;
end
$function$;

-- ----------------------------------------------- conclusão automática
create or replace function private.cronograma_basico_concluir(
  p_projeto uuid, p_etapa uuid, p_chave text, p_motivo text, p_doc uuid, p_quando timestamptz)
returns integer language plpgsql security definer set search_path = ''
as $function$
declare v_n integer; v_prev text := coalesce(current_setting('cme.cronograma_auto', true), '');
begin
  perform set_config('cme.cronograma_auto', 'on', true);
  update public.cronograma c set
    status = 'Concluído', percentual_conclusao = 100,
    conclusao_motivo = left(p_motivo, 300), documento_conclusao_id = p_doc, concluida_em = now()
  where c.projeto_id = p_projeto
    and ((p_etapa is not null and c.id = p_etapa) or (p_chave is not null and c.chave_automatica = p_chave))
    and not private.cronograma_concluido(c.status)
    and (c.reaberta_em is null or coalesce(p_quando, now()) > c.reaberta_em);
  get diagnostics v_n = row_count;
  perform set_config('cme.cronograma_auto', v_prev, true);
  return v_n;
end
$function$;

-- Entrega enviada de serviço que exige aceite: etapa passa a "Em andamento".
create or replace function private.cronograma_basico_iniciar(p_projeto uuid, p_chave text, p_quando timestamptz)
returns integer language plpgsql security definer set search_path = ''
as $function$
declare v_n integer; v_prev text := coalesce(current_setting('cme.cronograma_auto', true), '');
begin
  perform set_config('cme.cronograma_auto', 'on', true);
  update public.cronograma c set status = 'Em andamento', percentual_conclusao = greatest(coalesce(c.percentual_conclusao,0), 50)
  where c.projeto_id = p_projeto and c.chave_automatica = p_chave
    and lower(btrim(coalesce(c.status,''))) in ('','pendente')
    and (c.reaberta_em is null or coalesce(p_quando, now()) > c.reaberta_em);
  get diagnostics v_n = row_count;
  perform set_config('cme.cronograma_auto', v_prev, true);
  return v_n;
end
$function$;

create or replace function private.cronograma_basico_reavaliar(p_projeto uuid)
returns integer language plpgsql security definer set search_path = ''
as $function$
declare
  v_n integer := 0;
  r record;
  v_contract uuid;
begin
  select contract_id into v_contract from public.projetos where id = p_projeto;
  if not exists (select 1 from public.cronograma where projeto_id = p_projeto) then return 0; end if;

  -- 1. Contrato assinado
  for r in
    select d.id doc, coalesce(ac.accepted_at, d.created_at) quando,
      case when ac.decision is not null then 'Contrato aceito pelo cliente no portal'
           when d.document_kind = 'contrato' then 'Contrato assinado'
           else 'Contrato assinado registrado: '||coalesce(d.nome,'arquivo enviado') end motivo
    from public.documentos d
    left join lateral (select a.decision, a.accepted_at from public.document_acceptances a
                       where a.document_id = d.id and a.decision in ('accepted','accepted_with_notes')
                       order by a.accepted_at desc limit 1) ac on true
    where d.projeto_id = p_projeto and d.superseded_by is null and (
      (d.document_kind = 'contrato' and (d.workflow_status in ('assinado','aceito') or ac.decision is not null))
      or (d.document_kind is null and lower(btrim(coalesce(d.tipo,''))) = 'contrato'))
    order by 2 desc limit 1
  loop
    v_n := v_n + private.cronograma_basico_concluir(p_projeto, null, 'contrato:assinatura', r.motivo, r.doc, r.quando);
  end loop;
  for r in select c.signed_at from public.contratos c where c.id = v_contract and c.signed_at is not null loop
    v_n := v_n + private.cronograma_basico_concluir(p_projeto, null, 'contrato:assinatura', 'Contrato assinado', null, r.signed_at);
  end loop;

  -- 2. Termo de Aceite aceito pelo cliente (aceite vinculado à etapa)
  for r in
    select a.schedule_stage_id etapa, d.id doc, ac.decision, ac.accepted_at
    from public.documentos d
    join public.aprovacoes a on a.id = d.approval_id
    join lateral (select x.decision, x.accepted_at from public.document_acceptances x
                  where x.document_id = d.id order by x.accepted_at desc limit 1) ac on true
    where d.projeto_id = p_projeto and d.document_kind = 'termo_aceite' and d.superseded_by is null
      and a.schedule_stage_id is not null and ac.decision in ('accepted','accepted_with_notes')
  loop
    v_n := v_n + private.cronograma_basico_concluir(p_projeto, r.etapa, null,
      case when r.decision = 'accepted' then 'Aceite formal registrado pelo cliente (Termo de Aceite)'
           else 'Aceite com ressalvas registrado pelo cliente (Termo de Aceite)' end, r.doc, r.accepted_at);
  end loop;
  for r in
    select a.schedule_stage_id etapa, coalesce(a.respondido_at, a.created_at) quando
    from public.aprovacoes a
    where a.projeto_id = p_projeto and a.schedule_stage_id is not null and lower(coalesce(a.status,'')) = 'aprovado'
  loop
    v_n := v_n + private.cronograma_basico_concluir(p_projeto, r.etapa, null, 'Entrega aprovada pelo cliente', null, r.quando);
  end loop;

  -- 3. Entrega enviada que a administradora indicou como conclusão da etapa
  for r in
    select d.id doc, d.conclui_etapa_id etapa, d.nome, d.created_at
    from public.documentos d
    join public.cronograma c on c.id = d.conclui_etapa_id and c.projeto_id = d.projeto_id
    where d.projeto_id = p_projeto and d.superseded_by is null
  loop
    v_n := v_n + private.cronograma_basico_concluir(p_projeto, r.etapa, null,
      'Entrega registrada: '||coalesce(r.nome,'documento'), r.doc, r.created_at);
  end loop;

  -- 4. Entregas típicas reconhecidas pelo tipo do documento
  for r in
    select d.id doc, d.nome, coalesce(ac.accepted_at, d.created_at) quando, x.codigo,
           (ac.decision is not null or d.workflow_status in ('assinado','aceito')) aceito
    from public.documentos d
    cross join lateral (select case
        when d.document_kind = 'estudo_preliminar' then 'a'
        when d.document_kind = 'levantamento_tecnico' then 'u'
        when d.document_kind is null and lower(btrim(coalesce(d.tipo,''))) = 'art' then 'ao'
        when d.document_kind is null and lower(btrim(coalesce(d.tipo,''))) = 'laudo' then 'o'
        when d.document_kind is null and lower(btrim(coalesce(d.tipo,''))) = 'memorial' then 'w'
      end codigo) x
    left join lateral (select a.decision, a.accepted_at from public.document_acceptances a
                       where a.document_id = d.id and a.decision in ('accepted','accepted_with_notes')
                       order by a.accepted_at desc limit 1) ac on true
    where d.projeto_id = p_projeto and d.superseded_by is null and x.codigo is not null
      and (d.document_kind is null or d.workflow_status in ('enviado','assinado','aceito') or ac.decision is not null)
  loop
    if r.aceito or not exists (select 1 from public.cronograma c where c.projeto_id = p_projeto
                                 and c.chave_automatica = 'servico:'||r.codigo and c.exige_aceite) then
      v_n := v_n + private.cronograma_basico_concluir(p_projeto, null, 'servico:'||r.codigo,
        case when r.aceito then 'Entrega aceita pelo cliente: ' else 'Entrega registrada: ' end||coalesce(r.nome,'documento'),
        r.doc, r.quando);
    else
      v_n := v_n + private.cronograma_basico_iniciar(p_projeto, 'servico:'||r.codigo, r.quando);
    end if;
  end loop;

  -- 5. Quitação e encerramento
  for r in
    select d.id doc, coalesce(ac.accepted_at, d.created_at) quando
    from public.documentos d
    left join lateral (select a.accepted_at from public.document_acceptances a
                       where a.document_id = d.id and a.decision in ('accepted','accepted_with_notes')
                       order by a.accepted_at desc limit 1) ac on true
    where d.projeto_id = p_projeto and d.document_kind = 'quitacao_encerramento' and d.superseded_by is null
      and (ac.accepted_at is not null or d.workflow_status in ('assinado','aceito'))
    order by 2 desc limit 1
  loop
    v_n := v_n + private.cronograma_basico_concluir(p_projeto, null, 'encerramento',
      'Termo de Quitação e Encerramento registrado', r.doc, r.quando);
  end loop;

  return v_n;
end
$function$;

-- Sincroniza e reavalia sem nunca impedir a operação que disparou.
create or replace function private.cronograma_basico_atualizar(p_projeto uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
begin
  if p_projeto is null then return; end if;
  begin
    perform private.cronograma_basico_sincronizar(p_projeto);
    perform private.cronograma_basico_reavaliar(p_projeto);
  exception when others then
    raise warning 'Cronograma simples do projeto % não foi atualizado: %', p_projeto, sqlerrm;
  end;
end
$function$;

-- --------------------------------------------------------- gatilhos
create or replace function private.trg_cronograma_basico_eventos()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare v_proj uuid;
begin
  if tg_table_name = 'commercial_records' then
    if new.record_kind <> 'contrato' then return new; end if;
    begin
      perform private.sincronizar_escopo_contrato(new.linked_contract_id);
      if tg_op = 'UPDATE' and old.linked_contract_id is distinct from new.linked_contract_id then
        perform private.sincronizar_escopo_contrato(old.linked_contract_id);
      end if;
    exception when others then
      raise warning 'Escopo do contrato % não foi sincronizado: %', new.linked_contract_id, sqlerrm;
    end;
    for v_proj in
      select p.id from public.projetos p
      where p.id = new.linked_project_id
         or (new.linked_contract_id is not null and p.contract_id = new.linked_contract_id)
    loop
      perform private.cronograma_basico_atualizar(v_proj);
    end loop;
  elsif tg_table_name = 'contratos' then
    for v_proj in select p.id from public.projetos p where p.contract_id = new.id loop
      perform private.cronograma_basico_atualizar(v_proj);
    end loop;
  elsif tg_table_name = 'document_acceptances' then
    v_proj := coalesce(new.project_id, (select d.projeto_id from public.documentos d where d.id = new.document_id));
    perform private.cronograma_basico_atualizar(v_proj);
  else
    perform private.cronograma_basico_atualizar(new.projeto_id);
  end if;
  return new;
end
$function$;

drop trigger if exists zz_cronograma_basico_contrato on public.commercial_records;
create trigger zz_cronograma_basico_contrato
  after insert or update of status, services, linked_project_id, linked_contract_id on public.commercial_records
  for each row execute function private.trg_cronograma_basico_eventos();

drop trigger if exists zz_cronograma_basico_assinatura on public.contratos;
create trigger zz_cronograma_basico_assinatura
  after update of signed_at on public.contratos
  for each row when (new.signed_at is not null and old.signed_at is distinct from new.signed_at)
  execute function private.trg_cronograma_basico_eventos();

drop trigger if exists zz_cronograma_basico_documento on public.documentos;
create trigger zz_cronograma_basico_documento
  after insert or update of workflow_status, tipo, document_kind, projeto_id, superseded_by, conclui_etapa_id on public.documentos
  for each row when (new.projeto_id is not null)
  execute function private.trg_cronograma_basico_eventos();

drop trigger if exists zz_cronograma_basico_aceite on public.document_acceptances;
create trigger zz_cronograma_basico_aceite
  after insert on public.document_acceptances
  for each row execute function private.trg_cronograma_basico_eventos();

drop trigger if exists zz_cronograma_basico_aprovacao on public.aprovacoes;
create trigger zz_cronograma_basico_aprovacao
  after insert or update of status, schedule_stage_id on public.aprovacoes
  for each row when (new.projeto_id is not null)
  execute function private.trg_cronograma_basico_eventos();

-- Aceite de etapa sempre ligado a uma etapa do mesmo projeto; sem escolha
-- explícita, tenta reconhecer o serviço contratado pelo título.
create or replace function private.aprovacao_vincular_etapa()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare v_etapa uuid;
begin
  if new.schedule_stage_id is not null then
    if not exists (select 1 from public.cronograma c where c.id = new.schedule_stage_id and c.projeto_id = new.projeto_id) then
      raise exception 'A etapa do cronograma escolhida não pertence a este projeto.';
    end if;
  elsif tg_op = 'INSERT' and new.projeto_id is not null then
    select c.id into v_etapa
    from public.cronograma c
    where c.projeto_id = new.projeto_id and c.origem = 'contrato' and c.servico_codigo is not null
      and position(lower(regexp_replace(c.nome, '^Serviço adicional — ', ''))
                   in lower(coalesce(new.titulo,'')||' '||coalesce(new.approval_object,''))) > 0
    order by length(c.nome) desc
    limit 1;
    new.schedule_stage_id := v_etapa;
  end if;
  return new;
end
$function$;

drop trigger if exists a10_aprovacao_vincular_etapa on public.aprovacoes;
create trigger a10_aprovacao_vincular_etapa
  before insert or update of schedule_stage_id, projeto_id on public.aprovacoes
  for each row execute function private.aprovacao_vincular_etapa();

-- O upload que conclui etapa precisa apontar para etapa do mesmo projeto.
create or replace function private.documento_valida_etapa()
returns trigger language plpgsql security definer set search_path = ''
as $function$
begin
  if new.conclui_etapa_id is not null and not exists (
    select 1 from public.cronograma c where c.id = new.conclui_etapa_id and c.projeto_id = new.projeto_id
  ) then
    raise exception 'A etapa escolhida não pertence ao projeto deste documento.';
  end if;
  return new;
end
$function$;

drop trigger if exists a10_documento_valida_etapa on public.documentos;
create trigger a10_documento_valida_etapa
  before insert or update of conclui_etapa_id, projeto_id on public.documentos
  for each row when (new.conclui_etapa_id is not null)
  execute function private.documento_valida_etapa();

-- ------------------------------------- Termo de Aceite pela etapa contratada
-- O termo passa a saber qual serviço do contrato está sendo aceito (pela
-- etapa vinculada) e o gerador usa o código, não mais a semelhança do título.
do $migration$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.admin_prepare_contract_document(uuid,text,uuid,jsonb)'::regprocedure);
  if position('approval_service_code' in v_def) = 0 then
    v_def := replace(v_def,
      $old$'approval_due_at',v_approval.approval_due_at,'approval_status',v_approval.status
    );$old$,
      $new$'approval_due_at',v_approval.approval_due_at,'approval_status',v_approval.status,
      'approval_stage_id',v_approval.schedule_stage_id,
      'approval_stage_name',(select c.nome from public.cronograma c where c.id=v_approval.schedule_stage_id),
      'approval_service_code',(select c.servico_codigo from public.cronograma c where c.id=v_approval.schedule_stage_id)
    );$new$);
    if position('approval_service_code' in v_def) = 0 then
      raise exception 'admin_prepare_contract_document mudou; ajuste a migração do cronograma simples.';
    end if;
    execute v_def;
  end if;
end
$migration$;

-- ------------------------------------------- ação manual da administradora
create or replace function public.admin_cronograma_simples_sincronizar(p_projeto uuid default null)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare v_proj uuid; v_qtd integer := 0; v_novas integer := 0; v_concl integer := 0;
begin
  if not public.is_portal_admin() then raise exception 'Acesso administrativo necessário'; end if;
  for v_proj in
    select p.id from public.projetos p where p_projeto is null or p.id = p_projeto
  loop
    perform private.sincronizar_escopo_contrato((select contract_id from public.projetos where id = v_proj));
    v_novas := v_novas + private.cronograma_basico_sincronizar(v_proj);
    v_concl := v_concl + private.cronograma_basico_reavaliar(v_proj);
    v_qtd := v_qtd + 1;
  end loop;
  return jsonb_build_object('projetos', v_qtd, 'etapas_criadas', v_novas, 'etapas_concluidas', v_concl);
end
$function$;
revoke all on function public.admin_cronograma_simples_sincronizar(uuid) from public, anon;
grant execute on function public.admin_cronograma_simples_sincronizar(uuid) to authenticated;

-- --------------------------------------- dados existentes (sem avisar clientes)
do $migration$
declare v_proj uuid; v_contract uuid;
begin
  perform set_config('cme.silent_client_change', 'on', true);

  -- Situação x percentual coerentes nas etapas já gravadas.
  update public.cronograma set percentual_conclusao = 100
  where private.cronograma_concluido(status) and coalesce(percentual_conclusao,0) < 100;
  update public.cronograma set status = 'Concluído'
  where not private.cronograma_concluido(status) and coalesce(percentual_conclusao,0) >= 100;
  update public.cronograma set status = 'Em andamento'
  where coalesce(percentual_conclusao,0) between 1 and 99 and lower(btrim(coalesce(status,''))) in ('','pendente');
  update public.cronograma set conclusao_motivo = 'Registrada antes da automação'
  where private.cronograma_concluido(status) and conclusao_motivo = 'Concluída manualmente'
    and concluida_em > now() - interval '1 minute';

  for v_contract in select distinct linked_contract_id from public.commercial_records
                    where record_kind = 'contrato' and linked_contract_id is not null loop
    perform private.sincronizar_escopo_contrato(v_contract);
  end loop;

  for v_proj in select id from public.projetos loop
    perform private.cronograma_basico_sincronizar(v_proj);
    perform private.cronograma_basico_reavaliar(v_proj);
  end loop;

  perform set_config('cme.silent_client_change', '', true);
end
$migration$;
