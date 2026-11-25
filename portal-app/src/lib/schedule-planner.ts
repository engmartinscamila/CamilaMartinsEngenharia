/* Planejador de cronograma — motor puro (sem banco, sem rede).
 * Calcula datas por dias de trabalho, dependências término-início com defasagem,
 * caminho crítico (CPM), folgas, deadline, avanço planejado × real, previsão de
 * término, Curva S e desembolso mensal. Usado pela tela "Cronograma completo"
 * e pelo gerador de Excel. Nada aqui grava contratos, projetos ou clientes. */

export type PlannerCalendar = 'mon_fri' | 'mon_sat' | 'all_days';
export type WeightMode = 'cost' | 'duration';

export interface PlannerActivity {
  id: string;
  code: string;
  group: string;
  name: string;
  /** Duração em dias de trabalho do calendário escolhido. */
  duration: number;
  /** Códigos separados por vírgula; aceita defasagem: "3", "3+2", "3-1". */
  predecessors: string;
  /** Início mínimo opcional (aaaa-mm-dd). */
  fixedStart: string;
  cost: number;
  progress: number;
  responsible: string;
  notes: string;
}

export interface PlannerProject {
  id: string;
  name: string;
  client: string;
  address: string;
  responsible: string;
  startDate: string;
  deadline: string;
  statusDate: string;
  calendar: PlannerCalendar;
  nationalHolidays: boolean;
  extraHolidays: string;
  weightMode: WeightMode;
  activities: PlannerActivity[];
  updatedAt: string;
}

export interface PlannedRow extends PlannerActivity {
  start: string;
  finish: string;
  lateStart: string;
  lateFinish: string;
  totalFloat: number;
  critical: boolean;
  weight: number;
  plannedNow: number;
  status: 'Concluída' | 'Em andamento' | 'Não iniciada' | 'Atrasada';
  delayed: boolean;
  calendarDays: number;
}

export interface CurvePoint { date: string; planned: number; actual: number | null }
export interface MonthFlow { month: string; label: string; cost: number; cumulative: number; percent: number }

export interface PlannerResult {
  rows: PlannedRow[];
  start: string;
  finish: string;
  workDays: number;
  calendarDays: number;
  totalCost: number;
  plannedPercent: number;
  actualPercent: number;
  spi: number | null;
  forecastFinish: string;
  deadline: string | null;
  deadlineMarginWorkDays: number | null;
  deadlineMarginCalendarDays: number | null;
  forecastMarginCalendarDays: number | null;
  criticalCodes: string[];
  holidays: string[];
  curve: CurvePoint[];
  months: MonthFlow[];
  statusDate: string;
  warnings: string[];
  counts: { total: number; done: number; running: number; notStarted: number; delayed: number };
}

const DAY = 86_400_000;
const isoPattern = /^\d{4}-\d{2}-\d{2}$/;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const isIso = (value: string) => isoPattern.test(value) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
const toDate = (value: string) => new Date(`${value}T12:00:00Z`);
const toIso = (date: Date) => date.toISOString().slice(0, 10);
export const addCalendarDays = (value: string, days: number) => toIso(new Date(toDate(value).getTime() + days * DAY));
export const diffCalendarDays = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / DAY);

export function todayIso() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function formatBr(value: string) {
  return isIso(value) ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : '—';
}

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
function easter(year: number) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Feriados nacionais (fixos + móveis usuais em obras: Carnaval, Sexta-feira Santa, Corpus Christi). */
export function nationalHolidays(year: number): { date: string; name: string }[] {
  const e = easter(year);
  const fixed: [string, string][] = [
    ['01-01', 'Confraternização Universal'], ['04-21', 'Tiradentes'], ['05-01', 'Dia do Trabalho'],
    ['09-07', 'Independência'], ['10-12', 'Nossa Senhora Aparecida'], ['11-02', 'Finados'],
    ['11-15', 'Proclamação da República'], ['11-20', 'Consciência Negra'], ['12-25', 'Natal'],
  ];
  return [
    ...fixed.map(([md, name]) => ({ date: `${year}-${md}`, name })),
    { date: addCalendarDays(e, -48), name: 'Carnaval (segunda)' },
    { date: addCalendarDays(e, -47), name: 'Carnaval (terça)' },
    { date: addCalendarDays(e, -2), name: 'Sexta-feira Santa' },
    { date: addCalendarDays(e, 60), name: 'Corpus Christi' },
  ].sort((x, y) => x.date.localeCompare(y.date));
}

