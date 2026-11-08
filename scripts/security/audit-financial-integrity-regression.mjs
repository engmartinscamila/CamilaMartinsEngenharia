import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
await db.exec(`create schema private;create role anon;create role authenticated;
create table clientes(id uuid primary key);
create table contratos(id uuid primary key,cliente_id uuid references clientes(id));
create table projetos(id uuid primary key,cliente_id uuid references clientes(id),contract_id uuid references contratos(id));
create table financeiro(id uuid primary key default gen_random_uuid(),cliente_id uuid references clientes(id),contract_id uuid references contratos(id),projeto_id uuid references projetos(id),descricao text,tipo text,valor numeric(12,2),data date,status text,data_pagamento date,forma_pagamento text,observacoes text,categoria text);
create table payment_receipts(id uuid primary key default gen_random_uuid(),financial_entry_id uuid,client_id uuid,project_id uuid,amount numeric(14,2),paid_on date,description text,snapshot jsonb);
insert into clientes values('${id(1)}'),('${id(2)}');
insert into contratos values('${id(11)}','${id(1)}'),('${id(12)}','${id(2)}'),('${id(13)}','${id(1)}');
insert into projetos values('${id(21)}','${id(1)}','${id(11)}'),('${id(22)}','${id(2)}','${id(12)}'),('${id(23)}','${id(1)}',null);`);
const file='supabase/migrations/20261108020416_audit_financial_receipt_integrity.sql';
await db.exec(fs.readFileSync(file,'utf8'));
await db.exec(fs.readFileSync(file,'utf8')); // reapplying definitions is safe
const insert=async(n,{client=id(1),contract=null,project=null}={})=>db.query(`insert into financeiro(id,cliente_id,contract_id,projeto_id,descricao,tipo,valor,data,status,data_pagamento,forma_pagamento) values($1,$2,$3,$4,'Serviço QA','entrada',100,'2026-10-01','pago','2026-10-01','Pix') returning *`,[id(n),client,contract,project]);
await insert(31); // standalone service
await insert(32,{contract:id(11)}); // contract without project
await insert(33,{project:id(23)}); // project before contract
await insert(34,{client:null,project:id(21)}); // derive actual client
await insert(35,{client:null,contract:id(11)});
assert.equal((await db.query('select cliente_id from financeiro where id=$1',[id(34)])).rows[0].cliente_id,id(1));
for(const input of [{client:id(2),project:id(21)},{client:id(2),contract:id(11)},{project:id(21),contract:id(12)},{project:id(21),contract:id(13)},{client:null}])await assert.rejects(insert(90,input),/incompat|Identifique/);
await assert.rejects(db.query('update financeiro set cliente_id=$1 where id=$2',[id(2),id(34)]),/incompat/);
await assert.rejects(db.query('update projetos set cliente_id=$1 where id=$2',[id(2),id(21)]),/histórico/);
await assert.rejects(db.query('update contratos set cliente_id=$1 where id=$2',[id(2),id(11)]),/histórico/);

// The real issuance sequence creates an immutable snapshot, then links it in
// the same transaction. A failure must roll both writes back.
await db.exec(`begin;insert into payment_receipts(id,client_id,project_id,amount,paid_on,description,snapshot) values('${id(41)}','${id(1)}','${id(21)}',100,'2026-10-01','Serviço QA','{"source":"QA"}');update payment_receipts set financial_entry_id='${id(34)}' where id='${id(41)}';commit;`);
for(const change of ["valor=200","cliente_id='"+id(2)+"'","projeto_id=null","status='cancelado'","descricao='Alterado'","forma_pagamento='Dinheiro'","data_pagamento='2026-10-02'"]){
 await assert.rejects(db.exec(`update financeiro set ${change} where id='${id(34)}'`),/recibo emitido/);
}
await assert.rejects(db.query('delete from financeiro where id=$1',[id(34)]),/recibo emitido/);
await db.query("update financeiro set categoria='consultoria',observacoes='Conferência interna QA' where id=$1",[id(34)]);
await assert.rejects(db.query('delete from payment_receipts where id=$1',[id(41)]),/imutável/);
await assert.rejects(db.query('update payment_receipts set amount=200 where id=$1',[id(41)]),/imutável/);
await assert.rejects(db.query('update payment_receipts set financial_entry_id=null where id=$1',[id(41)]),/imutável/);
await assert.rejects(db.query('update payment_receipts set financial_entry_id=$1 where id=$2',[id(35),id(41)]),/imutável/);
await assert.rejects(db.query("insert into payment_receipts(financial_entry_id,client_id,project_id,amount,paid_on,description) values($1,$2,$3,200,'2026-10-01','Serviço QA')",[id(34),id(1),id(21)]),/não corresponde/);
await assert.rejects(db.query("insert into payment_receipts(financial_entry_id,client_id,amount,paid_on,description) values($1,$2,100,'2026-10-01','Serviço QA')",[id(99),id(1)]),/não encontrado/);
assert.equal(Number((await db.query('select valor from financeiro where id=$1',[id(34)])).rows[0].valor),100);
assert.equal(Number((await db.query('select count(*) n from payment_receipts')).rows[0].n),1);
for(const role of ['anon','authenticated'])for(const fn of ['guard_financial_origin_and_receipt','guard_receipt_financial_equivalence','guard_financial_parent_origin'])assert.equal((await db.query(`select has_function_privilege($1,$2,'execute') allowed`,[role,'private.'+fn+'()'])).rows[0].allowed,false);
await db.close();
console.log('PASS A02/A03 candidate SQL: valid standalone/direct/precontract origins, incompatible IDs and parent edits rejected; receipt and payment immutable; no public trigger execution grants. Not a production/concurrency homologation.');
