/** Pure CPM analysis of an already calculated, approved or draft schedule.
 * Do not infer costs, physical weights, delays or historical measurements.
 * Links are FS (default), SS or FF with an optional lag in work-calendar days
 * (negative = lead). Absent type/lag behave exactly as before (FS, zero lag).
 * Requested-start constraints
 * already reflected in the input dates remain visible as float in earlier tasks.
 */
import type { PlannedActivity, WorkCalendar } from './construction-schedule-engine';

export interface CriticalPathItem {
  code: string;
  earliestStart: string;
  earliestFinish: string;
  latestStart: string;
  latestFinish: string;
  totalFloatDays: number;
  isCritical: boolean;
}
export interface CriticalPathResult {
  plannedFinish: string;
  criticalCodes: string[];
  activities: CriticalPathItem[];
}

const iso = /^\d{4}-\d{2}-\d{2}$/;
function date(value: string): Date {
  const parsed = new Date(`${value}T12:00:00.000Z`);
  if (!iso.test(value) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`Data inválida para caminho crítico: ${value}`);
  }
  return parsed;
}
function shiftDay(value: string, change: number): string {
  const result = date(value);
  result.setUTCDate(result.getUTCDate() + change);
  return result.toISOString().slice(0, 10);
}
export function analyzeConstructionCriticalPath(
  activities: PlannedActivity[],
  options: { calendar: WorkCalendar; holidays?: string[] },
): CriticalPathResult {
  const first = activities[0];
  if (!first) throw new Error('Caminho crítico exige pelo menos uma atividade.');
  if (!['weekdays', 'calendar_days'].includes(options.calendar)) throw new Error('Calendário inválido para caminho crítico.');
  const holidays = new Set(options.holidays ?? []);
  for (const holiday of holidays) date(holiday);
  const isWorkday = (day: string): boolean => {
    if (options.calendar === 'calendar_days') return true;
    const weekday = date(day).getUTCDay();
    return weekday !== 0 && weekday !== 6 && !holidays.has(day);
  };
  const previousWorkday = (day: string): string => {
    let cursor = shiftDay(day, -1);
    while (!isWorkday(cursor)) cursor = shiftDay(cursor, -1);
    return cursor;
  };
  const nextWorkday = (day: string): string => {
    let cursor = shiftDay(day, 1);
    while (!isWorkday(cursor)) cursor = shiftDay(cursor, 1);
    return cursor;
  };
  const shiftWorkdays = (day: string, n: number): string => {
    let cursor = day;
    if (n === 0) { while (!isWorkday(cursor)) cursor = shiftDay(cursor, 1); return cursor; }
    for (let remaining = Math.abs(n); remaining > 0; remaining--) cursor = n > 0 ? nextWorkday(cursor) : previousWorkday(cursor);
    return cursor;
  };
  const finishOfDuration = (start: string, duration: number): string => {
    let cursor = start;
    for (let remaining = duration - 1; remaining > 0; remaining--) cursor = nextWorkday(cursor);
    return cursor;
  };
  const startOfDuration = (finish: string, duration: number): string => {
    let cursor = finish;
    for (let remaining = duration - 1; remaining > 0; remaining--) cursor = previousWorkday(cursor);
    return cursor;
  };
  const floatBetween = (start: string, finish: string): number => {
    if (finish < start) throw new Error('Datas inviáveis no caminho crítico: folga negativa.');
    let count = 0;
    for (let cursor = shiftDay(start, 1); cursor <= finish; cursor = shiftDay(cursor, 1)) {
      if (isWorkday(cursor)) count++;
    }
    return count;
  };
  const byCode = new Map<string, PlannedActivity>();
  const successors = new Map<string, string[]>();
  const linkOf = (task: PlannedActivity) => ({ type: task.dependencyType ?? 'FS', lag: task.lagDays ?? 0 });
  for (const task of activities) {
    if (!task.code.trim() || byCode.has(task.code)) throw new Error('Código de atividade vazio ou duplicado no CPM.');
    if (!Number.isSafeInteger(task.durationDays) || task.durationDays < 1) throw new Error(`Duração inválida em ${task.code}.`);
    date(task.plannedStart); date(task.plannedFinish);
    if (!isWorkday(task.plannedStart) || !isWorkday(task.plannedFinish)) throw new Error(`Data fora do calendário em ${task.code}.`);
    let expectedFinish = task.plannedStart;
    for (let remaining = task.durationDays - 1; remaining > 0; remaining--) {
      expectedFinish = shiftDay(expectedFinish, 1);
      while (!isWorkday(expectedFinish)) expectedFinish = shiftDay(expectedFinish, 1);
    }
    if (expectedFinish !== task.plannedFinish) throw new Error(`Duração e datas inconsistentes em ${task.code}.`);
    byCode.set(task.code, task);
    successors.set(task.code, []);
  }
  for (const task of activities) {
    if (!task.predecessorCode) continue;
    const predecessor = byCode.get(task.predecessorCode);
    if (!predecessor) throw new Error(`Dependência inexistente em ${task.code}.`);
    const { type, lag } = linkOf(task);
    const violates = type === 'FS'
      ? task.plannedStart < shiftWorkdays(predecessor.plannedFinish, 1 + lag)
      : type === 'SS'
        ? task.plannedStart < shiftWorkdays(predecessor.plannedStart, lag)
        : task.plannedFinish < shiftWorkdays(predecessor.plannedFinish, lag);
    if (predecessor.code === task.code || violates || (type === 'FS' && lag >= 0 && predecessor.plannedFinish >= task.plannedStart)) {
      throw new Error(`Dependência ou datas inconsistentes em ${task.code}.`);
    }
    successors.get(predecessor.code)!.push(task.code);
  }
  const plannedFinish = activities.reduce((last, task) => task.plannedFinish > last ? task.plannedFinish : last, first.plannedFinish);
  const latest = new Map<string, { start: string; finish: string }>();
  const visiting = new Set<string>();
  function resolve(code: string): { start: string; finish: string } {
    const prior = latest.get(code);
    if (prior) return prior;
    if (visiting.has(code)) throw new Error(`Dependências circulares em ${code}.`);
    visiting.add(code);
    const next = successors.get(code) ?? [];
    const duration = byCode.get(code)!.durationDays;
    const latestFinish = next.length
      ? next.map(successorCode => {
        const successor = byCode.get(successorCode)!;
        const late = resolve(successorCode);
        const { type, lag } = linkOf(successor);
        if (type === 'FS') return shiftWorkdays(late.start, -(1 + lag));
        if (type === 'SS') return finishOfDuration(shiftWorkdays(late.start, -lag), duration);
        return shiftWorkdays(late.finish, -lag);
      }).reduce((minimum, candidate) => candidate < minimum ? candidate : minimum)
      : plannedFinish;
    const latestStart = startOfDuration(latestFinish, duration);
    if (latestStart < byCode.get(code)!.plannedStart) throw new Error(`Planejamento inviável em ${code}.`);
    const result = { start: latestStart, finish: latestFinish };
    latest.set(code, result);
    visiting.delete(code);
    return result;
  }
  const items = activities.map(task => {
    const late = resolve(task.code);
    const totalFloatDays = floatBetween(task.plannedStart, late.start);
    return {
      code: task.code,
      earliestStart: task.plannedStart,
      earliestFinish: task.plannedFinish,
      latestStart: late.start,
      latestFinish: late.finish,
      totalFloatDays,
      isCritical: totalFloatDays === 0,
    };
  });
  return { plannedFinish, criticalCodes: items.filter(item => item.isCritical).map(item => item.code), activities: items };
}
