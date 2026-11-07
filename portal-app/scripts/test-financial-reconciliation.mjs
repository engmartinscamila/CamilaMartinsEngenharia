import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const requireDeps={
  '@/lib/financial-model':{financialStatus:(s)=>s==='pago'?'pago':s==='cancelado'?'cancelado':'pendente'},
};
const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/financial-reconciliation.ts','utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText,{exports,Map,Set,Number,console,require:name=>requireDeps[name]??(()=>{throw Error(name)})()});
const {analyzeFinancialIntegrity}=exports;
const clients=[{id:'c',name:'Cliente'}];
const contracts=[{id:'con',clientId:'c',contractNumber:'C-1'}];
const projects=[{id:'p',clientId:'c',contractId:'con'}];
const base={id:'fin-1',clientId:'c',projectId:'p',contractId:'con',amount:100,status:'pago',date:'2026-11-01',paidAt:'2026-11-01',accountId:'acc'};
assert.equal(analyzeFinancialIntegrity([base],contracts,projects,clients,[]).length,0);
let out=analyzeFinancialIntegrity([{...base,amount:0,paidAt:null,accountId:null,clientId:'wrong',contractId:'other'}],contracts,projects,clients,[]);
let codes=out.map(x=>x.code);
for(const code of ['invalid_amount','missing_client','project_client_mismatch','project_contract_mismatch','paid_without_date','paid_without_account'])
  assert(codes.includes(code),'Esperado: '+code);
out=analyzeFinancialIntegrity([base],contracts,projects,clients,[
 {id:'tx-1',matchedFinancialId:'fin-1',accountId:'acc',date:'2026-11-01',amount:100,description:'Pago'},
 {id:'tx-2',matchedFinancialId:'fin-1',accountId:'acc',date:'2026-11-01',amount:100,description:'Pago novamente'},
 {id:'tx-3',matchedFinancialId:'não-existe',accountId:'acc',date:'2026-11-01',amount:100,description:'Sem lançamento'},
]);
assert(out.some(x=>x.code==='bank_link_conflict'));
assert(out.some(x=>x.code==='bank_reference_missing'));
assert.equal(analyzeFinancialIntegrity([],[],[],[],[]).length,0);
console.log('PASS: conferência financeira não destrutiva — vínculos, valores, pagamentos sem conta, datas e conciliação duplicada.');
