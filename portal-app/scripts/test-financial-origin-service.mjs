import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(file,deps={}){
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,
 {exports,console,Date,Intl,Number,Math,Map,Set,JSON,Error,require:name=>{if(!(name in deps))throw Error(name);return deps[name];}});
 return exports;
}
const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
let rows=[{id:1,financial_entry_id:uuid(1),classification:'servico_avulso',reason:'Serviço sem contrato formal',entry_snapshot:{
 client_id:uuid(2),project_id:null,contract_id:null,amount:'125.50',type:'entrada',status:'pago'
}}];
let error=false,calls=0;
const fake={
 from(table){assert.equal(table,'financial_origin_review_events');return {select(){return this}}},
 async rpc(name,args){assert.equal(name,'admin_review_financial_origin');assert.equal(args.p_classification,'servico_avulso');calls++;return {data:12,error:null};}
};
const paging={readAllRows:async()=>error?{data:[],error:{message:'falha'}}:{data:rows,error:null}};
const svc=load('src/services/financial-origin-review-service.ts',{
 '@/lib/supabase':{supabase:fake},'@/lib/paginated-query':paging
});
let result=await svc.listFinancialOriginReviews();
assert.equal(result.error,null);
assert.equal(result.data[0].snapshot.amount,125.5);
assert.equal(result.data[0].classification,'servico_avulso');
assert.equal((await svc.recordFinancialOriginReview({financialEntryId:uuid(1),classification:'servico_avulso',
 reason:'Serviço avulso confirmado',requestId:uuid(3)})).data,12);
assert.equal(calls,1);
assert((await svc.recordFinancialOriginReview({financialEntryId:'invalido',classification:'servico_avulso',
 reason:'Serviço avulso confirmado',requestId:uuid(3)})).error);
assert.equal(calls,1);
error=true;result=await svc.listFinancialOriginReviews();
assert.equal(result.data,null);assert(result.error?.includes('migração não pode ser liberada'));
error=false;rows=[{...rows[0],entry_snapshot:{...rows[0].entry_snapshot,amount:'NaN'}}];
result=await svc.listFinancialOriginReviews();assert.equal(result.data,null);
console.log('PASS: classificação avulso — serviço com paginação íntegra, validação, RPC e bloqueio em dados incompletos.');
