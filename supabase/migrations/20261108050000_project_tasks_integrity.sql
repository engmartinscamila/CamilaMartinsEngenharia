-- A06 — Criação de tarefa + dependência em uma única transação idempotente.
-- A07 — Dependências e subtarefas só no mesmo projeto e sem ciclos (no banco).
-- A08 — Progresso por tarefas trata o conjunto vazio sem apagar progresso
--       informado manualmente.
-- Migração aditiva e idempotente. Reversão no fim do arquivo.

-- ---------------------------------------------------------------- A07
create or replace function private.guard_project_task_dependency()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_task_project uuid;
  v_dep_project uuid;
  v_cycle boolean;
begin
  select project_id into v_task_project from public.project_tasks where id = new.task_id;
  select project_id into v_dep_project from public.project_tasks where id = new.depends_on_task_id;
  if v_task_project is null or v_dep_project is null then
    raise exception 'Tarefa ou dependência inexistente.' using errcode = '23503';
  end if;
  if v_task_project <> v_dep_project then
    raise exception 'A dependência precisa pertencer ao mesmo projeto da tarefa.' using errcode = '23514', hint = 'task_dependency_invalid';
  end if;
  -- Serializa alterações do grafo do projeto para impedir ciclos concorrentes.
  perform pg_advisory_xact_lock(hashtextextended('task-graph:' || v_task_project::text, 0));
  with recursive chain(id) as (
    select new.depends_on_task_id
    union
    select d.depends_on_task_id from public.project_task_dependencies d join chain c on d.task_id = c.id
  )
  select exists(select 1 from chain where id = new.task_id) into v_cycle;
  if v_cycle then
    raise exception 'Esta dependência criaria um ciclo entre tarefas.' using errcode = '23514', hint = 'task_dependency_invalid';
  end if;
  return new;
end
$function$;

drop trigger if exists a00_guard_project_task_dependency on public.project_task_dependencies;
create trigger a00_guard_project_task_dependency
  before insert or update on public.project_task_dependencies
  for each row execute function private.guard_project_task_dependency();

create or replace function private.guard_project_task_parent()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_parent_project uuid;
  v_cycle boolean;
begin
  if new.parent_task_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.parent_task_id is not distinct from old.parent_task_id and new.project_id = old.project_id then
    return new;
  end if;
  if new.parent_task_id = new.id then
    raise exception 'Uma tarefa não pode ser subtarefa de si mesma.' using errcode = '23514', hint = 'task_dependency_invalid';
  end if;
  select project_id into v_parent_project from public.project_tasks where id = new.parent_task_id;
  if v_parent_project is null then raise exception 'Tarefa principal inexistente.' using errcode = '23503'; end if;
  if v_parent_project <> new.project_id then
    raise exception 'A tarefa principal precisa pertencer ao mesmo projeto.' using errcode = '23514', hint = 'task_dependency_invalid';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('task-graph:' || new.project_id::text, 0));
  with recursive up(id) as (
    select new.parent_task_id
    union
    select t.parent_task_id from public.project_tasks t join up u on t.id = u.id where t.parent_task_id is not null
  )
  select exists(select 1 from up where id = new.id) into v_cycle;
  if v_cycle then
    raise exception 'Esta subtarefa criaria um ciclo de hierarquia.' using errcode = '23514', hint = 'task_dependency_invalid';
  end if;
  return new;
end
$function$;

drop trigger if exists a00_guard_project_task_parent on public.project_tasks;
create trigger a00_guard_project_task_parent
  before insert or update of parent_task_id, project_id on public.project_tasks
  for each row execute function private.guard_project_task_parent();

-- ---------------------------------------------------------------- A08
alter table public.projetos add column if not exists progress_source text;

create or replace function private.track_project_progress_source()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.progress_percent is distinct from old.progress_percent then
    new.progress_source := case when current_setting('app.progress_from_tasks', true) = 'on' then 'tasks' else 'manual' end;
  end if;
  return new;
