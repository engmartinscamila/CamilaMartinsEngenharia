import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(file,deps={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date,Intl,Math,Map,Set,require:n=>{if(!(n in deps))throw Error('Missing '+n);return deps[n];}});return exports;}
const model=load('src/lib/financial-model.ts');
const dash=load('src/lib/admin-dashboard-model.ts',{'@/lib/financial-model':model});
const today='2026-11-11';
assert.deepEqual([...dash.monthKeys(3,today)],['2026-09','2026-10','2026-11']);
assert.deepEqual([...dash.monthKeys(3,'2026-01-05')],['2025-11','2025-12','2026-01'],'Virada de ano');
assert.equal(dash.monthLabel('2026-11'),'nov/26');
const e=(o)=>({id:Math.random().toString(),projectId:'p',projectName:'P',clientName:'C',contractNumber:'K',category:'materiais',description:'d',date:null,notes:null,accountId:null,dueDate:null,paidAt:null,...o});
const entries=[e({type:'entrada',status:'pago',amount:100.1,paidAt:'2026-11-02'}),e({type:'entrada',status:'pago',amount:0.2,paidAt:'2026-11-03'}),e({type:'saida',status:'pago',amount:50,paidAt:'2026-10-03'}),
 e({type:'entrada',status:'pendente',amount:300,dueDate:'2026-11-20'}),e({type:'entrada',status:'pendente',amount:80,dueDate:'2026-11-01'}),e({type:'entrada',status:'cancelado',amount:999,paidAt:'2026-11-04'}),
 e({type:'saida',status:'pendente',amount:70,dueDate:'2026-11-25',category:'taxas'})];
const buckets=dash.cashByMonth(entries,3,today);
assert.equal(buckets[2].received,100.3,'Soma em centavos, sem erro de ponto flutuante');
assert.equal(buckets[1].paid,50);
const k=dash.dashboardKpis(entries,buckets,today);
assert.equal(k.receivable,380);assert.equal(k.overdueCount,1);assert.equal(k.overdueAmount,80);assert.equal(k.payable,70);
assert.equal(k.dueNext30.length,1,'Só parcelas futuras em até 30 dias');assert.equal(k.balanceInPeriod,50.3);
const costs=dash.costsByCategory(entries,buckets);assert.equal(costs[0].amount,70);assert.equal(costs.length,2,'Cancelados fora dos custos');
const prog=dash.activeProjectProgress([{id:'a',name:'A',clientName:'x',progress:80,status:'ativo'},{id:'b',name:'B',clientName:'y',progress:null,status:'ativo'},{id:'c',name:'C',clientName:'z',progress:100,status:'concluido'}]);
assert.deepEqual(prog.map(p=>p.id),['b','a'],'Obras concluídas fora; menos avançadas primeiro');
const c=dash.contractOverview([{status:'active',contractValue:1000,addendumValue:200},{status:'active',contractValue:null},{status:'completed',contractValue:5}]);
assert.equal(c.active,2);assert.equal(c.activeValue,1200);assert.equal(c.missingValue,1);
console.log('Painel do admin: períodos, somas em centavos, atrasos, vencimentos, custos, obras e contratos OK.');
