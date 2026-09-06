-- Operação integrada: CRM, tarefas, diário de obra, compras, financeiro e portal.
-- Migração exclusivamente aditiva e compatível com os dados existentes.

create schema if not exists private;

alter table public.commercial_records
  add column if not exists crm_stage text not null default 'novo',
  add column if not exists crm_priority text not null default 'normal',
  add column if not exists crm_source text,
  add column if not exists next_action_at timestamptz,
  add column if not exists lost_reason text;

update public.commercial_records
set crm_stage = case
  when linked_project_id is not null or status = 'convertido' then 'ganho'
  when contract_document_id is not null then 'negociacao'
  when quote_document_id is not null then 'proposta'
  else 'novo'
end
where crm_stage = 'novo';

create table if not exists public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projetos(id) on delete cascade,
  parent_task_id uuid references public.project_tasks(id) on delete cascade,
  title text not null check (length(btrim(title)) between 3 and 180),
  description text,
  status text not null default 'todo' check (status in ('todo','doing','blocked','done','cancelled')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  start_date date,
  due_date date,
  completed_at timestamptz,
  estimated_hours numeric(10,2) check (estimated_hours is null or estimated_hours >= 0),
  weight numeric(10,2) not null default 1 check (weight > 0),
  assignee_user_id uuid references auth.users(id) on delete set null,
  client_visible boolean not null default false,
  position integer not null default 0,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (due_date is null or start_date is null or due_date >= start_date)
);

create table if not exists public.project_task_dependencies (
  task_id uuid not null references public.project_tasks(id) on delete cascade,
  depends_on_task_id uuid not null references public.project_tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, depends_on_task_id),
  check (task_id <> depends_on_task_id)
);

create table if not exists public.task_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 3 and 120),
  description text,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.task_templates(id) on delete cascade,
  title text not null check (length(btrim(title)) between 3 and 180),
  description text,
  offset_days integer not null default 0,
  duration_days integer not null default 1 check (duration_days > 0),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  weight numeric(10,2) not null default 1 check (weight > 0),
  client_visible boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.work_diary_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projetos(id) on delete cascade,
  entry_date date not null default current_date,
  weather text,
  team_count integer check (team_count is null or team_count >= 0),
  activities text not null check (length(btrim(activities)) >= 3),
  occurrences text,
  materials text,
  next_steps text,
  voice_transcript text,
  client_visible boolean not null default false,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, entry_date, created_by)
);

alter table public.fotos
  add column if not exists work_diary_entry_id uuid references public.work_diary_entries(id) on delete set null;

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 160),
  cpf_cnpj text,
  email text,
  phone text,
  category text,
  notes text,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_quotes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projetos(id) on delete cascade,
  title text not null check (length(btrim(title)) between 3 and 180),
  description text,
  status text not null default 'draft' check (status in ('draft','collecting','analysis','approved','ordered','cancelled')),
  due_date date,
  selected_supplier_id uuid references public.suppliers(id) on delete set null,
  client_visible boolean not null default false,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.purchase_quotes(id) on delete cascade,
  description text not null check (length(btrim(description)) >= 2),
  quantity numeric(12,3) not null default 1 check (quantity > 0),
  unit text not null default 'un',
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.supplier_bids (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.purchase_quotes(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  total_amount numeric(14,2) not null check (total_amount >= 0),
  lead_time_days integer check (lead_time_days is null or lead_time_days >= 0),
  payment_terms text,
  notes text,
  attachment_bucket text,
  attachment_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quote_id, supplier_id)
);

create table if not exists public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 100),
  account_type text not null default 'bank' check (account_type in ('bank','cash','credit')),
  opening_balance numeric(14,2) not null default 0,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.financial_accounts(id) on delete restrict,
  external_id text,
  transaction_date date not null,
  description text not null,
  amount numeric(14,2) not null,
  transaction_type text not null check (transaction_type in ('credit','debit','transfer')),
  matched_financial_id uuid references public.financeiro(id) on delete set null,
  imported_at timestamptz not null default now(),
  imported_by uuid references auth.users(id) on delete set null default auth.uid(),
  unique (account_id, external_id)
);

