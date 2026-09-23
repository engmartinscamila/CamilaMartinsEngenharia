import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../src/lib/construction-schedule-client-gantt.ts', import.meta.url), 'utf8');
const transpiled = ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext}});
const { buildClientConstructionGantt: gantt } = await import(`data:text/javascript,${encodeURIComponent(transpiled.outputText)}`);
let checks = 0;
const equal = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; };
const base = {
  projectId: 'synthetic-project-A', version: 1, publishedAt: '2026-09-22T12:00:00Z', title: 'Obra fictícia',
  plannedStart: '2026-09-21', plannedFinish: '2026-09-25', activities: [
    {code:'A', activity:'Etapa fictícia A', planned_start:'2026-09-21', planned_finish:'2026-09-22', actual_progress:null, measurement_date:null},
    {code:'B', activity:'Etapa fictícia B', planned_start:'2026-09-23', planned_finish:'2026-09-25', actual_progress:40, measurement_date:'2026-09-24'},
  ],
};
const bars = gantt(base);
assert.ok(bars); checks++;
equal(bars.bars.map(b => [b.offsetPercent,b.widthPercent]), [[0,40],[40,60]], 'inclusive date positioning');
equal(bars.bars.map(b => b.measuredPercent), [null,40], 'only measured percentages');
equal(gantt({...base,plannedFinish:'2026-09-20'}), null, 'invalid project range');
equal(gantt({...base,plannedStart:'2026-02-30'}), null, 'invalid date');
equal(gantt({...base,activities:[{...base.activities[0],planned_start:'2026-09-19'}]}), null, 'do not invent missing fitting bars');
equal(gantt({...base,activities:[{...base.activities[0],actual_progress:150}]}).bars[0].measuredPercent, null, 'do not surface invalid measurements');
equal(gantt({...base,activities:[{...base.activities[0],actual_progress:0}]}).bars[0].measuredPercent, 0, 'zero recorded is not missing');
const serialized = JSON.stringify(bars);
for (const forbidden of ['planned_cost','honorarios','notes_internal','clientId','financial_weight','measurement_history']) {
  assert.equal(serialized.includes(forbidden), false, `client view cannot include ${forbidden}`); checks++;
}
console.log(`GANTT CLIENTE ISOLADO: ${checks} verificações passaram.`);
