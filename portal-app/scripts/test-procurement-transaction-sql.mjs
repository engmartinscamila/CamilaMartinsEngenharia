import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const requireDb=createRequire(path.join(process.env.CME_FIN_SQL_ROOT??path.resolve('../../finance-v2-test'),'index.js'));
const {PGlite}=requireDb('@electric-sql/pglite');
const db=new PGlite();
const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const user=uuid(1),project=uuid(2),supplier=uuid(3),other=uuid(4),request=uuid(5),quote2=uuid(8);
await db.exec(`
create schema auth; create role authenticated;create role anon;
create function auth.uid() returns uuid language sql stable as $$select '${user}'::uuid$$;
create function public.is_portal_admin() returns boolean language sql stable as $$select true$$;
create table public.projetos(id uuid primary key);
create table public.suppliers(id uuid primary key,active boolean not null default true);
create table public.purchase_quotes(
 id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projetos(id),
 title text not null,description text,status text not null default 'draft',due_date date,
 selected_supplier_id uuid references public.suppliers(id),client_visible boolean not null default false,
 created_by uuid,created_at timestamptz default now(),updated_at timestamptz default now()
);
create table public.purchase_quote_items(id uuid primary key default gen_random_uuid(),
 quote_id uuid not null references public.purchase_quotes(id) on delete cascade,
 description text not null,quantity numeric not null check(quantity>0),unit text not null,position int not null default 0);
create table public.supplier_bids(id uuid primary key default gen_random_uuid(),
 quote_id uuid not null references public.purchase_quotes(id),
 supplier_id uuid not null references public.suppliers(id),total_amount numeric not null check(total_amount>=0),
 lead_time_days integer,payment_terms text,notes text,updated_at timestamptz default now(),
 unique(quote_id,supplier_id));
create table public.audit_log(id uuid primary key default gen_random_uuid(),user_id uuid,
 action text not null,entity_type text,entity_id uuid,details jsonb,created_at timestamptz default now());
`);
await db.exec(fs.readFileSync('../docs/procurement/0001-atomic-quote-supplier-workflow.sql','utf8'));
const q=(sql,args=[])=>db.query(sql,args);
const one=async(sql,args=[])=> (await q(sql,args)).rows[0];
await q('insert into public.projetos(id) values($1)',[project]);
await q('insert into public.suppliers(id,active) values($1,true),($2,true)',[supplier,other]);
const createSql='select public.admin_create_purchase_quote($1,$2,$3,$4,$5,$6,$7,$8) as id';
const args=[request,project,'Cotação de revestimentos','Proposta completa','2026-11-20','Porcelanato 60x60',25.5,'m²'];
const first=(await one(createSql,args)).id;
assert(first);
const retry=(await one(createSql,args)).id;
assert.equal(first,retry,'Reenvio após perda de resposta não duplica a cotação');
assert.equal((await one('select count(*)::int as n from public.purchase_quotes')).n,1);
assert.equal((await one('select count(*)::int as n from public.purchase_quote_items')).n,1);
await assert.rejects(()=>q(createSql,[...args.slice(0,6),26,'m²']),/dados diferentes/);
await assert.rejects(()=>q(createSql,[uuid(6),project,'Cotação inválida',null,null,'Item',-4,'un']),/quantidade e unidade/);
assert.equal((await one('select count(*)::int as n from public.purchase_quotes')).n,1,'Erro não deve criar cabeçalho órfão');
await q('insert into public.purchase_quotes(id,project_id,title,status) values($1,$2,$3,$4)',[quote2,project,'Outra cotação','collecting']);
const addSql='select public.admin_register_supplier_bid($1,$2,$3,$4,$5,$6) as id';
const bid=(await one(addSql,[first,supplier,550.25,7,'Pix à vista',null])).id;
assert(bid);
assert.equal((await one(addSql,[first,supplier,550.25,7,'Pix à vista',null])).id,bid,'Upsert de mesma proposta');
await one(addSql,[quote2,other,510,5,'Boleto',null]);
await assert.rejects(()=>q('select public.admin_approve_supplier_bid($1,$2)',[first,other]),/não apresentou proposta/);
const approve=await one('select public.admin_approve_supplier_bid($1,$2) as id',[first,supplier]);
assert.equal(approve.id,first);
assert.equal((await one('select public.admin_approve_supplier_bid($1,$2) as id',[first,supplier])).id,first,'Reenvio idempotente');
await assert.rejects(()=>q(addSql,[first,other,400,2,'Boleto',null]),/não aceita alteração/);
await assert.rejects(()=>q('select public.admin_approve_supplier_bid($1,$2)',[first,other]),/Nova escolha exige revisão/);
assert.equal((await one('select count(*)::int as n from public.supplier_bids where quote_id=$1',[first])).n,1);
assert.equal((await one("select count(*)::int as n from public.audit_log where action='supplier_bid_approved'")).n,1,'Não repetir evento de aprovação');
assert.equal((await one('select selected_supplier_id from public.purchase_quotes where id=$1',[first])).selected_supplier_id,supplier);
assert.equal((await one("select has_function_privilege('anon','public.admin_create_purchase_quote(uuid,uuid,text,text,date,text,numeric,text)','EXECUTE') as allowed")).allowed,false);
assert.equal((await one("select has_function_privilege('anon','public.admin_approve_supplier_bid(uuid,uuid)','EXECUTE') as allowed")).allowed,false);
await db.exec('create or replace function public.is_portal_admin() returns boolean language sql stable as $$select false$$');
await assert.rejects(()=>q(createSql,[uuid(7),...args.slice(1)]),/Acesso administrativo obrigatório/);
await assert.rejects(()=>q('select public.admin_approve_supplier_bid($1,$2)',[first,supplier]),/Acesso administrativo obrigatório/);
await db.close();
console.log('PASS: cotação atômica — idempotência, propostas únicas, autorização, bloqueio de troca indevida e sem cabeçalho órfão.');
