import fs from 'node:fs';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';

// Banco efêmero: valida o caminho contrato legado -> Serviço Adicional aceito -> cronograma,
// sem tocar em produção, clientes reais ou credenciais.
const db = new PGlite();
const root = new URL('../../', import.meta.url);
let checks = 0;
const sql = (query) => db.exec(query);
const scalar = async (query) => (await db.query(query)).rows[0]?.value;
const ok = (condition, description) => { assert.ok(condition, description); checks += 1; };
const expectFailure = async (query, pattern) => {
  let error = null;
  try { await sql(query); } catch (cause) { error = cause; }
  assert.ok(error, `Deveria bloquear: ${query.slice(0, 100)}`);
  if (pattern) assert.match(String(error.message), pattern);
  checks += 1;
};

const user = '20000000-0000-4000-8000-000000000001';
const client = '20000000-0000-4000-8000-000000000002';
const contract = '20000000-0000-4000-8000-000000000003';
const otherContract = '20000000-0000-4000-8000-000000000004';
const project = '20000000-0000-4000-8000-000000000005';
const document = '20000000-0000-4000-8000-000000000006';
const acceptance = '20000000-0000-4000-8000-000000000007';
const json = (value) => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;

await sql(`
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as
$$ select '${user}'::uuid $$;

create table public.clientes(id uuid primary key);
create table public.contratos(id uuid primary key);
create table public.projetos(
  id uuid primary key,
  cliente_id uuid not null references public.clientes(id),
  contract_id uuid references public.contratos(id),
  nome text
);
create table public.documentos(
  id uuid primary key,
  projeto_id uuid references public.projetos(id),
  contract_id uuid references public.contratos(id),
  document_kind text,
  superseded_by uuid,
  snapshot_frozen_at timestamptz,
  version text,
  versao text,
  generated_data jsonb not null default '{}'::jsonb
);
create table public.document_acceptances(
  id uuid primary key,
  document_id uuid not null references public.documentos(id),
  document_version text not null,
  decision text not null,
  accepted_at timestamptz not null default now()
);
create table public.construction_schedule_templates(
  template_code text not null,
  template_version integer not null,
  active boolean not null default true,
  primary key(template_code,template_version)
);
create table public.construction_schedule_template_items(
  template_code text not null,
  template_version integer not null,
  code text not null,
  category text,
  activity text,
  display_order integer,
  reference_weight_percent numeric,
  reference_duration_days integer,
  predecessor_code text
);
create table public.construction_schedules(
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projetos(id),
  client_id uuid not null references public.clientes(id),
  contract_id uuid references public.contratos(id),
  quote_record_id uuid,
  contract_record_id uuid,
  source_scope_snapshot jsonb,
  title text,
  planned_start date,
  planned_finish date,
  reference_date date,
  activation_status text not null default 'draft',
  revision_number integer not null default 1,
  is_current boolean not null default true
);
create function public.is_portal_admin() returns boolean language sql stable as
$$ select coalesce(current_setting('cme.fixture_admin',true),'')='yes' $$;
create function public.admin_save_full_schedule_plan(uuid,jsonb) returns void language sql as $$ select $$;
create function public.admin_set_construction_schedule_holidays(uuid,jsonb) returns void language sql as $$ select $$;
create function public.admin_set_full_schedule_physical_weights(uuid,jsonb) returns void language sql as $$ select $$;

set cme.fixture_admin = 'yes';
insert into public.clientes(id) values('${client}');
insert into public.contratos(id) values('${contract}'),('${otherContract}');
insert into public.projetos(id,cliente_id,contract_id,nome)
values('${project}','${client}','${contract}','Obra fictícia');
insert into public.construction_schedule_templates(template_code,template_version,active)
values('residential_reference',1,true);
insert into public.construction_schedule_template_items(
  template_code,template_version,code,category,activity,display_order,
  reference_weight_percent,reference_duration_days,predecessor_code
) values(
  'residential_reference',1,'01','Planejamento','Mobilização',1,10,5,null
);
`);

await sql(fs.readFileSync(
  new URL('supabase/migrations/20260924012000_schedule_from_accepted_additional_service.sql', root),
  'utf8',
));
checks++;

const options = {
  document_options: {
    additional_service_code: 's',
    additional_service_name: 'Cronograma completo de acompanhamento de obra',
    additional_service_level: 'ouro',
    additional_value: 'R$ 1.500,00',
    payment_method: 'pix',
  },
};
await sql(`
insert into public.documentos(
  id,projeto_id,contract_id,document_kind,snapshot_frozen_at,version,versao,generated_data
) values(
  '${document}','${project}','${contract}','servico_adicional',now(),'1.0','1.0',${json(options)}
);
`);

