-- Cronograma completo de USO INTERNO para obra sem cronograma completo contratado
-- ("obra sem contrato"). Regra de negócio: o cronograma completo só é oferecido
-- ao CLIENTE quando o serviço "s" for selecionado no orçamento/contrato (ou
-- aceito por Serviço Adicional). Este caminho permite à administradora planejar,
-- medir e controlar custos internamente, mas NUNCA publica ao cliente.
--
-- Também:
--  * a aprovação passa a reconhecer o caminho por Serviço Adicional aceito
--    (antes só validava orçamento + contrato e recusaria esse caminho);
--  * a publicação ao cliente aceita Serviço Adicional aceito e recusa
--    explicitamente o cronograma interno;
--  * migração formal de cronograma LEGADO: a nova versão sucede o legado, que
--    deixa de ser vigente e permanece intacto como histórico.
--
-- Aditiva e idempotente. Nenhum dado é apagado ou alterado fora dos cabeçalhos
-- envolvidos na migração formal (is_current do legado).

alter table public.construction_schedules
drop constraint if exists construction_schedule_activation_valid;

alter table public.construction_schedules
add constraint construction_schedule_activation_valid
check (
  activation_status in ('legacy','draft','approved')
  and (
    activation_status='legacy'
    or (quote_record_id is not null and contract_record_id is not null)
    or (
      quote_record_id is null
      and contract_record_id is null
      and source_scope_snapshot->>'authorization_type'='servico_adicional_aceito'
      and nullif(source_scope_snapshot->>'source_document_id','') is not null
    )
    or (
      quote_record_id is null
      and contract_record_id is null
      and source_scope_snapshot->>'authorization_type'='obra_sem_contrato'
      and source_scope_snapshot->>'client_visibility'='internal_only'
    )
  )
);

