import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const helper=(file,deps={})=>{
  const exports={};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
  }).outputText,{exports,require:name=>{if(!(name in deps))throw Error(name);return deps[name]},Map,Set,JSON,Date,Math,Number,Array,Error,console});
  return exports;
};
const money=helper('src/lib/payment-allocation-model.ts');
const m=helper('src/lib/finance-v2-forms.ts',{'@/lib/payment-allocation-model':money});
const pure=(value)=>JSON.parse(JSON.stringify(value));
assert.deepEqual(pure(m.buildMonthlyInstallments(100,3,'2027-01-31')),[{amount:33.34,dueDate:'2027-01-31'},{amount:33.33,dueDate:'2027-02-28'},{amount:33.33,dueDate:'2027-03-31'}]);
assert.deepEqual(pure(m.buildMonthlyInstallments(0.03,3,'2028-02-29')),[{amount:0.01,dueDate:'2028-02-29'},{amount:0.01,dueDate:'2028-03-29'},{amount:0.01,dueDate:'2028-04-29'}]);
assert.throws(()=>m.buildMonthlyInstallments(0.02,3,'2027-01-01'),/insuficiente/);
assert.throws(()=>m.buildMonthlyInstallments(100,0,'2027-01-01'),/1 a 60/);
assert.throws(()=>m.buildMonthlyInstallments(100,3,'2027-02-30'),/inválida/);
const debts=[{installmentId:'future',dueDate:'2027-12-01',remaining:90},{installmentId:'late',dueDate:'2027-01-01',remaining:40}];
assert.deepEqual(pure(m.suggestPaymentDistribution(100,debts)),{allocations:[{installmentId:'late',amount:40},{installmentId:'future',amount:60}],applied:100,unallocated:0});
assert.deepEqual(pure(m.suggestPaymentDistribution(200,debts)),{allocations:[{installmentId:'late',amount:40},{installmentId:'future',amount:90}],applied:130,unallocated:70});
assert.throws(()=>m.suggestPaymentDistribution(5,[debts[0],debts[0]]),/duplicadas/);
assert.throws(()=>m.suggestPaymentDistribution(0.001,debts),/casas decimais/);
console.log('PASS: parcelamento em centavos e distribuição automática em ordem de vencimento com sobra explícita.');
