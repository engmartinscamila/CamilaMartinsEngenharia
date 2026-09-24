-- Corrige a gravação do cronograma completo quando a contratação ocorreu
-- posteriormente por Serviço Adicional aceito. O fluxo original ORC + CON
-- continua obrigatório para cronogramas contratados desde a origem.

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

  if v_header.source_scope_snapshot->>'authorization_type'='servico_adicional_aceito' then
    begin
      v_source_document_id:=nullif(v_header.source_scope_snapshot->>'source_document_id','')::uuid;
    exception when invalid_text_representation then
      raise exception 'Serviço Adicional de origem inválido';
    end;

    if v_source_document_id is null
       or v_header.quote_record_id is not null
       or v_header.contract_record_id is not null then
      raise exception 'Vínculo do cronograma por Serviço Adicional está inconsistente';
    end if;

    v_scope:=public.assert_full_schedule_additional_service(
      v_header.project_id,
      v_source_document_id
    );
  else
    v_scope:=public.assert_full_schedule_commercial_link(
      v_header.project_id,
      v_header.quote_record_id,
      v_header.contract_record_id
    );
  end if;

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

revoke all on function public.admin_save_full_schedule_plan(uuid,jsonb) from public,anon;
grant execute on function public.admin_save_full_schedule_plan(uuid,jsonb) to authenticated,service_role;
