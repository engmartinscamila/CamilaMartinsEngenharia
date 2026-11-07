import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(file,deps={}){
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{
  exports,Date,Math,Number,Map,Set,JSON,Error,console,require:name=>{if(!(name in deps))throw Error(name);return deps[name]}
 });
 return exports;
}
const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
let fail=false,rows=[{
 id:uuid(1),payment_id:uuid(2),reference_number:1,issued_at:'2026-11-07T20:00:00Z',
 immutable_snapshot:{payment_id:uuid(2),payment_amount:120.15,paid_on:'2026-11-07',client_name:'Cliente',
 document_is_final:false}
}];
let calls=0;
const supabase={
 from(table){assert.equal(table,'fin_v2_receipt_records');return {select(){return this},order(){return this},range(start,end){
  return Promise.resolve(fail?{data:null,error:{message:'Falha simulada'}}:{data:rows.slice(start,end+1),error:null});
 }}},
 async rpc(name,args){assert.equal(name,'admin_fin_v2_issue_receipt_reference');calls++;return {data:uuid(1),error:null,args};}
};
const mockPaging={readAllRows:async query=>{
 const result=await query.select().order('id').range(0,499);
 return result.error?{data:[],error:result.error}:result;
}};
const deps={'@/lib/supabase':{supabase},
 '@/services/finance-v2-service':{financeV2HomologationEnabled:true},
 '@/lib/paginated-query':mockPaging};
let svc=load('src/services/finance-v2-receipt-service.ts',deps);
let result=await svc.listFinanceV2ReceiptRecords();
assert.equal(result.error,null);
assert.equal(result.data.length,1);
assert.equal(result.data[0].referenceNumber,'1');
assert.equal(result.data[0].paymentId,uuid(2));
assert.equal((await svc.issueFinanceV2ReceiptReference(uuid(2),uuid(3))).data,uuid(1));
assert.equal(calls,1);
assert.equal((await svc.issueFinanceV2ReceiptReference('not-uuid',uuid(3))).data,null);
assert.equal(calls,1);
rows=[{...rows[0],immutable_snapshot:{...rows[0].immutable_snapshot,document_is_final:true}}];
result=await svc.listFinanceV2ReceiptRecords();
assert.equal(result.data,null,'Um documento marcado como definitivo nesta tabela deve falhar.');
rows=[];fail=true;
result=await svc.listFinanceV2ReceiptRecords();
assert.equal(result.data,null);assert(result.error?.includes('Emissão bloqueada'));
fail=false;
svc=load('src/services/finance-v2-receipt-service.ts',{
 ...deps,'@/services/finance-v2-service':{financeV2HomologationEnabled:false}
});
const before=calls;
assert.equal((await svc.listFinanceV2ReceiptRecords()).data,null);
assert.equal((await svc.issueFinanceV2ReceiptReference(uuid(2),uuid(3))).data,null);
assert.equal(calls,before,'Produção não pode chamar RPC nem abrir comprovantes V2.');
console.log('PASS: serviço de comprovantes V2 — vínculo 1:1, leitura completa, snapshot inválido e trava de produção.');
