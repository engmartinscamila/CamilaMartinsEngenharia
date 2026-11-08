// Regressão — contrato emitido gera contas a receber por parcela, sem duplicar;
// Anexo I exigido somente com serviço adicional.
// Uso: CME_PGLITE_ROOT=<pasta com @electric-sql/pglite> node scripts/security/contract-receivables-regression.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = process.env.CME_PGLITE_ROOT || process.cwd();
const require = createRequire(path.join(root, 'package.json'));
const { PGlite } = await import(require.resolve('@electric-sql/pglite'));
const read = (f) => fs.readFileSync(new URL('../../supabase/migrations/' + f, import.meta.url), 'utf8');
const addendum = read('20261108060000_accepted_addendum_financial_obligation.sql');
const receivables = read('20261108140000_contract_installments_receivables.sql');
const annex = read('20261108141000_annex_only_with_additional_service.sql');
const db = new PGlite();
const C = 'c0000000-0000-4000-8000-00000000000c', K = 'a0000000-0000-4000-8000-00000000000a', P = 'e0000000-0000-4000-8000-00000000000e';
const R = 'b0000000-0000-4000-8000-00000000000b', D = 'd0000000-0000-4000-8000-00000000000d', D2 = 'd0000000-0000-4000-8000-0000000000d2';
await db.exec(`
create schema auth; create schema private; create role authenticated; create role anon;
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create function public.is_portal_admin() returns boolean language sql stable as $$ select true $$;
create table public.clientes(id uuid primary key);
create table public.contratos(id uuid primary key, cliente_id uuid, contract_value numeric(12,2));
create table public.projetos(id uuid primary key, cliente_id uuid, contract_id uuid);
create table public.audit_log(id bigserial primary key, user_id uuid, action text, entity_type text, entity_id uuid, details jsonb);
create table public.documentos(id uuid primary key, nome text, document_kind text, projeto_id uuid, cliente_id uuid, contract_id uuid,
  generated_data jsonb, generated_at timestamptz, versao text, superseded_by uuid);
create table public.document_acceptances(id uuid primary key default gen_random_uuid(), document_id uuid, project_id uuid, client_id uuid, user_id uuid,
  document_version text, decision text, accepted_at timestamptz default now(), unique(document_id, document_version));
create table public.financeiro(id uuid primary key default gen_random_uuid(), projeto_id uuid, cliente_id uuid, contract_id uuid, descricao text, tipo text,
  valor numeric(12,2), data date, status text check (status in ('previsto','pendente','pago','atrasado','cancelado')), data_vencimento date, data_pagamento date,
  forma_pagamento text, categoria text, source text not null default 'manual', client_request_id uuid unique, observacoes text);
create table public.commercial_records(id uuid primary key, record_kind text, status text, contract_number text, linked_contract_id uuid,
  linked_project_id uuid, linked_client_id uuid, contract_document_id uuid, total_value numeric, payment_terms jsonb);
create function public.admin_project_document_map(p_project_id uuid) returns table(kind text, required_now boolean) language sql as $f$
  with catalog(kind,label,required_now) as (values ('contrato','Contrato',true),('anexo_i','Anexo I',true)) select kind, required_now from catalog $f$;
create function public.admin_commercial_closure(p_record_id uuid) returns jsonb language plpgsql as $f$
  declare r public.commercial_records; access_ready boolean := true;
  begin select * into r from public.commercial_records where id=p_record_id;
  return jsonb_build_object('recordId',r.id,'accessReady',coalesce(access_ready,false),'total',r.total_value); end $f$;
insert into public.clientes values ('${C}'); insert into public.contratos values ('${K}','${C}',3000); insert into public.projetos values ('${P}','${C}','${K}');
`);
await db.exec(addendum);
await db.exec(receivables); await db.exec(receivables);
await db.exec(annex); await db.exec(annex);
const one = async (sql) => (await db.query(sql)).rows[0];
const n = async (where = "source='contract_installment'") => Number((await one(`select count(*) n from public.financeiro where ${where}`)).n);
const snap = (terms, total = 3000) => JSON.stringify({ commercial_finalization_state: 'complete',
  commercial_record_snapshot: { total_value: total, payment_terms: terms } });
const T3 = [{ value: '1000.00', due: '2026-12-01', method: 'pix' }, { value: '1000.00', due: '2027-01-01', method: 'pix' }, { value: '1000.00', due: '', method: 'boleto' }];

// Contrato ainda não convertido: nada é gerado.
await db.query(`insert into public.documentos(id,document_kind,generated_at,versao,generated_data,contract_id) values ('${D}','contrato',now(),'1.0','${snap(T3)}','${K}')`);
await db.query(`insert into public.commercial_records values ('${R}','contrato','contrato_gerado','CON-QA',null,'${P}','${C}','${D}',3000,'[]')`);
assert.equal(await n(), 0, 'sem conversão não gera');

