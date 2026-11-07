import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file,deps={}){
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{
  exports,console,Date,Intl,Math,Number,Map,Set,JSON,Error,require:name=>{if(!(name in deps))throw Error('Missing: '+name);return deps[name]}
 });
 return exports;
}
const model=load('src/lib/payment-allocation-model.ts');
const format=load('src/lib/format.ts');
const date='2026-11-07';
const financial={financialToday:()=>date};
const uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const client=uid(1),account=uid(2),title=uid(3),a=uid(4),b=uid(5),payment=uid(6);
const database={
 clientes:[{id:client,nome:'Cliente de homologação'}],
 contratos:[],projetos:[],financial_accounts:[{id:account,name:'Conta'}],
 fin_v2_receivables:[{id:title,client_id:client,contract_id:null,project_id:null,amount:1000,created_at:date}],
 fin_v2_installments:[{id:a,receivable_id:title,due_date:'2026-10-01',amount:400},{id:b,receivable_id:title,due_date:'2026-12-01',amount:600}],
 fin_v2_payments:[{id:payment,request_id:uid(7),client_id:client,account_id:account,amount:250,paid_on:date,payment_method:'Pix'}],
 fin_v2_allocations:[{payment_id:payment,installment_id:a,amount:250}],
 fin_v2_reversals:[]
};
const calls=[];let failTable=null,failRpc=false;
const supabase={
 from(table){
  return {select(){return this},order(){return this},async range(start,end){
   if(table===failTable)return {data:null,error:{message:'Falha simulada'}};
   return {data:(database[table]??[]).slice(start,end+1),error:null};
  }};
 },
 async rpc(name,args){calls.push({name,args});return failRpc?{data:null,error:{message:'Falha de conexão'}}:{data:uid(9),error:null};}
};
const dependencies={'@/lib/env':{env:{isHomologation:true,projectRef:'nvhjcoxnzigwwbdbhkhq',isSupabaseConfigured:true}},
 '@/lib/supabase':{supabase},
 '@/lib/payment-allocation-model':model,
 '@/lib/financial-model':financial,'@/lib/format':format};
const service=load('src/services/finance-v2-service.ts',dependencies);
assert.equal(service.financeV2HomologationEnabled,true);
let result=await service.loadFinanceV2Snapshot();
assert.equal(result.error,null);
assert.equal(result.data.totalOpen,750);
assert.equal(result.data.overdue,150);
assert.equal(result.data.cashReceived,250);
assert.equal(result.data.unallocatedCredit,0);
assert.equal(result.data.installments.find(x=>x.id===a).remaining,150);
failTable='fin_v2_installments';
result=await service.loadFinanceV2Snapshot();
assert.equal(result.data,null,'Uma página faltando não pode gerar saldo parcial');
assert(result.error?.includes('Nenhum total parcial'));
failTable=null;
const titleReq={requestId:uid(20),clientId:client,contractId:null,projectId:null,amount:1000,installments:[{dueDate:'2026-11-10',amount:500},{dueDate:'2026-12-10',amount:500}]};
result=await service.createFinanceV2Title(titleReq);
assert.equal(result.data,uid(9));
assert.equal(calls.at(-1).name,'admin_fin_v2_create_receivable');
assert.equal(calls.at(-1).args.p_data.installments[0].due_date,'2026-11-10');
assert.equal((await service.createFinanceV2Title({...titleReq,amount:100})).data,null);
const paymentReq={requestId:uid(21),clientId:client,accountId:account,amount:400,paidOn:date,method:'Pix',allocations:[{installmentId:a,amount:150},{installmentId:b,amount:250}]};
result=await service.recordFinanceV2Payment(paymentReq);
assert.equal(result.data,uid(9));
assert.equal(calls.at(-1).name,'admin_fin_v2_record_payment');
assert.equal(calls.at(-1).args.p_data.allocations.length,2);
assert.equal((await service.recordFinanceV2Payment({...paymentReq,amount:300})).data,null);
assert.equal((await service.recordFinanceV2Payment({...paymentReq,paidOn:'2027-01-01'})).data,null);
result=await service.reverseFinanceV2Payment(payment,uid(22),'Pagamento cancelado');
assert.equal(result.data,uid(9));
assert.equal(calls.at(-1).name,'admin_fin_v2_reverse_payment');
failRpc=true;result=await service.recordFinanceV2Payment(paymentReq);
assert.equal(result.data,null);assert(result.error?.includes('Falha de conexão'));
const production=load('src/services/finance-v2-service.ts',{...dependencies,'@/lib/env':{env:{isHomologation:false,projectRef:'hghtwlopqztfcosfxafd',isSupabaseConfigured:true}}});
assert.equal(production.financeV2HomologationEnabled,false);
const numCalls=calls.length;
const guarded=await production.loadFinanceV2Snapshot();
assert.equal(guarded.data,null);
assert.equal((await production.createFinanceV2Title(titleReq)).data,null);
assert.equal((await production.recordFinanceV2Payment(paymentReq)).data,null);
assert.equal((await production.reverseFinanceV2Payment(payment,uid(22),'Estorno')).data,null);
assert.equal(calls.length,numCalls,'Nenhuma chamada de escrita ou leitura no banco de produção.');
console.log('PASS: serviço V2 — guarda de ambiente, RLS delegada ao banco, saldo reconciliado, bloqueio de totais parciais e RPCs idempotentes.');