alter table public.financeiro
  add column if not exists account_id uuid references public.financial_accounts(id) on delete set null,
  add column if not exists bank_transaction_id uuid references public.bank_transactions(id) on delete set null,
  add column if not exists recurrence_rule text,
  add column if not exists source text not null default 'manual';

create table if not exists public.timesheets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projetos(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  work_date date not null default current_date,
  hours numeric(8,2) not null check (hours > 0 and hours <= 24),
  hourly_cost numeric(12,2) not null default 0 check (hourly_cost >= 0),
  description text not null check (length(btrim(description)) >= 3),
  billable boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.fiscal_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projetos(id) on delete restrict,
  financial_entry_id uuid references public.financeiro(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','ready','submitted','authorized','cancelled','error')),
  provider text,
  external_id text,
  service_code text,
  description text not null,
  amount numeric(14,2) not null check (amount > 0),
  issued_at timestamptz,
  error_message text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_portal_settings (
  project_id uuid primary key references public.projetos(id) on delete cascade,
  show_documents boolean not null default true,
  show_photos boolean not null default true,
  show_library boolean not null default true,
  show_agenda boolean not null default true,
  show_schedule boolean not null default true,
  show_approvals boolean not null default true,
  show_requests boolean not null default true,
  show_tasks boolean not null default true,
  show_work_diary boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now()
);

insert into public.project_portal_settings(project_id)
select id from public.projetos
on conflict (project_id) do nothing;

create table if not exists public.system_automation_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  status text not null check (status in ('running','success','error')),
  metrics jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.prospect_access_links (
  id uuid primary key default gen_random_uuid(),
  commercial_record_id uuid not null references public.commercial_records(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  max_uses integer not null default 20 check (max_uses between 1 and 200),
  use_count integer not null default 0 check (use_count >= 0),
  revoked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.prospect_access_documents (
  link_id uuid not null references public.prospect_access_links(id) on delete cascade,
  document_id uuid not null references public.documentos(id) on delete cascade,
  primary key(link_id,document_id)
);

create index if not exists idx_commercial_records_crm on public.commercial_records(crm_stage, next_action_at);
create index if not exists idx_project_tasks_board on public.project_tasks(project_id, status, position);
create index if not exists idx_project_tasks_due on public.project_tasks(due_date) where status not in ('done','cancelled');
create index if not exists idx_task_dependencies_target on public.project_task_dependencies(depends_on_task_id);
create index if not exists idx_task_template_items_order on public.task_template_items(template_id, position);
create index if not exists idx_work_diary_project_date on public.work_diary_entries(project_id, entry_date desc);
create index if not exists idx_purchase_quotes_project on public.purchase_quotes(project_id, status, due_date);
create index if not exists idx_supplier_bids_quote on public.supplier_bids(quote_id, total_amount);
create index if not exists idx_bank_transactions_date on public.bank_transactions(account_id, transaction_date desc);
create index if not exists idx_timesheets_project_date on public.timesheets(project_id, work_date desc);
create index if not exists idx_fiscal_documents_project on public.fiscal_documents(project_id, status);
create index if not exists idx_financeiro_due on public.financeiro(data_vencimento) where status = 'pendente';
create index if not exists idx_prospect_links_expiration on public.prospect_access_links(expires_at) where revoked_at is null;
create index if not exists idx_project_tasks_assignee on public.project_tasks(assignee_user_id);
create index if not exists idx_project_tasks_created_by on public.project_tasks(created_by);
create index if not exists idx_project_tasks_parent on public.project_tasks(parent_task_id);
create index if not exists idx_work_diary_created_by on public.work_diary_entries(created_by);
create index if not exists idx_suppliers_created_by on public.suppliers(created_by);
create index if not exists idx_purchase_quotes_created_by on public.purchase_quotes(created_by);
create index if not exists idx_purchase_quotes_selected_supplier on public.purchase_quotes(selected_supplier_id);
create index if not exists idx_purchase_quote_items_quote on public.purchase_quote_items(quote_id);
create index if not exists idx_supplier_bids_supplier on public.supplier_bids(supplier_id);
create index if not exists idx_financial_accounts_created_by on public.financial_accounts(created_by);
create index if not exists idx_bank_transactions_imported_by on public.bank_transactions(imported_by);
create index if not exists idx_bank_transactions_matched_financial on public.bank_transactions(matched_financial_id);
create index if not exists idx_timesheets_user on public.timesheets(user_id);
create index if not exists idx_fiscal_documents_created_by on public.fiscal_documents(created_by);
create index if not exists idx_fiscal_documents_financial_entry on public.fiscal_documents(financial_entry_id);
create index if not exists idx_project_portal_settings_updated_by on public.project_portal_settings(updated_by);
create index if not exists idx_prospect_documents_document on public.prospect_access_documents(document_id);
create index if not exists idx_prospect_links_commercial_record on public.prospect_access_links(commercial_record_id);
create index if not exists idx_prospect_links_created_by on public.prospect_access_links(created_by);
create index if not exists idx_task_templates_created_by on public.task_templates(created_by);

create or replace function private.operation_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.operation_touch_updated_at() from public, anon, authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'project_tasks','task_templates','work_diary_entries','suppliers',
    'purchase_quotes','supplier_bids','financial_accounts','fiscal_documents'
  ]
  loop
    if not exists (
      select 1 from pg_trigger
      where tgname = 'trg_' || table_name || '_updated_at'
        and tgrelid = ('public.' || table_name)::regclass
    ) then
      execute format(
        'create trigger %I before update on public.%I for each row execute function private.operation_touch_updated_at()',
        'trg_' || table_name || '_updated_at', table_name
      );
    end if;
  end loop;
end
$$;

create or replace function private.ensure_project_portal_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.project_portal_settings(project_id)
  values (new.id)
  on conflict (project_id) do nothing;
  return new;
end;
$$;

revoke all on function private.ensure_project_portal_settings() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname='trg_project_portal_settings') then
    create trigger trg_project_portal_settings
      after insert on public.projetos
      for each row execute function private.ensure_project_portal_settings();
  end if;
end
$$;

create or replace function private.recalculate_project_task_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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

  if v_progress is not null then
    update public.projetos set progress_percent=v_progress where id=v_project_id;
  end if;
  return coalesce(new, old);
end;
$$;

revoke all on function private.recalculate_project_task_progress() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname='trg_project_task_progress') then
    create trigger trg_project_task_progress
      after insert or update of status, weight or delete on public.project_tasks
      for each row execute function private.recalculate_project_task_progress();
  end if;
end
$$;

create or replace function private.enqueue_operational_reminders()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run uuid;
  v_admin_tasks integer := 0;
  v_client_tasks integer := 0;
  v_financial integer := 0;
begin
  insert into public.system_automation_runs(job_name,status)
  values ('operational-reminders','running')
  returning id into v_run;

  insert into public.notificacoes(projeto_id,cliente_id,titulo,mensagem,tipo,destinatario,referencia_tipo,referencia_id,link_path)
  select t.project_id,p.cliente_id,
    case when t.due_date < current_date then 'Tarefa atrasada' else 'Tarefa próxima do vencimento' end,
    t.title || ' • prazo ' || to_char(t.due_date,'DD/MM/YYYY'),
    'task_due','admin','project_task',t.id,'/admin/tasks'
  from public.project_tasks t
  join public.projetos p on p.id=t.project_id
  where t.status not in ('done','cancelled')
    and t.due_date between current_date - 30 and current_date + 2
    and not exists (
      select 1 from public.notificacoes n
      where n.destinatario='admin' and n.referencia_tipo='project_task'
        and n.referencia_id::text=t.id::text and n.created_at::date=current_date
    );
  get diagnostics v_admin_tasks = row_count;

  insert into public.notificacoes(projeto_id,cliente_id,titulo,mensagem,tipo,destinatario,referencia_tipo,referencia_id,link_path)
  select t.project_id,p.cliente_id,'Atualização do projeto',
    t.title || ' • prazo ' || to_char(t.due_date,'DD/MM/YYYY'),
    'task_due','cliente','project_task',t.id,'/(client)/tasks'
  from public.project_tasks t
  join public.projetos p on p.id=t.project_id
  where t.client_visible and t.status not in ('done','cancelled')
    and t.due_date between current_date and current_date + 2
    and not exists (
      select 1 from public.notificacoes n
      where n.destinatario='cliente' and n.referencia_tipo='project_task'
        and n.referencia_id::text=t.id::text and n.created_at::date=current_date
    );
  get diagnostics v_client_tasks = row_count;

  insert into public.notificacoes(projeto_id,cliente_id,titulo,mensagem,tipo,destinatario,referencia_tipo,referencia_id,link_path)
  select f.projeto_id,p.cliente_id,'Financeiro pendente',
    coalesce(f.descricao,'Lançamento') || ' • ' || to_char(f.data_vencimento,'DD/MM/YYYY'),
    'financial_due','admin','financeiro',f.id,'/admin/financial'
  from public.financeiro f
  left join public.projetos p on p.id=f.projeto_id
  where f.status='pendente' and f.data_vencimento between current_date - 30 and current_date + 3
    and not exists (
      select 1 from public.notificacoes n
      where n.destinatario='admin' and n.referencia_tipo='financeiro'
        and n.referencia_id::text=f.id::text and n.created_at::date=current_date
    );
  get diagnostics v_financial = row_count;

  update public.system_automation_runs
  set status='success', finished_at=now(),
      metrics=jsonb_build_object('admin_task_alerts',v_admin_tasks,'client_task_alerts',v_client_tasks,'financial_alerts',v_financial)
  where id=v_run;

  return jsonb_build_object('run_id',v_run,'admin_task_alerts',v_admin_tasks,'client_task_alerts',v_client_tasks,'financial_alerts',v_financial);
exception when others then
  if v_run is not null then
    update public.system_automation_runs set status='error',finished_at=now(),error_message=sqlerrm where id=v_run;
  end if;
  raise;
end;
$$;

revoke all on function private.enqueue_operational_reminders() from public, anon, authenticated;
grant execute on function private.enqueue_operational_reminders() to service_role;

create or replace function private.apply_task_template(p_template_id uuid,p_project_id uuid,p_start_date date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_count integer;
begin
  if not public.is_portal_admin() then raise exception 'Acesso administrativo necessário'; end if;
  if not exists(select 1 from public.projetos where id=p_project_id and contract_id is not null) then
    raise exception 'Projeto com contrato obrigatório não encontrado';
  end if;
  insert into public.project_tasks(project_id,title,description,priority,start_date,due_date,weight,client_visible,position)
  select p_project_id,i.title,i.description,i.priority,
    p_start_date+i.offset_days,
    p_start_date+i.offset_days+i.duration_days-1,
    i.weight,i.client_visible,i.position
  from public.task_template_items i
  join public.task_templates t on t.id=i.template_id and t.active
  where i.template_id=p_template_id
  order by i.position;
  get diagnostics v_count=row_count;
  return v_count;
end;
$$;

revoke all on function private.apply_task_template(uuid,uuid,date) from public, anon, authenticated;

create or replace function public.admin_apply_task_template(
  p_template_id uuid,
  p_project_id uuid,
  p_start_date date default current_date
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_portal_admin() then raise exception 'Acesso administrativo necessário'; end if;
  return private.apply_task_template(p_template_id,p_project_id,p_start_date);
end;
$$;

create or replace function public.admin_run_operational_reminders()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_portal_admin() then raise exception 'Acesso administrativo necessário'; end if;
  return private.enqueue_operational_reminders();
end;
$$;

revoke all on function public.admin_apply_task_template(uuid,uuid,date) from public,anon;
revoke all on function public.admin_run_operational_reminders() from public,anon;
grant execute on function public.admin_apply_task_template(uuid,uuid,date) to authenticated;
grant execute on function public.admin_run_operational_reminders() to authenticated;

create or replace function public.admin_create_prospect_access_link(
  p_commercial_record_id uuid,
  p_expires_hours integer default 72
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := encode(extensions.gen_random_bytes(24),'hex');
  v_link uuid;
  v_documents integer;
begin
  if not public.is_portal_admin() then raise exception 'Acesso administrativo necessário'; end if;
  if p_expires_hours not between 1 and 720 then raise exception 'Validade deve ficar entre 1 e 720 horas'; end if;
  if not exists(select 1 from public.commercial_records where id=p_commercial_record_id) then
    raise exception 'Registro comercial não encontrado';
  end if;
  insert into public.prospect_access_links(commercial_record_id,token_hash,expires_at)
  values(p_commercial_record_id,encode(extensions.digest(v_token,'sha256'),'hex'),now()+make_interval(hours=>p_expires_hours))
  returning id into v_link;
  insert into public.prospect_access_documents(link_id,document_id)
  select v_link,document_id
  from (
    select quote_document_id document_id from public.commercial_records where id=p_commercial_record_id
    union
    select contract_document_id from public.commercial_records where id=p_commercial_record_id
  ) available
  where document_id is not null;
  get diagnostics v_documents=row_count;
  if v_documents=0 then raise exception 'Gere e arquive ao menos um documento antes de criar o link'; end if;
  return v_token;
end;
$$;

revoke all on function public.admin_create_prospect_access_link(uuid,integer) from public,anon;
grant execute on function public.admin_create_prospect_access_link(uuid,integer) to authenticated;

alter table public.project_tasks enable row level security;
alter table public.project_task_dependencies enable row level security;
alter table public.task_templates enable row level security;
alter table public.task_template_items enable row level security;
alter table public.work_diary_entries enable row level security;
alter table public.suppliers enable row level security;
alter table public.purchase_quotes enable row level security;
alter table public.purchase_quote_items enable row level security;
alter table public.supplier_bids enable row level security;
alter table public.financial_accounts enable row level security;
alter table public.bank_transactions enable row level security;
alter table public.timesheets enable row level security;
alter table public.fiscal_documents enable row level security;
alter table public.project_portal_settings enable row level security;
alter table public.system_automation_runs enable row level security;
alter table public.prospect_access_links enable row level security;
alter table public.prospect_access_documents enable row level security;

grant select,insert,update,delete on
  public.project_tasks,public.project_task_dependencies,public.task_templates,public.task_template_items,
  public.work_diary_entries,public.suppliers,public.purchase_quotes,public.purchase_quote_items,
  public.supplier_bids,public.financial_accounts,public.bank_transactions,public.timesheets,
  public.fiscal_documents,public.project_portal_settings
  ,public.prospect_access_links,public.prospect_access_documents
to authenticated;
grant select on public.system_automation_runs to authenticated;
grant all on
  public.project_tasks,public.project_task_dependencies,public.task_templates,public.task_template_items,
  public.work_diary_entries,public.suppliers,public.purchase_quotes,public.purchase_quote_items,
  public.supplier_bids,public.financial_accounts,public.bank_transactions,public.timesheets,
  public.fiscal_documents,public.project_portal_settings,public.system_automation_runs,
  public.prospect_access_links,public.prospect_access_documents
to service_role;
grant select on public.commercial_records,public.documentos to service_role;

do $$
declare t text;
begin
  foreach t in array array[
    'project_tasks','project_task_dependencies','task_templates','task_template_items',
    'work_diary_entries','suppliers','purchase_quotes','purchase_quote_items','supplier_bids',
    'financial_accounts','bank_transactions','timesheets','fiscal_documents',
    'project_portal_settings','system_automation_runs','prospect_access_links','prospect_access_documents'
  ]
  loop
    if not exists(select 1 from pg_policies where schemaname='public' and tablename=t and policyname='Administração integral') then
      execute format('create policy %I on public.%I for all to authenticated using ((select public.is_portal_admin())) with check ((select public.is_portal_admin()))','Administração integral',t);
    end if;
  end loop;
end
$$;

do $$
begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='project_tasks' and policyname='Cliente acompanha tarefas liberadas') then
    create policy "Cliente acompanha tarefas liberadas" on public.project_tasks
      for select to authenticated
      using (client_visible and (select public.user_has_project_access(project_id)));
  end if;
  alter policy "Cliente acompanha tarefas liberadas" on public.project_tasks
    using (
      client_visible
      and (select public.user_has_project_access(project_id))
      and exists(select 1 from public.project_portal_settings s where s.project_id=project_tasks.project_id and s.show_tasks)
    );
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='work_diary_entries' and policyname='Cliente acompanha diário liberado') then
    create policy "Cliente acompanha diário liberado" on public.work_diary_entries
      for select to authenticated
      using (client_visible and (select public.user_has_project_access(project_id)));
  end if;
  alter policy "Cliente acompanha diário liberado" on public.work_diary_entries
    using (
      client_visible
      and (select public.user_has_project_access(project_id))
      and exists(select 1 from public.project_portal_settings s where s.project_id=work_diary_entries.project_id and s.show_work_diary)
    );
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='project_portal_settings' and policyname='Cliente lê configuração do projeto') then
    create policy "Cliente lê configuração do projeto" on public.project_portal_settings
      for select to authenticated
      using ((select public.user_has_project_access(project_id)));
  end if;
end
$$;

-- Evita políticas permissivas sobrepostas: cada leitura combina, em uma única
-- regra, o acesso administrativo e o acesso explicitamente liberado ao cliente.
drop policy if exists "Administração integral" on public.project_tasks;
drop policy if exists "Cliente acompanha tarefas liberadas" on public.project_tasks;
drop policy if exists "Leitura de tarefas por perfil" on public.project_tasks;
drop policy if exists "Administração insere tarefas" on public.project_tasks;
drop policy if exists "Administração atualiza tarefas" on public.project_tasks;
drop policy if exists "Administração exclui tarefas" on public.project_tasks;
create policy "Leitura de tarefas por perfil" on public.project_tasks
  for select to authenticated using (
    (select public.is_portal_admin()) or (
      client_visible
      and (select public.user_has_project_access(project_id))
      and exists(select 1 from public.project_portal_settings s where s.project_id=project_tasks.project_id and s.show_tasks)
    )
  );
create policy "Administração insere tarefas" on public.project_tasks for insert to authenticated
  with check ((select public.is_portal_admin()));
create policy "Administração atualiza tarefas" on public.project_tasks for update to authenticated
  using ((select public.is_portal_admin())) with check ((select public.is_portal_admin()));
create policy "Administração exclui tarefas" on public.project_tasks for delete to authenticated
  using ((select public.is_portal_admin()));

drop policy if exists "Administração integral" on public.work_diary_entries;
drop policy if exists "Cliente acompanha diário liberado" on public.work_diary_entries;
drop policy if exists "Leitura de diário por perfil" on public.work_diary_entries;
drop policy if exists "Administração insere diário" on public.work_diary_entries;
drop policy if exists "Administração atualiza diário" on public.work_diary_entries;
drop policy if exists "Administração exclui diário" on public.work_diary_entries;
create policy "Leitura de diário por perfil" on public.work_diary_entries
  for select to authenticated using (
    (select public.is_portal_admin()) or (
      client_visible
      and (select public.user_has_project_access(project_id))
      and exists(select 1 from public.project_portal_settings s where s.project_id=work_diary_entries.project_id and s.show_work_diary)
    )
  );
create policy "Administração insere diário" on public.work_diary_entries for insert to authenticated
  with check ((select public.is_portal_admin()));
create policy "Administração atualiza diário" on public.work_diary_entries for update to authenticated
  using ((select public.is_portal_admin())) with check ((select public.is_portal_admin()));
create policy "Administração exclui diário" on public.work_diary_entries for delete to authenticated
  using ((select public.is_portal_admin()));

drop policy if exists "Administração integral" on public.project_portal_settings;
drop policy if exists "Cliente lê configuração do projeto" on public.project_portal_settings;
drop policy if exists "Leitura de configuração por perfil" on public.project_portal_settings;
drop policy if exists "Administração insere configuração" on public.project_portal_settings;
drop policy if exists "Administração atualiza configuração" on public.project_portal_settings;
drop policy if exists "Administração exclui configuração" on public.project_portal_settings;
create policy "Leitura de configuração por perfil" on public.project_portal_settings
  for select to authenticated using (
    (select public.is_portal_admin()) or (select public.user_has_project_access(project_id))
  );
create policy "Administração insere configuração" on public.project_portal_settings for insert to authenticated
  with check ((select public.is_portal_admin()));
create policy "Administração atualiza configuração" on public.project_portal_settings for update to authenticated
  using ((select public.is_portal_admin())) with check ((select public.is_portal_admin()));
create policy "Administração exclui configuração" on public.project_portal_settings for delete to authenticated
  using ((select public.is_portal_admin()));

-- A configuração administrativa também é aplicada no banco, impedindo acesso
-- direto por URL quando um módulo estiver oculto.
do $$
begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='documentos' and policyname='Visibilidade configurada documentos') then
    create policy "Visibilidade configurada documentos" on public.documentos as restrictive
      for select to authenticated using (
        (select public.is_portal_admin()) or exists(
          select 1 from public.project_portal_settings s where s.project_id=documentos.projeto_id and s.show_documents
        )
      );
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='fotos' and policyname='Visibilidade configurada fotos') then
    create policy "Visibilidade configurada fotos" on public.fotos as restrictive
      for select to authenticated using (
        (select public.is_portal_admin()) or exists(
          select 1 from public.project_portal_settings s where s.project_id=fotos.projeto_id and s.show_photos
        )
      );
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='biblioteca' and policyname='Visibilidade configurada biblioteca') then
    create policy "Visibilidade configurada biblioteca" on public.biblioteca as restrictive
      for select to authenticated using (
        (select public.is_portal_admin()) or exists(
          select 1 from public.project_portal_settings s where s.project_id=biblioteca.projeto_id and s.show_library
        )
      );
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='agenda' and policyname='Visibilidade configurada agenda') then
    create policy "Visibilidade configurada agenda" on public.agenda as restrictive
      for select to authenticated using (
        (select public.is_portal_admin()) or exists(
          select 1 from public.project_portal_settings s where s.project_id=agenda.projeto_id and s.show_agenda
        )
      );
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='cronograma' and policyname='Visibilidade configurada cronograma') then
    create policy "Visibilidade configurada cronograma" on public.cronograma as restrictive
      for select to authenticated using (
        (select public.is_portal_admin()) or exists(
          select 1 from public.project_portal_settings s where s.project_id=cronograma.projeto_id and s.show_schedule
        )
      );
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='aprovacoes' and policyname='Visibilidade configurada aprovacoes') then
    create policy "Visibilidade configurada aprovacoes" on public.aprovacoes as restrictive
      for select to authenticated using (
        (select public.is_portal_admin()) or exists(
          select 1 from public.project_portal_settings s where s.project_id=aprovacoes.projeto_id and s.show_approvals
        )
      );
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='solicitacoes' and policyname='Visibilidade configurada solicitacoes') then
    create policy "Visibilidade configurada solicitacoes" on public.solicitacoes as restrictive
      for select to authenticated using (
        (select public.is_portal_admin()) or exists(
          select 1 from public.project_portal_settings s where s.project_id=solicitacoes.projeto_id and s.show_requests
        )
      );
  end if;
