import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const requireDb=createRequire(path.join(process.env.CME_FIN_SQL_ROOT??path.resolve('../../finance-v2-test'),'index.js'));
const {PGlite}=requireDb('@electric-sql/pglite');
const db=new PGlite();
const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const user=uuid(1),client=uuid(2),financial=uuid(3),request=uuid(4);
await db.exec(`
create schema auth;
create role authenticated;create role anon;
create function auth.uid() returns uuid language sql stable as $$select '${user}'::uuid$$;
create function public.is_portal_admin() returns boolean language sql stable as $$select true$$;
create table public.financeiro(id uuid primary key,cliente_id uuid,contract_id uuid,projeto_id uuid,tipo text,valor numeric,status text);
create table public.audit_log(id uuid primary key default gen_random_uuid(),user_id uuid,action text,entity_type text,entity_id uuid,details jsonb);
`);
await db.exec(fs.readFileSync('../docs/finance-v2/0003-legacy-origin-review-candidate.sql','utf8'));
const q=(sql,args=[])=>db.query(sql,args);
const one=async(sql,args=[])=> (await q(sql,args)).rows[0];
await q('insert into public.financeiro(id,cliente_id,tipo,valor,status) values ($1,$2,$3,$4,$5)',
 [financial,client,'entrada',125.5,'pago']);
const result=await one('select public.admin_review_financial_origin($1,$2,$3,$4) as id',
 [financial,'servico_avulso','Serviço prestado diretamente sem contrato',request]);
const reviewId=Number(result.id);
assert(reviewId>0);
assert.equal(Number((await one('select public.admin_review_financial_origin($1,$2,$3,$4) as id',
 [financial,'servico_avulso','Serviço prestado diretamente sem contrato',request])).id),reviewId);
assert.equal(Number((await one('select count(*)::int as n from public.financial_origin_review_events')).n),1);
await assert.rejects(()=>q('select public.admin_review_financial_origin($1,$2,$3,$4)',
 [financial,'vinculo_pendente','Serviço prestado diretamente sem contrato',request]),/reutilizado/);
await assert.rejects(()=>q('select public.admin_review_financial_origin($1,$2,$3,$4)',
 [financial,'servico_avulso','curto',uuid(5)]),/justificativa/);
await q('update public.financeiro set valor=200 where id=$1',[financial]);
assert.equal((await one('select entry_snapshot from public.financial_origin_review_events where id=$1',[reviewId])).entry_snapshot.amount,'125.5');
assert.equal(Number((await one('select count(*)::int as n from public.financeiro')).n),1,'A classificação não cria lançamento no caixa');
await q('update public.financeiro set contract_id=$1 where id=$2',[uuid(6),financial]);
await assert.rejects(()=>q('select public.admin_review_financial_origin($1,$2,$3,$4)',
 [financial,'servico_avulso','Registro já possui contrato',uuid(7)]),/sem contrato e sem projeto/);
await q('set role authenticated');
await assert.rejects(()=>q('insert into public.financial_origin_review_events(request_id,financial_entry_id,classification,reason,entry_snapshot,reviewed_by) values ($1,$2,$3,$4,$5,$6)',
 [uuid(8),financial,'servico_avulso','Tentativa indevida',JSON.stringify({amount:2}),user]),/permission denied|row-level security/);
await q('reset role');
await db.exec('create or replace function public.is_portal_admin() returns boolean language sql stable as $$select false$$');
await q('set role authenticated');
assert.equal(Number((await one('select count(*)::int as n from public.financial_origin_review_events')).n),0);
await assert.rejects(()=>q('select public.admin_review_financial_origin($1,$2,$3,$4)',
 [financial,'vinculo_pendente','Tentativa sem autorização',uuid(9)]),/administrativo/);
await q('reset role');
assert.equal((await one("select has_function_privilege('anon','public.admin_review_financial_origin(uuid,text,text,uuid)','EXECUTE') as allowed")).allowed,false);
await db.close();
console.log('PASS: classificação no PostgreSQL — idempotência, append-only, snapshot, autorização e nenhum movimento financeiro.');
