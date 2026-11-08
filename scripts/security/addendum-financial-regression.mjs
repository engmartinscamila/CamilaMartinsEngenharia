// Regressão A18 — aceite de aditivo gera obrigação financeira única.
// Uso: CME_PGLITE_ROOT=<pasta com @electric-sql/pglite> node scripts/security/addendum-financial-regression.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = process.env.CME_PGLITE_ROOT || process.cwd();
const require = createRequire(path.join(root, 'package.json'));
const { PGlite } = await import(require.resolve('@electric-sql/pglite'));
const migration = fs.readFileSync(new URL('../../supabase/migrations/20261108060000_accepted_addendum_financial_obligation.sql', import.meta.url), 'utf8');
const db = new PGlite();
const C = 'c0000000-0000-4000-8000-00000000000c', K = 'k0000000-0000-4000-8000-00000000000k'.replace(/k/g, 'a'), P = 'e0000000-0000-4000-8000-00000000000e';
await db.exec(`
create schema auth; create schema private; create role authenticated; create role anon;
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create function public.is_portal_admin() returns boolean language sql stable as $$ select true $$;
create table public.clientes(id uuid primary key);
create table public.contratos(id uuid primary key, cliente_id uuid, contract_value numeric(12,2));
create table public.projetos(id uuid primary key, cliente_id uuid, contract_id uuid);
create table public.audit_log(id bigserial primary key, user_id uuid, action text, entity_type text, entity_id uuid, details jsonb);
create table public.documentos(id uuid primary key, nome text, document_kind text, projeto_id uuid, cliente_id uuid, contract_id uuid, generated_data jsonb);
create table public.document_acceptances(id uuid primary key default gen_random_uuid(), document_id uuid, project_id uuid, client_id uuid, user_id uuid,
  document_version text, decision text, unique(document_id, document_version));
create table public.financeiro(id uuid primary key default gen_random_uuid(), projeto_id uuid, cliente_id uuid, contract_id uuid, descricao text, tipo text,
  valor numeric(12,2), data date, status text, data_vencimento date, categoria text, source text, client_request_id uuid unique, observacoes text);
insert into public.clientes values ('${C}'); insert into public.contratos values ('${K}','${C}',25000); insert into public.projetos values ('${P}','${C}','${K}');
`);
await db.exec(migration); await db.exec(migration);
const one = async (sql) => (await db.query(sql)).rows[0];
const doc = async (id, kind, value) => db.query(`insert into public.documentos values ('${id}','Termo aditivo','${kind}','${P}','${C}',null,'${JSON.stringify({ document_options: { additional_value: value } })}')`);
const accept = (id, decision, v = '1.0') => db.query(`insert into public.document_acceptances(document_id,project_id,client_id,document_version,decision) values ('${id}','${P}','${C}','${v}','${decision}')`);

assert.equal(Number((await one(`select private.parse_brl_amount('"R$ 2.500,00"'::jsonb) v`)).v), 2500);
assert.equal(Number((await one(`select private.parse_brl_amount('"1.234.567,89"'::jsonb) v`)).v), 1234567.89);
assert.equal((await one(`select private.parse_brl_amount('"100,005"'::jsonb) v`)).v, null, 'três casas não viram valor');
assert.equal((await one(`select private.parse_brl_amount('"A definir"'::jsonb) v`)).v, null);

const D1 = '11111111-1111-4111-8111-111111111111', D2 = '22222222-2222-4222-8222-222222222222', D3 = '33333333-3333-4333-8333-333333333333', D4 = '44444444-4444-4444-8444-444444444444';
await doc(D1, 'servico_adicional', 'R$ 2.500,00');
await accept(D1, 'rejected');
assert.equal(Number((await one(`select count(*) n from public.financeiro`)).n), 0, 'rejeição não gera cobrança');
await accept(D1, 'accepted', '1.1');
let f = await one(`select valor, status, tipo, contract_id, cliente_id, source from public.financeiro`);
assert.deepEqual({ ...f, valor: Number(f.valor) }, { valor: 2500, status: 'previsto', tipo: 'entrada', contract_id: K, cliente_id: C, source: 'addendum' });
await accept(D1, 'accepted', '1.2');
assert.equal(Number((await one(`select count(*) n from public.financeiro`)).n), 1, 'novo aceite do mesmo aditivo não duplica');
assert.equal(Number((await one(`select contract_value v from public.contratos`)).v), 25000, 'valor original do contrato preservado');
assert.equal(Number((await one(`select amount a from public.contract_addenda where document_id='${D1}'`)).a), 2500);

await doc(D2, 'servico_adicional', 'A definir');
await accept(D2, 'accepted');
assert.equal(Number((await one(`select count(*) n from public.financeiro`)).n), 1, 'valor ausente não inventa cobrança');
assert.equal(Number((await one(`select count(*) n from public.audit_log where action='addendum_accepted_without_value'`)).n), 1);

await doc(D3, 'termo_aceite', 'R$ 900,00');
await accept(D3, 'accepted');
assert.equal(Number((await one(`select count(*) n from public.financeiro`)).n), 1, 'outros documentos não geram cobrança');

await doc(D4, 'servico_adicional', 'R$ 1.000,00');
await accept(D4, 'accepted_with_notes');
assert.equal(Number((await one(`select count(*) n from public.financeiro`)).n), 2, 'aceite com observações gera cobrança');

console.log('PASS (A18): aceite de aditivo gera obrigação prevista única; rejeição, valor ausente e outros documentos não geram cobrança; valor original preservado.');
