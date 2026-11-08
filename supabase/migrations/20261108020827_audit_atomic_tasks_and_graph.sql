-- A06/A07 candidate. Requires A13/A19 gates before remote application.
begin;
create table if not exists private.task_creation_requests(
  request_id uuid primary key,
  requested_by uuid not null,
  payload jsonb not null,
  task_id uuid not null,
  created_at timestamptz not null default now()
);
alter table private.task_creation_requests enable row level security;
revoke all on private.task_creation_requests from public,anon,authenticated;

create or replace function private.guard_project_task_graph()
returns trigger language plpgsql security definer set search_path='' as $$
declare project uuid; other_project uuid; related uuid;
begin
  if tg_table_name='project_task_dependencies' then
    select project_id into project from public.project_tasks where id=new.task_id;
    select project_id into other_project from public.project_tasks where id=new.depends_on_task_id;
    if project is null or other_project is null then raise exception 'Tarefa da dependência não encontrada.' using errcode='23503'; end if;
    if project is distinct from other_project then raise exception 'Dependências devem pertencer ao mesmo projeto.' using errcode='23514'; end if;
    perform 1 from public.projetos where id=project for update;
    if exists(select 1 from public.project_tasks where id in (new.task_id,new.depends_on_task_id) and project_id is distinct from project) then
      raise exception 'O projeto da tarefa mudou durante a operação. Atualize a lista.' using errcode='40001';
    end if;
    if new.task_id=new.depends_on_task_id or exists(
      with recursive successors(id) as (
        select new.depends_on_task_id
        union
        select d.depends_on_task_id from public.project_task_dependencies d join successors s on d.task_id=s.id
        where tg_op<>'UPDATE' or (d.task_id,d.depends_on_task_id) is distinct from (old.task_id,old.depends_on_task_id)
      ) select 1 from successors where id=new.task_id
    ) then raise exception 'Dependência criaria um ciclo de tarefas.' using errcode='23514'; end if;
  else
    -- Serialize edits of both old/new projects in a stable order.
    for related in select id from public.projetos where id=new.project_id or (tg_op='UPDATE' and id=old.project_id) order by id loop
      perform 1 from public.projetos where id=related for update;
    end loop;
    if new.parent_task_id is not null then
      select project_id into other_project from public.project_tasks where id=new.parent_task_id;
      if other_project is distinct from new.project_id then raise exception 'Tarefa principal deve pertencer ao mesmo projeto.' using errcode='23514'; end if;
      if new.id=new.parent_task_id or exists(
        with recursive parents(id,parent_task_id) as (
          select t.id,t.parent_task_id from public.project_tasks t where t.id=new.parent_task_id
          union
          select t.id,t.parent_task_id from public.project_tasks t join parents p on t.id=p.parent_task_id
        ) select 1 from parents where id=new.id
      ) then raise exception 'Hierarquia criaria um ciclo de tarefas.' using errcode='23514'; end if;
    end if;
    if tg_op='UPDATE' and new.project_id is distinct from old.project_id then
      if exists(select 1 from public.project_tasks t where t.parent_task_id=old.id and t.project_id is distinct from new.project_id)
        or exists(select 1 from public.project_task_dependencies d join public.project_tasks t on t.id=d.depends_on_task_id where d.task_id=old.id and t.project_id is distinct from new.project_id)
        or exists(select 1 from public.project_task_dependencies d join public.project_tasks t on t.id=d.task_id where d.depends_on_task_id=old.id and t.project_id is distinct from new.project_id) then
        raise exception 'A mudança de projeto invalidaria a hierarquia/dependências.' using errcode='23514';
      end if;
    end if;
  end if;
  return new;
end $$;
revoke all on function private.guard_project_task_graph() from public,anon,authenticated;
create or replace trigger audit_task_dependency_graph_guard before insert or update on public.project_task_dependencies
for each row execute function private.guard_project_task_graph();
create or replace trigger audit_task_parent_graph_guard before insert or update of project_id,parent_task_id on public.project_tasks
for each row execute function private.guard_project_task_graph();

create or replace function public.admin_create_project_task(p_request_id uuid,p_data jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare project uuid; task uuid; payload jsonb; prior private.task_creation_requests;
begin
  if auth.uid() is null or not public.is_portal_admin() then raise exception 'Acesso administrativo necessário.' using errcode='42501'; end if;
  if p_request_id is null then raise exception 'Identifique a solicitação da tarefa.'; end if;
  project:=(p_data->>'project_id')::uuid;
  payload:=jsonb_build_object('project_id',project,'title',trim(p_data->>'title'),
    'description',nullif(trim(p_data->>'description'),''),'priority',coalesce(p_data->>'priority','normal'),
    'start_date',nullif(p_data->>'start_date','')::date,'due_date',nullif(p_data->>'due_date','')::date,
    'estimated_hours',nullif(p_data->>'estimated_hours','')::numeric,'weight',coalesce(nullif(p_data->>'weight','')::numeric,1),
    'client_visible',coalesce((p_data->>'client_visible')::boolean,false),
    'parent_task_id',nullif(p_data->>'parent_task_id','')::uuid,'dependency_id',nullif(p_data->>'dependency_id','')::uuid);
  if project is null or length(coalesce(payload->>'title',''))<3
    or payload->>'priority' not in ('low','normal','high','urgent')
    or (payload->>'weight')::numeric<=0 or coalesce((payload->>'estimated_hours')::numeric,0)<0
    or payload->>'weight' in ('NaN','Infinity','-Infinity') or payload->>'estimated_hours' in ('NaN','Infinity','-Infinity')
    or (payload->>'due_date')::date<(payload->>'start_date')::date then raise exception 'Dados da tarefa inválidos.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,19));
  select * into prior from private.task_creation_requests where request_id=p_request_id;
  if found then
    if prior.requested_by is distinct from auth.uid() or prior.payload is distinct from payload then raise exception 'Solicitação de tarefa reutilizada com outros dados.'; end if;
    if not exists(select 1 from public.project_tasks where id=prior.task_id) then raise exception 'A tarefa desta solicitação foi removida; atualize a lista antes de criar outra.'; end if;
    return prior.task_id;
  end if;
  perform 1 from public.projetos where id=project for update;
  if not found then raise exception 'Projeto da tarefa não encontrado.'; end if;
  insert into public.project_tasks(project_id,parent_task_id,title,description,priority,start_date,due_date,estimated_hours,weight,client_visible,created_by)
  values(project,(payload->>'parent_task_id')::uuid,payload->>'title',payload->>'description',payload->>'priority',
    (payload->>'start_date')::date,(payload->>'due_date')::date,(payload->>'estimated_hours')::numeric,
    (payload->>'weight')::numeric,(payload->>'client_visible')::boolean,auth.uid()) returning id into task;
  if payload->>'dependency_id' is not null then
    insert into public.project_task_dependencies(task_id,depends_on_task_id) values(task,(payload->>'dependency_id')::uuid);
  end if;
  insert into private.task_creation_requests(request_id,requested_by,payload,task_id) values(p_request_id,auth.uid(),payload,task);
  insert into public.audit_log(user_id,action,entity_type,entity_id,details)
    values(auth.uid(),'create_project_task','project_tasks',task,jsonb_build_object('request_id',p_request_id,'project_id',project));
  return task;
end $$;
revoke all on function public.admin_create_project_task(uuid,jsonb) from public,anon;
grant execute on function public.admin_create_project_task(uuid,jsonb) to authenticated;
commit;