end
$$;

create or replace view public.project_financial_summary
with (security_invoker=true)
as
select
  p.id as project_id,
  p.nome as project_name,
  c.contract_number,
  c.contract_value,
  coalesce(sum(case when f.tipo='entrada' and f.status in ('pago','recebido') then f.valor else 0 end),0) as received,
  coalesce(sum(case when f.tipo='entrada' and f.status='pendente' then f.valor else 0 end),0) as receivable,
  coalesce(sum(case when f.tipo='saida' and f.status in ('pago','recebido') then f.valor else 0 end),0) as paid_costs,
  coalesce(sum(case when f.tipo='saida' and f.status='pendente' then f.valor else 0 end),0) as payable,
  coalesce((select sum(ts.hours) from public.timesheets ts where ts.project_id=p.id),0) as hours,
  coalesce((select sum(ts.hours*ts.hourly_cost) from public.timesheets ts where ts.project_id=p.id),0) as labor_cost
from public.projetos p
join public.contratos c on c.id=p.contract_id
left join public.financeiro f on f.projeto_id=p.id
group by p.id,p.nome,c.contract_number,c.contract_value;

grant select on public.project_financial_summary to authenticated;

-- Remove acesso anônimo herdado de funções privilegiadas. As funções públicas
-- continuam disponíveis somente para sessões autenticadas e mantêm suas checagens internas.
do $$
declare fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef
  loop
    execute format('revoke execute on function %s from public, anon',fn.signature);
    execute format('grant execute on function %s to authenticated',fn.signature);
  end loop;
end
$$;

alter default privileges in schema public revoke execute on functions from public, anon;

-- O lembrete diário roda às 08:00 em America/Sao_Paulo (11:00 UTC).
create extension if not exists pg_cron;
do $$
begin
  if not exists(select 1 from cron.job where jobname='cme-operational-reminders') then
    perform cron.schedule(
      'cme-operational-reminders',
      '0 11 * * *',
      'select private.enqueue_operational_reminders()'
    );
  end if;
end
$$;
