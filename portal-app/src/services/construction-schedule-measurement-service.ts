import { supabase } from '@/lib/supabase';
import {
  scheduleIndicators, scheduleWeeklyCurve,
  type FinancialScheduleActivity, type ScheduleCalendar, type ScheduleMeasurement,
} from '@/lib/construction-schedule-progress';

export interface ApprovedScheduleOption {
  id: string;
  projectId: string;
  title: string;
  baselineVersion: number;
  approvedAt: string | null;
}
export interface ScheduleMeasuredItem {
  id: string;
  code: string;
  activity: string;
  weightPercent: number;
  plannedCost: number | null;
  progress: number | null;
  cost: number | null;
}
export interface ScheduleMeasurementEvent {
  id: string;
  code: string;
  measuredOn: string;
  recordedAt: string;
  progress: number;
  cost: number | null;
  reason: string;
}
export interface ScheduleMeasurementOverview {
  items: ScheduleMeasuredItem[];
  history: ScheduleMeasurementEvent[];
  calendar: ScheduleCalendar;
  holidays: string[];
  baselineVersion: number;
  summary: ReturnType<typeof scheduleIndicators>;
  curve: ReturnType<typeof scheduleWeeklyCurve>;
}
export interface NewScheduleMeasurement {
  code: string;
  progress: number;
  actualCost: number | null;
  actualStart?: string | null;
  actualFinish?: string | null;
}

export async function listApprovedSchedules(): Promise<{data: ApprovedScheduleOption[]; error: string | null}> {
  const response = await supabase.from('construction_schedules')
    .select('id,project_id,title,baseline_version,approved_at')
    .eq('activation_status', 'approved').order('approved_at', {ascending: false}).limit(100);
  if (response.error) return {data: [], error: response.error.message};
  return {data: (response.data ?? []).map((row) => ({
    id: String(row.id), projectId: String(row.project_id), title: String(row.title),
    baselineVersion: Number(row.baseline_version), approvedAt: row.approved_at,
  })), error: null};
}

