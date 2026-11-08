/* Triagem operacional do projeto: leitura pura dos registros existentes.
 * Não calcula valores financeiros, não substitui o cronograma aprovado e não altera tarefas. */
import type { ProjectTaskSummary } from '@/types/domain';

export type TaskAttentionKind = 'overdue' | 'blocked' | 'due_soon' | 'urgent';
export interface TaskAttention {
  taskId: string;
  title: string;
  kind: TaskAttentionKind;
  dueDate: string | null;
}
export interface ProjectTaskTriage {
  active: number;
  completed: number;
  overdue: number;
  dueSoon: number;
  blocked: number;
  attention: TaskAttention[];
}

function addCalendarDays(day: string, count: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error('Data de referência inválida.');
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

export function todayInSaoPaulo(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const field = (kind: string) => parts.find((part) => part.type === kind)?.value ?? '';
  return `${field('year')}-${field('month')}-${field('day')}`;
}

export function getUnmetTaskDependencies(
  task: Pick<ProjectTaskSummary, 'dependencyIds'>,
  tasks: readonly ProjectTaskSummary[],
): string[] {
  const byId = new Map(tasks.map((item) => [item.id, item]));
  // Referências ausentes, canceladas ou de outro projeto não são consideradas concluídas.
  return task.dependencyIds.filter((id) => byId.get(id)?.status !== 'done');
}

export function getProjectTaskTriage(
  tasks: readonly ProjectTaskSummary[],
  today: string,
): ProjectTaskTriage {
  const weekEnd = addCalendarDays(today, 7);
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const results: ProjectTaskTriage = {
    active: 0, completed: 0, overdue: 0, dueSoon: 0, blocked: 0, attention: [],
  };
  const severity: Record<TaskAttentionKind, number> = {
    overdue: 0, blocked: 1, due_soon: 2, urgent: 3,
  };
  const priorityRank: Record<ProjectTaskSummary['priority'], number> = {
    urgent: 0, high: 1, normal: 2, low: 3,
  };
  const attention: Array<TaskAttention & { priority: number }> = [];
  for (const task of tasks) {
    if (task.status === 'cancelled') continue;
    if (task.status === 'done') { results.completed++; continue; }
    results.active++;
    const overdue = !!task.dueDate && task.dueDate < today;
    const dueSoon = !!task.dueDate && task.dueDate >= today && task.dueDate <= weekEnd;
    const blocked = task.status === 'blocked'
      || task.dependencyIds.some((id) => byId.get(id)?.status !== 'done');
    if (overdue) results.overdue++;
    if (dueSoon) results.dueSoon++;
    if (blocked) results.blocked++;
    const kind: TaskAttentionKind | null = overdue ? 'overdue'
      : blocked ? 'blocked' : dueSoon ? 'due_soon'
      : task.priority === 'urgent' ? 'urgent' : null;
    if (kind) attention.push({
      taskId: task.id, title: task.title, kind, dueDate: task.dueDate,
      priority: priorityRank[task.priority],
    });
  }
  attention.sort((a, b) => severity[a.kind] - severity[b.kind]
    || (a.dueDate ?? '9999-12-31').localeCompare(b.dueDate ?? '9999-12-31')
    || a.priority - b.priority || a.title.localeCompare(b.title, 'pt-BR'));
  results.attention = attention.map((entry) => ({
    taskId: entry.taskId, title: entry.title, kind: entry.kind, dueDate: entry.dueDate,
  }));
  return results;
}