/** Converte "25/12/2026, 2026-12-31" em datas ISO válidas. */
export function parseHolidayList(text: string): { dates: string[]; invalid: string[] } {
  const dates: string[] = [], invalid: string[] = [];
  for (const raw of text.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean)) {
    const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
    const iso = br ? `${br[3]}-${br[2]!.padStart(2, '0')}-${br[1]!.padStart(2, '0')}` : raw;
    if (isIso(iso)) dates.push(iso); else invalid.push(raw);
  }
  return { dates, invalid };
}

interface Pred { code: string; lag: number }
export function parsePredecessors(text: string): { list: Pred[]; invalid: string[] } {
  const list: Pred[] = [], invalid: string[] = [];
  for (const raw of text.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean)) {
    const match = /^([A-Za-z0-9._-]+?)(?:([+-])(\d{1,3}))?$/.exec(raw);
    if (!match) { invalid.push(raw); continue; }
    list.push({ code: match[1]!.toUpperCase(), lag: match[2] ? (match[2] === '-' ? -1 : 1) * Number(match[3]) : 0 });
  }
  return { list, invalid };
}

class WorkCalendarIndex {
  private readonly days: string[] = [];
  private readonly index = new Map<string, number>();
  private readonly origin: string;
  private readonly mode: PlannerCalendar;
  private readonly holidays: Set<string>;
  constructor(origin: string, mode: PlannerCalendar, holidays: Set<string>) {
    this.origin = origin; this.mode = mode; this.holidays = holidays;
  }
  isWorkday(value: string) {
    const weekday = toDate(value).getUTCDay();
    if (this.mode === 'mon_fri' && (weekday === 0 || weekday === 6)) return false;
    if (this.mode === 'mon_sat' && weekday === 0) return false;
    return !this.holidays.has(value);
  }
  private ensure(position: number) {
    let cursor = this.days.length ? addCalendarDays(this.days[this.days.length - 1]!, 1) : this.origin;
    let guard = 0;
    while (this.days.length <= position) {
      if (this.isWorkday(cursor)) { this.index.set(cursor, this.days.length); this.days.push(cursor); }
      cursor = addCalendarDays(cursor, 1);
      if (++guard > 40_000) throw new Error('Calendário sem dias de trabalho suficientes.');
    }
  }
  dateAt(position: number): string { this.ensure(Math.max(0, position)); return this.days[Math.max(0, position)]!; }
  /** Índice do primeiro dia de trabalho em ou após a data. */
  indexOnOrAfter(value: string) {
    if (value <= this.origin) return 0;
    let guard = 0, cursor = value;
    while (!this.isWorkday(cursor)) { cursor = addCalendarDays(cursor, 1); if (++guard > 400) break; }
    let position = Math.max(0, this.days.length - 1);
    while (this.dateAt(position) < cursor) position += 1;
    return position;
  }
  /** Quantidade de dias de trabalho entre a origem e a data (inclusive). */
  workdaysUpTo(value: string) {
    if (value < this.origin) return 0;
    let position = 0;
    while (this.dateAt(position) <= value) position += 1;
    return position;
  }
}

