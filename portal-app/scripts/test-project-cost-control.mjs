import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync('src/lib/project-cost-control.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
}).outputText;
const exports = {};
vm.runInNewContext(compiled, {exports, Set, Error, Math, Number});
const calculate = exports.calculateProjectCostEvidence;
const activity = (code, plannedCost, measuredCost = null) =>
  ({code, activity: code, plannedCost, measuredCost});
const expense = (id, amount, status, type = 'saida') =>
  ({id, type, amount, status});
const quote = (id, selectedAmount, status = 'approved') =>
  ({id, title: id, status, selectedAmount, selectedSupplierId: 's1'});

let result = calculate([
  activity('FUN', 1000, 450),
  activity('ALV', 220.33, null),
], [
  expense('f1', 100.13, 'pago'),
  expense('f2', 20.20, 'pendente'),
  expense('f3', 800, 'pago', 'entrada'),
], [
  quote('q1', 90.22),
  quote('q2', 150, 'draft'),
], true);
assert.equal(result.plannedTotal, 1220.33);
assert.equal(result.measuredTotal, 450);
assert.equal(result.paidExpenses, 100.13);
assert.equal(result.pendingExpenses, 20.2);
assert.equal(result.selectedQuoteTotal, 90.22);
assert.equal(result.selectedQuoteCount, 1);
assert.equal(result.budgetMinusRegisteredExpenses, 1100);
assert.equal(result.unmeasuredItems, 1);

result = calculate([activity('FUND', null, null)], [], [], true);
assert.equal(result.plannedTotal, null);
assert.equal(result.budgetMinusRegisteredExpenses, null);
assert.equal(result.unpricedItems, 1);

result = calculate([activity('FUN', 100)], [
  expense('p1', 5, 'cancelado'),
  expense('p2', 8, 'desconhecido'),
], [quote('q1', null), quote('q2', 10)], true);
assert.equal(result.unclassifiedExpenses, 1);
assert.equal(result.budgetMinusRegisteredExpenses, null);
assert.equal(result.missingSelectedBids, 1);
assert.equal(result.selectedQuoteTotal, 10);

result = calculate([activity('FUN', 200)], [], [], false);
assert.equal(result.plannedTotal, null); // rascunho/legado nunca vira baseline aprovada
result = calculate([], [], [], true);
assert.equal(result.plannedTotal, null); // orçamento vazio não é orçamento de custo zero

assert.throws(() => calculate([], [expense('f1', 1, 'pago'), expense('f1', 1, 'pago')], [], true), /duplicado/);
assert.throws(() => calculate([], [], [quote('q1', 10), quote('q1', 10)], true), /duplicada/);
assert.throws(() => calculate([activity('F', Number.NaN)], [], [], true), /inválido/);
assert.throws(() => calculate([], [expense('f1', -2, 'pago')], [], true), /inválido/);
assert.throws(() => calculate([activity('F', Number.MAX_VALUE)], [], [], true), /inválido/);

// Defesa contra implementação que soma cotações ou medições às despesas pagas.
result = calculate([activity('F', 1000, 600)], [expense('f', 500, 'pago')], [quote('q', 500)], true);
assert.equal(result.paidExpenses, 500);
assert.equal(result.measuredTotal, 600);
assert.equal(result.selectedQuoteTotal, 500);
assert.equal(result.budgetMinusRegisteredExpenses, 500);
console.log('PASS: custo por obra (baseline, medição, pagamento e cotação separados; lacunas e duplicidades).');
