// Regressão A06/A07/A08 — aplica a migração real em PostgreSQL (PGlite) com a
// estrutura de project_tasks/projetos da produção.
// Uso: CME_PGLITE_ROOT=<pasta com @electric-sql/pglite> node scripts/security/project-tasks-integrity-regression.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = process.env.CME_PGLITE_ROOT || process.cwd();
const require = createRequire(path.join(root, 'package.json'));
const { PGlite } = await import(require.resolve('@electric-sql/pglite'));
const migration = fs.readFileSync(new URL('../../supabase/migrations/20261108050000_project_tasks_integrity.sql', import.meta.url), 'utf8');
const db = new PGlite();
const ADMIN = '00000000-0000-4000-8000-0000000000ad';
const P1 = '11111111-1111-4111-8111-111111111111', P2 = '22222222-2222-4222-8222-222222222222';
await db.exec(`
create schema auth; create schema private; create role anon; create role authenticated;
create table auth.users(id uuid primary key); insert into auth.users values ('${ADMIN}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true),'')::uuid $$;
create function public.is_portal_admin() returns boolean language sql stable as $$ select auth.uid() = '${ADMIN}'::uuid $$;
create table public.projetos(id uuid primary key, progress_percent numeric check (progress_percent is null or (progress_percent >= 0 and progress_percent <= 100)));
create table public.project_tasks(
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projetos(id) on delete cascade,
  parent_task_id uuid references public.project_tasks(id) on delete cascade,
  title text not null check (length(btrim(title)) between 3 and 180), description text,
  status text not null default 'todo' check (status = any (array['todo','doing','blocked','done','cancelled'])),
  priority text not null default 'normal' check (priority = any (array['low','normal','high','urgent'])),
  start_date date, due_date date check (due_date is null or start_date is null or due_date >= start_date), completed_at timestamptz,
  estimated_hours numeric check (estimated_hours is null or estimated_hours >= 0), weight numeric not null default 1 check (weight > 0),
  assignee_user_id uuid, client_visible boolean not null default false, position integer not null default 0,
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.project_task_dependencies(
  task_id uuid not null references public.project_tasks(id) on delete cascade,
  depends_on_task_id uuid not null references public.project_tasks(id) on delete cascade,
  created_at timestamptz not null default now(), primary key (task_id, depends_on_task_id), check (task_id <> depends_on_task_id));
-- trigger original da produção (o corpo é substituído pela migração)
create function private.recalculate_project_task_progress() returns trigger language plpgsql as $$ begin return coalesce(new,old); end $$;
create trigger trg_project_task_progress after insert or delete or update of status, weight on public.project_tasks
  for each row execute function private.recalculate_project_task_progress();
insert into public.projetos values ('${P1}', null), ('${P2}', 40);
`);
await db.exec(migration); await db.exec(migration);
const q = async (sql) => (await db.query(sql)).rows;
const one = async (sql) => (await q(sql))[0];
const rejects = async (sql, re, msg) => assert.rejects(db.query(sql), (e) => { assert.match(String(e.message), re, msg); return true; }, msg);
const task = async (project, title, extra = '') => (await one(`insert into public.project_tasks(project_id,title${extra ? ',' + extra.split('=')[0] : ''}) values ('${project}','${title}'${extra ? ",'" + extra.split('=')[1] + "'" : ''}) returning id`)).id;

// ---- A07
const a = await task(P1, 'Tarefa A'), b = await task(P1, 'Tarefa B'), c = await task(P1, 'Tarefa C'), other = await task(P2, 'Outra obra');
await db.query(`insert into public.project_task_dependencies values ('${b}','${a}')`);
await db.query(`insert into public.project_task_dependencies values ('${c}','${b}')`);
await rejects(`insert into public.project_task_dependencies values ('${a}','${c}')`, /ciclo/, 'ciclo indireto A→C→B→A recusado');
await rejects(`insert into public.project_task_dependencies values ('${a}','${other}')`, /mesmo projeto/, 'dependência entre projetos recusada');
await rejects(`update public.project_tasks set parent_task_id='${other}' where id='${a}'`, /mesmo projeto/, 'subtarefa de outro projeto recusada');
await db.query(`update public.project_tasks set parent_task_id='${a}' where id='${b}'`);
await rejects(`update public.project_tasks set parent_task_id='${b}' where id='${a}'`, /ciclo/, 'ciclo de hierarquia recusado');

// ---- A08
await db.query(`update public.project_tasks set status='done' where id='${a}'`);
assert.equal(Number((await one(`select progress_percent from public.projetos where id='${P1}'`)).progress_percent), 33.33);
assert.equal((await one(`select progress_source from public.projetos where id='${P1}'`)).progress_source, 'tasks');
await db.query(`delete from public.project_tasks where project_id='${P1}'`);
assert.equal((await one(`select progress_percent from public.projetos where id='${P1}'`)).progress_percent, null, 'sem tarefas o progresso por tarefas deixa de valer');
// Progresso manual não é apagado quando não há tarefas ativas.
await db.query(`update public.projetos set progress_percent=40 where id='${P2}'`);
await db.query(`update public.project_tasks set status='cancelled' where id='${other}'`);
assert.equal(Number((await one(`select progress_percent from public.projetos where id='${P2}'`)).progress_percent), 40, 'progresso manual preservado');
assert.equal((await one(`select progress_source from public.projetos where id='${P2}'`)).progress_source, 'manual');

// ---- A06
await db.exec(`set test.uid='${ADMIN}'`);
const base = await task(P1, 'Base');
const data = JSON.stringify({ project_id: P1, title: 'Nova tarefa', priority: 'high', weight: 2, client_visible: true, dependency_id: base });
const req = '33333333-3333-4333-8333-333333333333';
const id1 = (await one(`select public.admin_create_project_task('${data}','${req}') id`)).id;
const id2 = (await one(`select public.admin_create_project_task('${data}','${req}') id`)).id;
assert.equal(id1, id2, 'repetição devolve a mesma tarefa');
assert.equal(Number((await one(`select count(*) n from public.project_tasks where title='Nova tarefa'`)).n), 1);
assert.equal(Number((await one(`select count(*) n from public.project_task_dependencies where task_id='${id1}'`)).n), 1);
// Dependência inválida desfaz a tarefa inteira (transação única).
const bad = JSON.stringify({ project_id: P1, title: 'Tarefa inválida', dependency_id: other });
await rejects(`select public.admin_create_project_task('${bad}','44444444-4444-4444-8444-444444444444')`, /mesmo projeto/, 'dependência inválida recusada');
assert.equal(Number((await one(`select count(*) n from public.project_tasks where title='Tarefa inválida'`)).n), 0, 'nenhuma tarefa órfã após falha');
await rejects(`select public.admin_create_project_task('${JSON.stringify({ project_id: P1, title: 'Outro título' })}','${req}')`, /já foi usada/, 'reuso da solicitação com outros dados recusado');
await db.exec(`reset test.uid`);
await rejects(`select public.admin_create_project_task('${data}','55555555-5555-4555-8555-555555555555')`, /administrativo/, 'somente administradora');

console.log('PASS (A06/A07/A08): tarefa e dependência atômicas e idempotentes, ciclos e projetos cruzados recusados no banco, progresso vazio tratado sem apagar progresso manual.');
