import fs from 'node:fs';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
const db = new PGlite();
const root = new URL('../../', import.meta.url);
const exec = (sql) => db.exec(sql);
const scalar = async (sql) => (await db.query(sql)).rows[0]?.value;
let checks = 0;
const ok = (condition, label) => {assert.ok(condition, label);checks++;};
const rejected = async (sql, label) => {let error;try {await exec(sql);}catch (caught){error=caught;}assert.ok(error,label);checks++;};
const uid='10000000-0000-4000-8000-000000000001';
const approved='10000000-0000-4000-8000-000000000002';
const draft='10000000-0000-4000-8000-000000000003';
const legacy='10000000-0000-4000-8000-000000000004';
const item='10000000-0000-4000-8000-000000000005';
const draftItem='10000000-0000-4000-8000-000000000006';
const legacyItem='10000000-0000-4000-8000-000000000007';
await exec(`create role anon;create role authenticated;create schema auth;
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('app.test_uid',true),'')::uuid$$;
grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
create function public.is_portal_admin() returns boolean language sql as $$select coalesce(current_setting('app.is_admin',true),'false')='true'$$;
create table public.construction_schedules(id uuid primary key,activation_status text,baseline_version integer,baseline_snapshot jsonb);
create table public.construction_schedule_items(id uuid primary key,schedule_id uuid,code text,
 actual_progress integer default 0,actual_cost numeric,actual_start date,actual_finish date,updated_at timestamptz default now());
insert into construction_schedules values
 ('${approved}','approved',1,'{"activities":[{"code":"01"}]}'),
 ('${draft}','draft',0,null),('${legacy}','legacy',0,null);
insert into construction_schedule_items(id,schedule_id,code) values
 ('${item}','${approved}','01'),('${draftItem}','${draft}','01'),('${legacyItem}','${legacy}','01');
-- SELECT FOR UPDATE da RPC exige também a permissão UPDATE sobre o cabeçalho.
grant select,update on public.construction_schedules to authenticated;
grant select,update on public.construction_schedule_items to authenticated;
select set_config('app.test_uid','${uid}',false);select set_config('app.is_admin','true',false);`);
await exec(fs.readFileSync(new URL('supabase/migrations/20260922002000_cronograma_medicoes_auditaveis.sql',root),'utf8'));
await exec(fs.readFileSync(new URL('supabase/migrations/20260922005000_cronograma_bloquear_avanco_sem_medicao.sql',root),'utf8'));
checks += 2;
await exec('set role authenticated');
await rejected(`update construction_schedule_items set actual_progress=90 where id='${item}'`, 'Atualização REST aprovada sem medição precisa falhar');
await rejected(`update construction_schedule_items set actual_cost=999 where id='${item}'`, 'Custo aprovado sem medição precisa falhar');
ok(await scalar(`select actual_progress value from construction_schedule_items where id='${item}'`)===0, 'Nenhum avanço foi adulterado');
await exec(`update construction_schedule_items set actual_progress=20 where id='${draftItem}'`);
ok(await scalar(`select actual_progress value from construction_schedule_items where id='${draftItem}'`)===20, 'Rascunhos permanecem editáveis');
await exec(`update construction_schedule_items set actual_progress=30 where id='${legacyItem}'`);
ok(await scalar(`select actual_progress value from construction_schedule_items where id='${legacyItem}'`)===30, 'Cronogramas históricos não sofrem bloqueio retroativo');
await exec(`select public.admin_record_full_schedule_measurement('${approved}','2026-09-21',
 '[{"code":"01","progress":45,"actual_cost":125}]'::jsonb,'Vistoria realizada com evidência');`);
ok(await scalar(`select actual_progress value from construction_schedule_items where id='${item}'`)===45, 'RPC legítima grava medição e atualiza avanço');
ok(Number(await scalar(`select actual_cost value from construction_schedule_items where id='${item}'`))===125, 'RPC legítima grava custo real');
ok(await scalar(`select count(*)::integer value from construction_schedule_measurements`)===1, 'Medição preservada em histórico');
await rejected(`update construction_schedule_items set actual_progress=99 where id='${item}'`, 'Marcador não pode sobreviver a outra transação REST');
ok(await scalar(`select actual_progress value from construction_schedule_items where id='${item}'`)===45, 'Tentativa posterior não altera o realizado');
await exec(`select set_config('app.is_admin','false',false)`);
await rejected(`select public.admin_record_full_schedule_measurement('${approved}','2026-09-21','[{"code":"01","progress":55}]'::jsonb,'Tentativa sem autorização')`, 'Cliente não consegue usar RPC');
await exec('reset role');
console.log(`BLOQUEIO DE AVANÇO SEM MEDIÇÃO: ${checks} verificações em PostgreSQL sintético aprovadas.`);