create or replace function public.assert_full_schedule_without_contract(p_project_id uuid)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  v_project public.projetos%rowtype;
begin
  if not public.is_portal_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;

  select * into v_project from public.projetos where id=p_project_id;
  if v_project.id is null then
    raise exception 'Projeto não encontrado';
  end if;

  -- Cronograma completo contratado (serviço "s") segue obrigatoriamente o
  -- caminho contratual, que é o único publicado ao cliente.
  if exists(
    select 1 from public.commercial_records cr
    where (cr.linked_project_id=p_project_id or cr.source_project_id=p_project_id)
      and exists(
        select 1 from jsonb_array_elements(coalesce(cr.services,'[]'::jsonb)) s
        where lower(coalesce(s->>'code',''))='s'
          and coalesce(s->>'included','false')='true'
      )
  ) then
    raise exception 'Este projeto tem o cronograma completo contratado; use o orçamento + contrato';
  end if;

  if exists(
    select 1 from public.documentos d
    where d.projeto_id=p_project_id
      and d.document_kind='servico_adicional'
      and d.superseded_by is null
      and lower(coalesce(d.generated_data#>>'{document_options,additional_service_code}',d.generated_data->>'additional_service_code',''))='s'
      and exists(select 1 from public.document_acceptances a
                 where a.document_id=d.id and a.decision in ('accepted','accepted_with_notes'))
  ) then
    raise exception 'Este projeto tem Serviço Adicional de cronograma completo aceito; use esse vínculo';
  end if;

  return jsonb_build_object(
    'authorization_type','obra_sem_contrato',
    'client_visibility','internal_only',
    'billing','sem_cobranca_ao_cliente',
    'project_id',v_project.id,
    'client_id',v_project.cliente_id,
    'contract_id',v_project.contract_id,
    'services',jsonb_build_array(jsonb_build_object(
      'code','obra',
      'name','Execução da obra — controle interno (sem cronograma completo contratado)',
      'included',true
    ))
  );
end
$function$;

-- Fonte única: qual vínculo autoriza um cronograma completo.
create or replace function public.resolve_full_schedule_authorization(
  p_project_id uuid,
  p_quote_record_id uuid,
  p_contract_record_id uuid,
  p_snapshot jsonb
)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  v_source_document_id uuid;
begin
  if p_snapshot->>'authorization_type'='servico_adicional_aceito' then
    begin
      v_source_document_id:=nullif(p_snapshot->>'source_document_id','')::uuid;
    exception when invalid_text_representation then
      raise exception 'Serviço Adicional de origem inválido';
    end;
    if v_source_document_id is null or p_quote_record_id is not null or p_contract_record_id is not null then
      raise exception 'Vínculo do cronograma por Serviço Adicional está inconsistente';
    end if;
    return public.assert_full_schedule_additional_service(p_project_id,v_source_document_id);
  elsif p_snapshot->>'authorization_type'='obra_sem_contrato' then
    if p_quote_record_id is not null or p_contract_record_id is not null then
      raise exception 'Cronograma interno não pode ter orçamento/contrato comercial vinculado';
    end if;
    return public.assert_full_schedule_without_contract(p_project_id);
  end if;
  return public.assert_full_schedule_commercial_link(p_project_id,p_quote_record_id,p_contract_record_id);
end
$function$;


create or replace function public.guard_construction_schedule_creation()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_snapshot jsonb;
  v_source_document_id uuid;
begin
  if tg_op='UPDATE' then
    if new.source_scope_snapshot is distinct from old.source_scope_snapshot then
      raise exception 'Escopo congelado. Alterações exigem nova versão/aditivo';
    end if;
    if old.activation_status='legacy' then
      return new;
    end if;
  elsif new.activation_status='legacy' then
    raise exception 'Novos cronogramas exigem vínculo comercial verificável';
  end if;

  v_snapshot:=public.resolve_full_schedule_authorization(
    new.project_id,new.quote_record_id,new.contract_record_id,new.source_scope_snapshot
  );

  if new.client_id is distinct from (
       select cliente_id from public.projetos where id=new.project_id
     )
     or new.contract_id is distinct from (
       select contract_id from public.projetos where id=new.project_id
     ) then
    raise exception 'Cliente/contrato do cabeçalho divergente do projeto';
  end if;

  if tg_op='INSERT' then
    new.source_scope_snapshot:=v_snapshot;
  elsif v_snapshot is distinct from new.source_scope_snapshot then
    raise exception 'Vínculo comercial mudou; abra uma revisão/aditivo';
  end if;

  return new;
end
$function$;

create or replace function public.admin_save_full_schedule_plan(
  p_schedule_id uuid,
  p_plan jsonb
)
returns uuid
language plpgsql
set search_path to ''
as $function$
declare
  v_header public.construction_schedules%rowtype;
  v_scope jsonb;
  v_items jsonb;
  v_item jsonb;
  v_count integer;
  v_unique integer;
  v_weight numeric;
  v_min date;
  v_max date;
  v_pred text;
  v_source text;
  v_code text;
  v_day_start date;
  v_day_finish date;
  v_source_document_id uuid;
begin
  if not public.is_portal_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;

  select * into v_header
  from public.construction_schedules
  where id=p_schedule_id
  for update;

  if v_header.id is null or v_header.activation_status is distinct from 'draft' then
    raise exception 'Somente cronogramas novos em rascunho podem receber um plano';
  end if;

  v_scope:=public.resolve_full_schedule_authorization(
    v_header.project_id,v_header.quote_record_id,v_header.contract_record_id,v_header.source_scope_snapshot
  );

  if v_scope is distinct from v_header.source_scope_snapshot then
    raise exception 'Vínculo comercial mudou; não usar escopo desatualizado';
  end if;

  if p_plan->>'scope_confirmed' is distinct from 'true' then
    raise exception 'Confirme individualmente as atividades do escopo antes de salvar';
  end if;

  if p_plan->>'calendar' is null
     or p_plan->>'calendar' not in ('weekdays','calendar_days')
     or p_plan->>'weight_source' is null
     or p_plan->>'weight_source' not in ('construction_costs','confirmed_manual') then
    raise exception 'Selecione calendário e origem dos pesos';
  end if;

  v_items:=p_plan->'items';
  if jsonb_typeof(v_items) is distinct from 'array' then
    raise exception 'Atividades não informadas';
  end if;
  if jsonb_array_length(v_items)=0 or jsonb_array_length(v_items)>200 then
    raise exception 'Informe de 1 a 200 atividades confirmadas';
  end if;

  select
    count(*),
    count(distinct i->>'code'),
    sum((i->>'weight_percent')::numeric),
    min((i->>'planned_start')::date),
    max((i->>'planned_finish')::date)
  into v_count,v_unique,v_weight,v_min,v_max
  from jsonb_array_elements(v_items) i;

  if v_count is distinct from v_unique
     or abs(coalesce(v_weight,0)-100)>0.01
     or v_min is null
     or v_max is null then
    raise exception 'Códigos únicos, datas e pesos totalizando 100%% são obrigatórios';
  end if;

  if p_plan->>'planned_start' is distinct from v_min::text
     or p_plan->>'planned_finish' is distinct from v_max::text then
    raise exception 'Início e término geral devem vir das atividades calculadas';
  end if;

  for v_item in select value from jsonb_array_elements(v_items) loop
    v_code:=nullif(btrim(v_item->>'code'),'');
    v_source:=nullif(btrim(v_item->>'source_service_code'),'');
    v_pred:=nullif(btrim(v_item->>'predecessor_code'),'');
    v_day_start:=(v_item->>'planned_start')::date;
    v_day_finish:=(v_item->>'planned_finish')::date;

    if v_code is null
       or nullif(btrim(v_item->>'activity'),'') is null
       or v_day_start is null
       or v_day_finish is null
       or v_day_finish<v_day_start
       or v_item->>'planned_duration_days' is null
       or (v_item->>'planned_duration_days')::integer<1
       or v_item->>'weight_percent' is null
       or (v_item->>'weight_percent')::numeric not between 0 and 100 then
      raise exception 'Atividade inválida: %',coalesce(v_code,'sem código');
    end if;

    if v_source is null or not exists(
      select 1
      from jsonb_array_elements(v_scope->'services') s
      where s->>'code'=v_source and s->>'included'='true'
    ) then
      raise exception 'Etapa % não pertence ao serviço contratado',v_code;
    end if;

    if v_pred is not null and not exists(
      select 1
      from jsonb_array_elements(v_items) p
      where p->>'code'=v_pred
        and (p->>'planned_finish')::date<v_day_start
    ) then
      raise exception 'Predecessora inexistente ou data conflitante para %',v_code;
    end if;

    if (v_item->>'planned_cost') is not null
       and (v_item->>'planned_cost')::numeric<0 then
      raise exception 'Custo de obra inválido para %',v_code;
    end if;
  end loop;

  delete from public.construction_schedule_items
  where schedule_id=p_schedule_id;

  insert into public.construction_schedule_items(
    schedule_id,code,category,activity,display_order,weight_percent,
    planned_duration_days,predecessor_code,planned_start,planned_finish,
    planned_cost,actual_progress,status,is_default,source_service_code,
    weight_source,cost_source,quantity,unit,unit_cost
  )
  select
    p_schedule_id,
    i->>'code',
    coalesce(i->>'category','Obra'),
    i->>'activity',
    coalesce((i->>'display_order')::integer,ord::integer),
    (i->>'weight_percent')::numeric,
    (i->>'planned_duration_days')::integer,
    nullif(i->>'predecessor_code',''),
    (i->>'planned_start')::date,
    (i->>'planned_finish')::date,
    (i->>'planned_cost')::numeric,
    0,
    'Pendente',
    false,
    i->>'source_service_code',
    p_plan->>'weight_source',
    nullif(i->>'cost_source',''),
    (i->>'quantity')::numeric,
    nullif(i->>'unit',''),
    (i->>'unit_cost')::numeric
  from jsonb_array_elements(v_items) with ordinality as entry(i,ord);

  update public.construction_schedules
  set work_calendar=p_plan->>'calendar',
      weight_source=p_plan->>'weight_source',
      planned_start=v_min,
      planned_finish=v_max,
      notes=coalesce(nullif(p_plan->>'notes',''),notes),
      updated_at=now()
  where id=p_schedule_id;

  return p_schedule_id;
end
$function$;

CREATE OR REPLACE FUNCTION public.guard_full_schedule_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $approve$
DECLARE v_count integer;v_sum numeric;v_missing integer;v_min date;v_max date;v_snapshot jsonb;
DECLARE v_total_construction_cost numeric;
BEGIN
 IF TG_OP='INSERT' AND NEW.activation_status='approved' THEN
  RAISE EXCEPTION 'Novo cronograma deve começar como rascunho'; END IF;
 IF TG_OP='UPDATE' AND OLD.activation_status='approved' AND (
    NEW.project_id IS DISTINCT FROM OLD.project_id OR NEW.client_id IS DISTINCT FROM OLD.client_id OR
    NEW.contract_id IS DISTINCT FROM OLD.contract_id OR NEW.quote_record_id IS DISTINCT FROM OLD.quote_record_id OR
    NEW.contract_record_id IS DISTINCT FROM OLD.contract_record_id OR NEW.source_scope_snapshot IS DISTINCT FROM OLD.source_scope_snapshot OR
    NEW.work_calendar IS DISTINCT FROM OLD.work_calendar OR NEW.weight_source IS DISTINCT FROM OLD.weight_source OR
    NEW.planned_start IS DISTINCT FROM OLD.planned_start OR NEW.planned_finish IS DISTINCT FROM OLD.planned_finish OR
    NEW.baseline_snapshot IS DISTINCT FROM OLD.baseline_snapshot OR NEW.baseline_version IS DISTINCT FROM OLD.baseline_version
 ) THEN RAISE EXCEPTION 'Linha de base aprovada não pode ser modificada; gere nova versão'; END IF;
 IF NEW.activation_status IS DISTINCT FROM 'approved' THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.activation_status='approved' THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.activation_status='legacy' THEN
   RAISE EXCEPTION 'Não converter cronogramas legados sem revisão formal'; END IF;
 v_snapshot:=public.resolve_full_schedule_authorization(NEW.project_id,NEW.quote_record_id,NEW.contract_record_id,NEW.source_scope_snapshot);
 IF NEW.source_scope_snapshot IS DISTINCT FROM v_snapshot THEN
   RAISE EXCEPTION 'Orçamento ou contrato mudou: gere nova linha de base a partir dos documentos aprovados'; END IF;
 IF NEW.work_calendar NOT IN ('weekdays','calendar_days') OR NEW.weight_source IS NULL THEN
   RAISE EXCEPTION 'Defina calendário e origem dos pesos antes de aprovar'; END IF;
 SELECT count(*),sum(weight_percent),min(planned_start),max(planned_finish),sum(planned_cost),
 count(*) FILTER (WHERE planned_cost IS NULL OR nullif(btrim(cost_source),'') IS NULL OR source_service_code IS NULL OR
    planned_start IS NULL OR planned_finish IS NULL OR planned_duration_days<=0 OR
    planned_finish<planned_start OR weight_percent<0 OR weight_percent>100)
 INTO v_count,v_sum,v_min,v_max,v_total_construction_cost,v_missing
 FROM public.construction_schedule_items WHERE schedule_id=NEW.id;
 IF v_count=0 OR v_missing>0 OR abs(coalesce(v_sum,0)-100)>0.01 THEN
  RAISE EXCEPTION 'Cronograma incompleto: conferir atividades, origem dos custos, datas e pesos totalizando 100%%'; END IF;
 IF v_total_construction_cost IS NULL OR v_total_construction_cost<=0 THEN
  RAISE EXCEPTION 'Custo total da execução deve ser positivo para aprovar cronograma físico-financeiro'; END IF;
 -- Todos os pesos derivados de custo, exceto o último ajuste de arredondamento,
 -- devem corresponder ao custo físico da obra, não aos honorários comerciais.
 IF NEW.weight_source='construction_costs' AND EXISTS(
   SELECT 1 FROM (
     SELECT i.weight_percent,i.planned_cost,
       row_number() OVER (ORDER BY i.display_order,i.code) AS ord,
       count(*) OVER () AS total
     FROM public.construction_schedule_items i WHERE i.schedule_id=NEW.id
   ) weights
   WHERE weights.ord<weights.total AND
     abs(weights.weight_percent-round(weights.planned_cost*100/v_total_construction_cost,2))>0.02
 ) THEN
   RAISE EXCEPTION 'Pesos financeiros divergem dos custos informados da obra'; END IF;
 IF NEW.planned_start IS DISTINCT FROM v_min OR NEW.planned_finish IS DISTINCT FROM v_max THEN
  RAISE EXCEPTION 'Datas do cabeçalho não coincidem com as atividades calculadas'; END IF;
 IF EXISTS(
  SELECT 1 FROM public.construction_schedule_items current_item
  LEFT JOIN public.construction_schedule_items predecessor
    ON predecessor.schedule_id=current_item.schedule_id AND predecessor.code=current_item.predecessor_code
  WHERE current_item.schedule_id=NEW.id AND current_item.predecessor_code IS NOT NULL
   AND (predecessor.id IS NULL OR predecessor.planned_finish>=current_item.planned_start)
 ) THEN RAISE EXCEPTION 'Predecessoras ausentes ou conflito de datas'; END IF;
 IF NEW.planned_finish>(SELECT data_fim FROM public.projetos WHERE id=NEW.project_id)
    AND (SELECT data_fim FROM public.projetos WHERE id=NEW.project_id) IS NOT NULL THEN
   RAISE EXCEPTION 'Término excede a data vinculada ao projeto; revisar prazo com o contrato'; END IF;
 NEW.baseline_version:=coalesce(OLD.baseline_version,0)+1;
 NEW.approved_at:=now();NEW.approved_by:=auth.uid();
 NEW.baseline_snapshot:=jsonb_build_object('scope',NEW.source_scope_snapshot,
  'calendar',NEW.work_calendar,'weight_source',NEW.weight_source,
  'planned_start',NEW.planned_start,'planned_finish',NEW.planned_finish,
  'activities',(SELECT jsonb_agg(to_jsonb(i) ORDER BY i.display_order)
    FROM public.construction_schedule_items i WHERE i.schedule_id=NEW.id));
 RETURN NEW;
END;
$approve$;

CREATE OR REPLACE FUNCTION public.admin_publish_full_schedule_to_client(p_schedule_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $publish$
DECLARE v_schedule public.construction_schedules%ROWTYPE;
DECLARE v_stages jsonb;v_curve jsonb;v_summary jsonb;v_publication uuid;
BEGIN
 IF NOT public.is_portal_admin() OR (SELECT auth.uid()) IS NULL THEN
  RAISE EXCEPTION 'Somente administradora autenticada pode publicar';
 END IF;
 SELECT * INTO v_schedule FROM public.construction_schedules WHERE id=p_schedule_id FOR UPDATE;
 IF v_schedule.id IS NULL OR v_schedule.activation_status IS DISTINCT FROM 'approved'
    OR v_schedule.baseline_version<1 OR v_schedule.baseline_snapshot IS NULL
    OR NOT (
      (v_schedule.quote_record_id IS NOT NULL AND v_schedule.contract_record_id IS NOT NULL)
      OR v_schedule.source_scope_snapshot->>'authorization_type'='servico_adicional_aceito'
    ) THEN
  IF v_schedule.source_scope_snapshot->>'authorization_type'='obra_sem_contrato' THEN
   RAISE EXCEPTION 'Cronograma interno (obra sem cronograma completo contratado) não é publicado ao cliente';
  END IF;
  RAISE EXCEPTION 'Cronograma deve possuir vínculo comercial e linha de base aprovada';
 END IF;
 IF v_schedule.is_current IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'Somente a revisão vigente pode ser publicada ao cliente';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.project_portal_settings settings
      WHERE settings.project_id=v_schedule.project_id AND settings.show_schedule IS TRUE) THEN
  RAISE EXCEPTION 'O módulo de cronograma deve estar habilitado no portal deste projeto';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.projetos p WHERE p.id=v_schedule.project_id
      AND p.cliente_id=v_schedule.client_id AND p.contract_id=v_schedule.contract_id) THEN
  RAISE EXCEPTION 'Projeto, cliente e contrato estão inconsistentes';
 END IF;

 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'code',a->>'code','activity',a->>'activity',
  'planned_start',a->>'planned_start','planned_finish',a->>'planned_finish',
  'actual_progress',m.actual_progress,'measurement_date',m.measured_on
 ) ORDER BY (a->>'display_order')::integer,a->>'code'),'[]'::jsonb) INTO v_stages
 FROM jsonb_array_elements(v_schedule.baseline_snapshot->'activities') a
 JOIN public.construction_schedule_items i
   ON i.schedule_id=v_schedule.id AND i.code=a->>'code'
 LEFT JOIN LATERAL (
  SELECT e.actual_progress,e.measured_on
  FROM public.construction_schedule_measurements e
  WHERE e.schedule_id=v_schedule.id AND e.item_id=i.id AND e.measured_on<=current_date
  ORDER BY e.measured_on DESC,e.recorded_at DESC,e.id DESC LIMIT 1
 ) m ON TRUE;
 IF jsonb_array_length(v_stages)<>jsonb_array_length(v_schedule.baseline_snapshot->'activities')
    OR jsonb_array_length(v_stages)=0 THEN
  RAISE EXCEPTION 'Linha de base e atividades divergentes: não publicar';
 END IF;
 IF v_schedule.planned_start IS NULL OR v_schedule.planned_finish IS NULL OR
    v_schedule.planned_finish<v_schedule.planned_start OR
    (v_schedule.planned_finish-v_schedule.planned_start)>3653 THEN
  RAISE EXCEPTION 'Prazo inválido para gerar Curva S do cliente';
 END IF;

 WITH dates AS (
   SELECT v_schedule.planned_start AS day
   UNION
   SELECT least(d::date,v_schedule.planned_finish)
   FROM generate_series(v_schedule.planned_start,v_schedule.planned_finish,'7 days'::interval) d
   UNION
   SELECT v_schedule.planned_finish
   UNION
   SELECT e.measured_on
   FROM public.construction_schedule_measurements e
   WHERE e.schedule_id=v_schedule.id
     AND e.measured_on BETWEEN v_schedule.planned_start AND v_schedule.planned_finish
 ), points AS (
   SELECT day,
     public.full_schedule_planned_percent_at(v_schedule.id,day) planned,
     public.full_schedule_measured_percent_at(v_schedule.id,day) actual
   FROM dates
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'date',day,'planned_percent',planned,'actual_percent',actual
 ) ORDER BY day),'[]'::jsonb) INTO v_curve FROM points;

 v_summary:=jsonb_build_object(
   'reference_date',current_date,
   'planned_percent',public.full_schedule_planned_percent_at(v_schedule.id,current_date),
   'actual_percent',public.full_schedule_measured_percent_at(v_schedule.id,current_date),
   'deadline',v_schedule.planned_finish,
   'revision_number',v_schedule.revision_number
 );

 UPDATE public.construction_schedule_publications SET
  revoked_at=now(),revoked_by=(SELECT auth.uid()),
  revoke_reason='Substituída por nova publicação auditável'
 WHERE project_id=v_schedule.project_id AND revoked_at IS NULL;
 INSERT INTO public.construction_schedule_publications(
  project_id,schedule_id,baseline_version,published_snapshot,published_by)
 VALUES(v_schedule.project_id,v_schedule.id,v_schedule.baseline_version,
  jsonb_build_object(
    'title',v_schedule.title,'baseline_version',v_schedule.baseline_version,
    'planned_start',v_schedule.planned_start,'planned_finish',v_schedule.planned_finish,
    'summary',v_summary,'curve',v_curve,'activities',v_stages
  ),(SELECT auth.uid()))
 RETURNING id INTO v_publication;
 RETURN v_publication;
