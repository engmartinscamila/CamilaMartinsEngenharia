import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../src/lib/construction-schedule-critical-path.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
const { analyzeConstructionCriticalPath: analyze } = await import(`data:text/javascript,${encodeURIComponent(output.outputText)}`);
let checks = 0;
function test(actual, expected, name) { assert.deepEqual(actual, expected, name); checks++; }
function bad(callback, matcher) { assert.throws(callback, matcher); checks++; }
const row = (code, predecessorCode, durationDays, plannedStart, plannedFinish) => ({
  code, predecessorCode, durationDays, plannedStart, plannedFinish,
});
const tasks = [
  row('A', null, 2, '2026-09-21', '2026-09-22'),
  row('B', null, 4, '2026-09-21', '2026-09-24'),
  row('C', 'B', 1, '2026-09-25', '2026-09-25'),
];
const result = analyze(tasks, { calendar: 'weekdays' });
test(result.plannedFinish, '2026-09-25', 'project finish');
test(result.criticalCodes, ['B', 'C'], 'critical branch');
test(result.activities.map(a => a.totalFloatDays), [3, 0, 0], 'independent shorter branch has three workdays of float');
const two = analyze([row('A', null, 5, '2026-09-21', '2026-09-25'), row('B', null, 5, '2026-09-21', '2026-09-25')], {calendar: 'weekdays'});
test(two.criticalCodes, ['A', 'B'], 'parallel critical paths');
const holiday = analyze([
  row('A', null, 2, '2026-09-21', '2026-09-23'),
  row('B', 'A', 2, '2026-09-24', '2026-09-25'),
], { calendar:'weekdays', holidays:['2026-09-22'] });
test(holiday.criticalCodes, ['A', 'B'], 'holiday does not create false float');
const requested = analyze([
  row('A', null, 1, '2026-09-21', '2026-09-21'),
  row('B', 'A', 1, '2026-09-25', '2026-09-25'),
], { calendar:'weekdays' });
test(requested.activities[0].totalFloatDays, 3, 'requested start constraint creates predecessor float');
const elapsed = analyze([
  row('A', null, 1, '2026-09-25', '2026-09-25'),
  row('B', null, 3, '2026-09-25', '2026-09-27'),
], { calendar:'calendar_days' });
test(elapsed.activities[0].totalFloatDays, 2, 'calendar-days float includes weekend');
bad(() => analyze([row('A', 'missing', 1, '2026-09-21', '2026-09-21')], {calendar:'weekdays'}), /inexistente/);
bad(() => analyze([row('A', null, 1, '2026-09-21', '2026-09-21'), row('A', null, 1, '2026-09-22', '2026-09-22')], {calendar:'weekdays'}), /duplicado/);
bad(() => analyze([row('A', null, 1, '2026-09-21', '2026-09-21'), row('B', 'A', 1, '2026-09-21', '2026-09-21')], {calendar:'weekdays'}), /inconsistentes/);
bad(() => analyze([row('A', null, 1, '2026-09-22', '2026-09-22')], {calendar:'weekdays',holidays:['2026-09-22']}), /calendário/);
bad(() => analyze([row('A', null, 3, '2026-09-21', '2026-09-22')], {calendar:'weekdays'}), /Duração e datas/);
console.log(`CPM isolado: ${checks} verificações passaram.`);
