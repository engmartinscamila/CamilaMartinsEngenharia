import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';

// Isola dependências do teste: não altera o lockfile nem as dependências do portal.
const testRoot = path.join(process.env.RUNNER_TEMP ?? '/tmp', 'schedule-xlsx-test');
const requireTest = createRequire(path.join(testRoot, 'index.js'));
const ExcelJS = requireTest('exceljs');
const {PNG} = requireTest('pngjs');
const root = new URL('../supabase/functions/generate-verified-construction-schedule-xlsx/', import.meta.url);
const js = (source) => ts.transpileModule(source, {
  reportDiagnostics: true, compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext},
}).outputText;
const chartSource = fs.readFileSync(new URL('curve-chart.ts', root), 'utf8')
  .replace(/^import \{ PNG \} from .*;\s*$/m, '');
const renderScheduleCurveChart = new Function('PNG', `${js(chartSource)}\nreturn renderScheduleCurveChart;`)(PNG);

const ids = {
  schedule: '10000000-0000-4000-8000-000000000001',
  project: '10000000-0000-4000-8000-000000000002',
  client: '10000000-0000-4000-8000-000000000003',
  quote: '10000000-0000-4000-8000-000000000004',
  contract: '10000000-0000-4000-8000-000000000005',
  first: '10000000-0000-4000-8000-000000000006',
  second: '10000000-0000-4000-8000-000000000007',
};
const baseline = {
  scope: {quote_id: ids.quote, contract_record_id: ids.contract, quote_number: 'ORC-FICTICIO', contract_number: 'CON-FICTICIO'},
  calendar: 'weekdays', activities: [
    {id: ids.first, code: '01', eap: '1', category: 'Obra', activity: 'Primeira atividade fictícia',
      planned_start: '2026-09-21', planned_finish: '2026-09-23', planned_duration_days: 2,
      weight_percent: 60, planned_cost: 600, cost_source: 'Orçamento de obra sintético', source_service_code: 's'},
    {id: ids.second, code: '02', eap: '2', category: 'Obra', activity: 'Segunda atividade fictícia',
      planned_start: '2026-09-24', planned_finish: '2026-09-25', planned_duration_days: 2,
      weight_percent: 40, planned_cost: 400, cost_source: 'Orçamento de obra sintético', source_service_code: 's'},
  ],
};
const schedule = {id: ids.schedule, project_id: ids.project, client_id: ids.client,
  quote_record_id: ids.quote, contract_record_id: ids.contract, activation_status: 'approved',
  baseline_version: 1, baseline_snapshot: baseline, reference_date: '2026-09-25', approved_at: '2026-09-23T12:00:00Z'};
const items = baseline.activities.map((item, index) => ({...item, schedule_id: ids.schedule,
  display_order: index + 1, actual_progress: 0, actual_cost: null, actual_start: null, actual_finish: null, status: 'Pendente'}));
const measurements = [
  {id: '10000000-0000-4000-8000-000000000008', schedule_id: ids.schedule, item_id: ids.first,
    measured_on: '2026-09-24', recorded_at: '2026-09-24T12:00:00Z', actual_progress: 80, actual_construction_cost: 400},
  {id: '10000000-0000-4000-8000-000000000009', schedule_id: ids.schedule, item_id: ids.second,
    measured_on: '2026-09-25', recorded_at: '2026-09-25T12:00:00Z', actual_progress: 30, actual_construction_cost: 200},
];
const records = {
  construction_schedules: [schedule], construction_schedule_items: items,
  construction_schedule_measurements: measurements,
  construction_schedule_holidays: [{schedule_id: ids.schedule, holiday_date: '2026-09-22'}],
  construction_schedule_baseline_versions: [{schedule_id: ids.schedule, baseline_version: 1,
    baseline_snapshot: baseline, holiday_dates: ['2026-09-22']}],
  projetos: [{id: ids.project, cliente_id: ids.client, nome: 'Obra fictícia', numero_contrato: 'CON-FICTICIO',
    numero_orcamento: 'ORC-FICTICIO', endereco_obra: 'Endereço fictício'}],
  clientes: [{id: ids.client, nome: 'Cliente fictício'}],
};
let isAdmin = true;
let reads = 0;
const createClient = () => ({
  auth: {getUser: async () => ({data: {user: {id: '10000000-0000-4000-8000-000000000010'}}, error: null})},
  rpc: async (name) => {assert.equal(name, 'is_portal_admin'); return {data: isAdmin, error: null};},
  from(table) {
    assert.ok(Object.hasOwn(records, table), `Tabela não simulada: ${table}`);
    reads++;
    let selectedOptions = {};
    let result = records[table];
    const builder = {
      select(_columns, options = {}) {selectedOptions = options; return builder;},
      eq(field, value) {result = result.filter((row) => row[field] === value); return builder;},
      order() {return builder;},
      limit(limit) {result = result.slice(0, limit); return Promise.resolve(resolve());},
      single() {return Promise.resolve(result.length === 1 ? {data: result[0], error: null} : {data: null, error: {message: 'Ausente'}});},
      then(onFulfilled, onRejected) {return Promise.resolve(resolve()).then(onFulfilled, onRejected);},
    };
    function resolve() {return selectedOptions.head ? {data: null, count: result.length, error: null} : {data: result, count: result.length, error: null};}
    return builder;
  },
});
globalThis.__mockCreateClient = createClient;
globalThis.__mockExcelJS = ExcelJS;
globalThis.__mockCurve = renderScheduleCurveChart;
globalThis.__mockDeno = {env: {get: (key) => ({SUPABASE_URL: 'https://example.invalid', SUPABASE_ANON_KEY: 'publishable-test-key'}[key] ?? null)}};
let source = fs.readFileSync(new URL('index.ts', root), 'utf8')
  .replace(/^import .*;\s*$/gm, '')
  .replace('Deno.serve(async (req) => {', 'async function handler(req) {')
  .replace(/\}\);\s*$/, '}\nexport {handler};');