END;
$publish$;

CREATE OR REPLACE FUNCTION public.guard_construction_schedule_revision_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $guard$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.activation_status = 'approved' AND (
    NEW.revision_number IS DISTINCT FROM OLD.revision_number OR
    NEW.supersedes_schedule_id IS DISTINCT FROM OLD.supersedes_schedule_id OR
    NEW.revision_reason IS DISTINCT FROM OLD.revision_reason
  ) THEN
    RAISE EXCEPTION 'Metadados de uma revisão aprovada são imutáveis';
  END IF;

  IF NEW.revision_number = 1 AND NEW.supersedes_schedule_id IS NOT NULL THEN
    RAISE EXCEPTION 'A revisão inicial não pode substituir outro cronograma';
  END IF;
  IF NEW.revision_number > 1 AND NEW.supersedes_schedule_id IS NULL THEN
    RAISE EXCEPTION 'Revisões posteriores precisam identificar a versão substituída';
  END IF;

  IF NEW.supersedes_schedule_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
      FROM public.construction_schedules prior
     WHERE prior.id = NEW.supersedes_schedule_id
       AND prior.project_id = NEW.project_id
       AND prior.revision_number = NEW.revision_number - 1
       AND (prior.activation_status = 'approved' OR prior.activation_status = 'legacy')
  ) THEN
    RAISE EXCEPTION 'A revisão deve suceder a versão aprovada imediatamente anterior do mesmo projeto';
  END IF;

  RETURN NEW;
