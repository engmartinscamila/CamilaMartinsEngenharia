import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const module={exports:{}};
const code=ts.transpileModule(fs.readFileSync('src/lib/receivable-priorities.ts','utf8'),{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},
}).outputText;
vm.runInNewContext(code,{module,exports:module.exports,Intl,Number,Math,console});
const {receivableOverview,prioritizeReceivables}=module.exports;
const row=(id,extra={})=>({
 id,clientName:'Cliente '+id,contractNumber:id,contractValue:1000,received:400,pending:300,
 remaining:600,unscheduled:300,overdue:0,credit:0,entries:[],inactive:false,...extra
});
const rows=[
 row('normal',{remaining:400,unscheduled:0}),
 row('vencido',{clientName:'João',remaining:600,overdue:150,unscheduled:0}),
 row('sem-parcelas',{remaining:800,unscheduled:500}),
 row('credito',{remaining:0,pending:0,unscheduled:0,credit:35}),
 row('inativo',{remaining:9000,overdue:9000,unscheduled:9000,inactive:true}),
];
const totals=receivableOverview(rows);
assert.equal(totals.total,1800,'Não contabilizar contrato inativo ou duplicar parcelas');
assert.equal(totals.overdue,150,'Atraso apenas de contratos ativos');
assert.equal(totals.unplanned,500,'Saldo sem parcela não deve ser lançado duas vezes');
assert.equal(totals.credit,35,'Crédito não aumenta o saldo a receber');
assert.equal(totals.overdueCount,1);
assert.equal(totals.unplannedCount,1);
assert.deepEqual(Array.from(prioritizeReceivables(rows,'overdue'),r=>r.id),['vencido']);
assert.deepEqual(Array.from(prioritizeReceivables(rows,'unplanned'),r=>r.id),['sem-parcelas']);
assert.deepEqual(Array.from(prioritizeReceivables(rows,'credit'),r=>r.id),['credito']);
assert.deepEqual(Array.from(prioritizeReceivables(rows,'inactive'),r=>r.id),['inativo']);
assert.deepEqual(Array.from(prioritizeReceivables(rows,'all'),r=>r.id),['vencido','sem-parcelas','normal','credito','inativo']);
assert.deepEqual(Array.from(prioritizeReceivables(rows,'all','JOAO'),r=>r.id),['vencido'],'Pesquisa deve ignorar acentos');
assert.equal(receivableOverview([]).total,0);
console.log('PASS: painel a receber — filtros, prioridade, créditos, contratos inativos, pesquisa e totais sem duplicação.');
