create table if not exists public.construction_schedules (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projetos(id) on delete cascade,
  client_id uuid not null references public.clientes(id) on delete cascade,
  contract_id uuid null references public.contratos(id) on delete set null,
  title text not null default 'Cronograma de Obra',
  template_version text not null default 'residencial_v1',
  reference_date date not null default current_date,
  planned_start date null,
  planned_finish date null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.construction_schedule_items (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.construction_schedules(id) on delete cascade,
  code text not null,
  category text not null default 'Obra',
  activity text not null,
  display_order integer not null default 0,
  weight_percent numeric(7,3) not null default 0 check (weight_percent >= 0 and weight_percent <= 100),
  planned_duration_days integer not null default 1 check (planned_duration_days >= 0),
  predecessor_code text null,
  planned_start date null,
  planned_finish date null,
  actual_start date null,
  actual_finish date null,
  actual_progress integer not null default 0 check (actual_progress between 0 and 100),
  planned_cost numeric(14,2) null check (planned_cost is null or planned_cost >= 0),
  actual_cost numeric(14,2) null check (actual_cost is null or actual_cost >= 0),
  status text not null default 'Pendente',
  notes text null,
  is_default boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(schedule_id, code)
);

create index if not exists idx_construction_schedules_client on public.construction_schedules(client_id);
create index if not exists idx_construction_schedules_contract on public.construction_schedules(contract_id);
create index if not exists idx_construction_schedule_items_schedule_order on public.construction_schedule_items(schedule_id, display_order);

alter table public.construction_schedules enable row level security;
alter table public.construction_schedule_items enable row level security;

drop policy if exists construction_schedules_admin_all on public.construction_schedules;
create policy construction_schedules_admin_all on public.construction_schedules for all to authenticated using (public.is_portal_admin()) with check (public.is_portal_admin());

drop policy if exists construction_schedule_items_admin_all on public.construction_schedule_items;
create policy construction_schedule_items_admin_all on public.construction_schedule_items for all to authenticated using (public.is_portal_admin()) with check (public.is_portal_admin());

grant select, insert, update, delete on public.construction_schedules to authenticated;
grant select, insert, update, delete on public.construction_schedule_items to authenticated;
revoke all on public.construction_schedules from anon;
revoke all on public.construction_schedule_items from anon;

create or replace function public.admin_initialize_construction_schedule(p_project_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_project public.projetos%rowtype;
  v_schedule_id uuid;
  v_start date;
begin
  if not public.is_portal_admin() then raise exception 'Acesso negado'; end if;
  select * into v_project from public.projetos where id = p_project_id;
  if not found then raise exception 'Projeto não encontrado'; end if;
  v_start := coalesce(v_project.data_inicio, current_date);

  insert into public.construction_schedules(project_id, client_id, contract_id, title, planned_start, planned_finish, reference_date)
  values (v_project.id, v_project.cliente_id, v_project.contract_id, 'Cronograma de Obra — ' || coalesce(v_project.nome, 'Projeto'), v_start, v_start + 169, current_date)
  on conflict(project_id) do update set client_id=excluded.client_id, contract_id=excluded.contract_id, updated_at=now()
  returning id into v_schedule_id;

  if not exists (select 1 from public.construction_schedule_items where schedule_id=v_schedule_id) then
    insert into public.construction_schedule_items(schedule_id,code,category,activity,display_order,weight_percent,planned_duration_days,predecessor_code,planned_start,planned_finish,status) values
    (v_schedule_id,'01','Planejamento','Mobilização e planejamento executivo',1,2,3,null,v_start,v_start+2,'Pendente'),
    (v_schedule_id,'02','Preliminares','Serviços preliminares e canteiro',2,3,5,'01',v_start+3,v_start+7,'Pendente'),
    (v_schedule_id,'03','Terreno','Terraplenagem e preparação do terreno',3,4,5,'02',v_start+8,v_start+12,'Pendente'),
    (v_schedule_id,'04','Infraestrutura','Fundações',4,8,10,'03',v_start+13,v_start+22,'Pendente'),
    (v_schedule_id,'05','Estrutura','Estrutura',5,12,25,'04',v_start+23,v_start+47,'Pendente'),
    (v_schedule_id,'06','Vedações','Alvenaria e vedações',6,8,15,'05',v_start+48,v_start+62,'Pendente'),
    (v_schedule_id,'07','Cobertura','Cobertura',7,5,10,'06',v_start+63,v_start+72,'Pendente'),
    (v_schedule_id,'08','Instalações','Instalações hidrossanitárias',8,7,15,'06',v_start+63,v_start+77,'Pendente'),
    (v_schedule_id,'09','Instalações','Instalações elétricas, dados e infraestrutura',9,7,15,'06',v_start+63,v_start+77,'Pendente'),
    (v_schedule_id,'10','Proteção','Impermeabilização',10,4,7,'08',v_start+78,v_start+84,'Pendente'),
    (v_schedule_id,'11','Revestimentos','Revestimentos internos',11,8,20,'10',v_start+85,v_start+104,'Pendente'),
    (v_schedule_id,'12','Revestimentos','Revestimentos externos e fachada',12,5,12,'10',v_start+85,v_start+96,'Pendente'),
    (v_schedule_id,'13','Esquadrias','Esquadrias e vidros',13,5,10,'12',v_start+97,v_start+106,'Pendente'),
    (v_schedule_id,'14','Acabamentos','Forros, gesso e sancas',14,4,8,'11',v_start+105,v_start+112,'Pendente'),
    (v_schedule_id,'15','Acabamentos','Pisos, soleiras e rodapés',15,5,10,'11',v_start+105,v_start+114,'Pendente'),
    (v_schedule_id,'16','Acabamentos','Pintura',16,5,10,'14',v_start+115,v_start+124,'Pendente'),
    (v_schedule_id,'17','Acabamentos','Louças, metais e acabamentos finais',17,3,7,'15',v_start+125,v_start+131,'Pendente'),
    (v_schedule_id,'18','Externo','Área externa e paisagismo',18,2,7,'13',v_start+132,v_start+138,'Pendente'),
    (v_schedule_id,'19','Qualidade','Testes, inspeções e comissionamento',19,2,5,'17',v_start+139,v_start+143,'Pendente'),
    (v_schedule_id,'20','Entrega','Limpeza final, as built e entrega',20,1,3,'19',v_start+144,v_start+146,'Pendente');
  end if;
  return v_schedule_id;
end;
$$;

grant execute on function public.admin_initialize_construction_schedule(uuid) to authenticated;
revoke execute on function public.admin_initialize_construction_schedule(uuid) from anon;