END;
$guard$;

CREATE OR REPLACE FUNCTION public.promote_approved_construction_schedule_revision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $promote$
BEGIN
  IF NEW.activation_status = 'approved'
     AND OLD.activation_status IS DISTINCT FROM 'approved'
     AND NEW.revision_number > 1 THEN
    IF NEW.supersedes_schedule_id IS NULL THEN
      RAISE EXCEPTION 'Revisão aprovada sem versão anterior';
    END IF;

    -- Migração formal de legado: o legado já foi retirado de vigência na
    -- criação desta versão e permanece como histórico.
    IF NEW.is_current IS TRUE AND EXISTS (
      SELECT 1 FROM public.construction_schedules prior
       WHERE prior.id = NEW.supersedes_schedule_id
         AND prior.project_id = NEW.project_id
         AND prior.activation_status = 'legacy'
         AND prior.is_current IS FALSE
    ) THEN
      RETURN NEW;
    END IF;

    UPDATE public.construction_schedules
       SET is_current = false,
           updated_at = now()
     WHERE id = NEW.supersedes_schedule_id
       AND project_id = NEW.project_id
       AND revision_number = NEW.revision_number - 1
       AND is_current IS TRUE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'A versão anterior vigente não foi localizada; promoção cancelada';
    END IF;

    UPDATE public.construction_schedules
       SET is_current = true,
           updated_at = now()
     WHERE id = NEW.id
       AND is_current IS FALSE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Não foi possível marcar a nova revisão como vigente';
    END IF;
  END IF;
  RETURN NEW;
