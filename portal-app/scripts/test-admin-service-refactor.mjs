import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// A principal API importada por telas não pode ser renomeada durante a extração.
const original = fs.readFileSync('src/services/admin-service.ts', 'utf8');
const content = fs.readFileSync('src/services/admin-content-service.ts', 'utf8');
const financial = fs.readFileSync('src/services/admin-financial-service.ts', 'utf8');
for (const name of [
  'listAdminContent', 'uploadAdminContent', 'createAdminContentSignedUrl', 'deleteAdminContent',
]) {
  assert.match(original, new RegExp('\\b' + name + '\\b'));
  assert.match(content, new RegExp('export async function ' + name + '\\('));
}
for (const name of [
  'listAdminFinancialEntries', 'listFinancialArchive', 'createAdminFinancialEntry',
  'financialEntryPayload', 'updateAdminFinancialEntry', 'deleteAdminFinancialEntry', 'updateAdminContractValue',
]) {
  assert.match(original, new RegExp('\\b' + name + '\\b'));
  assert.match(financial, new RegExp('export (?:async )?function ' + name + '\\('));
}
assert.match(original, /export type \{ FinancialEntryInput \} from '\.\/admin-financial-service'/);
assert.match(content, /readAllRows\(supabase\.from\(table\)/);
assert.match(financial, /const result = await readAllRows\(/);
assert.doesNotMatch(financial, /for\s*\(let offset/);
assert.doesNotMatch(content, /for\s*\(let offset/);

// Executa o paginador compartilhado com uma consulta simulada: nenhuma consulta real.
const pageModule = { exports: {} };
const pageJs = ts.transpileModule(fs.readFileSync('src/lib/paginated-query.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
vm.runInNewContext(pageJs, { module: pageModule, exports: pageModule.exports, Promise });
const { readAllRows } = pageModule.exports;
function query(records, failureOffset = -1) {
  const calls = [];
  return {
    calls,
    order(column) { calls.push(['order', column]); return this; },
    async range(start, end) {
      calls.push(['range', start, end]);
      return start === failureOffset
        ? { data: [], error: { code: 'network' } }
        : { data: records.slice(start, end + 1), error: null };
    },
  };
}
let q = query(Array.from({ length: 503 }, (_, id) => ({ id })));
let result = await readAllRows(q);
assert.equal(result.error, null);
assert.equal(result.data.length, 503);
assert.equal(result.data[0].id, 0);
assert.equal(result.data[502].id, 502);
assert.deepEqual(q.calls.filter(x => x[0] === 'range').map(x => [...x]), [
  ['range', 0, 499], ['range', 500, 999],
]);
q = query(Array.from({ length: 503 }, (_, id) => ({ id })), 500);
result = await readAllRows(q);
assert.ok(result.error, 'Erro de página intermediária deve bloquear totais incompletos');
assert.equal(result.data.length, 0, 'Não retornar saldo calculado com linhas parciais');
q = query(Array.from({ length: 500 }, (_, id) => ({ id })));
result = await readAllRows(q, 500);
assert.ok(result.error, 'Teto deve ser respeitado sem totalizações parciais');
assert.equal(result.data.length, 0);
q = query([]);
result = await readAllRows(q);
assert.equal(result.data.length, 0);
assert.equal(result.error, null);

// O gerador do payload financeiro conserva datas, validação e valores.
const finModule = { exports: {} };
const financialJs = ts.transpileModule(financial, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const stubs = {
  '@/lib/financial-model': {
    financialCategory: value => value,
    financialStatus: value => value,
    financialToday: () => '2026-11-07',
  },
  '@/lib/format': { isValidIsoDate: value => /^\\d{4}-\\d{2}-\\d{2}$/.test(value) },
  '@/lib/paginated-query': { readAllRows },
  '@/lib/supabase': { supabase: {} },
};
vm.runInNewContext(financialJs, {
  module: finModule,
  exports: finModule.exports,
  require: name => {
    if (!stubs[name]) throw new Error('Dependência inesperada: ' + name);
    return stubs[name];
  },
});
const payload = finModule.exports.financialEntryPayload({
  projectId: null, clientId: 'client-1', contractId: null,
  description: ' Entrada de honorários ', type: 'entrada', amount: 2400.50,
  date: '2026-11-06', status: 'pago', category: 'honorarios',
});
assert.equal(typeof payload, 'object');
assert.equal(payload.projeto_id, null, 'Serviço sem projeto permanece válido');
assert.equal(payload.cliente_id, 'client-1');
assert.equal(payload.descricao, 'Entrada de honorários');
assert.equal(payload.valor, 2400.50);
assert.equal(payload.data_pagamento, '2026-11-06');
assert.equal(finModule.exports.financialEntryPayload({
  projectId: null, clientId: null, description: 'Teste',
  type: 'entrada', amount: 100, date: '2026-11-06',
}).startsWith('Informe cliente ou projeto'), true);
assert.equal(finModule.exports.financialEntryPayload({
  projectId: null, clientId: 'client-1', description: 'Teste',
  type: 'entrada', amount: 100, date: '2026-11-06', status: 'pago', paidAt: '2026-11-08',
}).startsWith('A data de recebimento'), true);

console.log('PASS: API administrativa preservada, 503 registros paginados, falha atômica e payload financeiro íntegro.');
