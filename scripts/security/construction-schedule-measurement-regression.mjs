import fs from 'node:fs';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const root = new URL('../../', import.meta.url);
let checks = 0;
const exec = (query) => db.exec(query);
const val = async (query) => (await db.query(query)).rows[0]?.value;
function ok(value, message) { assert.ok(value, message); checks++; }
async function reject(query, message) { let error; try { await exec(query); } catch (failure) { error = failure; } assert.ok(error, message); checks++; }
const me = '10000000-0000-4000-8000-000000000001';
const schedule = '10000000-0000-4000-8000-000000000002';
const draft = '10000000-0000-4000-8000-000000000003';
const item1 = '10000000-0000-4000-8000-000000000004';
const item2 = '10000000-0000-4000-8000-000000000005';
const foreign = '10000000-0000-4000-8000-000000000006';
const measured = '2026-09-21';
const json = (object) => `'${JSON.stringify(object).replaceAll("'", "''")}'::jsonb`;
const entry = (code, progress, cost = null) => ({ code, progress, actual_cost: cost });
const record = (day, entries, reason = 'Medição vistoriada e registrada') =>
  `select public.admin_record_full_schedule_measurement('${schedule}', '${day}', ${json(entries)}, '${reason}')`;
await exec(`create role anon; create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('app.test_uid',true),'')::uuid$$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
create function public.is_portal_admin() returns boolean language sql as $$select coalesce(current_setting('app.is_admin',true),'false')='true'$$;
create table public.construction_schedules(id uuid primary key,activation_status text,baseline_version integer,baseline_snapshot jsonb);
create table public.construction_schedule_items(id uuid primary key,schedule_id uuid,code text,actual_progress integer default 0,
 actual_cost numeric,actual_start date,actual_finish date,updated_at timestamptz default now());
insert into construction_schedules values ('${schedule}','approved',1,'{"activities":[{"code":"01"}]}'),('${draft}','draft',0,null);
insert into construction_schedule_items(id,schedule_id,code) values
 ('${item1}','${schedule}','01'),('${item2}','${schedule}','02'),('${foreign}','${draft}','01');
-- A RPC SECURITY INVOKER usa SELECT ... FOR UPDATE, que exige UPDATE também.
-- Este GRANT reproduz a configuração verificada no projeto publicado sem mudar a produção.
grant select,update on public.construction_schedules to authenticated;
grant select,update on public.construction_schedule_items to authenticated;
select set_config('app.is_admin','true',false);
select set_config('app.test_uid','${me}',false);`);
await exec(fs.readFileSync(new URL('supabase/migrations/20260922002000_cronograma_medicoes_auditaveis.sql',root),'utf8'));
checks++;
const policy = await db.query(`select policyname,cmd,roles::text from pg_policies where tablename='construction_schedule_measurements' order by policyname`);
ok(policy.rows.length === 2 && policy.rows.every((row) => String(row.roles).includes('authenticated')), 'Somente policies autenticadas/admin');
const grants = await db.query(`select grantee,privilege_type from information_schema.role_table_grants where table_name='construction_schedule_measurements' and grantee in ('anon','authenticated')`);
ok(grants.rows.every((row) => row.grantee==='authenticated' && ['SELECT','INSERT'].includes(row.privilege_type)), 'Sem leitura anônima ou alteração/apagamento do histórico');
await exec('set role authenticated');
await reject(`select public.admin_record_full_schedule_measurement('${draft}','${measured}',${json([entry('01',20)])},'Rascunho rejeitado')`, 'Rascunho não admite medição');
await reject(record('2026-09-21',[entry('99',20)]),'Atividade inexistente');
await reject(record('2026-09-21',[entry('01',10),entry('01',50)]),'Repetição de atividade na transação');
await reject(record('2099-01-01',[entry('01',50)]),'Data futura não é medição real');
await reject(record('2026-09-21',[entry('01',101)]),'Progresso inválido');
await reject(record('2026-09-21',[entry('01',50,-10)]),'Custo negativo');
await reject(record('2026-09-21',[entry('01',50)],'Curta'),'Justificativa insuficiente');
await reject(record('2026-09-21',[entry('01',50),entry('99',10)]),'Falha na segunda atividade deve desfazer a primeira');
ok(await val(`select count(*)::integer value from construction_schedule_measurements`) === 0, 'Falha atômica sem evento órfão');
ok(await val(`select actual_progress value from construction_schedule_items where id='${item1}'`) === 0, 'Falha não modifica avanço corrente');
await exec(record(measured,[entry('01',40,120),entry('02',10,null)]));
ok(await val(`select count(*)::integer value from construction_schedule_measurements`) === 2,'Duas medições históricas inseridas');
ok(await val(`select actual_progress value from construction_schedule_items where id='${item1}'`) === 40,'Avanço corrente atualizado');
ok(Number(await val(`select actual_cost value from construction_schedule_items where id='${item1}'`)) === 120,'Custo real cumulativo atualizado');
ok(await val(`select actual_cost value from construction_schedule_items where id='${item2}'`) === null,'Custo não informado continua desconhecido');
await exec(record('2026-09-20',[entry('01',20,80)],'Registro retroativo justificado por relatório'));
ok(await val(`select actual_progress value from construction_schedule_items where id='${item1}'`) === 40,'Registro retroativo não rebaixa status atual');
await exec(record(measured,[entry('01',45,125)],'Correção expressa registrada com evidência'));
ok(await val(`select count(*)::integer value from construction_schedule_measurements where item_id='${item1}'`) === 3,'Correção adiciona versão do evento');
ok(await val(`select actual_progress value from construction_schedule_items where id='${item1}'`) === 45,'Correção da data corrente atualiza retrato');
await reject(`update public.construction_schedule_measurements set actual_progress=5 where item_id='${item1}'`,'Aplicativo não edita eventos');
await reject(`delete from public.construction_schedule_measurements where item_id='${item1}'`,'Aplicativo não apaga eventos');
await exec(`select set_config('app.is_admin','false',false)`);
await reject(record(measured,[entry('01',50)]),'Autenticado não administrador é recusado na RPC');
ok(await val(`select count(*)::integer value from construction_schedule_measurements`) === 0,'RLS oculta histórico de não administrador');
await exec('reset role;set role anon;');
await reject(`select * from public.construction_schedule_measurements`, 'Anônimo não pode ler medições');
await reject(record(measured,[entry('01',50)]), 'Anônimo não pode executar RPC');
await exec('reset role;');
console.log(`HISTÓRICO DE MEDIÇÕES: ${checks} verificações com dados fictícios aprovadas.`);
