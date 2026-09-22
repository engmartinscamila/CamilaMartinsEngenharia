import type { ClientConstructionSchedulePublication } from '../services/construction-schedule-publication-service';

export interface ClientGanttBar {
  code: string;
  activity: string;
  start: string;
  finish: string;
  offsetPercent: number;
  widthPercent: number;
  measuredPercent: number | null;
}
export interface ClientGanttData {
  start: string;
  finish: string;
  bars: ClientGanttBar[];
}
const iso = /^\d{4}-\d{2}-\d{2}$/;
const dateMs = (value: string | null): number | null => {
  if (!value || !iso.test(value)) return null;
  const parsed = Date.parse(`${value}T12:00:00.000Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value ? parsed : null;
};
const day = 86_400_000;
const round = (n: number) => Math.round(n * 100) / 100;
/** This is a date-positioning helper, NOT a forecast or a synthetic measurement curve.
 * Use exclusively the minimally published client snapshot, never admin costs or raw measurements.
 */
export function buildClientConstructionGantt(
  publication: ClientConstructionSchedulePublication,
): ClientGanttData | null {
  const startMs = dateMs(publication.plannedStart);
  const finishMs = dateMs(publication.plannedFinish);
  if (startMs === null || finishMs === null || finishMs < startMs) return null;
  const days = Math.round((finishMs - startMs) / day) + 1;
  if (days > 3660) return null;
  const bars: ClientGanttBar[] = [];
  for (const activity of publication.activities) {
    const activityStart = dateMs(activity.planned_start);
    const activityFinish = dateMs(activity.planned_finish);
    if (activityStart === null || activityFinish === null || activityFinish < activityStart ||
      activityStart < startMs || activityFinish > finishMs) continue;
    const measured = activity.actual_progress;
    const measuredPercent = typeof measured === 'number' && Number.isFinite(measured) && measured >= 0 && measured <= 100
      ? measured : null;
    bars.push({
      code: activity.code,
      activity: activity.activity,
      start: activity.planned_start!,
      finish: activity.planned_finish!,
      offsetPercent: round((activityStart - startMs) / day / days * 100),
      widthPercent: round(((activityFinish - activityStart) / day + 1) / days * 100),
      measuredPercent,
    });
  }
  if (!bars.length) return null;
  return { start: publication.plannedStart!, finish: publication.plannedFinish!, bars };
}