assert.ok(source.includes('export {handler};'), 'O teste deve interceptar a função Edge real sem rede.');
source = `const createClient=globalThis.__mockCreateClient;\nconst ExcelJS=globalThis.__mockExcelJS;\nconst Buffer=globalThis.Buffer;\nconst renderScheduleCurveChart=globalThis.__mockCurve;\nconst Deno=globalThis.__mockDeno;\n${source}`;
const {handler} = await import(`data:text/javascript,${encodeURIComponent(js(source))}`);
const request = () => new Request('https://example.invalid/generate', {method: 'POST',
  headers: {Authorization: 'Bearer synthetic-session'}, body: JSON.stringify({scheduleId: ids.schedule})});
let checks = 0;
const test = (value, label) => {assert.ok(value, label); checks++;};
isAdmin = false;
const denied = await handler(request());
test(denied.status === 400 && (await denied.json()).generated === false, 'Exportação negada a cliente não administrador');
test(reads === 0, 'Cliente sem permissão não recebe sequer consulta ao banco');
isAdmin = true;
const response = await handler(request());
const answer = await response.json();
test(response.status === 200 && answer.generated === true && answer.contentBase64, `O XLSX deve ser gerado, erro: ${answer.error ?? 'nenhum'}`);
const bytes = Buffer.from(answer.contentBase64, 'base64');
test(bytes.subarray(0, 2).toString() === 'PK', 'Planilha é arquivo ZIP/XLSX real');
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.load(bytes);
const expected = ['Cadastro', 'Feriados', 'Cronograma', 'Indicadores', 'Curva S', 'Gantt', 'Marcos', 'Export Dashboard', 'Leia-me'];
test(workbook.worksheets.length === expected.length && expected.every((name) => workbook.getWorksheet(name)), 'Nove abas reais após reabrir o Excel');
const holiday = workbook.getWorksheet('Feriados').getCell('A2').value;
test(holiday instanceof Date && holiday.toISOString().slice(0, 10) === '2026-09-22', 'Feriado aprovado é data do Excel');
const formula = workbook.getWorksheet('Cronograma').getCell('L2').value?.formula;
test(formula?.includes('NETWORKDAYS(F2,Cadastro!$B$9,Feriados!$A$2:$A$2)'), 'Fórmula do Excel usa feriado aprovado');
test(workbook.getWorksheet('Cronograma').getCell('M2').value === 80, 'Avanço atual vem de medição, não do campo legado zero');
test(workbook.getWorksheet('Cronograma').getCell('Q2').value === 400, 'Custo real vem da vistoria datada');
const curve = workbook.getWorksheet('Curva S');
test(curve.getCell('D2').value === null, 'Histórico sem medição no primeiro corte permanece em branco');
test(curve.getCell('D3').value === 60, 'Avanço medido completo ponderado resulta em 60%');
test(curve.getImages().length === 1, 'Imagem gráfica de Curva S está incorporada ao XLSX');
test(Number(curve.getCell('B3').value) === 100, 'Planejado chega a 100% no término da obra');
test(answer.itemCount === 2 && answer.baselineVersion === 1, 'Exportação preserva vínculo e versão-base');
delete globalThis.__mockCreateClient;
delete globalThis.__mockExcelJS;
delete globalThis.__mockCurve;
delete globalThis.__mockDeno;
console.log(`XLSX REAL REABERTO: ${checks} verificações sintéticas, sem rede ou dados de cliente.`);