/** Acesso via JWT administrativo e RLS; consultas não criam cronogramas. */
export async function loadScheduleMeasurementOverview(scheduleId: string, reference: string): Promise<{data: ScheduleMeasurementOverview | null; error: string | null}> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reference) || !Number.isFinite(Date.parse(`${reference}T12:00:00Z`))) {
    return {data: null, error: 'Data de referência inválida.'};
  }
  const [scheduleResponse, itemResponse, eventResponse, holidayResponse] = await Promise.all([
    supabase.from('construction_schedules').select('id,activation_status,baseline_version,baseline_snapshot,work_calendar').eq('id', scheduleId).single(),
    supabase.from('construction_schedule_items').select('id,code,activity,weight_percent,planned_cost,actual_progress,actual_cost').eq('schedule_id', scheduleId).order('display_order'),
    supabase.from('construction_schedule_measurements').select('id,item_id,measured_on,recorded_at,actual_progress,actual_construction_cost,reason')
      .eq('schedule_id', scheduleId).order('measured_on').order('recorded_at').order('id').limit(2000),
    supabase.from('construction_schedule_holidays').select('holiday_date').eq('schedule_id', scheduleId).order('holiday_date').limit(367),
  ]);
  if (scheduleResponse.error || itemResponse.error || eventResponse.error || holidayResponse.error ||
    !scheduleResponse.data || !itemResponse.data || !eventResponse.data || !holidayResponse.data) {
    return {data: null, error: scheduleResponse.error?.message ?? itemResponse.error?.message ?? eventResponse.error?.message ?? holidayResponse.error?.message ?? 'Falha ao carregar as medições.'};
  }
  if (eventResponse.data.length >= 2000) return {data: null, error: 'O histórico supera 2.000 eventos. A paginação integral é necessária antes de calcular indicadores.'};
  if (holidayResponse.data.length > 366) return {data: null, error: 'Calendário de feriados incompleto: revisar os dados antes de calcular.'};
  const header = scheduleResponse.data;
  const baseline = header.baseline_snapshot as {activities?: Array<Record<string, unknown>>; calendar?: string} | null;
  if (header.activation_status !== 'approved' || Number(header.baseline_version) < 1 || !Array.isArray(baseline?.activities)) {
    return {data: null, error: 'Este cronograma ainda não possui uma linha de base aprovada.'};
  }
  const calendar = header.work_calendar;
  if (calendar !== 'weekdays' && calendar !== 'calendar_days') return {data: null, error: 'Calendário de trabalho inválido.'};
  const {data: archived, error: archivedError} = await supabase.from('construction_schedule_baseline_versions')
    .select('holiday_dates').eq('schedule_id', scheduleId).eq('baseline_version', header.baseline_version).single();
  if (archivedError || !archived || !Array.isArray(archived.holiday_dates)) {
    return {data: null, error: 'Versão aprovada sem calendário arquivado: conferência necessária.'};
  }
  const holidays = holidayResponse.data.map((row) => String(row.holiday_date));
  if (JSON.stringify(holidays) !== JSON.stringify(archived.holiday_dates)) {
    return {data: null, error: 'Feriados atuais não coincidem com o calendário aprovado.'};
  }
  const codeById = new Map(itemResponse.data.map((item) => [String(item.id), String(item.code)]));
  const itemByCode = new Map(itemResponse.data.map((item) => [String(item.code), item]));
  const events: ScheduleMeasurementEvent[] = eventResponse.data.map((event) => ({
    id: String(event.id), code: codeById.get(String(event.item_id)) ?? '',
    measuredOn: String(event.measured_on), recordedAt: String(event.recorded_at),
    progress: Number(event.actual_progress),
    cost: event.actual_construction_cost === null ? null : Number(event.actual_construction_cost),
    reason: String(event.reason),
  }));
  if (events.some((event) => !event.code)) return {data: null, error: 'O histórico contém uma atividade sem vínculo. Revisar a integridade.'};
  const latest = new Map<string, {progress: number; cost: number | null}>();
  const asOf = new Map<string, {progress: number; cost: number | null}>();
  const snapshots: ScheduleMeasurement[] = [];
  let lastDate = '';
  const consolidate = (measuredAt: string) => {
    if (!latest.size) return;
    let financial = 0, physical = 0, realCost = 0;
    let allProgress = true, allPhysical = true, allCost = true;
    for (const baselineItem of baseline.activities ?? []) {
      const code = String(baselineItem.code);
      const state = latest.get(code);
      const weight = Number(baselineItem.weight_percent);
      const physicalWeight = baselineItem.physical_weight_percent;
      if (!state || !Number.isFinite(weight)) allProgress = false;
      else financial += weight * state.progress / 100;
      if (!state || physicalWeight === null || physicalWeight === undefined) allPhysical = false;
      else physical += Number(physicalWeight) * state.progress / 100;
      if (!state || state.cost === null) allCost = false;
      else realCost += state.cost;
    }
    snapshots.push({measuredAt, financialPercent: allProgress ? financial : null,
      physicalPercent: allPhysical ? physical : null,
      actualConstructionCost: allCost ? realCost : null});
  };
  for (const event of events) {
    if (lastDate && event.measuredOn !== lastDate) consolidate(lastDate);
    const previous = latest.get(event.code);
    const next = {progress: event.progress, cost: event.cost ?? previous?.cost ?? null};
    latest.set(event.code, next);
    // Uma medição de amanhã nunca deve aparecer no painel consultado ontem.
    if (event.measuredOn <= reference) asOf.set(event.code, next);
    lastDate = event.measuredOn;
  }
  if (lastDate) consolidate(lastDate);
  const activities: FinancialScheduleActivity[] = [];
  for (const baseItem of baseline.activities) {
    const code = String(baseItem.code);
    const live = itemByCode.get(code);
    if (!live) return {data: null, error: `Atividade ${code} não corresponde à linha de base.`};
    const measurement = asOf.get(code);
    activities.push({
      code, plannedStart: String(baseItem.planned_start), plannedFinish: String(baseItem.planned_finish),
      financialWeightPercent: Number(baseItem.weight_percent),
      plannedConstructionCost: baseItem.planned_cost === null ? null : Number(baseItem.planned_cost),
      physicalWeightPercent: baseItem.physical_weight_percent === null || baseItem.physical_weight_percent === undefined ? null : Number(baseItem.physical_weight_percent),
      actualProgressPercent: measurement?.progress ?? null, actualConstructionCost: measurement?.cost ?? null,
    });
  }
  try {
    const summary = scheduleIndicators(activities, reference, calendar, holidays);
    const curve = scheduleWeeklyCurve(activities, calendar, holidays, snapshots);
    const items: ScheduleMeasuredItem[] = itemResponse.data.map((item) => ({
      id: String(item.id), code: String(item.code), activity: String(item.activity),
      weightPercent: Number(item.weight_percent),
      plannedCost: item.planned_cost === null ? null : Number(item.planned_cost),
      progress: asOf.get(String(item.code))?.progress ?? null,
      cost: asOf.get(String(item.code))?.cost ?? null,
    }));
    return {data: {items, history: events, calendar, holidays, baselineVersion: Number(header.baseline_version), summary, curve}, error: null};
  } catch (error) {
    return {data: null, error: error instanceof Error ? error.message : 'Não foi possível validar os indicadores.'};
  }
}

export async function recordScheduleMeasurement(scheduleId: string, measuredOn: string, entries: NewScheduleMeasurement[], reason: string): Promise<string | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(measuredOn) || !reason.trim() || reason.trim().length < 10 || entries.length === 0) {
    return 'Informe data real, atividades medidas e justificativa com pelo menos dez caracteres.';
  }
  const response = await supabase.rpc('admin_record_full_schedule_measurement', {
    p_schedule_id: scheduleId, p_measured_on: measuredOn,
    p_entries: entries.map((entry) => ({code: entry.code, progress: entry.progress,
      actual_cost: entry.actualCost, actual_start: entry.actualStart ?? null, actual_finish: entry.actualFinish ?? null})),
    p_reason: reason.trim(),
  });
  return response.error?.message ?? null;
}
