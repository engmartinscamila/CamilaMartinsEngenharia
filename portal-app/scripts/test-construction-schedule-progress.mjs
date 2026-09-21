import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../src/lib/construction-schedule-progress.ts', import.meta.url), 'utf8');
const out = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
const { plannedPercentAt, scheduleIndicators, scheduleWeeklyCurve } = await import(`data:text/javascript,${encodeURIComponent(out.outputText)}`);
let count = 0;
const check = (actual, expected, msg) => { assert.deepEqual(actual, expected, msg); count++; };
const invalid = (fn, regex) => { assert.throws(fn, regex); count++; };
const one = {
  code: '1', plannedStart: '2026-09-25', plannedFinish: '2026-09-29',
  financialWeightPercent: 40, physicalWeightPercent: 20,
  plannedConstructionCost: 400, actualProgressPercent: 50, actualConstructionCost: 80,
};
const two = {
  code: '2', plannedStart: '2026-09-30', plannedFinish: '2026-10-02',
  financialWeightPercent: 60, physicalWeightPercent: 80,
  plannedConstructionCost: 600, actualProgressPercent: 0, actualConstructionCost: 0,
};
check(plannedPercentAt(one.plannedStart, one.plannedFinish, '2026-09-28', 'weekdays'), 66.67, 'sexta + segunda de três dias úteis');
check(plannedPercentAt(one.plannedStart, one.plannedFinish, '2026-09-28', 'weekdays', ['2026-09-28']), 50, 'feriado não conta no progresso');
check(plannedPercentAt(one.plannedStart, one.plannedFinish, '2026-09-28', 'calendar_days'), 80, 'dias corridos distintos de úteis');
check(plannedPercentAt(one.plannedStart, one.plannedFinish, '2026-09-24', 'weekdays'), 0, 'antes do início');
check(plannedPercentAt(one.plannedStart, one.plannedFinish, '2026-09-29', 'weekdays'), 100, 'término completo');
const metrics = scheduleIndicators([one, two], '2026-09-29', 'weekdays');
check(metrics.totalConstructionCost, 1000, 'denominador de construção, não honorários');
check(metrics.plannedFinancialPercent, 40, 'percentual financeiro realizado pelo orçamento físico');
check(metrics.actualWeightedProgressPercent, 20, 'progresso atual ponderado por custos');
check(metrics.actualConstructionCostAtDate, 80, 'custo real informado');
check(metrics.plannedPhysicalPercent, 20, 'peso físico separado de financeiro');
check(metrics.actualPhysicalPercent, 10, 'avanço físico por quantitativos validados');
check(metrics.costDeviation, -320, 'desvio de custo sem trocar bases');
check(scheduleIndicators([{...one, actualConstructionCost: null}, two], '2026-09-29', 'weekdays').actualConstructionCostAtDate, null, 'NULL não vira zero no custo realizado');
check(scheduleIndicators([{...one, physicalWeightPercent: null}, {...two, physicalWeightPercent: null}], '2026-09-29', 'weekdays').plannedPhysicalPercent, null, 'peso financeiro não vira peso físico inventado');
const curve = scheduleWeeklyCurve([one, two], 'weekdays', [], [
  { measuredAt: '2026-09-29', physicalPercent: 10, financialPercent: 20, actualConstructionCost: 80 },
]);
check(curve.at(-1).date, '2026-10-02', 'curva inclui fim exato');
check(curve[0].measuredFinancialPercent, null, 'sem medição anterior não fabricar realizado');
check(curve.at(-1).measurementDate, '2026-09-29', 'último valor carrega data da medição');
check(curve.at(-1).plannedFinancialPercent, 100, 'planejamento chega a 100% no final');
const long = scheduleWeeklyCurve([{...one, plannedStart:'2026-01-01',plannedFinish:'2027-04-01',financialWeightPercent:100,physicalWeightPercent:100,plannedConstructionCost:1000}], 'weekdays');
check(long.length > 27, true, 'prazo longo não é truncado na semana 27');
check(long.at(-1).date, '2027-04-01', 'curva longa também inclui data final');
invalid(() => scheduleIndicators([one, {...two, financialWeightPercent:50}], '2026-09-29','weekdays'), /100%/);
invalid(() => scheduleIndicators([one, {...two, code:'1'}], '2026-09-29','weekdays'), /duplicado/);
invalid(() => scheduleIndicators([one, {...two, plannedConstructionCost:null}], '2026-09-29','weekdays'), /ausente/);
invalid(() => scheduleWeeklyCurve([one,two],'weekdays',[],[{measuredAt:'2026-09-29',physicalPercent:101,financialPercent:null,actualConstructionCost:null}]), /Medição/);
console.log(`MÉTRICAS E CURVA S: ${count} verificações aprovadas.`);
