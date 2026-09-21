import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const path = new URL('../supabase/functions/generate-verified-construction-schedule-xlsx/index.ts', import.meta.url);
const source = fs.readFileSync(path, 'utf8');
let checks = 0;
function check(condition, reason) { assert.ok(condition, reason); checks++; }
function includes(value, reason) { check(source.includes(value), reason); }
const compiled = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
}});
const errors = (compiled.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error);
check(errors.length === 0, `Erro sintático no gerador Edge: ${errors.map(error => ts.flattenDiagnosticMessageText(error.messageText, ' ')).join('; ')}`);
includes("db.auth.getUser()", 'Sessão deve ser validada no servidor');
includes("db.rpc('is_portal_admin')", 'Somente administradora extrai dados completos');
includes("schedule.activation_status !== 'approved'", 'Rascunho não pode ser exportado como aprovado');
includes('schedule.baseline_snapshot', 'Versão base é obrigatória');
includes('baseline.scope?.quote_id !== schedule.quote_record_id', 'Orçamento vinculado deve corresponder à origem aprovada');
includes('baseline.scope?.contract_record_id !== schedule.contract_record_id', 'Contrato deve corresponder à origem aprovada');
includes("db.from('construction_schedule_items').select('*')", 'Consultar avanço atual sem regravar planejamento');
check(!/admin_initialize_construction_schedule|\.insert\(|\.upsert\(|\.update\(|\.delete\(/.test(source), 'Exportação não pode criar ou alterar registros');
check(!source.includes('SUPABASE_SERVICE_ROLE_KEY'), 'Exportador usa exclusivamente sessão e RLS');
check(!source.includes('length:27') && !source.includes('i < 27'), 'Gantt/Curva S não podem cortar em 27 semanas');
includes('day <= finish', 'Os períodos semanais incluem toda a duração');
includes('weeks.push(finish)', 'A última data da curva é a data final exata');
includes("'weekdays', 'calendar_days'", 'Calendários previstos em contrato devem ser suportados');
includes('NETWORKDAYS(', 'Fórmula do Excel respeita dias úteis');
includes('Medições datadas', 'O arquivo deve identificar ausência de dados históricos');
check(!/actualProgressAt|progress\s*\*\s*\(.*reference/.test(source), 'Não criar realizado retrospectivo a partir de um único percentual');
for (const name of ['Cadastro', 'Cronograma', 'Indicadores', 'Curva S', 'Gantt', 'Marcos', 'Export Dashboard', 'Leia-me']) {
  includes(`addWorksheet('${name}')`, `Falta aba ${name}`);
}
includes('baselineVersion: schedule.baseline_version', 'Resposta deve indicar versão da linha de base');
includes('contentBase64', 'Resposta deve trazer dados .xlsx');
includes('totalCost <= 0', 'Não permitir orçamento de obra zerado');
// Executa o cálculo de datas real isoladamente, sem iniciar Deno.serve nem rede.
const helperSource = source.slice(source.indexOf('const dateText'), source.indexOf('Deno.serve'));
const helperJavaScript = ts.transpileModule(`${helperSource}\nexport { date, countDays, progress, addDays };`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const helpers = await import(`data:text/javascript,${encodeURIComponent(helperJavaScript)}`);
const start = helpers.date('2026-09-25');
const finish = helpers.date('2026-09-29');
const monday = helpers.date('2026-09-28');
check(helpers.countDays(start, finish, 'weekdays') === 3, 'Sexta/segunda/terça contam três dias úteis');
check(Math.abs(helpers.progress(start, finish, monday, 'weekdays') - (200 / 3)) < 0.01, 'Avanço progressivo no calendário útil');
check(helpers.progress(start, finish, monday, 'calendar_days') === 80, 'Dias corridos não usam regra de dias úteis');
check(helpers.progress(start, finish, helpers.date('2026-09-29'), 'weekdays') === 100, 'Fim equivale a 100%');
assert.throws(() => helpers.date('2026-02-30'), /inválidas/); checks++;
console.log(`EXPORTAÇÃO XLSX DE CRONOGRAMA: ${checks} verificações aprovadas.`);
