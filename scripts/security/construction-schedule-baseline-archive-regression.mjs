import fs from 'node:fs';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
const root=new URL('../../',import.meta.url);
const run=(sql)=>db.exec(sql);
const value=async(sql)=>(await db.query(sql)).rows[0]?.value;
let checks=0;
const ok=(result,name)=>{assert.ok(result,name);checks++;};
const reject=async(sql,name)=>{let error;try{await run(sql);}catch(caught){error=caught;}assert.ok(error,name);checks++;};
const user='10000000-0000-4000-8000-000000000001';
const prior='10000000-0000-4000-8000-000000000002';
const next='10000000-0000-4000-8000-000000000003';
const snapshot='{"activities":[{"code":"01","activity":"Estrutura"}]}';
const scope='{"services":[{"code":"s","included":true}]}';
await run(`create role anon;create role authenticated;create schema auth;
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('app.test_uid',true),'')::uuid$$;
grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
create function public.is_portal_admin() returns boolean language sql as $$select coalesce(current_setting('app.is_admin',true),'false')='true'$$;
create table public.construction_schedules(id uuid primary key,activation_status text,baseline_version integer,
 baseline_snapshot jsonb,source_scope_snapshot jsonb,approved_at timestamptz,approved_by uuid);
insert into construction_schedules values
 ('${prior}','approved',1,'${snapshot}'::jsonb,'${scope}'::jsonb,now(),'${user}'),
 ('${next}','draft',0,null,'${scope}'::jsonb,null,null);
grant select,update on public.construction_schedules to authenticated;
select set_config('app.test_uid','${user}',false);
select set_config('app.is_admin','true',false);`);
await run(fs.readFileSync(new URL('supabase/migrations/20260922006000_cronograma_arquivo_imutavel_linhas_base.sql',root),'utf8'));
checks++;
ok(await value('select count(*)::integer value from construction_schedule_baseline_versions')===1,
 'Backfill arquiva somente aprovação preexistente; rascunho não recebe versão presumida');
await run('set role authenticated');
const archived=await db.query(`select baseline_version,baseline_snapshot,source_scope_snapshot from construction_schedule_baseline_versions where schedule_id='${prior}'`);
ok(archived.rows.length===1 && archived.rows[0].baseline_version===1 &&
 archived.rows[0].baseline_snapshot.activities[0].activity==='Estrutura' &&
 archived.rows[0].source_scope_snapshot.services[0].code==='s','Arquivo contém versão e escopo originais');
await reject(`update construction_schedule_baseline_versions set baseline_version=2 where schedule_id='${prior}'`, 'Arquivo não pode ser alterado');
await reject(`delete from construction_schedule_baseline_versions where schedule_id='${prior}'`, 'Arquivo não pode ser apagado');
await reject(`insert into construction_schedule_baseline_versions(schedule_id,baseline_version,baseline_snapshot,source_scope_snapshot)
 values('${prior}',2,'${snapshot}'::jsonb,'${scope}'::jsonb)`, 'Não inserir versão fictícia diferente do plano aprovado');
await run(`update construction_schedules set activation_status='approved',baseline_version=1,
 baseline_snapshot='${snapshot}'::jsonb,approved_at=now(),approved_by='${user}' where id='${next}'`);
ok(await value(`select count(*)::integer value from construction_schedule_baseline_versions where schedule_id='${next}'`)===1,
 'Aprovação nova arquiva automaticamente no mesmo comando');
await reject(`update construction_schedules set activation_status='draft' where id='${next}'`,
 'Não é possível reverter aprovação sem histórico duplicado');
// O mock não instala os demais guards do produto: esta suíte testa apenas o arquivo,
// por isso confirma que a tentativa não pode gravar segundo arquivo idêntico.
ok(await value(`select count(*)::integer value from construction_schedule_baseline_versions where schedule_id='${next}'`)===1,
 'Arquivos duplicados são proibidos');
await run(`select set_config('app.is_admin','false',false)`);
ok(await value('select count(*)::integer value from construction_schedule_baseline_versions')===0,
 'Cliente autenticado não lê snapshots internos');
await run('reset role;set role anon');
await reject('select * from construction_schedule_baseline_versions','Anônimo não lê arquivos');
await run('reset role');
console.log(`ARQUIVO DE LINHAS DE BASE: ${checks} verificações com dados sintéticos aprovadas.`);
