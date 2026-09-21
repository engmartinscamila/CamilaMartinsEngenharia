import fs from 'node:fs';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';

// Banco em memória: nenhum dado real, credencial ou operação em produção.
const db = new PGlite();
const root = new URL('../../', import.meta.url);
let checks = 0;
const sql = (query) => db.exec(query);
const scalar = async (query) => (await db.query(query)).rows[0]?.value;
const expectFailure = async (query, match) => {
  let error = null;
  try { await sql(query); } catch (cause) { error = cause; }
  assert.ok(error, `Deveria bloquear: ${query.slice(0,90)}`);
  if (match) assert.match(String(error.message),match);
  checks++;
};
const ok = (condition, explanation) => { assert.ok(condition, explanation); checks++; };
const quote = '10000000-0000-4000-8000-000000000001';
const contract = '10000000-0000-4000-8000-000000000002';
const client = '10000000-0000-4000-8000-000000000003';
const legacyContract = '10000000-0000-4000-8000-000000000004';
const project = '10000000-0000-4000-8000-000000000005';
const history = '10000000-0000-4000-8000-000000000006';
const json = (value) => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
const scheduleItem = (code, value='200.00', level='prata') => ({code, included:true, value, level:{code:level}});

await sql(`create role anon; create role authenticated;
create table public.service_catalog(
  code text primary key, name text not null, category text,level_applicable boolean,
  description text,deliverables jsonb,exclusions jsonb,client_inputs jsonb,
  default_revisions integer,delivery_formats jsonb,acceptance_required boolean,
  planning_reference text,contract_clause_refs text[],version integer,active boolean,
  last_contract_master_version integer
);
create table public.clientes(id uuid primary key);
create table public.contratos(id uuid primary key);
create table public.projetos(id uuid primary key,cliente_id uuid references clientes(id),contract_id uuid references contratos(id),nome text);
create table public.commercial_records(
  id uuid primary key, record_kind text,status text, quote_number text,
  contract_number text, linked_project_id uuid,linked_client_id uuid,
  linked_contract_id uuid,quote_document_id uuid,contract_document_id uuid,
  services jsonb not null default '[]'::jsonb,total_value numeric,
  contract_master_version integer
);
create table public.commercial_contract_quote_links(
  contract_record_id uuid references commercial_records(id),
  quote_record_id uuid references commercial_records(id),
  primary key(contract_record_id,quote_record_id)
);
create table public.construction_schedules(
  id uuid primary key default gen_random_uuid(),project_id uuid not null unique references projetos(id),
  client_id uuid not null references clientes(id),contract_id uuid references contratos(id),
  title text,template_version text default 'residencial_v1',reference_date date,
  planned_start date, planned_finish date, notes text,updated_at timestamptz default now()
);
create table public.construction_schedule_items(
  id uuid primary key default gen_random_uuid(),schedule_id uuid not null references construction_schedules(id),
  code text not null, activity text not null,weight_percent numeric not null default 0
);
create function public.is_portal_admin() returns boolean language sql as
$$ select coalesce(current_setting('cme.fixture_admin',true),'')='yes' $$;
set cme.fixture_admin = 'yes';
insert into clientes(id) values('${client}');
insert into contratos(id) values('${legacyContract}');
insert into projetos(id,cliente_id,contract_id,nome) values('${project}','${client}','${legacyContract}','Obra fictícia');
insert into construction_schedules(id,project_id,client_id,contract_id,title)
values('${history}','${project}','${client}','${legacyContract}','Histórico imutável');
insert into construction_schedule_items(schedule_id,code,activity,weight_percent)
values('${history}','01','Etapa anterior',100);`);
for (const name of ['20260921180000_cronograma_completo_servico_opcional.sql','20260921181000_cronograma_vinculo_contratual_obrigatorio.sql']) {
  await sql(fs.readFileSync(new URL(`supabase/migrations/${name}`,root),'utf8'));
  checks++;
}
ok(await scalar("select count(*)::integer value from service_catalog where code='s' and active") === 1,'Serviço opcional foi registrado');
ok(await scalar('select count(*)::integer value from construction_schedule_items') === 1,'Histórico anterior preservado');
ok(await scalar(`select activation_status value from construction_schedules where id='${history}'`) === 'legacy','Histórico marcado legado');
ok(await scalar(`select public.admin_initialize_construction_schedule('${project}'::uuid)::text value`)===history,'Inicialização antiga consulta cronograma preexistente');
await expectFailure(`insert into construction_schedules(project_id,client_id,contract_id,title) values('${project}','${client}','${legacyContract}','Duplicado')`,/cronogramas exigem|contrat/i);
await expectFailure(`select public.assert_full_schedule_commercial_link('${project}'::uuid,'${quote}'::uuid,'${contract}'::uuid)`,/Selecione um projeto/i);
await sql(`insert into commercial_records(id,record_kind,status,quote_number,quote_document_id,services,total_value,linked_client_id)
values('${quote}','orcamento','orcamento_gerado','ORC-TESTE','10000000-0000-4000-8000-000000000020',${json([scheduleItem('s')])},200,'${client}');
insert into commercial_records(id,record_kind,status,quote_number,contract_number,contract_document_id,services,total_value,linked_project_id,linked_client_id,linked_contract_id,contract_master_version)
values('${contract}','contrato','convertido','REF-CON','CON-TESTE','10000000-0000-4000-8000-000000000021',${json([scheduleItem('s')])},200,'${project}','${client}','${legacyContract}',3);
insert into commercial_contract_quote_links(contract_record_id,quote_record_id) values('${contract}','${quote}');`);
ok((await db.query(`select public.assert_full_schedule_commercial_link('${project}'::uuid,'${quote}'::uuid,'${contract}'::uuid) data`)).rows[0].data.quote_id===quote,'Par de documentos coerente é aceito');
await sql(`update commercial_records set services=${json([scheduleItem('s','200.00'),scheduleItem('n','10.00')])} where id='${contract}'`);
await expectFailure(`select public.assert_full_schedule_commercial_link('${project}'::uuid,'${quote}'::uuid,'${contract}'::uuid)`,/não constam dos orçamentos/i);
await sql(`update commercial_records set services=${json([scheduleItem('s')])},total_value=300 where id='${contract}'`);
await expectFailure(`select public.assert_full_schedule_commercial_link('${project}'::uuid,'${quote}'::uuid,'${contract}'::uuid)`,/Total contratual diverge/i);
await sql(`update commercial_records set total_value=200,services=${json([scheduleItem('s',null)])} where id='${contract}'`);
await expectFailure(`select public.assert_full_schedule_commercial_link('${project}'::uuid,'${quote}'::uuid,'${contract}'::uuid)`,/Valores por serviço/i);
await sql(`update commercial_records set services=${json([scheduleItem('s')])} where id='${contract}'`);
await sql(`set cme.fixture_admin = 'no'`);
await expectFailure(`select public.assert_full_schedule_commercial_link('${project}'::uuid,'${quote}'::uuid,'${contract}'::uuid)`,/Acesso administrativo/i);
await sql(`set cme.fixture_admin = 'yes'`);
await expectFailure(`select public.admin_initialize_construction_schedule('${project}'::uuid,'${quote}'::uuid,'${contract}'::uuid)`,/histórico|anterior/i);
ok(await scalar('select count(*)::integer value from construction_schedules') === 1,'O histórico não foi duplicado');
console.log(`CRONOGRAMA REGRESSION PASSED: ${checks} checks (migrações, autorização, escopo, valores e preservação histórica).`);
