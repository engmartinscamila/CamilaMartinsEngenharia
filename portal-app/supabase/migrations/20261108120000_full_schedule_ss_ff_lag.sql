-- D05 (decisão de 08/11): dependências início-início (SS), término-término (FF)
-- e defasagem (lag, em dias do calendário da obra; negativo = antecipação),
-- além do término-início (FS) existente. Itens existentes ficam FS com lag 0,
-- comportamento idêntico ao anterior. Aditiva e idempotente.

alter table public.construction_schedule_items
  add column if not exists dependency_type text not null default 'FS',
  add column if not exists lag_days integer not null default 0;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='construction_schedule_items_dependency_valid') then
    alter table public.construction_schedule_items
      add constraint construction_schedule_items_dependency_valid
      check (dependency_type in ('FS','SS','FF') and lag_days between -30 and 365
             and (predecessor_code is not null or (dependency_type='FS' and lag_days=0)));
  end if;
end $$;

-- Condição necessária (independe de fins de semana/feriados): N dias úteis
-- ocupam pelo menos N dias corridos. Antecipações (lag<0) só exigem a
-- predecessora existente; a data exata é calculada e conferida pelo motor.
create or replace function public.full_schedule_dependency_ok(
  p_type text, p_lag integer,
  p_pred_start date, p_pred_finish date,
  p_start date, p_finish date
) returns boolean
language sql immutable
set search_path to ''
as $function$
  select case coalesce(p_type,'FS')
    when 'FS' then case when coalesce(p_lag,0)>=0 then p_start - p_pred_finish >= 1 + coalesce(p_lag,0) else p_start >= p_pred_start end
    when 'SS' then case when coalesce(p_lag,0)>=0 then p_start - p_pred_start >= coalesce(p_lag,0) else true end
    when 'FF' then case when coalesce(p_lag,0)>=0 then p_finish - p_pred_finish >= coalesce(p_lag,0) else true end
    else false end
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

    if coalesce(v_item->>'dependency_type','FS') not in ('FS','SS','FF')
       or coalesce(v_item->>'lag_days','0') !~ '^-?[0-9]{1,3}$'
       or coalesce((v_item->>'lag_days')::integer,0) not between -30 and 365
       or (v_pred is null and (coalesce(v_item->>'dependency_type','FS')<>'FS' or coalesce((v_item->>'lag_days')::integer,0)<>0)) then
      raise exception 'Tipo de dependência ou defasagem inválidos em %',v_code;
    end if;

    if v_pred is not null and (v_pred=v_code or not exists(
      select 1
      from jsonb_array_elements(v_items) p
      where p->>'code'=v_pred
        and public.full_schedule_dependency_ok(
          coalesce(v_item->>'dependency_type','FS'),coalesce((v_item->>'lag_days')::integer,0),
          (p->>'planned_start')::date,(p->>'planned_finish')::date,v_day_start,v_day_finish)
    )) then
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
    weight_source,cost_source,quantity,unit,unit_cost,dependency_type,lag_days
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
    (i->>'unit_cost')::numeric,
    case when nullif(i->>'predecessor_code','') is null then 'FS' else coalesce(i->>'dependency_type','FS') end,
    case when nullif(i->>'predecessor_code','') is null then 0 else coalesce((i->>'lag_days')::integer,0) end
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
   AND (predecessor.id IS NULL OR NOT public.full_schedule_dependency_ok(
        current_item.dependency_type,current_item.lag_days,
        predecessor.planned_start,predecessor.planned_finish,
        current_item.planned_start,current_item.planned_finish))
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


revoke all on function public.full_schedule_dependency_ok(text,integer,date,date,date,date) from public,anon;
grant execute on function public.full_schedule_dependency_ok(text,integer,date,date,date,date) to authenticated,service_role;
