import fs from 'node:fs';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';

// Banco efêmero: cronograma completo de USO INTERNO (obra sem cronograma
// completo contratado), migração formal do legado e bloqueio de publicação.
const db = new PGlite();
const root = new URL('../../', import.meta.url);
let checks = 0;
const sql = (q) => db.exec(q);
const scalar = async (q) => (await db.query(q)).rows[0]?.value;
const ok = (c, d) => { assert.ok(c, d); checks += 1; };
const fails = async (q, pattern) => {
  let error = null;
  try { await sql(q); } catch (cause) { error = cause; }
  assert.ok(error, `Deveria bloquear: ${q.slice(0, 120)}`);
  if (pattern) assert.match(String(error.message), pattern);
  checks += 1;
};
const json = (v) => `'${JSON.stringify(v).replaceAll("'", "''")}'::jsonb`;
const admin = '30000000-0000-4000-8000-000000000001';
const client = '30000000-0000-4000-8000-000000000002';
const contract = '30000000-0000-4000-8000-000000000003';
const project = '30000000-0000-4000-8000-000000000004';
const contracted = '30000000-0000-4000-8000-000000000005';
const legacy = '30000000-0000-4000-8000-000000000006';

await sql(`
create role anon; create role authenticated; create role service_role;
create schema auth; create schema private;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('cme.uid',true),'')::uuid $$;
create function public.is_portal_admin() returns boolean language sql stable as $$ select coalesce(auth.uid()='${admin}'::uuid,false) $$;
create table public.clientes(id uuid primary key);
create table public.contratos(id uuid primary key);
create table public.projetos(id uuid primary key, cliente_id uuid not null, contract_id uuid, nome text, data_fim date);
create table public.commercial_records(id uuid primary key default gen_random_uuid(), linked_project_id uuid, source_project_id uuid, services jsonb);
create table public.documentos(id uuid primary key, projeto_id uuid, contract_id uuid, document_kind text, superseded_by uuid,
  snapshot_frozen_at timestamptz, version text, versao text, generated_data jsonb not null default '{}'::jsonb);
create table public.document_acceptances(id uuid primary key default gen_random_uuid(), document_id uuid, document_version text, decision text, accepted_at timestamptz default now());
create table public.audit_log(user_id uuid, action text, entity_type text, entity_id uuid, details jsonb);
create table public.construction_schedule_templates(template_code text, template_version integer, active boolean default true);
create table public.construction_schedule_template_items(template_code text, template_version integer, code text, category text, activity text,
  display_order integer, reference_weight_percent numeric, reference_duration_days integer, predecessor_code text);
create table public.construction_schedules(
  id uuid primary key default gen_random_uuid(), project_id uuid not null, client_id uuid, contract_id uuid,
  quote_record_id uuid, contract_record_id uuid, source_scope_snapshot jsonb, title text, notes text,
  planned_start date, planned_finish date, reference_date date, activation_status text not null default 'legacy',
  revision_number integer not null default 1, supersedes_schedule_id uuid, revision_reason text,
  is_current boolean not null default true, work_calendar text, weight_source text,
  baseline_version integer not null default 0, baseline_snapshot jsonb, approved_at timestamptz, approved_by uuid,
  updated_at timestamptz default now(), created_at timestamptz default now());
create unique index on public.construction_schedules(project_id) where is_current is true;
create unique index on public.construction_schedules(project_id, revision_number);
create table public.construction_schedule_items(
  id uuid primary key default gen_random_uuid(), schedule_id uuid, code text, category text, activity text, display_order integer,
  weight_percent numeric, planned_duration_days integer, predecessor_code text, planned_start date, planned_finish date,
  planned_cost numeric, actual_progress numeric, status text, is_default boolean, source_service_code text,
  weight_source text, cost_source text, quantity numeric, unit text, unit_cost numeric);
create table public.construction_schedule_measurements(id uuid primary key default gen_random_uuid(), schedule_id uuid, item_id uuid,
  actual_progress numeric, measured_on date, recorded_at timestamptz default now());
create table public.construction_schedule_publications(id uuid primary key default gen_random_uuid(), project_id uuid, schedule_id uuid,
  baseline_version integer, published_snapshot jsonb, published_by uuid, revoked_at timestamptz, revoked_by uuid, revoke_reason text);
create table public.project_portal_settings(project_id uuid, show_schedule boolean);
create function public.assert_full_schedule_commercial_link(uuid,uuid,uuid) returns jsonb language plpgsql as $b$
begin
  if $2 is null or $3 is null then raise exception 'Orçamento e contrato comerciais são obrigatórios'; end if;
  return jsonb_build_object('quote',$2,'contract',$3,'services',jsonb_build_array(jsonb_build_object('code','s','included',true)));
end $b$;
create function public.admin_set_construction_schedule_holidays(uuid,jsonb) returns void language plpgsql as $b$ begin return; end $b$;
create function public.admin_set_full_schedule_physical_weights(uuid,jsonb) returns void language plpgsql as $b$ begin return; end $b$;
create function public.full_schedule_planned_percent_at(uuid,date) returns numeric language sql as $b$ select 0::numeric $b$;
create function public.full_schedule_measured_percent_at(uuid,date) returns numeric language sql as $b$ select 0::numeric $b$;
`);
// Funções reais em produção, na versão anterior a esta mudança.
for (const file of [
  '20260924012000_schedule_from_accepted_additional_service.sql',
  '20260924155500_fix_additional_service_schedule_save.sql',
  '20260924160000_fix_additional_service_schedule_guard.sql',
]) await sql(fs.readFileSync(new URL(`supabase/migrations/${file}`, root), 'utf8'));
const extract = (file, fn) => {
  const text = fs.readFileSync(new URL(`supabase/migrations/${file}`, root), 'utf8');
  const m = text.match(new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${fn}\\s*\\([\\s\\S]*?\\$(\\w*)\\$[\\s\\S]*?\\$\\1\\$\\s*;`, 'i'));
  assert.ok(m, `${fn} em ${file}`); return m[0];
};
await sql(extract('20260921183000_cronograma_planejamento_aprovacao_linha_base.sql', 'guard_full_schedule_approval'));
await sql(extract('20260922234500_cronograma_revisoes_aditivos.sql', 'guard_construction_schedule_revision_metadata'));
await sql(extract('20260922234500_cronograma_revisoes_aditivos.sql', 'promote_approved_construction_schedule_revision'));
await sql(extract('20260923000500_cronograma_publicacao_curva_cliente.sql', 'admin_publish_full_schedule_to_client'));
await sql(`
create trigger construction_schedule_commercial_guard before insert or update of project_id, client_id, contract_id, quote_record_id, contract_record_id, source_scope_snapshot
  on public.construction_schedules for each row execute function public.guard_construction_schedule_creation();
create trigger construction_schedule_revision_metadata_guard before insert or update of revision_number, supersedes_schedule_id, revision_reason, project_id
  on public.construction_schedules for each row execute function public.guard_construction_schedule_revision_metadata();
create trigger full_schedule_approval_guard before insert or update of activation_status, project_id, client_id, contract_id, quote_record_id, contract_record_id, source_scope_snapshot, work_calendar, weight_source, planned_start, planned_finish, baseline_snapshot, baseline_version
  on public.construction_schedules for each row execute function public.guard_full_schedule_approval();
create trigger zz_promote_approved_construction_schedule_revision after update of activation_status
  on public.construction_schedules for each row execute function public.promote_approved_construction_schedule_revision();
insert into public.clientes values('${client}'); insert into public.contratos values('${contract}');
insert into public.projetos values('${project}','${client}','${contract}','Obra sem contrato',null),('${contracted}','${client}','${contract}','Obra contratada',null);
insert into public.construction_schedule_templates values('residential_reference',1,true);
insert into public.construction_schedule_template_items values('residential_reference',1,'01','Planejamento','Mobilização',1,10,5,null);
alter table public.construction_schedules add constraint construction_schedule_activation_valid check (activation_status in ('legacy','draft','approved'));
`);
// Legado existente antes da migração (como o do Vitalle), criado sem os guardas.
await sql(`alter table public.construction_schedules disable trigger user;
insert into public.construction_schedules(id,project_id,client_id,contract_id,title,activation_status,revision_number,is_current)
values('${legacy}','${project}','${client}','${contract}','Legado','legacy',1,true);
insert into public.construction_schedule_items(schedule_id,code,activity,display_order,weight_percent) values('${legacy}','01','Atividade legada',1,100);
alter table public.construction_schedules enable trigger user;`);

await sql(fs.readFileSync(new URL('supabase/migrations/20261108110000_full_schedule_internal_without_contract.sql', root), 'utf8'));
checks += 1;

await sql(`select set_config('cme.uid','${admin}',false)`);
const snap = (await db.query(`select public.assert_full_schedule_without_contract('${project}') d`)).rows[0].d;
ok(snap.authorization_type === 'obra_sem_contrato' && snap.client_visibility === 'internal_only', 'Snapshot identifica uso interno');

await sql(`insert into public.commercial_records(linked_project_id,services) values('${contracted}','[{"code":"s","included":true}]')`);
await fails(`select public.assert_full_schedule_without_contract('${contracted}')`, /cronograma completo contratado/i);
await sql(`insert into public.commercial_records(linked_project_id,services) values('${project}','[{"code":"c","included":true},{"code":"s","included":false}]')`);
ok(Boolean(await scalar(`select public.assert_full_schedule_without_contract('${project}')::text value`)), 'Contrato sem o serviço "s" não impede o uso interno');

const preview = (await db.query(`select public.admin_preview_full_schedule_template_without_contract('${project}','residential_reference') d`)).rows[0].d;
ok(preview.internal_only === true && preview.items.length === 1, 'Prévia do modelo para uso interno');

const plan = {
  scope_confirmed: true, calendar: 'weekdays', weight_source: 'construction_costs', holidays: [], physical_weights: [],
  planned_start: '2026-11-09', planned_finish: '2026-12-04',
  items: [
    { code: '01', activity: 'Mobilização', planned_duration_days: 5, planned_start: '2026-11-09', planned_finish: '2026-11-13', planned_cost: 100, weight_percent: 10, cost_source: 'Custo interno', source_service_code: 'obra' },
    { code: '02', activity: 'Fundações', predecessor_code: '01', planned_duration_days: 5, planned_start: '2026-11-16', planned_finish: '2026-11-20', planned_cost: 200, weight_percent: 20, cost_source: 'Custo interno', source_service_code: 'obra' },
    { code: '03', activity: 'Estrutura', predecessor_code: '02', planned_duration_days: 10, planned_start: '2026-11-23', planned_finish: '2026-12-04', planned_cost: 700, weight_percent: 70, cost_source: 'Custo interno', source_service_code: 'obra' },
  ],
};
await fails(`select public.admin_initialize_and_save_full_schedule_without_contract('${project}',${json(plan)},'curto')`, /motivo/i);
const created = await scalar(`select public.admin_initialize_and_save_full_schedule_without_contract('${project}',${json(plan)},'Obra sem contrato: controle interno de custos')::text value`);
ok(Boolean(created), 'Cronograma interno criado a partir do legado');
ok(await scalar(`select is_current::text value from public.construction_schedules where id='${legacy}'`) === 'false', 'Legado deixa de ser vigente');
ok(await scalar(`select count(*)::int value from public.construction_schedule_items where schedule_id='${legacy}'`) === 1, 'Atividades do legado preservadas');
ok(await scalar(`select (revision_number=2 and supersedes_schedule_id='${legacy}' and is_current)::text value from public.construction_schedules where id='${created}'`) === 'true', 'Nova versão sucede formalmente o legado');
ok(await scalar(`select count(*)::int value from public.construction_schedule_items where schedule_id='${created}'`) === 3, 'Plano gravado');
ok(await scalar(`select count(*)::int value from public.audit_log where action='migrate_legacy_schedule_internal'`) === 1, 'Migração auditada');
const again = await scalar(`select public.admin_initialize_and_save_full_schedule_without_contract('${project}',${json(plan)},'Obra sem contrato: controle interno de custos')::text value`);
ok(again === created, 'Repetição reaproveita o mesmo rascunho');

await fails(`select public.admin_initialize_and_save_full_schedule_without_contract('${project}',${json({ ...plan, items: plan.items.map((i) => ({ ...i, source_service_code: 's' })) })},'Obra sem contrato: controle interno de custos')`, /não pertence ao serviço/i);

await sql(`update public.construction_schedules set activation_status='approved' where id='${created}'`);
ok(await scalar(`select (activation_status='approved' and baseline_version=1 and is_current)::text value from public.construction_schedules where id='${created}'`) === 'true', 'Linha de base interna aprovada e vigente');
await sql(`insert into public.project_portal_settings values('${project}',true)`);
await fails(`select public.admin_publish_full_schedule_to_client('${created}')`, /não é publicado ao cliente/i);
await fails(`select public.admin_initialize_and_save_full_schedule_without_contract('${project}',${json(plan)},'Obra sem contrato: controle interno de custos')`, /aprovado vigente/i);
await fails(`update public.construction_schedules set quote_record_id=gen_random_uuid() where id='${created}'`);

// Caminho contratual (serviço "s" contratado) continua funcionando igual.
const quote = '30000000-0000-4000-8000-000000000011', con = '30000000-0000-4000-8000-000000000012';
const commercial = await scalar(`insert into public.construction_schedules(project_id,client_id,contract_id,quote_record_id,contract_record_id,title,activation_status,revision_number,is_current)
  values('${contracted}','${client}','${contract}','${quote}','${con}','Contratado','draft',1,true) returning id::text value`);
ok(Boolean(commercial), 'Cronograma contratado criado com orçamento + contrato');
await sql(`select public.admin_save_full_schedule_plan('${commercial}',${json({ ...plan, items: plan.items.map((i) => ({ ...i, source_service_code: 's' })) })})`);
await sql(`update public.construction_schedules set activation_status='approved' where id='${commercial}'`);
ok(await scalar(`select activation_status value from public.construction_schedules where id='${commercial}'`) === 'approved', 'Aprovação contratual inalterada');
await sql(`insert into public.project_portal_settings values('${contracted}',true)`);
ok(Boolean(await scalar(`select public.admin_publish_full_schedule_to_client('${commercial}')::text value`)), 'Cronograma contratado continua publicável ao cliente');

await sql(`select set_config('cme.uid','',false)`);
await fails(`select public.assert_full_schedule_without_contract('${project}')`, /administrativo/i);
// D05: SS/FF/defasagem (migração seguinte), sobre o mesmo banco efêmero.
await sql(`select set_config('cme.uid','${admin}',false)`);
await sql(fs.readFileSync(new URL('supabase/migrations/20261108120000_full_schedule_ss_ff_lag.sql', root), 'utf8'));
ok(await scalar(`select count(*)::int value from public.construction_schedule_items where dependency_type='FS' and lag_days=0`) >= 1, 'Itens existentes ficam FS sem defasagem');
const project2 = '30000000-0000-4000-8000-000000000021';
await sql(`insert into public.projetos values('${project2}','${client}','${contract}','Obra D05',null)`);
const typedPlan = { ...plan, planned_finish: '2026-11-20', items: [
  { code: 'A', activity: 'Estrutura', planned_duration_days: 5, planned_start: '2026-11-09', planned_finish: '2026-11-13', planned_cost: 600, weight_percent: 60, cost_source: 'Custo interno', source_service_code: 'obra' },
  { code: 'B', activity: 'Instalações', predecessor_code: 'A', dependency_type: 'SS', lag_days: 2, planned_duration_days: 3, planned_start: '2026-11-11', planned_finish: '2026-11-13', planned_cost: 300, weight_percent: 30, cost_source: 'Custo interno', source_service_code: 'obra' },
  { code: 'C', activity: 'Limpeza', predecessor_code: 'A', dependency_type: 'FS', lag_days: 4, planned_duration_days: 2, planned_start: '2026-11-19', planned_finish: '2026-11-20', planned_cost: 100, weight_percent: 10, cost_source: 'Custo interno', source_service_code: 'obra' },
] };
const typedId = await scalar(`select public.admin_initialize_and_save_full_schedule_without_contract('${project2}',${json(typedPlan)},'Teste de dependências SS e FS com defasagem')::text value`);
ok(await scalar(`select string_agg(code||dependency_type||lag_days,',' order by code) value from public.construction_schedule_items where schedule_id='${typedId}'`) === 'AFS0,BSS2,CFS4', 'Tipos e defasagens gravados');
await sql(`update public.construction_schedules set activation_status='approved' where id='${typedId}'`);
ok(await scalar(`select activation_status value from public.construction_schedules where id='${typedId}'`) === 'approved', 'Aprovação aceita SS e FS com defasagem coerentes');
const project3 = '30000000-0000-4000-8000-000000000022';
await sql(`insert into public.projetos values('${project3}','${client}','${contract}','Obra D05 inválida',null)`);
const wrong = { ...typedPlan, items: typedPlan.items.map((i) => i.code === 'B' ? { ...i, planned_start: '2026-11-09', planned_finish: '2026-11-11' } : i) };
await fails(`select public.admin_initialize_and_save_full_schedule_without_contract('${project3}',${json({ ...wrong, planned_start: '2026-11-09' })},'Teste de dependências SS e FS com defasagem')`, /Predecessora inexistente ou data conflitante/i);
await fails(`select public.admin_initialize_and_save_full_schedule_without_contract('${project3}',${json({ ...typedPlan, items: typedPlan.items.map((i) => i.code === 'A' ? { ...i, lag_days: 3 } : i) })},'Teste de dependências SS e FS com defasagem')`, /defasagem/i);
await fails(`select public.admin_initialize_and_save_full_schedule_without_contract('${project3}',${json({ ...typedPlan, items: typedPlan.items.map((i) => i.code === 'B' ? { ...i, dependency_type: 'XX' } : i) })},'Teste de dependências SS e FS com defasagem')`, /dependência/i);
await sql(`select set_config('cme.uid','',false)`);

console.log(`CRONOGRAMA INTERNO (OBRA SEM CONTRATO): ${checks} verificações passaram em PostgreSQL efêmero.`);