END;
$promote$;


create or replace function public.admin_preview_full_schedule_template_without_contract(
  p_project_id uuid,
  p_template_code text
)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  v_template public.construction_schedule_templates%rowtype;
  v_authorization jsonb;
begin
  if not public.is_portal_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;

  v_authorization:=public.assert_full_schedule_without_contract(p_project_id);

  select * into v_template
  from public.construction_schedule_templates
  where template_code=p_template_code and active=true
  order by template_version desc
  limit 1;

  if v_template.template_code is null then
    raise exception 'Modelo de cronograma não encontrado';
  end if;

  return jsonb_build_object(
    'commercial',v_authorization,
    'template_code',v_template.template_code,
    'template_version',v_template.template_version,
    'reference_only',true,
    'requires_scope_confirmation',true,
    'internal_only',true,
    'items',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'code',code,
        'category',category,
        'activity',activity,
        'display_order',display_order,
        'reference_weight_percent',reference_weight_percent,
        'reference_duration_days',reference_duration_days,
        'predecessor_code',predecessor_code,
        'requires_scope_confirmation',true
      ) order by display_order),'[]'::jsonb)
      from public.construction_schedule_template_items
      where template_code=v_template.template_code
        and template_version=v_template.template_version
    )
  );
end
$function$;

create or replace function public.admin_initialize_and_save_full_schedule_without_contract(
  p_project_id uuid,
  p_plan jsonb,
  p_reason text
)
returns uuid
language plpgsql
set search_path to 'public'
as $function$
declare
  v_schedule_id uuid;
  v_current public.construction_schedules%rowtype;
  v_project public.projetos%rowtype;
  v_authorization jsonb;
  v_reason text:=btrim(coalesce(p_reason,''));
