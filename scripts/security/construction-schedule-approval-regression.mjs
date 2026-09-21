import fs from 'node:fs';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
const db=new PGlite();const root=new URL('../../',import.meta.url);let checks=0;
const sql=(q)=>db.exec(q);const scalar=async(q)=>(await db.query(q)).rows[0]?.value;
const ok=(b,m)=>{assert.ok(b,m);checks++;};
const bad=async(q,m)=>{let e;try{await sql(q);}catch(x){e=x;}assert.ok(e,m);checks++;};
const client='10000000-0000-4000-8000-000000000001';
const project='10000000-0000-4000-8000-000000000002';
const schedule='10000000-0000-4000-8000-000000000003';
const legacy='10000000-0000-4000-8000-000000000004';
const scope={services:[{code:'s',included:true}]};
const json=(value)=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;
const item=(cost=null)=>({code:'01',category:'Planejamento',activity:'Etapa confirmada',display_order:1,weight_percent:100,planned_duration_days:2,predecessor_code:null,planned_start:'2026-09-21',planned_finish:'2026-09-22',planned_cost:cost,source_service_code:'s',cost_source:'orçamento de obra separado'});
const plan=(cost=null)=>({scope_confirmed:true,calendar:'weekdays',weight_source:'confirmed_manual',planned_start:'2026-09-21',planned_finish:'2026-09-22',items:[item(cost)]});
await sql(`create role anon;create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql as $$select '10000000-0000-4000-8000-000000000005'::uuid$$;
create function public.is_portal_admin() returns boolean language sql as $$select true$$;
create table public.projetos(id uuid primary key,data_fim date);
create table public.construction_schedules(
id uuid primary key,project_id uuid,client_id uuid,contract_id uuid,quote_record_id uuid,contract_record_id uuid,
source_scope_snapshot jsonb,activation_status text,planned_start date,planned_finish date,notes text,
updated_at timestamptz default now());
create table public.construction_schedule_items(
id uuid primary key default gen_random_uuid(),schedule_id uuid,code text,category text,activity text,
display_order int,weight_percent numeric,planned_duration_days int,predecessor_code text,
planned_start date,planned_finish date,actual_start date,actual_finish date,actual_progress int,
planned_cost numeric,actual_cost numeric,status text,notes text,is_default boolean,
created_at timestamptz default now(),updated_at timestamptz default now());
create function public.assert_full_schedule_commercial_link(uuid,uuid,uuid) returns jsonb language sql as
$$select jsonb_build_object('services',jsonb_build_array(jsonb_build_object('code','s','included',true)))$$;
insert into public.projetos values('${project}','2026-10-01');
insert into public.construction_schedules(id,project_id,client_id,activation_status)
values('${legacy}','${project}','${client}','legacy');
insert into public.construction_schedule_items(schedule_id,code,category,activity,display_order,weight_percent,planned_duration_days,planned_cost,is_default)
values('${legacy}','L','Histórico','Histórico existente',1,100,1,null,true);`);
for (const filename of ['20260921183000_cronograma_planejamento_aprovacao_linha_base.sql','20260921184000_cronograma_salvar_plano_atomico.sql']) {
 await sql(fs.readFileSync(new URL(`supabase/migrations/${filename}`,root),'utf8'));
 checks++;
}
await sql(`insert into public.construction_schedules(id,project_id,client_id,activation_status,quote_record_id,contract_record_id,source_scope_snapshot,work_calendar,weight_source)
values('${schedule}','${project}','${client}','draft','${client}','${project}',${json(scope)},'weekdays','confirmed_manual');`);
await bad(`select public.admin_save_full_schedule_plan('${schedule}'::uuid,${json({...plan(),scope_confirmed:undefined})})`,'Sem confirmação deve recusar');
ok(await scalar(`select count(*)::integer value from construction_schedule_items where schedule_id='${schedule}'`)===0,'Falha não gera etapa');
await sql(`select public.admin_save_full_schedule_plan('${schedule}'::uuid,${json(plan())})`);
ok(await scalar(`select count(*)::integer value from construction_schedule_items where schedule_id='${schedule}'`)===1,'Plano cria exatamente a etapa confirmada');
await bad(`select public.admin_save_full_schedule_plan('${schedule}'::uuid,${json({...plan(),items:[{...item(),predecessor_code:'99'}]})})`,'Predecessora inválida deve impedir alteração');
ok(await scalar(`select count(*)::integer value from construction_schedule_items where schedule_id='${schedule}'`)===1,'Erro preserva o plano anterior');
await bad(`update public.construction_schedules set activation_status='approved' where id='${schedule}'`,'Sem custos de obra não pode aprovar plano financeiro');
await sql(`select public.admin_save_full_schedule_plan('${schedule}'::uuid,${json(plan(200))})`);
await sql(`update public.construction_schedules set activation_status='approved' where id='${schedule}'`);
ok(await scalar(`select baseline_version value from construction_schedules where id='${schedule}'`)===1,'Primeira linha de base versionada');
ok(await scalar(`select baseline_snapshot->'activities'->0->>'code' value from construction_schedules where id='${schedule}'`)==='01','Linha de base contém o escopo');
await bad(`update construction_schedule_items set planned_cost=300 where schedule_id='${schedule}'`,'Não alterar custo da linha de base');
await bad(`insert into construction_schedule_items(schedule_id,code,category,activity,display_order,weight_percent,planned_duration_days,source_service_code) values('${schedule}','02','Obra','Etapa tardia',2,0,1,'s')`,'Não inserir etapa após aprovação');
await bad(`update construction_schedules set activation_status='draft' where id='${schedule}'`,'Linha de base não pode reabrir para modificar');
await sql(`update construction_schedule_items set actual_progress=50 where schedule_id='${schedule}'`);
ok(await scalar(`select actual_progress value from construction_schedule_items where schedule_id='${schedule}'` )===50,'Avanço real continua permitido');
ok(await scalar(`select baseline_version value from construction_schedules where id='${legacy}'`)===0,'Histórico legado preservado');
console.log(`APROVAÇÃO DO CRONOGRAMA: ${checks} verificações com dados fictícios aprovadas.`);
