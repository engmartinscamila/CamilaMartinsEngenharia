// A04 — valores com mais de duas casas decimais não podem ser gravados com
// arredondamento silencioso, e o reenvio após perda de resposta deve
// reconhecer a gravação já concluída (comparação em centavos).
// A05 — contrato sem valor (null) não pode virar R$ 0,00 na lista de projetos.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file, deps = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText,
    { exports, console, Date, Intl, require: (name) => { if (!(name in deps)) throw Error(name); return deps[name]; } });
  return exports;
}
const format = load('src/lib/format.ts');
const model = load('src/lib/financial-model.ts');

// ---- Conversões monetárias (formato brasileiro) ----
assert.equal(format.parseBrazilianMoney('100,005'), null, '100,005 deve ser recusado, não arredondado');
assert.equal(format.parseBrazilianMoney('100,01'), 100.01);
assert.equal(format.parseBrazilianMoney('R$ 1.234,56'), 1234.56);
assert.equal(format.parseBrazilianMoney('1.234.567,89'), 1234567.89);
assert.equal(format.parseBrazilianMoney('1.005'), 1005, '1.005 em formato brasileiro é mil e cinco');
assert.equal(format.parseBrazilianMoney('1,005'), null, '1,005 tem três casas decimais');
assert.equal(format.parseBrazilianMoney('0,10'), 0.1);
assert.equal(format.moneyToCents(0.1 + 0.2), 30, 'erro de ponto flutuante não pode virar terceira casa');
assert.equal(format.moneyToCents(100.005), null);
assert.equal(format.moneyToCents(1234.56), 123456);

// ---- A05: valor opcional ----
assert.equal(format.optionalMoney(null), null);
assert.equal(format.optionalMoney(undefined), null);
assert.equal(format.optionalMoney(''), null);
assert.equal(format.optionalMoney('   '), null);
assert.equal(format.optionalMoney(0), 0, 'zero explícito continua zero');
assert.equal(format.optionalMoney('0'), 0);
assert.equal(format.optionalMoney('1500.50'), 1500.5);
assert.equal(format.optionalMoney('abc'), null);

// ---- Banco simulado ----
const database = { financeiro: [], bank_transactions: [], projetos: [] };
let loseNextResponse = false;
const db = { from(table) {
  let action = 'read', payload, filters = [], one = false;
  const q = {
    select() { return q; }, eq(k, v) { filters.push((r) => r[k] === v); return q; }, is(k, v) { filters.push((r) => (r[k] ?? null) === v); return q; },
    order() { return q; }, limit() { return q; }, range() { return q; }, in() { return q; },
    insert(v) { action = 'insert'; payload = v; return q; }, update(v) { action = 'update'; payload = v; return q; },
    single() { one = true; return q; }, maybeSingle() { one = true; return q; },
    then(resolve, reject) { return Promise.resolve().then(() => {
      let data = (database[table] ?? []).filter((r) => filters.every((f) => f(r)));
      if (action === 'insert') {
        if (database[table].some((r) => r.client_request_id === payload.client_request_id)) return { data: null, error: { code: '23505' } };
        // numeric(12,2): o banco arredonda para centavos.
        const stored = { id: 'created', ...payload, valor: Math.round(payload.valor * 100) / 100 };
        database[table].push(stored);
        if (loseNextResponse) { loseNextResponse = false; return { data: null, error: { message: 'resposta perdida' } }; }
        data = [stored];
      }
      return { data: one ? data[0] ?? null : data, error: null };
    }).then(resolve, reject); },
  };
  return q;
} };
const service = load('src/services/admin-service.ts', { '@/lib/paginated-query': load('src/lib/paginated-query.ts'), '@/lib/financial-model': model, '@/lib/format': format,
  '@/lib/supabase': { supabase: db }, '@/lib/errors': {}, 'base64-arraybuffer': {}, 'expo-file-system/legacy': {}, 'expo-crypto': {}, 'react-native': { Platform: { OS: 'web' } }, '@/services/push-service': {} });

const base = { projectId: 'p1', description: 'Parcela', type: 'entrada', date: '2026-10-10', status: 'pendente' };

// Terceira casa decimal é recusada com mensagem explícita, sem gravar nada.
const rejected = await service.createAdminFinancialEntry({ ...base, amount: 100.005, requestId: 'req-1' });
assert.match(String(rejected), /duas casas decimais/);
assert.equal(database.financeiro.length, 0);

// Reenvio após perda da resposta: deve reconhecer a gravação concluída.
loseNextResponse = true;
const input = { ...base, amount: 0.1 + 0.2, requestId: 'req-2' }; // 0.30000000000000004
assert.equal(typeof await service.createAdminFinancialEntry(input), 'string', 'primeira tentativa perde a resposta');
assert.equal(await service.createAdminFinancialEntry(input), null, 'reenvio idêntico deve confirmar o mesmo registro');
assert.equal(database.financeiro.length, 1, 'reenvio não pode duplicar');
assert.equal(database.financeiro[0].valor, 0.3, 'valor gravado em centavos exatos');
assert.equal(typeof await service.createAdminFinancialEntry({ ...input, amount: 0.31 }), 'string', 'reuso com outro valor continua bloqueado');

// ---- A05 pela lista de projetos ----
const source = fs.readFileSync('src/services/admin-service.ts', 'utf8');
assert.ok(!/contractValue:\s*Number\.isFinite\(Number\(/.test(source), 'admin-service não pode converter contract_value com Number(null)');
assert.ok(!/contractValue:\s*Number\.isFinite\(Number\(/.test(fs.readFileSync('src/services/document-workflow-service.ts', 'utf8')), 'prévia contratual não pode converter Number(null)');

console.log('PASS (A04/A05): três casas recusadas, reenvio após perda confirma em centavos, formatos brasileiros cobertos e contrato sem valor permanece desconhecido.');
