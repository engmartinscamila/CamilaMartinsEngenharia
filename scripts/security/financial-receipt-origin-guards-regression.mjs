// Regressão A02/A03 — executa a migração real em Postgres (PGlite) com as
// colunas e constraints extraídas da produção e confere:
//  A02: recebimento com recibo não muda nem é excluído (SQL direto e
//       concorrência), recibo é imutável, estorno é rastreável e idempotente.
//  A03: cliente/contrato/projeto incoerentes são rejeitados; serviço avulso,
//       contrato sem projeto e projeto anterior ao contrato continuam válidos.
// Uso: CME_PGLITE_ROOT=<pasta com @electric-sql/pglite> node scripts/security/financial-receipt-origin-guards-regression.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = process.env.CME_PGLITE_ROOT || process.cwd();
const require = createRequire(path.join(root, 'package.json'));
const { PGlite } = await import(require.resolve('@electric-sql/pglite'));
const migration = fs.readFileSync(new URL('../../supabase/migrations/20261108040000_financial_receipt_and_origin_guards.sql', import.meta.url), 'utf8');

const db = new PGlite();
const ADMIN = '00000000-0000-4000-8000-0000000000ad';
await db.exec(`
create schema auth; create schema private;
create table auth.users(id uuid primary key);
insert into auth.users values ('${ADMIN}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true),'')::uuid $$;
create function public.is_portal_admin() returns boolean language sql stable as $$ select auth.uid() = '${ADMIN}'::uuid $$;
create role anon; create role authenticated;
create table public.clientes(id uuid primary key);
create table public.contratos(id uuid primary key, cliente_id uuid references public.clientes(id), contract_number text);
create table public.projetos(id uuid primary key, cliente_id uuid references public.clientes(id), contract_id uuid references public.contratos(id));
create table public.financial_accounts(id uuid primary key);
create table public.bank_transactions(id uuid primary key);
create table public.audit_log(id bigserial primary key, user_id uuid, action text, entity_type text, entity_id uuid, details jsonb, created_at timestamptz default now());
create table public.financeiro(
  id uuid primary key default gen_random_uuid(), projeto_id uuid references public.projetos(id) on delete cascade,
  descricao text, tipo text, valor numeric(12,2), data date, created_at timestamptz default now(), observacoes text,
  categoria text not null default 'outros', status text not null default 'pendente', data_vencimento date, data_pagamento date,
  forma_pagamento text, account_id uuid references public.financial_accounts(id) on delete set null,
  bank_transaction_id uuid references public.bank_transactions(id) on delete set null, recurrence_rule text,
  source text not null default 'manual', client_request_id uuid unique, cliente_id uuid references public.clientes(id) on delete set null,
  contract_id uuid references public.contratos(id) on delete set null,
  constraint financeiro_status_valido check (status = any (array['previsto','pendente','pago','atrasado','cancelado'])));
create table public.payment_receipts(
  id uuid primary key default gen_random_uuid(), receipt_number bigint not null unique, request_id uuid not null unique default gen_random_uuid(),
  client_id uuid not null references public.clientes(id) on delete restrict, project_id uuid references public.projetos(id) on delete restrict,
  amount numeric not null check (amount > 0), paid_on date not null, payment_method text not null, description text not null,
  snapshot jsonb not null default '{}', created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
  financial_entry_id uuid);
create unique index on public.payment_receipts(financial_entry_id);
`);
await db.exec(migration);
await db.exec(migration); // idempotência da própria migração

const A = 'a0000000-0000-4000-8000-00000000000a', B = 'b0000000-0000-4000-8000-00000000000b';
const CA = 'ca000000-0000-4000-8000-0000000000ca', CB = 'cb000000-0000-4000-8000-0000000000cb';
const PA = 'ea000000-0000-4000-8000-0000000000ea', PB = 'eb000000-0000-4000-8000-0000000000eb', PPRE = 'ec000000-0000-4000-8000-0000000000ec';
await db.exec(`
insert into public.clientes values ('${A}'),('${B}');
insert into public.contratos values ('${CA}','${A}','CON-A'),('${CB}','${B}','CON-B');
insert into public.projetos values ('${PA}','${A}','${CA}'),('${PB}','${B}','${CB}'),('${PPRE}','${A}',null);
`);
const rejects = async (sql, pattern, msg) => {
  await assert.rejects(db.query(sql), (e) => { assert.match(String(e.message), pattern, msg); return true; }, msg);
};
const one = async (sql) => (await db.query(sql)).rows[0];

// ---------------- A03 ----------------
await rejects(`insert into public.financeiro(projeto_id,cliente_id,contract_id,descricao,tipo,valor,data) values ('${PA}','${B}','${CB}','x','entrada',10,'2026-10-01')`, /outro cliente/, 'projeto de A com cliente B');
await rejects(`insert into public.financeiro(projeto_id,contract_id,descricao,tipo,valor,data) values ('${PA}','${CB}','x','entrada',10,'2026-10-01')`, /outro (cliente|contrato)/, 'projeto de A com contrato de B');
await rejects(`insert into public.financeiro(cliente_id,contract_id,descricao,tipo,valor,data) values ('${A}','${CB}','x','entrada',10,'2026-10-01')`, /outro cliente/, 'cliente A com contrato B');
let row = await one(`insert into public.financeiro(projeto_id,descricao,tipo,valor,data) values ('${PA}','só projeto','entrada',10,'2026-10-01') returning cliente_id`);
assert.equal(row.cliente_id, A, 'cliente derivado do projeto');
row = await one(`insert into public.financeiro(cliente_id,descricao,tipo,valor,data) values ('${B}','avulso','entrada',10,'2026-10-01') returning id`);
assert.ok(row.id, 'serviço avulso só por cliente continua válido');
row = await one(`insert into public.financeiro(contract_id,descricao,tipo,valor,data) values ('${CA}','contrato sem projeto','entrada',10,'2026-10-01') returning cliente_id`);
assert.equal(row.cliente_id, A, 'contrato sem projeto válido e cliente derivado');
row = await one(`insert into public.financeiro(projeto_id,contract_id,descricao,tipo,valor,data) values ('${PPRE}','${CA}','projeto anterior ao contrato','entrada',10,'2026-10-01') returning id`);
assert.ok(row.id, 'projeto pré-contrato com contrato do mesmo cliente é válido');
const avulso = (await one(`select id from public.financeiro where descricao='avulso'`)).id;
await rejects(`update public.financeiro set projeto_id='${PA}' where id='${avulso}'`, /outro cliente/, 'UPDATE incoerente também é recusado');