// Conversão: 3 parcelas, uma vez só.
await db.query(`update public.commercial_records set status='convertido', linked_contract_id='${K}' where id='${R}'`);
assert.equal(await n(), 3, 'conversão gera uma conta a receber por parcela');
await db.query(`update public.commercial_records set status='convertido' where id='${R}'`);
await db.query(`select private.sync_contract_receivables('${R}')`);
assert.equal(await n(), 3, 'reexecução não duplica');
let rows = (await db.query(`select valor, status, data_vencimento::text v, forma_pagamento fp, contract_id, cliente_id, projeto_id from public.financeiro where source='contract_installment' order by descricao`)).rows;
assert.deepEqual(rows.map(r => [Number(r.valor), r.status, r.v, r.fp]), [[1000, 'pendente', '2026-12-01', 'Pix'], [1000, 'pendente', '2027-01-01', 'Pix'], [1000, 'previsto', null, 'Boleto Bancário']]);
assert.ok(rows.every(r => r.contract_id === K && r.cliente_id === C && r.projeto_id === P), 'vínculos de contrato, cliente e projeto');

// Parcela 1 paga; revisão muda parcela 2 e remove a 3 (soma mantida).
await db.query(`update public.financeiro set status='pago', data_pagamento='2026-12-01' where descricao like 'Parcela 1/%'`);
await db.query(`update public.documentos set generated_data='${snap([{ value: '999.00', due: '2026-12-01' }, { value: '2001.00', due: '2027-02-01' }])}' where id='${D}'`);
rows = (await db.query(`select descricao d, valor, status from public.financeiro where source='contract_installment' order by descricao`)).rows;
assert.equal(Number(rows[0].valor), 1000, 'parcela paga nunca é alterada');
assert.equal(Number(rows[1].valor), 2001, 'parcela em aberto acompanha a revisão');
assert.equal(rows[2].status, 'cancelado', 'parcela removida e em aberto é cancelada');
assert.equal(Number((await one(`select count(*) n from public.audit_log where action='contract_receivable_paid_divergence'`)).n), 1, 'divergência de parcela paga registrada');

// Soma inválida: nada muda, pendência registrada.
await db.query(`update public.documentos set generated_data='${snap([{ value: '10.00', due: '2026-12-01' }])}' where id='${D}'`);
assert.equal(Number((await one(`select valor from public.financeiro where descricao like 'Parcela 2/%'`)).valor), 2001, 'soma inválida não altera nada');
assert.ok(Number((await one(`select count(*) n from public.audit_log where action='contract_receivables_pending'`)).n) >= 1);

// Cancelamento do contrato: só o que está em aberto é cancelado.
await db.query(`update public.commercial_records set status='cancelado' where id='${R}'`);
assert.equal(await n(`source='contract_installment' and status='pago'`), 1);
assert.equal(await n(`source='contract_installment' and status in ('pendente','previsto')`), 0);

// Lançamentos manuais pré-existentes: não gera (evita duplicar).
const K2 = 'a0000000-0000-4000-8000-0000000000a2', R2 = 'b0000000-0000-4000-8000-0000000000b2';
await db.query(`insert into public.contratos values ('${K2}','${C}',3000)`);
await db.query(`insert into public.financeiro(contract_id,cliente_id,tipo,valor,data,status,source) values ('${K2}','${C}','entrada',500,'2026-10-01','pago','manual')`);
await db.query(`insert into public.documentos(id,document_kind,generated_at,versao,generated_data) values ('${D2}','contrato',now(),'1.0','${snap(T3)}')`);
await db.query(`insert into public.commercial_records values ('${R2}','contrato','convertido','CON-QA2','${K2}',null,'${C}','${D2}',3000,'[]')`);
assert.equal(await n(`contract_id='${K2}' and source='contract_installment'`), 0, 'conflito manual não duplica');
assert.equal(Number((await one(`select count(*) n from public.audit_log where action='contract_receivables_manual_conflict'`)).n), 1);
assert.equal(Number((await one(`select count(*) n from public.audit_log where action='contract_receivables_sync_failed'`)).n), 0, 'nenhuma falha silenciosa');

// Anexo I: só com serviço adicional.
const req = async () => (await one(`select required_now r from public.admin_project_document_map('${P}') where kind='anexo_i'`)).r;
assert.equal(await req(), false, 'sem adicional, Anexo I não é exigido');
assert.equal((await one(`select public.admin_commercial_closure('${R}')->'annexRequired' v`)).v, false);
const A = 'f0000000-0000-4000-8000-00000000000f';
await db.query(`insert into public.documentos(id,nome,document_kind,projeto_id,cliente_id,contract_id,generated_data) values ('${A}','Adicional','servico_adicional','${P}','${C}',null,'{}')`);
assert.equal(await req(), true, 'com adicional, Anexo I é exigido');
assert.equal((await one(`select public.admin_commercial_closure('${R}')->'annexRequired' v`)).v, true);
await db.query(`insert into public.document_acceptances(document_id,project_id,client_id,document_version,decision) values ('${A}','${P}','${C}','1.0','rejected')`);
assert.equal(await req(), false, 'adicional recusado não exige Anexo I');

console.log('PASS: parcelas do contrato emitido viram contas a receber únicas (revisão, pagamento, cancelamento, soma inválida e conflito manual cobertos); Anexo I exigido só com serviço adicional.');