begin
  if (select auth.uid()) is null or not public.is_portal_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;
  if char_length(v_reason)<10 or char_length(v_reason)>2000 then
    raise exception 'Informe o motivo do cronograma interno (10 a 2000 caracteres)';
  end if;

  v_authorization:=public.assert_full_schedule_without_contract(p_project_id);
  select * into v_project from public.projetos where id=p_project_id;

  select * into v_current
  from public.construction_schedules
  where project_id=p_project_id and is_current is true
  order by revision_number desc
  limit 1
  for update;

  if v_current.id is not null
     and v_current.activation_status='draft'
     and v_current.source_scope_snapshot->>'authorization_type'='obra_sem_contrato' then
    v_schedule_id:=v_current.id;
  elsif v_current.id is not null and v_current.activation_status='approved' then
    raise exception 'Projeto já possui cronograma aprovado vigente; abra uma revisão com justificativa';
  elsif v_current.id is not null and v_current.activation_status='legacy' then
    -- Migração formal: o legado deixa de ser vigente e permanece como histórico.
    update public.construction_schedules
       set is_current=false, updated_at=now()
     where id=v_current.id;
    insert into public.construction_schedules(
      project_id,client_id,contract_id,quote_record_id,contract_record_id,
      source_scope_snapshot,title,planned_start,planned_finish,reference_date,
      activation_status,revision_number,supersedes_schedule_id,revision_reason,is_current,notes
    )
    values(
      v_project.id,v_project.cliente_id,v_project.contract_id,null,null,
      v_authorization,
      'Cronograma físico-financeiro interno — '||coalesce(v_project.nome,'Obra'),
      null,null,current_date,'draft',v_current.revision_number+1,v_current.id,
      'Migração formal do cronograma legado: '||v_reason,true,v_reason
    )
    returning id into v_schedule_id;
    insert into public.audit_log(user_id,action,entity_type,entity_id,details)
    values(auth.uid(),'migrate_legacy_schedule_internal','construction_schedules',v_schedule_id,
      jsonb_build_object('legacy_schedule_id',v_current.id,'project_id',p_project_id,'reason',v_reason));
  elsif v_current.id is not null then
    raise exception 'Projeto já possui cronograma incompatível; não sobrescreva o histórico';
  else
    insert into public.construction_schedules(
      project_id,client_id,contract_id,quote_record_id,contract_record_id,
      source_scope_snapshot,title,planned_start,planned_finish,reference_date,
      activation_status,revision_number,is_current,notes
    )
    values(
      v_project.id,v_project.cliente_id,v_project.contract_id,null,null,
      v_authorization,
      'Cronograma físico-financeiro interno — '||coalesce(v_project.nome,'Obra'),
      null,null,current_date,'draft',1,true,v_reason
    )
    returning id into v_schedule_id;
  end if;

  perform public.admin_save_full_schedule_plan(v_schedule_id,p_plan);
  perform public.admin_set_construction_schedule_holidays(
    v_schedule_id,coalesce(p_plan->'holidays','[]'::jsonb)
  );
  perform public.admin_set_full_schedule_physical_weights(
    v_schedule_id,coalesce(p_plan->'physical_weights','[]'::jsonb)
  );

  return v_schedule_id;
end
$function$;

revoke all on function public.assert_full_schedule_without_contract(uuid) from public,anon;
revoke all on function public.resolve_full_schedule_authorization(uuid,uuid,uuid,jsonb) from public,anon;
revoke all on function public.admin_preview_full_schedule_template_without_contract(uuid,text) from public,anon;
revoke all on function public.admin_initialize_and_save_full_schedule_without_contract(uuid,jsonb,text) from public,anon;
grant execute on function public.assert_full_schedule_without_contract(uuid) to authenticated,service_role;
grant execute on function public.resolve_full_schedule_authorization(uuid,uuid,uuid,jsonb) to authenticated,service_role;
grant execute on function public.admin_preview_full_schedule_template_without_contract(uuid,text) to authenticated,service_role;
grant execute on function public.admin_initialize_and_save_full_schedule_without_contract(uuid,jsonb,text) to authenticated,service_role;