// ---------------- A02 ----------------
await db.exec(`set test.uid = '${ADMIN}'`);
const paid = (await one(`insert into public.financeiro(projeto_id,descricao,tipo,valor,data,status,data_pagamento,forma_pagamento,categoria)
  values ('${PA}','Parcela 1','entrada',100,'2026-10-10','pago','2026-10-10','Pix','honorarios') returning id`)).id;
await db.exec(`insert into public.payment_receipts(receipt_number,client_id,project_id,amount,paid_on,payment_method,description,created_by,financial_entry_id)
  values (7,'${A}','${PA}',100,'2026-10-10','Pix','Parcela 1','${ADMIN}','${paid}')`);

for (const [label, set] of [['valor', 'valor=200'], ['data', `data_pagamento='2026-10-11'`], ['cliente', `cliente_id='${B}'`],
  ['projeto', `projeto_id='${PPRE}'`], ['status', `status='pendente'`], ['descrição', `descricao='Outra'`], ['forma', `forma_pagamento='Boleto'`], ['tipo', `tipo='saida'`]]) {
  await rejects(`update public.financeiro set ${set} where id='${paid}'`, /REC-000007/, `alteração de ${label} bloqueada`);
}
await rejects(`delete from public.financeiro where id='${paid}'`, /não pode ser excluído/, 'exclusão bloqueada');
await rejects(`delete from public.projetos where id='${PA}'`, /./, 'exclusão do projeto não apaga recebimento com recibo');
await db.query(`update public.financeiro set observacoes='nota interna', categoria='honorarios' where id='${paid}'`);
assert.equal((await one(`select observacoes from public.financeiro where id='${paid}'`)).observacoes, 'nota interna', 'campos não materiais seguem editáveis');
await rejects(`update public.payment_receipts set amount=200 where receipt_number=7`, /imutáveis/, 'recibo imutável');
await rejects(`delete from public.payment_receipts where receipt_number=7`, /preservados/, 'recibo não pode ser excluído');

// Concorrência: duas sessões tentando alterar ao mesmo tempo continuam bloqueadas.
const results = await Promise.allSettled([db.query(`update public.financeiro set valor=150 where id='${paid}'`), db.query(`update public.financeiro set valor=175 where id='${paid}'`)]);
assert.ok(results.every((r) => r.status === 'rejected'), 'alterações concorrentes bloqueadas');
assert.equal(Number((await one(`select valor from public.financeiro where id='${paid}'`)).valor), 100);

// Estorno
await db.exec(`reset test.uid`);
await rejects(`select public.admin_reverse_receipted_payment('${paid}','motivo qualquer')`, /administrativo/, 'estorno exige administradora');
await db.exec(`set test.uid = '${ADMIN}'`);
await rejects(`select public.admin_reverse_receipted_payment('${paid}','abc')`, /motivo/, 'estorno exige motivo');
const first = (await one(`select public.admin_reverse_receipted_payment('${paid}','Valor lançado em duplicidade') r`)).r;
const again = (await one(`select public.admin_reverse_receipted_payment('${paid}','Valor lançado em duplicidade') r`)).r;
assert.equal(first.already_reversed, false); assert.equal(again.already_reversed, true);
assert.equal(again.reversal_financial_id, first.reversal_financial_id, 'repetição não duplica estorno');
const rev = await one(`select tipo, valor, cliente_id, projeto_id, categoria, source from public.financeiro where id='${first.reversal_financial_id}'`);
assert.deepEqual({ ...rev, valor: Number(rev.valor) }, { tipo: 'saida', valor: 100, cliente_id: A, projeto_id: PA, categoria: 'estorno', source: 'receipt_reversal' });
const rec = await one(`select amount, financial_entry_id, reversed_at is not null as reversed from public.payment_receipts where receipt_number=7`);
assert.equal(Number(rec.amount), 100); assert.equal(rec.financial_entry_id, paid); assert.equal(rec.reversed, true, 'recibo original preservado e marcado como estornado');
const saldo = await one(`select sum(case when tipo='entrada' then valor else -valor end) s from public.financeiro where projeto_id='${PA}' and status='pago'`);
assert.equal(Number(saldo.s), 0, 'saldo do recebimento estornado volta a zero');
assert.equal(Number((await one(`select count(*) c from public.audit_log where action='reverse_receipted_payment'`)).c), 1);

// Recebimento sem recibo continua editável e excluível.
const free = (await one(`insert into public.financeiro(projeto_id,descricao,tipo,valor,data,status) values ('${PA}','livre','entrada',50,'2026-10-10','pago') returning id`)).id;
await db.query(`update public.financeiro set valor=55 where id='${free}'`);
await db.query(`delete from public.financeiro where id='${free}'`);

console.log('PASS (A02/A03): recibo trava alterações e exclusões (inclusive concorrentes), estorno rastreável e idempotente, cadeia cliente/contrato/projeto validada e fluxos legítimos preservados.');