end
$function$;

drop trigger if exists a00_track_project_progress_source on public.projetos;
create trigger a00_track_project_progress_source
  before update of progress_percent on public.projetos
  for each row execute function private.track_project_progress_source();

create or replace function private.recalculate_project_task_progress()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_project_id uuid := coalesce(new.project_id, old.project_id);
  v_progress numeric;
begin
  select round(
    100 * sum(case when status='done' then weight else 0 end)
    / nullif(sum(case when status<>'cancelled' then weight else 0 end), 0),
    2
  )
  into v_progress
  from public.project_tasks
  where project_id=v_project_id;

  perform set_config('app.progress_from_tasks', 'on', true);
  if v_progress is not null then
    update public.projetos set progress_percent=v_progress where id=v_project_id and progress_percent is distinct from v_progress;
  else
    -- Nenhuma tarefa ativa: o progresso derivado de tarefas deixa de valer.
    -- Progresso informado manualmente é preservado.
    update public.projetos set progress_percent=null
     where id=v_project_id and progress_source='tasks' and progress_percent is not null;
  end if;
  perform set_config('app.progress_from_tasks', 'off', true);
  return coalesce(new, old);
end;
$function$;

-- ---------------------------------------------------------------- A06
alter table public.project_tasks add column if not exists client_request_id uuid;
create unique index if not exists project_tasks_client_request_uidx
  on public.project_tasks(client_request_id) where client_request_id is not null;

create or replace function public.admin_create_project_task(p_data jsonb, p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_id uuid;
  v_project uuid := nullif(p_data->>'project_id','')::uuid;
  v_dependency uuid := nullif(p_data->>'dependency_id','')::uuid;
  v_existing public.project_tasks;
begin
  if auth.uid() is null or not public.is_portal_admin() then
    raise exception 'Acesso administrativo necessário.' using errcode = '42501';
  end if;
  if p_request_id is null or v_project is null then raise exception 'Informe o projeto e a solicitação.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('task-request:' || p_request_id::text, 0));

  select * into v_existing from public.project_tasks where client_request_id = p_request_id;
  if found then
    if v_existing.project_id <> v_project or btrim(v_existing.title) <> btrim(coalesce(p_data->>'title','')) then
      raise exception 'Esta solicitação já foi usada para outra tarefa. Atualize a tela antes de tentar novamente.';
    end if;
    return v_existing.id;
  end if;

  insert into public.project_tasks(project_id, parent_task_id, title, description, priority, start_date, due_date,
                                   estimated_hours, weight, client_visible, client_request_id)
  values (v_project, nullif(p_data->>'parent_task_id','')::uuid, btrim(coalesce(p_data->>'title','')),
          nullif(btrim(coalesce(p_data->>'description','')),''), coalesce(nullif(p_data->>'priority',''),'normal'),
          nullif(p_data->>'start_date','')::date, nullif(p_data->>'due_date','')::date,
          nullif(p_data->>'estimated_hours','')::numeric, coalesce(nullif(p_data->>'weight','')::numeric, 1),
          coalesce((p_data->>'client_visible')::boolean, false), p_request_id)
  returning id into v_id;

  if v_dependency is not null then
    insert into public.project_task_dependencies(task_id, depends_on_task_id) values (v_id, v_dependency);
  end if;
  return v_id;
end
$function$;

revoke all on function public.admin_create_project_task(jsonb, uuid) from public, anon;
grant execute on function public.admin_create_project_task(jsonb, uuid) to authenticated;

-- ROLLBACK (manual):
--   drop trigger if exists a00_guard_project_task_dependency on public.project_task_dependencies;
--   drop trigger if exists a00_guard_project_task_parent on public.project_tasks;
--   drop trigger if exists a00_track_project_progress_source on public.projetos;
--   drop function if exists public.admin_create_project_task(jsonb, uuid);
--   restaurar private.recalculate_project_task_progress da migração 20260906045752.
--   (colunas progress_source e client_request_id podem permanecer)
