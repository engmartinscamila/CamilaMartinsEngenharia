import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exported={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/payment-allocation-model.ts','utf8'),{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
}).outputText,{exports:exported,Date,Math,Number,Map,Set,JSON,console,Error});
const {reconcileLedger,planPayment,planReversal,emptyLedger,toCents}=exported;
const today='2026-11-07';
const first=()=>({
  ...emptyLedger(),
  receivables:[{id:'t1',clientId:'c1',contractId:'con1',amount:1000},{id:'t2',clientId:'c2',contractId:null,amount:200}],
  installments:[{id:'a',receivableId:'t1',amount:400,dueDate:'2026-11-01'},
    {id:'b',receivableId:'t1',amount:600,dueDate:'2026-12-01'},
    {id:'c',receivableId:'t2',amount:200,dueDate:'2026-10-01'}],
});
const payment=(id,amount,allocations,extra={})=>({id,requestId:'req-'+id,clientId:'c1',paidOn:today,amount,allocations,...extra});
const equal=(a,b)=>assert.deepEqual(JSON.parse(JSON.stringify(a)),b);
let ledger=first();
let snapshot=reconcileLedger(ledger,today);
assert.equal(snapshot.totalOpen,1200);
assert.equal(snapshot.overdue,600);
ledger=planPayment(ledger,payment('p1',250,[{installmentId:'a',amount:250}]),today);
snapshot=reconcileLedger(ledger,today);
assert.equal(snapshot.totalOpen,950);
assert.equal(snapshot.overdue,350);
assert.equal(snapshot.cashReceived,250);
assert.equal(snapshot.receivables[0].installments[0].remaining,150);
assert.strictEqual(planPayment(ledger,payment('p1',250,[{installmentId:'a',amount:250}]),today),ledger,'Idempotência da solicitação');
assert.throws(()=>planPayment(ledger,payment('p2',250,[{installmentId:'a',amount:200}],{requestId:'req-p1'}),today),/dados diferentes/);
ledger=planPayment(ledger,payment('p2',350,[{installmentId:'a',amount:150},{installmentId:'b',amount:200}]),today);
snapshot=reconcileLedger(ledger,today);
assert.equal(snapshot.receivables[0].remaining,400);
assert.equal(snapshot.receivables[0].overdue,0);
assert.equal(snapshot.receivables[0].installments[1].remaining,400);
assert.equal(snapshot.cashReceived,600);
assert.throws(()=>planPayment(ledger,payment('excess',500,[{installmentId:'b',amount:500}]),today),/excedem o saldo/);
assert.throws(()=>planPayment(ledger,payment('other',20,[{installmentId:'c',amount:20}]),today),/Cliente do pagamento diverge/);
assert.throws(()=>planPayment(ledger,payment('invalid',100,[{installmentId:'b',amount:101}]),today),/excede o pagamento/);
assert.throws(()=>planPayment(ledger,payment('duplicate',100,[{installmentId:'b',amount:50},{installmentId:'b',amount:50}]),today),/Alocação duplicada/);
ledger=planPayment(ledger,payment('advance',50,[]),today);
snapshot=reconcileLedger(ledger,today);
assert.equal(snapshot.cashReceived,650);
assert.equal(snapshot.unallocatedCredit,50);
assert.equal(snapshot.receivables[0].remaining,400,'Adiantamento não abate título arbitrariamente');
ledger=planReversal(ledger,'p2','rev-1','Pagamento devolvido',today);
snapshot=reconcileLedger(ledger,today);
assert.equal(snapshot.cashReceived,300);
assert.equal(snapshot.unallocatedCredit,50);
assert.equal(snapshot.receivables[0].remaining,750);
assert.equal(snapshot.overdue,350);
assert.equal(ledger.payments.length,3,'Estorno preserva pagamento original');
assert.strictEqual(planReversal(ledger,'p2','rev-1','Pagamento devolvido',today),ledger);
assert.throws(()=>planReversal(ledger,'p2','rev-2','Duplicado',today),/já foi estornado/);
assert.throws(()=>planPayment(first(),payment('future',10,[],{paidOn:'2026-12-01'}),today),/Data do pagamento inválida/);
assert.throws(()=>planPayment(first(),payment('precision',0.001,[]),today),/duas casas/);
assert.equal(toCents(1250.37),125037);
equal(reconcileLedger(emptyLedger(),today),{receivables:[],cashReceived:0,unallocatedCredit:0,totalOpen:0,overdue:0});
console.log('PASS: motor financeiro — parcial, repartição em 2 parcelas, crédito, estorno auditável, idempotência, arredondamento, datas e vínculo de cliente.');