export function planProject(project: PlannerProject): PlannerResult {
  const warnings: string[] = [];
  if (!isIso(project.startDate)) throw new Error('Informe a data de início da obra.');
  if (!project.activities.length) throw new Error('Inclua ao menos uma atividade.');
  const statusDate = isIso(project.statusDate) ? project.statusDate : todayIso();

  // Feriados
  const holidaySet = new Set<string>();
  const extra = parseHolidayList(project.extraHolidays || '');
  extra.invalid.forEach((value) => warnings.push(`Feriado ignorado (data inválida): ${value}`));
  extra.dates.forEach((d) => holidaySet.add(d));
  const startYear = Number(project.startDate.slice(0, 4));
  if (project.nationalHolidays && project.calendar !== 'all_days') {
    for (let year = startYear; year <= startYear + 5; year += 1) nationalHolidays(year).forEach((h) => holidaySet.add(h.date));
  }
  const cal = new WorkCalendarIndex(project.startDate, project.calendar, project.calendar === 'all_days' ? new Set<string>() : holidaySet);

  // Atividades válidas
  const byCode = new Map<string, PlannerActivity>();
  const acts: PlannerActivity[] = [];
  project.activities.forEach((activity, position) => {
    const code = (activity.code || String(position + 1)).trim().toUpperCase();
    if (!activity.name.trim()) throw new Error(`Informe o nome da atividade ${code}.`);
    if (byCode.has(code)) throw new Error(`O código ${code} está repetido.`);
    const duration = Math.round(Number(activity.duration));
    if (!Number.isFinite(duration) || duration < 1 || duration > 3650) throw new Error(`Duração inválida em ${code} (use de 1 a 3650 dias).`);
    const progress = Math.max(0, Math.min(100, Number(activity.progress) || 0));
    const cost = Math.max(0, Number(activity.cost) || 0);
    if (activity.fixedStart && !isIso(activity.fixedStart)) throw new Error(`Início mínimo inválido em ${code}.`);
    const normalized = { ...activity, code, duration, progress, cost };
    byCode.set(code, normalized); acts.push(normalized);
  });

  // Dependências e ordenação topológica
  const preds = new Map<string, Pred[]>();
  const succs = new Map<string, Pred[]>();
  for (const a of acts) {
    const parsed = parsePredecessors(a.predecessors || '');
    parsed.invalid.forEach((value) => warnings.push(`Predecessora ignorada em ${a.code}: "${value}"`));
    const list = parsed.list.filter((p) => {
      if (p.code === a.code) throw new Error(`${a.code} não pode depender dela mesma.`);
      if (!byCode.has(p.code)) throw new Error(`A predecessora ${p.code} (em ${a.code}) não existe.`);
      return true;
    });
    preds.set(a.code, list);
    for (const p of list) succs.set(p.code, [...(succs.get(p.code) ?? []), { code: a.code, lag: p.lag }]);
  }
  const order: string[] = [];
  const state = new Map<string, 1 | 2>();
  const visit = (code: string, chain: string[]) => {
    if (state.get(code) === 2) return;
    if (state.get(code) === 1) throw new Error(`Dependência circular: ${[...chain, code].join(' → ')}.`);
    state.set(code, 1);
    for (const p of preds.get(code) ?? []) visit(p.code, [...chain, code]);
    state.set(code, 2); order.push(code);
  };
  acts.forEach((a) => visit(a.code, []));

  // Passagem de ida (índices de dias de trabalho)
  const es = new Map<string, number>(), ef = new Map<string, number>();
  for (const code of order) {
    const a = byCode.get(code)!;
    let start = 0;
    for (const p of preds.get(code) ?? []) start = Math.max(start, ef.get(p.code)! + 1 + p.lag);
    if (a.fixedStart) start = Math.max(start, cal.indexOnOrAfter(a.fixedStart));
    start = Math.max(0, start);
    es.set(code, start); ef.set(code, start + a.duration - 1);
  }
  const projectEnd = Math.max(...[...ef.values()]);

  // Passagem de volta
  const lf = new Map<string, number>(), ls = new Map<string, number>();
  for (const code of [...order].reverse()) {
    const a = byCode.get(code)!;
    let finish = projectEnd;
    for (const s of succs.get(code) ?? []) finish = Math.min(finish, ls.get(s.code)! - 1 - s.lag);
    lf.set(code, finish); ls.set(code, finish - a.duration + 1);
  }

  // Pesos
  const totalCost = acts.reduce((sum, a) => sum + a.cost, 0);
  const totalDuration = acts.reduce((sum, a) => sum + a.duration, 0);
  const useCost = project.weightMode === 'cost' && totalCost > 0;
  if (project.weightMode === 'cost' && totalCost <= 0) warnings.push('Sem custos informados: os pesos foram calculados pela duração.');
  const weightOf = (a: PlannerActivity) => (useCost ? a.cost / totalCost : a.duration / totalDuration) * 100;

  const statusIdx = cal.workdaysUpTo(statusDate); // dias de trabalho decorridos até a data de referência (inclusive)
  const plannedFraction = (code: string, workdaysElapsed: number) => {
    const a = byCode.get(code)!;
    const done = workdaysElapsed - es.get(code)!;
    return Math.max(0, Math.min(1, done / a.duration));
  };

  const start = cal.dateAt(0);
  const finish = cal.dateAt(projectEnd);
  const rows: PlannedRow[] = acts.map((a) => {
    const s = cal.dateAt(es.get(a.code)!), f = cal.dateAt(ef.get(a.code)!);
    const float = ls.get(a.code)! - es.get(a.code)!;
    const plannedNow = round2(plannedFraction(a.code, statusIdx) * 100);
    const delayed = a.progress < 100 && (statusDate > f || a.progress + 10 < plannedNow);
    const status: PlannedRow['status'] = a.progress >= 100 ? 'Concluída' : delayed ? 'Atrasada' : a.progress > 0 ? 'Em andamento' : 'Não iniciada';
    return {
      ...a, start: s, finish: f,
      lateStart: cal.dateAt(ls.get(a.code)!), lateFinish: cal.dateAt(lf.get(a.code)!),
      totalFloat: float, critical: float <= 0, weight: round2(weightOf(a)),
      plannedNow, status, delayed, calendarDays: diffCalendarDays(s, f) + 1,
    };
  });

  const plannedPercent = round2(rows.reduce((sum, r) => sum + r.weight * r.plannedNow / 100, 0));
  const actualPercent = round2(rows.reduce((sum, r) => sum + r.weight * r.progress / 100, 0));
  const spi = plannedPercent > 0.5 ? round2(actualPercent / plannedPercent) : null;

  // Previsão de término: trabalho restante no ritmo observado (SPI), nunca antes do planejado se adiantado só por arredondamento.
  let forecastFinish = finish;
  if (actualPercent >= 100) forecastFinish = statusDate < finish ? statusDate : finish;
  else if (spi !== null && statusIdx > 0) {
    const totalWork = projectEnd + 1;
    const projectedTotal = Math.ceil(totalWork / Math.max(0.2, spi));
    forecastFinish = cal.dateAt(Math.max(projectedTotal - 1, statusIdx));
  } else if (statusDate > finish) {
    const remaining = Math.ceil((projectEnd + 1) * (1 - actualPercent / 100));
    forecastFinish = cal.dateAt(statusIdx + remaining);
  }

  const deadline = isIso(project.deadline) ? project.deadline : null;
  const deadlineMarginCalendarDays = deadline ? diffCalendarDays(finish, deadline) : null;
  const deadlineMarginWorkDays = deadline ? cal.workdaysUpTo(deadline) - (projectEnd + 1) : null;
  const forecastMarginCalendarDays = deadline ? diffCalendarDays(forecastFinish, deadline) : null;
  if (deadline && deadline < finish) warnings.push(`O término planejado (${formatBr(finish)}) passa do deadline (${formatBr(deadline)}).`);

  // Curva S: pontos semanais (ou diários em obras curtas)
  const span = diffCalendarDays(start, finish);
  const step = span <= 60 ? 1 : span <= 400 ? 7 : 14;
  const curve: CurvePoint[] = [];
  const scale = plannedPercent > 0 ? actualPercent / plannedPercent : 0;
  for (let offset = 0; ; offset += step) {
    const date = offset >= span ? finish : addCalendarDays(start, offset);
    const elapsed = cal.workdaysUpTo(date);
    const planned = round2(rows.reduce((sum, r) => sum + r.weight * plannedFraction(r.code, elapsed), 0));
    const actual = date <= statusDate ? round2(Math.min(actualPercent, planned * scale)) : null;
    curve.push({ date, planned, actual });
    if (date === finish) break;
  }
  if (statusDate > start && statusDate < finish && !curve.some((p) => p.date === statusDate)) {
    const elapsed = cal.workdaysUpTo(statusDate);
    curve.push({ date: statusDate, planned: round2(rows.reduce((s, r) => s + r.weight * plannedFraction(r.code, elapsed), 0)), actual: actualPercent });
    curve.sort((a, b) => a.date.localeCompare(b.date));
  }

  // Desembolso mensal (custo distribuído pelos dias de trabalho de cada atividade)
  const monthMap = new Map<string, number>();
  for (const r of rows) {
    if (!r.cost) continue;
    const perDay = r.cost / r.duration;
    for (let i = es.get(r.code)!; i <= ef.get(r.code)!; i += 1) {
      const m = cal.dateAt(i).slice(0, 7);
      monthMap.set(m, (monthMap.get(m) ?? 0) + perDay);
    }
  }
  const monthNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  let cumulative = 0;
  const months: MonthFlow[] = [];
  for (let m = start.slice(0, 7); m <= finish.slice(0, 7); ) {
    const cost = round2(monthMap.get(m) ?? 0);
    cumulative = round2(cumulative + cost);
    months.push({ month: m, label: `${monthNames[Number(m.slice(5)) - 1]}/${m.slice(2, 4)}`, cost, cumulative, percent: totalCost > 0 ? round2(cumulative / totalCost * 100) : 0 });
    const [y = 0, mo = 1] = m.split('-').map(Number);
    m = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`;
  }

  const criticalCodes = order.filter((code) => rows.find((r) => r.code === code)?.critical);
  const holidaysInRange = [...holidaySet].filter((d) => d >= start && d <= finish).sort();
  return {
    rows, start, finish, workDays: projectEnd + 1, calendarDays: span + 1, totalCost: round2(totalCost),
    plannedPercent, actualPercent, spi, forecastFinish, deadline, deadlineMarginWorkDays, deadlineMarginCalendarDays,
    forecastMarginCalendarDays, criticalCodes, holidays: holidaysInRange, curve, months, statusDate, warnings,
    counts: {
      total: rows.length,
      done: rows.filter((r) => r.status === 'Concluída').length,
      running: rows.filter((r) => r.status === 'Em andamento').length,
      notStarted: rows.filter((r) => r.status === 'Não iniciada').length,
      delayed: rows.filter((r) => r.status === 'Atrasada').length,
    },
  };
}

export const calendarLabel: Record<PlannerCalendar, string> = {
  mon_fri: 'Segunda a sexta',
  mon_sat: 'Segunda a sábado',
  all_days: 'Dias corridos',
};

let idCounter = 0;
export const newId = () => `${Date.now().toString(36)}${(idCounter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function blankActivity(code: string, predecessors = ''): PlannerActivity {
  return { id: newId(), code, group: '', name: '', duration: 5, predecessors, fixedStart: '', cost: 0, progress: 0, responsible: '', notes: '' };
}

export function blankProject(): PlannerProject {
  return {
    id: newId(), name: 'Novo cronograma', client: '', address: '', responsible: 'Eng. Camila Martins',
    startDate: todayIso(), deadline: '', statusDate: todayIso(), calendar: 'mon_fri', nationalHolidays: true,
    extraHolidays: '', weightMode: 'cost', activities: [blankActivity('1')], updatedAt: new Date().toISOString(),
  };
}

type TemplateRow = [group: string, name: string, duration: number, predecessors: string];
export const PLANNER_TEMPLATES: { key: string; label: string; rows: TemplateRow[] }[] = [
  {
    key: 'residencia', label: 'Residência térrea (obra completa)',
    rows: [
      ['Serviços preliminares', 'Mobilização, canteiro e ligações provisórias', 5, ''],
      ['Serviços preliminares', 'Locação da obra', 2, '1'],
      ['Fundação', 'Escavação e fundações', 10, '2'],
      ['Fundação', 'Vigas baldrame e impermeabilização', 6, '3'],
      ['Estrutura', 'Pilares, vigas e lajes', 20, '4'],
      ['Vedação', 'Alvenaria', 15, '5'],
      ['Cobertura', 'Estrutura do telhado e cobertura', 10, '6'],
      ['Instalações', 'Instalações hidrossanitárias', 12, '6'],
      ['Instalações', 'Instalações elétricas', 12, '6'],
      ['Revestimentos', 'Chapisco, reboco e contrapiso', 15, '8, 9'],
      ['Esquadrias', 'Esquadrias e vidros', 6, '10'],
      ['Revestimentos', 'Pisos e revestimentos cerâmicos', 12, '10'],
      ['Acabamentos', 'Louças, metais e acabamentos elétricos', 5, '12'],
      ['Acabamentos', 'Pintura', 12, '11, 12'],
      ['Área externa', 'Muros, calçadas e paisagismo', 8, '7'],
      ['Entrega', 'Limpeza final, vistoria e entrega', 3, '13, 14, 15'],
    ],
  },
  {
    key: 'reforma', label: 'Reforma de interiores',
    rows: [
      ['Preparação', 'Proteções e demolições', 4, ''],
      ['Instalações', 'Ajustes hidráulicos', 4, '1'],
      ['Instalações', 'Ajustes elétricos', 4, '1'],
      ['Revestimentos', 'Regularização e contrapiso', 4, '2, 3'],
      ['Revestimentos', 'Pisos e revestimentos', 6, '4'],
      ['Marcenaria', 'Marcenaria e bancadas', 8, '5'],
      ['Acabamentos', 'Pintura', 5, '5'],
      ['Acabamentos', 'Louças, metais e iluminação', 3, '6, 7'],
      ['Entrega', 'Limpeza e entrega', 2, '8'],
    ],
  },
  {
    key: 'projeto', label: 'Projeto e aprovação (escritório)',
    rows: [
      ['Projeto', 'Levantamento e briefing', 3, ''],
      ['Projeto', 'Estudo preliminar', 7, '1'],
      ['Projeto', 'Anteprojeto', 10, '2'],
      ['Projeto', 'Projeto legal', 7, '3'],
      ['Aprovação', 'Protocolo e análise na prefeitura', 30, '4'],
      ['Projeto', 'Projeto executivo', 15, '3'],
      ['Projeto', 'Projetos complementares', 15, '6'],
      ['Entrega', 'Compatibilização e entrega final', 5, '5, 7'],
    ],
  },
];

export function activitiesFromTemplate(key: string): PlannerActivity[] {
  const template = PLANNER_TEMPLATES.find((t) => t.key === key);
  if (!template) return [];
  return template.rows.map(([group, name, duration, predecessors], index) => ({
    ...blankActivity(String(index + 1), predecessors), group, name, duration,
  }));
}
