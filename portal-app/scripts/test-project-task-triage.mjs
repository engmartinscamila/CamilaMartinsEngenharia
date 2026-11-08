import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const file = fs.readFileSync(new URL('../src/lib/project-task-triage.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(file, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
const { todayInSaoPaulo, getUnmetTaskDependencies, getProjectTaskTriage } =
  await import(`data:text/javascript,${encodeURIComponent(compiled.outputText)}`);
const task = (id, options = {}) => ({
  id, projectId: 'p1', parentTaskId: null, title: `Tarefa ${id}`, description: null,
  status: 'todo', priority: 'normal', startDate: null, dueDate: null, completedAt: null,
  estimatedHours: null, weight: 1, clientVisible: false, position: 0, dependencyIds: [], ...options,
});
let checks = 0;
function equal(actual, expected, description) { assert.deepEqual(actual, expected, description); checks++; }

equal(todayInSaoPaulo(new Date('2026-11-08T01:00:00Z')), '2026-11-07', 'Virada de dia considera São Paulo');
equal(getProjectTaskTriage([], '2026-11-07').active, 0, 'Projeto vazio');
const data = [
  task('done', { status: 'done', dueDate: '2026-11-01' }),
  task('late', { dueDate: '2026-11-06', priority: 'low' }),
  task('soon', { dueDate: '2026-11-14' }),
  task('nextweek', { dueDate: '2026-11-15' }),
  task('pending', { dependencyIds: ['done'] }),
  task('blocked', { dependencyIds: ['soon'], priority: 'urgent' }),
  task('missing', { dependencyIds: ['unknown'] }),
  task('manual', { status: 'blocked' }),
  task('cancel', { status: 'cancelled', dueDate: '2026-10-31' }),
  task('urgent', { priority: 'urgent' }),
];
const triage = getProjectTaskTriage(data, '2026-11-07');
equal([triage.active, triage.completed, triage.overdue, triage.dueSoon, triage.blocked],
  [8, 1, 1, 2, 3], 'Contagem não mistura concluídas/canceladas');
equal(triage.attention.map((item) => item.taskId),
  ['late', 'missing', 'manual', 'blocked', 'soon', 'urgent'],
  'Atrasadas, bloqueadas, vencimentos e urgências ordenados');
equal(getUnmetTaskDependencies(data[4], data), [], 'Dependência concluída libera tarefa');
equal(getUnmetTaskDependencies(data[5], data), ['soon'], 'Dependência em aberto impede conclusão');
equal(getUnmetTaskDependencies(data[6], data), ['unknown'], 'Referência ausente não é considerada concluída');
equal(getProjectTaskTriage([task('today', { dueDate: '2026-11-07' })], '2026-11-07').dueSoon, 1, 'Vencimento hoje');
equal(getProjectTaskTriage([task('future', { dueDate: '2026-11-15' })], '2026-11-07').dueSoon, 0, 'Fora da janela de 7 dias');
equal(getProjectTaskTriage([task('skip', { status: 'done', dependencyIds: ['unknown'] })], '2026-11-07').blocked, 0, 'Concluída não cria alerta operacional');
const screen = fs.readFileSync(new URL('../src/app/admin/tasks.tsx', import.meta.url), 'utf8');
assert.ok(!screen.includes('projectResult.data.filter((item) => item.contractId)'), 'Projetos sem contrato não podem ficar ocultos'); checks++;
assert.ok(screen.includes('getProjectTaskTriage'), 'Indicadores operacionais estão na tela'); checks++;
assert.ok(screen.includes('getUnmetTaskDependencies'), 'Dependências são verificadas antes de concluir'); checks++;
console.log(`TRIAGEM DE TAREFAS: ${checks} verificações passaram.`);
