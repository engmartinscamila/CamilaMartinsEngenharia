import fs from 'node:fs';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';

// D04: proposta aprovada → pedido de compra → contas a pagar (financeiro), em banco efêmero.
const db = new PGlite();
let checks = 0;
const sql = (q) => db.exec(q);
const scalar = async (q) => (await db.query(q)).rows[0]?.value;
const ok = (c, d) => { assert.ok(c, d); checks += 1; };
const fails = async (q, pattern) => {
  let error = null; try { await sql(q); } catch (cause) { error = cause; }
  assert.ok(error, `Deveria bloquear: ${q.slice(0, 120)}`); if (pattern) assert.match(String(error.message), pattern); checks += 1;
};
const json = (v) => `'${JSON.stringify(v).replaceAll("'", "''")}'::jsonb`;
const admin = '40000000-0000-4000-8000-000000000001', project = '40000000-0000-4000-8000-000000000002';
const quote = '40000000-0000-4000-8000-000000000003', supplier = '40000000-0000-4000-8000-000000000004', other = '40000000-0000-4000-8000-000000000005';
const req = '40000000-0000-4000-8000-000000000006';
await sql(`
create role anon; create role authenticated; create role service_role; create schema auth; create schema private;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('cme.uid',true),'')::uuid $$;
create function public.is_portal_admin() returns boolean language sql stable as $$ select coalesce(auth.uid()='${admin}'::uuid,false) $$;
create table public.projetos(id uuid primary key, cliente_id uuid);
create table public.suppliers(id uuid primary key, name text, active boolean default true);
create table public.purchase_quotes(id uuid primary key, project_id uuid references public.projetos(id), title text, status text, selected_supplier_id uuid, updated_at timestamptz);
create table public.supplier_bids(id uuid primary key default gen_random_uuid(), quote_id uuid references public.purchase_quotes(id), supplier_id uuid references public.suppliers(id), total_amount numeric, payment_terms text);
create table public.audit_log(user_id uuid, action text, entity_type text, entity_id uuid, details jsonb);
create table public.financeiro(id uuid primary key default gen_random_uuid(), projeto_id uuid, descricao text, tipo text, valor numeric, data date,
  status text check (status in ('previsto','pendente','pago','atrasado','cancelado')), data_vencimento date, data_pagamento date, categoria text, source text, observacoes text);
insert into public.projetos values('${project}',null);
insert into public.suppliers values('${supplier}','Fornecedor A',true),('${other}','Fornecedor B',true);
insert into public.purchase_quotes values('${quote}','${project}','Concreto usinado','analysis',null,now());
insert into public.supplier_bids(quote_id,supplier_id,total_amount,payment_terms) values('${quote}','${supplier}',1000.50,'30/60'),('${quote}','${other}',900,'à vista');
`);
await sql(fs.readFileSync(new URL('../../supabase/migrations/20261108130000_purchase_orders_accounts_payable.sql', import.meta.url), 'utf8'));
checks += 1;
await sql(`select set_config('cme.uid','${admin}',false)`);
const two = [{ due_date: '2026-12-10', amount: 500.25 }, { due_date: '2027-01-10', amount: 500.25 }];
await fails(`select public.admin_create_purchase_order('${quote}','${req}',${json(two)})`, /Aprove a proposta/);
await sql(`update public.purchase_quotes set status='approved', selected_supplier_id='${supplier}' where id='${quote}'`);
await fails(`select public.admin_create_purchase_order('${quote}','${req}',${json([{ due_date: '2026-12-10', amount: 900 }])})`, /soma das parcelas/i);
await fails(`select public.admin_create_purchase_order('${quote}','${req}',${json([{ due_date: '2026-12-10', amount: 1000.505 }])})`, /2 casas/);
const order = (await db.query(`select to_jsonb(public.admin_create_purchase_order('${quote}','${req}',${json(two)},'2026-12-01','Entrega na obra')) o`)).rows[0].o;
ok(order.order_number === 'PC-000001' && Number(order.total_amount) === 1000.5, 'Pedido emitido com o valor da proposta aprovada');
ok(await scalar(`select count(*)::int value from public.financeiro where purchase_order_id='${order.id}' and tipo='saida' and status='pendente' and categoria='compras'`) === 2, 'Duas contas a pagar pendentes');
ok(Number(await scalar(`select sum(valor)::text value from public.financeiro where purchase_order_id='${order.id}'`)) === 1000.5, 'Soma das parcelas = pedido');
ok(await scalar(`select status value from public.purchase_quotes where id='${quote}'`) === 'ordered', 'Cotação passa a "pedido emitido"');
const again = (await db.query(`select to_jsonb(public.admin_create_purchase_order('${quote}','${req}',${json(two)})) o`)).rows[0].o;
ok(again.id === order.id && await scalar(`select count(*)::int value from public.financeiro`) === 2, 'Reenvio não duplica pedido nem contas');
await fails(`select public.admin_create_purchase_order('${quote}',gen_random_uuid(),${json(two)})`, /já possui o pedido/);

await fails(`update public.financeiro set valor=1 where purchase_order_id='${order.id}'`, /definidos pelo pedido/);
await fails(`delete from public.financeiro where purchase_order_id='${order.id}'`, /não é excluída/);
await fails(`insert into public.financeiro(projeto_id,tipo,valor,status,purchase_order_id) values('${project}','saida',1,'pendente','${order.id}')`, /só é criado pelo próprio pedido/);
await sql(`update public.financeiro set status='pago', data_pagamento='2026-12-10' where purchase_order_id='${order.id}' and data_vencimento='2026-12-10'`);
ok(await scalar(`select count(*)::int value from public.financeiro where status='pago'`) === 1, 'Pagamento da parcela pelo Financeiro continua livre');

await fails(`select public.admin_cancel_purchase_order('${order.id}','Fornecedor desistiu')`, /parcela paga/);
await fails(`select public.admin_mark_purchase_order_received('${order.id}','2999-01-01')`, /já ocorrida/);
const received = (await db.query(`select to_jsonb(public.admin_mark_purchase_order_received('${order.id}','2026-11-05')) o`)).rows[0].o;
ok(received.status === 'recebido', 'Recebimento registrado');

// Cancelamento sem parcela paga: pendentes ficam canceladas, nada é apagado.
const quote2 = '40000000-0000-4000-8000-000000000013';
await sql(`insert into public.purchase_quotes values('${quote2}','${project}','Aço','approved','${other}',now());
insert into public.supplier_bids(quote_id,supplier_id,total_amount) values('${quote2}','${other}',300)`);
const o2 = (await db.query(`select to_jsonb(public.admin_create_purchase_order('${quote2}',gen_random_uuid(),${json([{ due_date: '2026-12-01', amount: 300 }])})) o`)).rows[0].o;
ok(o2.order_number === 'PC-000002', 'Numeração sequencial');
const cancelled = (await db.query(`select to_jsonb(public.admin_cancel_purchase_order('${o2.id}','Compra desnecessária')) o`)).rows[0].o;
ok(cancelled.status === 'cancelado' && await scalar(`select status value from public.financeiro where purchase_order_id='${o2.id}'`) === 'cancelado', 'Cancelamento preserva e cancela a conta a pagar');

await sql(`select set_config('cme.uid','',false)`);
await fails(`select public.admin_create_purchase_order('${quote2}',gen_random_uuid(),${json(two)})`, /administrativo/);
console.log(`PEDIDO DE COMPRA E CONTAS A PAGAR: ${checks} verificações passaram em PostgreSQL efêmero.`);
