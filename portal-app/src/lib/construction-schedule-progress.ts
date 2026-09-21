/* Etapa 5/7: indicadores calculados apenas a partir da linha de base e de medições.
 * NÃO confundir os custos da execução com honorários comerciais.
 * Não inventar progresso histórico a partir do percentual atual. */
export type ScheduleCalendar = 'weekdays' | 'calendar_days';
export interface FinancialScheduleActivity {
  code: string;
  plannedStart: string;
  plannedFinish: string;
  financialWeightPercent: number;
  plannedConstructionCost: number | null;
  actualProgressPercent: number | null;
  actualConstructionCost: number | null;
  physicalWeightPercent?: number | null;
}
export interface ScheduleMeasurement {
  measuredAt: string;
  physicalPercent: number | null;
  financialPercent: number | null;
  actualConstructionCost: number | null;
}
export interface ScheduleCurvePoint {
  date: string;
  plannedFinancialPercent: number;
  plannedConstructionCost: number;
  plannedPhysicalPercent: number | null;
  measuredPhysicalPercent: number | null;
  measuredFinancialPercent: number | null;
  measuredActualCost: number | null;
  measurementDate: string | null;
}
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const round = (number: number) => Math.round((number + Number.EPSILON) * 100) / 100;
function epoch(day: string): number {
  if (!datePattern.test(day)) throw new Error(`Data inválida: ${day}`);
  const timestamp = Date.parse(`${day}T12:00:00.000Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== day) {
    throw new Error(`Data inválida: ${day}`);
  }
  return timestamp;
}
const iso = (timestamp: number) => new Date(timestamp).toISOString().slice(0, 10);
const next = (day: string, count = 1) => iso(epoch(day) + count * 86400000);
function workday(day: string, calendar: ScheduleCalendar, holidays: Set<string>): boolean {
  const weekday = new Date(epoch(day)).getUTCDay();
  return !holidays.has(day) && (calendar === 'calendar_days' || (weekday !== 0 && weekday !== 6));
}
/** Planejado inclusivo, consistente com o motor de planejamento e com feriados declarados. */
export function plannedPercentAt(start: string, finish: string, reference: string, calendar: ScheduleCalendar, holidays: readonly string[] = []): number {
  if (calendar !== 'weekdays' && calendar !== 'calendar_days') throw new Error('Calendário inválido');
  const beginning = epoch(start), end = epoch(finish), at = epoch(reference);
  if (end < beginning) throw new Error('Intervalo de atividade inválido');
  const excluded = new Set(holidays);
  for (const holiday of excluded) epoch(holiday);
  if (at < beginning) return 0;
  if (at >= end) return 100;
  let total = 0, elapsed = 0;
  for (let current = beginning; current <= end; current += 86400000) {
    if (workday(iso(current), calendar, excluded)) {
      total += 1;
      if (current <= at) elapsed += 1;
    }
  }
  if (!total) throw new Error('Atividade sem dias de trabalho: revise o calendário');
  return round(elapsed * 100 / total);
}
function validatedActivities(items: readonly FinancialScheduleActivity[]): { total: number; physical: boolean; begin: string; finish: string } {
  if (!items.length) throw new Error('Cronograma sem atividades');
  const seen = new Set<string>();
  let financialWeights = 0, physicalWeights = 0, total = 0;
  let allPhysical = true, begin = '9999-12-31', finish = '0001-01-01';
  for (const item of items) {
    if (!item.code.trim() || seen.has(item.code)) throw new Error('Código de atividade ausente ou duplicado');
    seen.add(item.code);
    if (epoch(item.plannedFinish) < epoch(item.plannedStart)) throw new Error('Período de atividade inválido');
    if (!Number.isFinite(item.financialWeightPercent) || item.financialWeightPercent < 0 || item.financialWeightPercent > 100) throw new Error('Peso financeiro inválido');
    if (item.plannedConstructionCost === null || !Number.isFinite(item.plannedConstructionCost) || item.plannedConstructionCost < 0) throw new Error('Custo de execução ausente ou inválido');
    if (item.actualProgressPercent !== null && (!Number.isFinite(item.actualProgressPercent) || item.actualProgressPercent < 0 || item.actualProgressPercent > 100)) throw new Error('Avanço realizado inválido');
    if (item.actualConstructionCost !== null && (!Number.isFinite(item.actualConstructionCost) || item.actualConstructionCost < 0)) throw new Error('Custo realizado inválido');
    financialWeights += item.financialWeightPercent;
    total += item.plannedConstructionCost;
    if (item.physicalWeightPercent === null || item.physicalWeightPercent === undefined) allPhysical = false;
    else {
      if (!Number.isFinite(item.physicalWeightPercent) || item.physicalWeightPercent < 0 || item.physicalWeightPercent > 100) throw new Error('Peso físico inválido');
      physicalWeights += item.physicalWeightPercent;
    }
    if (item.plannedStart < begin) begin = item.plannedStart;
    if (item.plannedFinish > finish) finish = item.plannedFinish;
  }
  if (total <= 0 || Math.abs(financialWeights - 100) > 0.011) throw new Error('Custo de obra positivo e pesos financeiros de 100% são obrigatórios');
  if (allPhysical && Math.abs(physicalWeights - 100) > 0.011) throw new Error('Pesos físicos informados devem somar 100%');
  return { total, physical: allPhysical, begin, finish };
}
/** Indicadores no corte: custo real só aparece quando foi informado; não tratar NULL como zero. */
export function scheduleIndicators(items: readonly FinancialScheduleActivity[], reference: string, calendar: ScheduleCalendar, holidays: readonly string[] = []) {
  epoch(reference);
  const { total, physical } = validatedActivities(items);
  let plannedCost = 0, weightedPlanned = 0, weightedActual = 0, physicalPlanned = 0, physicalActual = 0, realCost = 0;
  let measuredProgress = true, measuredCost = true;
  for (const item of items) {
    const fraction = plannedPercentAt(item.plannedStart, item.plannedFinish, reference, calendar, holidays) / 100;
    plannedCost += (item.plannedConstructionCost as number) * fraction;
    weightedPlanned += item.financialWeightPercent * fraction;
    if (item.actualProgressPercent === null) measuredProgress = false;
    else weightedActual += item.financialWeightPercent * item.actualProgressPercent / 100;
    if (item.actualConstructionCost === null) measuredCost = false;
    else realCost += item.actualConstructionCost;
    if (physical) {
      physicalPlanned += (item.physicalWeightPercent as number) * fraction;
      if (item.actualProgressPercent !== null) physicalActual += (item.physicalWeightPercent as number) * item.actualProgressPercent / 100;
    }
  }
  return {
    totalConstructionCost: round(total), plannedConstructionCostAtDate: round(plannedCost),
    actualConstructionCostAtDate: measuredCost ? round(realCost) : null,
    plannedFinancialPercent: round(100 * plannedCost / total),
    plannedWeightedProgressPercent: round(weightedPlanned),
    actualWeightedProgressPercent: measuredProgress ? round(weightedActual) : null,
    plannedPhysicalPercent: physical ? round(physicalPlanned) : null,
    actualPhysicalPercent: physical && measuredProgress ? round(physicalActual) : null,
    costDeviation: measuredCost ? round(realCost - plannedCost) : null,
    progressDeviationPoints: measuredProgress ? round(weightedActual - weightedPlanned) : null,
    actualDataComplete: measuredProgress && measuredCost,
  };
}
/** Datas semanais cobrem TODO o prazo e incluem exatamente o término; sem limite fixo de 27 semanas. */
export function scheduleWeeklyCurve(items: readonly FinancialScheduleActivity[], calendar: ScheduleCalendar, holidays: readonly string[] = [], measurements: readonly ScheduleMeasurement[] = []): ScheduleCurvePoint[] {
  const { begin, finish } = validatedActivities(items);
  const observed = [...measurements].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  const dates = new Set<string>([begin, finish]);
  for (let cursor = begin, index = 0; cursor < finish; cursor = next(cursor, 7), index += 1) {
    if (index > 520) throw new Error('Prazo superior a dez anos: revise datas antes de montar a Curva S');
    dates.add(cursor);
  }
  const points: ScheduleCurvePoint[] = [];
  let previous: ScheduleMeasurement | null = null, offset = 0;
  for (const date of [...dates].sort()) {
    while (offset < observed.length && observed[offset].measuredAt <= date) {
      const measurement = observed[offset++];
      epoch(measurement.measuredAt);
      for (const value of [measurement.physicalPercent, measurement.financialPercent]) {
        if (value !== null && (!Number.isFinite(value) || value < 0 || value > 100)) throw new Error('Medição percentual inválida');
      }
      if (measurement.actualConstructionCost !== null && (!Number.isFinite(measurement.actualConstructionCost) || measurement.actualConstructionCost < 0)) throw new Error('Custo medido inválido');
      previous = measurement;
    }
    const indicator = scheduleIndicators(items, date, calendar, holidays);
    points.push({
      date, plannedFinancialPercent: indicator.plannedFinancialPercent,
      plannedConstructionCost: indicator.plannedConstructionCostAtDate,
      plannedPhysicalPercent: indicator.plannedPhysicalPercent,
      measuredPhysicalPercent: previous?.physicalPercent ?? null,
      measuredFinancialPercent: previous?.financialPercent ?? null,
      measuredActualCost: previous?.actualConstructionCost ?? null,
      measurementDate: previous?.measuredAt ?? null,
    });
  }
  return points;
}