await expectFailure(
  `select public.assert_full_schedule_additional_service('${project}'::uuid,'${document}'::uuid)`,
  /cliente precisa aceitar/i,
);
ok(await scalar('select count(*)::integer value from public.admin_list_full_schedule_additional_authorizations()') === 0,
  'Documento sem aceite não aparece como autorização');

await sql(`
insert into public.document_acceptances(id,document_id,document_version,decision)
values('${acceptance}','${document}','1.0','accepted');
`);
const authorization = (await db.query(
  `select public.assert_full_schedule_additional_service('${project}'::uuid,'${document}'::uuid) data`,
)).rows[0].data;
ok(authorization.service_code === 's' && authorization.authorization_type === 'servico_adicional_aceito',
  'Versão congelada e aceita do serviço s é autorizada');
ok(await scalar('select count(*)::integer value from public.admin_list_full_schedule_additional_authorizations()') === 1,
  'Autorização aceita aparece para seleção no Admin');

await sql(`update public.documentos set version='2.0',versao='2.0' where id='${document}'`);
await expectFailure(
  `select public.assert_full_schedule_additional_service('${project}'::uuid,'${document}'::uuid)`,
  /cliente precisa aceitar/i,
);
ok(await scalar('select count(*)::integer value from public.admin_list_full_schedule_additional_authorizations()') === 0,
  'Aceite da versão anterior não libera uma nova versão');
await sql(`update public.documentos set version='1.0',versao='1.0' where id='${document}'`);

const preview = (await db.query(
  `select public.admin_preview_full_schedule_template_from_additional_service(
    '${project}'::uuid,'${document}'::uuid,'residential_reference'
  ) data`,
)).rows[0].data;
ok(preview.template_code === 'residential_reference' && preview.items.length === 1,
  'Modelo só é liberado depois da autorização aceita');

const plan = {
  scope_confirmed: true,
  holidays: [],
  physical_weights: [],
  items: [{ code: '01', activity: 'Mobilização', planned_cost: 1000 }],
};
const created = await scalar(
  `select public.admin_initialize_and_save_full_schedule_from_additional_service(
    '${project}'::uuid,'${document}'::uuid,${json(plan)}
  )::text value`,
);
ok(Boolean(created), 'Cronograma é criado a partir do adicional aceito');
ok(await scalar(`select (source_scope_snapshot->>'source_document_id') value from public.construction_schedules where id='${created}'::uuid`) === document,
  'Cronograma guarda o documento adicional aceito como origem');
ok(await scalar(`select (quote_record_id is null and contract_record_id is null)::text value from public.construction_schedules where id='${created}'::uuid`) === 'true',
  'Contrato legado não recebe IDs comerciais artificiais');
ok(await scalar(`select contract_id::text value from public.construction_schedules where id='${created}'::uuid`) === contract,
  'Vínculo com o contrato-base do projeto é preservado');

const reused = await scalar(
  `select public.admin_initialize_and_save_full_schedule_from_additional_service(
    '${project}'::uuid,'${document}'::uuid,${json(plan)}
  )::text value`,
);
ok(reused === created, 'Mesmo rascunho e mesma autorização não criam duplicata');

await sql(`update public.construction_schedules set activation_status='approved' where id='${created}'::uuid`);
await expectFailure(
  `select public.admin_initialize_and_save_full_schedule_from_additional_service(
    '${project}'::uuid,'${document}'::uuid,${json(plan)}
  )`,
  /cronograma aprovado vigente/i,
);

await sql(`delete from public.construction_schedules; update public.documentos set contract_id='${otherContract}' where id='${document}'`);
await expectFailure(
  `select public.assert_full_schedule_additional_service('${project}'::uuid,'${document}'::uuid)`,
  /contrato vigente/i,
);

await sql(`update public.documentos set contract_id='${contract}',
  generated_data=${json({document_options:{...options.document_options,additional_service_code:'n'}})}
  where id='${document}'`);
await expectFailure(
  `select public.assert_full_schedule_additional_service('${project}'::uuid,'${document}'::uuid)`,
  /não corresponde ao serviço de cronograma completo/i,
);

await sql(`set cme.fixture_admin = 'no'`);
await expectFailure(
  `select public.admin_list_full_schedule_additional_authorizations()`,
  /Acesso|permission|administr/i,
);

console.log(`CRONOGRAMA POR SERVIÇO ADICIONAL: ${checks} verificações passaram em PostgreSQL efêmero.`);
