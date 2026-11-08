import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../src/lib/construction-schedule-engine.ts',import.meta.url),'utf8');
const out=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});
const {planConstructionSchedule:plan}=await import(`data:text/javascript,${encodeURIComponent(out.outputText)}`);
let checks=0;
const test=(v,msg)=>{assert.ok(v,msg);checks++;};
const bad=(fn,msg)=>{assert.throws(fn,msg);checks++;};
const initial=[
{code:'01',activity:'Preparação',predecessorCode:null,durationDays:2,plannedCost:400,weightPercent:null,actualProgress:50},
{code:'02',activity:'Execução',predecessorCode:'01',durationDays:3,plannedCost:600,weightPercent:null,actualProgress:0},
];
const result=plan(initial,{startDate:'2026-09-21',calendar:'weekdays'});
test(result.activities[0].plannedStart==='2026-09-21' && result.activities[0].plannedFinish==='2026-09-22','Segunda-terça');
test(result.activities[1].plannedStart==='2026-09-23' && result.activities[1].plannedFinish==='2026-09-25','Dependência quarta-sexta');
test(result.plannedFinish==='2026-09-25','Término deriva da última atividade');
test(result.activities[0].assignedWeightPercent===40 && result.activities[1].assignedWeightPercent===60,'Pesos derivam do custo da OBRA');
test(result.progressPercent===20,'Avanço ponderado');
const holiday=plan(initial,{startDate:'2026-09-21',calendar:'weekdays',holidays:['2026-09-22']});
test(holiday.activities[0].plannedFinish==='2026-09-23' && holiday.activities[1].plannedStart==='2026-09-24','Feriado recalcula sequência');
const weekend=plan([{...initial[0],durationDays:3}],{startDate:'2026-09-25',calendar:'weekdays'});
test(weekend.plannedFinish==='2026-09-29','Sexta+segunda+terça');
const calendar=plan([{...initial[0],durationDays:3}],{startDate:'2026-09-25',calendar:'calendar_days'});
test(calendar.plannedFinish==='2026-09-27','Dias corridos incluem fim de semana');
const calendarWithHolidays=plan([{...initial[0],durationDays:3}],{
 startDate:'2026-09-25',calendar:'calendar_days',holidays:['2026-09-26','2026-09-27'],
});
test(calendarWithHolidays.plannedFinish==='2026-09-27','Dias corridos incluem feriados sem estender prazo');
bad(()=>plan(initial,{startDate:'2026-09-21',calendar:'weekdays',contractualDeadline:'2026-09-24'}),/excede o prazo/);
bad(()=>plan(initial.map(a=>({...a,plannedCost:null})),{startDate:'2026-09-21',calendar:'weekdays'}),/custos completos/);
const manual=plan(initial.map(a=>({...a,plannedCost:null,weightPercent:a.code==='01'?40:60})),{startDate:'2026-09-21',calendar:'weekdays',manualWeightsApproved:true});
test(manual.weightSource==='confirmed_manual' && manual.totalConstructionCost===null,'Pesos manuais aprovados NÃO inventam custo');
bad(()=>plan(initial.map(a=>({...a,plannedCost:null,weightPercent:40})),{startDate:'2026-09-21',calendar:'weekdays',manualWeightsApproved:true}),/somem 100/);
bad(()=>plan(initial.map(a=>({...a,predecessorCode:a.code==='01'?'02':'01'})),{startDate:'2026-09-21',calendar:'weekdays'}),/circulares/);
bad(()=>plan([{...initial[0],predecessorCode:'99'}],{startDate:'2026-09-21',calendar:'weekdays'}),/inexistente/);
bad(()=>plan(initial,{startDate:'2026-02-30',calendar:'weekdays'}),/Data inválida/);
// D05: SS, FF e defasagem (dias úteis). Seg 21/09/2026.
const base={activity:'X',plannedCost:100,weightPercent:null,actualProgress:0};
const linked=plan([
 {...base,code:'A',predecessorCode:null,durationDays:5},
 {...base,code:'B',predecessorCode:'A',dependencyType:'SS',lagDays:2,durationDays:3},
 {...base,code:'C',predecessorCode:'A',dependencyType:'FF',lagDays:0,durationDays:2},
 {...base,code:'D',predecessorCode:'A',dependencyType:'FS',lagDays:2,durationDays:1},
 {...base,code:'E',predecessorCode:'A',dependencyType:'FS',lagDays:-1,durationDays:2},
],{startDate:'2026-09-21',calendar:'weekdays'});
const at=c=>linked.activities.find(a=>a.code===c);
test(at('A').plannedFinish==='2026-09-25','A seg-sex');
test(at('B').plannedStart==='2026-09-23'&&at('B').plannedFinish==='2026-09-25','SS+2: começa 2 dias úteis após o início da predecessora');
test(at('C').plannedStart==='2026-09-24'&&at('C').plannedFinish==='2026-09-25','FF: termina junto com a predecessora');
test(at('D').plannedStart==='2026-09-30','FS+2: pula fim de semana e 2 dias úteis de espera');
test(at('E').plannedStart==='2026-09-25','FS-1: antecipação de 1 dia (sobreposição)');
const ffClamp=plan([{...base,code:'A',predecessorCode:null,durationDays:1},{...base,code:'B',predecessorCode:'A',dependencyType:'FF',durationDays:5}],{startDate:'2026-09-21',calendar:'weekdays'});
test(ffClamp.activities[1].plannedStart==='2026-09-21','FF nunca começa antes do início da obra');
const legacy=plan(initial.map(a=>({...a,dependencyType:'FS',lagDays:0})),{startDate:'2026-09-21',calendar:'weekdays'});
test(JSON.stringify(legacy.activities.map(a=>[a.plannedStart,a.plannedFinish]))===JSON.stringify(result.activities.map(a=>[a.plannedStart,a.plannedFinish])),'FS sem defasagem = comportamento anterior');
bad(()=>plan([{...base,code:'A',predecessorCode:null,durationDays:1,lagDays:2}],{startDate:'2026-09-21',calendar:'weekdays'}),/sem predecessora/);
bad(()=>plan([{...base,code:'A',predecessorCode:null,durationDays:1},{...base,code:'B',predecessorCode:'A',dependencyType:'XX',durationDays:1}],{startDate:'2026-09-21',calendar:'weekdays'}),/Tipo de dependência/);
bad(()=>plan([{...base,code:'A',predecessorCode:null,durationDays:1},{...base,code:'B',predecessorCode:'A',lagDays:1.5,durationDays:1}],{startDate:'2026-09-21',calendar:'weekdays'}),/Defasagem/);
console.log(`MOTOR DE CRONOGRAMA: ${checks} checks passaram.`);
