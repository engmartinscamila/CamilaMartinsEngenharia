/* Motor puro de planejamento. Sem chamadas ao banco ou mudanças em cronogramas antigos.
 * Pesos financeiros só derivam de CUSTOS DA OBRA, nunca de honorários comerciais.
 * O calendário deve ser informado; não inferir um prazo contratual universal.
 * CPM considera relações término→início (FS) e durações em unidades do calendário escolhido. */
export type WorkCalendar = 'weekdays' | 'calendar_days';
export interface PlanningActivity {
  code: string;
  activity: string;
  predecessorCode: string | null;
  durationDays: number;
  plannedCost: number | null;
  weightPercent: number | null;
  actualProgress: number;
  requestedStart?: string | null;
}
export interface PlannedActivity extends PlanningActivity {
  plannedStart: string;
  plannedFinish: string;
  assignedWeightPercent: number;
  critical: boolean;
  totalFloatDays: number;
}
export interface PlanResult {
  activities: PlannedActivity[];
  plannedStart: string;
  plannedFinish: string;
  weightSource: 'construction_costs' | 'confirmed_manual';
  totalConstructionCost: number | null;
  progressPercent: number;
  criticalPathCodes: string[];
}
const isoPattern = /^\d{4}-\d{2}-\d{2}$/;
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const validDate = (s: string) => isoPattern.test(s) && new Date(`${s}T12:00:00Z`).toISOString().slice(0,10) === s;
const asDate = (s: string) => { if (!validDate(s)) throw new Error(`Data inválida: ${s}`); return new Date(`${s}T12:00:00Z`); };
const asISO = (d: Date) => d.toISOString().slice(0,10);
const nextDay = (s: string) => { const d=asDate(s);d.setUTCDate(d.getUTCDate()+1);return asISO(d); };
export function planConstructionSchedule(
  activities: PlanningActivity[],
  options: { startDate: string; calendar: WorkCalendar; holidays?: string[]; contractualDeadline?: string | null; manualWeightsApproved?: boolean },
): PlanResult {
  if (!activities.length) throw new Error('Selecione atividades efetivamente contratadas antes de planejar.');
  asDate(options.startDate);
  if (options.contractualDeadline) asDate(options.contractualDeadline);
  if (!['weekdays','calendar_days'].includes(options.calendar)) throw new Error('Calendário de trabalho inválido.');
  const holidays = new Set(options.holidays ?? []);
  for (const holiday of holidays) asDate(holiday);
  const byCode = new Map<string,PlanningActivity>();
  for (const activity of activities) {
    if (!activity.code.trim() || !activity.activity.trim() || byCode.has(activity.code)) throw new Error('Código ou atividade em branco/duplicada.');
    if (!Number.isSafeInteger(activity.durationDays) || activity.durationDays <= 0) throw new Error(`Duração inválida em ${activity.code}.`);
    if (!Number.isFinite(activity.actualProgress) || activity.actualProgress<0 || activity.actualProgress>100) throw new Error(`Avanço inválido em ${activity.code}.`);
    if (activity.plannedCost!==null && (!Number.isFinite(activity.plannedCost) || activity.plannedCost<0)) throw new Error(`Custo inválido em ${activity.code}.`);
    if (activity.weightPercent!==null && (!Number.isFinite(activity.weightPercent) || activity.weightPercent<0 || activity.weightPercent>100)) throw new Error(`Peso inválido em ${activity.code}.`);
    if (activity.requestedStart) asDate(activity.requestedStart);
    byCode.set(activity.code,activity);
  }
  const costsComplete = activities.every(a=>a.plannedCost!==null);
  const sumCosts = costsComplete ? activities.reduce((sum,a)=>sum+(a.plannedCost ?? 0),0):null;
  const useCosts = sumCosts!==null && sumCosts>0;
  const manualComplete = options.manualWeightsApproved===true && activities.every(a=>a.weightPercent!==null)
    && Math.abs(activities.reduce((sum,a)=>sum+(a.weightPercent ?? 0),0)-100)<0.011;
  if (!useCosts && !manualComplete) throw new Error('Informe custos completos de obra ou aprove pesos manuais que somem 100%. Não usar honorários como custos.');
  const weightSource = useCosts?'construction_costs':'confirmed_manual';
  const rawWeights = activities.map(a=>useCosts ? (a.plannedCost ?? 0)/(sumCosts as number)*100 : (a.weightPercent as number));
  // Ajusta apenas arredondamento, nunca distribui custo desconhecido.
  const weights = rawWeights.map(round);
  weights[weights.length-1]=round(100-weights.slice(0,-1).reduce((sum,n)=>sum+n,0));
  if (weights.some(n=>n<0 || n>100)) throw new Error('Pesos inválidos após arredondamento; verifique custos.');
  const indices = new Map(activities.map((a,i)=>[a.code,i]));
  const visiting=new Set<string>();
  const planned=new Map<string,Omit<PlannedActivity,'critical'|'totalFloatDays'>>();
  const workday = (day: string): boolean => {
    if (options.calendar === 'calendar_days') return true;
    const d=asDate(day); const weekday=d.getUTCDay();
    return !holidays.has(day) && weekday!==0 && weekday!==6;
  };
  const advance = (start: string,duration: number): {start:string;finish:string} => {
    let cursor=start;
    while (!workday(cursor)) cursor=nextDay(cursor);
    const first=cursor;
    for (let remaining=duration-1;remaining>0;) {
      cursor=nextDay(cursor);
      if (workday(cursor)) remaining--;
    }
    return {start:first,finish:cursor};
  };
  const workUnitsBefore = (target: string): number => {
    if (target <= options.startDate) return 0;
    let cursor=options.startDate;
    let units=0;
    while (cursor < target) {
      if (workday(cursor)) units++;
      cursor=nextDay(cursor);
    }
    return units;
  };
  const resolve = (code: string): Omit<PlannedActivity,'critical'|'totalFloatDays'> => {
    const previous=planned.get(code);
    if (previous) return previous;
    if (visiting.has(code)) throw new Error(`Dependências circulares em ${code}.`);
    const source=byCode.get(code);
    if (!source) throw new Error(`Dependência inexistente: ${code}.`);
    visiting.add(code);
    let earliest=options.startDate;
    if (source.predecessorCode) {
      if (source.predecessorCode===code) throw new Error(`Atividade ${code} depende de si mesma.`);
      const predecessor=resolve(source.predecessorCode);
      earliest=nextDay(predecessor.plannedFinish);
    }
    if (source.requestedStart && source.requestedStart>earliest) earliest=source.requestedStart;
    const dates=advance(earliest,source.durationDays);
    const index=indices.get(code);
    const assignedWeightPercent=index===undefined?undefined:weights[index];
    if (assignedWeightPercent===undefined) throw new Error(`Peso não calculado para ${code}.`);
    const result={...source,plannedStart:dates.start,plannedFinish:dates.finish,assignedWeightPercent};
    visiting.delete(code);planned.set(code,result);return result;
  };
  const resolvedBase=activities.map(a=>resolve(a.code));
  const end=resolvedBase.map(a=>a.plannedFinish).sort().at(-1);
  const start=resolvedBase.map(a=>a.plannedStart).sort()[0];
  if (!start || !end) throw new Error('Nenhuma atividade válida para planejar.');
  if (options.contractualDeadline && end>options.contractualDeadline) throw new Error('Plano calculado excede o prazo contratual; revisar recursos ou formalizar aditivo antes de aprovar.');

  // CPM por rede término→início. O eixo usa unidades úteis do calendário escolhido,
  // permitindo comparar folga sem transformar feriados/fins de semana em duração produtiva.
  const successors = new Map<string,string[]>();
  for (const activity of activities) successors.set(activity.code,[]);
  for (const activity of activities) {
    if (activity.predecessorCode) successors.get(activity.predecessorCode)?.push(activity.code);
  }
  const es=new Map<string,number>();
  const ef=new Map<string,number>();
  const cpmVisit=new Set<string>();
  const forward=(code:string):number => {
    if (ef.has(code)) return ef.get(code) as number;
    if (cpmVisit.has(code)) throw new Error(`Dependências circulares em ${code}.`);
    const activity=byCode.get(code);
    if (!activity) throw new Error(`Atividade inexistente no CPM: ${code}.`);
    cpmVisit.add(code);
    let earliest=activity.predecessorCode ? forward(activity.predecessorCode) : 0;
    if (activity.requestedStart) earliest=Math.max(earliest,workUnitsBefore(activity.requestedStart));
    es.set(code,earliest);
    const finish=earliest+activity.durationDays;
    ef.set(code,finish);
    cpmVisit.delete(code);
    return finish;
  };
  for (const activity of activities) forward(activity.code);
  const projectDuration=Math.max(...activities.map(a=>ef.get(a.code) ?? 0));
  const ls=new Map<string,number>();
  const lf=new Map<string,number>();
  const backward=(code:string):number => {
    if (ls.has(code)) return ls.get(code) as number;
    const activity=byCode.get(code);
    if (!activity) throw new Error(`Atividade inexistente no CPM: ${code}.`);
    const next=successors.get(code) ?? [];
    const latestFinish=next.length ? Math.min(...next.map(backward)) : projectDuration;
    lf.set(code,latestFinish);
    const latestStart=latestFinish-activity.durationDays;
    ls.set(code,latestStart);
    return latestStart;
  };
  for (const activity of [...activities].reverse()) backward(activity.code);
  const resolved:PlannedActivity[]=resolvedBase.map(activity => {
    const totalFloatDays=Math.max(0,(ls.get(activity.code) ?? 0)-(es.get(activity.code) ?? 0));
    return {...activity,totalFloatDays,critical:totalFloatDays===0};
  });
  const criticalPathCodes=resolved.filter(a=>a.critical).sort((a,b)=>(es.get(a.code) ?? 0)-(es.get(b.code) ?? 0)).map(a=>a.code);
  const progress=round(resolved.reduce((sum,a)=>sum+a.assignedWeightPercent*a.actualProgress/100,0));
  return {activities:resolved,plannedStart:start,plannedFinish:end,weightSource,totalConstructionCost:useCosts?sumCosts:null,progressPercent:progress,criticalPathCodes};
}
