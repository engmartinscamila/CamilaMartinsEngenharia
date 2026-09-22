import fs from 'node:fs';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
const root=new URL('../../',import.meta.url);
const run=(sql)=>db.exec(sql);
const scalar=async(sql)=>(await db.query(sql)).rows[0]?.value;
let checks=0;
const ok=(value,label)=>{assert.ok(value,label);checks++;};
const reject=async(sql,label)=>{let error;try{await run(sql);}catch(caught){error=caught;}assert.ok(error,label);checks++;};
const user='10000000-0000-4000-8000-000000000001';
const invalid='10000000-0000-4000-8000-000000000002';
const valid='10000000-0000-4000-8000-000000000003';
const calendar='10000000-0000-4000-8000-000000000004';
const quote='10000000-0000-4000-8000-000000000005';
const contract='10000000-0000-4000-8000-000000000006';
const json=(data)=>`'${JSON.stringify(data).replaceAll("'","''")}'::jsonb`;
const item=(finish='2026-09-23',duration=2)=>({code:'01',planned_start:'2026-09-21',planned_finish:finish,planned_duration_days:duration});
const plan=(holidays,workCalendar='weekdays',finish='2026-09-23',duration=2)=>({
 calendar:workCalendar,planned_start:'2026-09-21',planned_finish:finish,holidays,
 items:[item(finish,duration)],
});
const record=(schedule,content)=>`select public.admin_initialize_and_save_full_schedule('${schedule}','${quote}','${contract}',${json(content)})`;
await run(`create role anon;create role authenticated;create schema auth;
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('app.test_uid',true),'')::uuid$$;
grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
create function public.is_portal_admin() returns boolean language sql as $$select coalesce(current_setting('app.is_admin',true),'false')='true'$$;
create table public.construction_schedules(id uuid primary key,activation_status text,planned_start date,planned_finish date,
 work_calendar text,baseline_version integer default 0,baseline_snapshot jsonb,source_scope_snapshot jsonb,
 approved_at timestamptz,approved_by uuid);
create table public.construction_schedule_items(id uuid primary key default gen_random_uuid(),schedule_id uuid,
 planned_start date,planned_finish date,planned_duration_days integer);
create function public.admin_initialize_construction_schedule(p_project uuid,p_quote uuid,p_contract uuid) returns uuid
 language plpgsql as $$begin
 insert into public.construction_schedules(id,activation_status,source_scope_snapshot)
 values(p_project,'draft','{"services":[{"code":"s","included":true}]}'::jsonb);
 return p_project;
 end$$;
create function public.admin_save_full_schedule_plan(p_schedule uuid,p_plan jsonb) returns uuid
 language plpgsql as $$begin
 update public.construction_schedules set planned_start=(p_plan->>'planned_start')::date,
 planned_finish=(p_plan->>'planned_finish')::date,work_calendar=p_plan->>'calendar' where id=p_schedule;
 insert into public.construction_schedule_items(schedule_id,planned_start,planned_finish,planned_duration_days)
 select p_schedule,(activity->>'planned_start')::date,(activity->>'planned_finish')::date,
 (activity->>'planned_duration_days')::integer from jsonb_array_elements(p_plan->'items') activity;
 return p_schedule;
 end$$;
create function public.mock_base_approval() returns trigger language plpgsql as $$begin
 if NEW.activation_status='approved' and OLD.activation_status<>'approved' then
 NEW.baseline_version=1;NEW.baseline_snapshot=jsonb_build_object('activities',
 (select jsonb_agg(jsonb_build_object('code','01','activity','Fundação'))
 from public.construction_schedule_items where schedule_id=NEW.id));
 NEW.approved_at=now();NEW.approved_by=auth.uid();end if;
 return NEW;end$$;
create trigger aa_mock_base_approval before update of activation_status on public.construction_schedules
 for each row execute function public.mock_base_approval();
grant select,insert,update,delete on public.construction_schedules,public.construction_schedule_items to authenticated;
select set_config('app.test_uid','${user}',false);select set_config('app.is_admin','true',false);`);
await run(fs.readFileSync(new URL('supabase/migrations/20260922010000_cronograma_arquivo_imutavel_linhas_base.sql',root),'utf8'));
await run(fs.readFileSync(new URL('supabase/migrations/20260922011000_cronograma_feriados_conferidos.sql',root),'utf8'));
checks+=2;
const pol=await db.query("select policyname from pg_policies where tablename='construction_schedule_holidays'");
ok(pol.rows.length===3,'Feriados possuem políticas de leitura, inclusão e exclusão, restritas a admin');
await run('set role authenticated');
await run("select set_config('app.is_admin','false',false)");
await reject(record(invalid,plan(['2026-09-22'])),'Usuário não administrador não cria plano via RPC');
await run("select set_config('app.is_admin','true',false)");
await reject(record(invalid,plan(['2026-10-03'])),'Feriado fora do período reverte plano completo');
ok(await scalar(`select count(*)::integer value from construction_schedules where id='${invalid}'`)===0,
 'Feriado inválido não deixa cabeçalho órfão');
await reject(record(invalid,plan(['2026-09-22','2026-09-22'])),'Datas duplicadas recusadas por chave primária');
ok(await scalar(`select count(*)::integer value from construction_schedules where id='${invalid}'`)===0,
 'Feriado repetido reverte toda a transação');
await reject(record(invalid,plan(['2026-02-30'])),'Data impossível é recusada');
ok(await scalar(`select count(*)::integer value from construction_schedule_holidays`)===0,
 'Falhas não deixam eventos de feriado órfãos');
await run(record(valid,plan(['2026-09-22'])));
ok(await scalar(`select count(*)::integer value from construction_schedule_holidays where schedule_id='${valid}'`)===1,
 'Calendário foi persistido na mesma transação do plano');
await run(`update public.construction_schedules set activation_status='approved' where id='${valid}'`);
ok(await scalar(`select count(*)::integer value from construction_schedule_baseline_versions where schedule_id='${valid}'`)===1,
 'Aprovação arquiva plano junto com feriado');
ok(await scalar(`select holiday_dates[1]::text value from construction_schedule_baseline_versions where schedule_id='${valid}'`)==='2026-09-22',
 'Versão arquivada registra a data não útil exata');
await reject(`delete from construction_schedule_holidays where schedule_id='${valid}'`,
 'Feriado aprovado não pode ser apagado');
await reject(`select admin_set_construction_schedule_holidays('${valid}',${json([])})`,
 'Calendário aprovado não pode ser substituído');
await run(record(calendar,plan(['2026-09-22'],'calendar_days','2026-09-22',2)));
await run(`update public.construction_schedules set activation_status='approved' where id='${calendar}'`);
ok(await scalar(`select holiday_dates[1]::text value from construction_schedule_baseline_versions where schedule_id='${calendar}'`)==='2026-09-22',
 'Dia corrido inclui feriado, mas o preserva no arquivo');
await run("select set_config('app.is_admin','false',false)");
ok(await scalar('select count(*)::integer value from construction_schedule_holidays')===0,
 'RLS oculta feriados de usuários não administradores');
await run('reset role;set role anon');
await reject('select * from construction_schedule_holidays','Anônimo não lê datas privadas');
await run('reset role');
console.log(`CALENDÁRIO E FERIADOS: ${checks} verificações em PostgreSQL sintético aprovadas.`);
