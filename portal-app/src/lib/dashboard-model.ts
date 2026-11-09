// Painel de indicadores (Dashboard 2.0). Funções puras, sem acesso ao banco:
// recebem os registros reais já carregados pelos serviços e apenas agregam.
// Nada aqui inventa valores; quando a fonte falha, a tela mostra "Indisponível".
import type { AdminContractSummary, AdminProjectSummary, FinancialEntrySummary, PurchaseOrderSummary, ScheduleStageSummary } from '@/types/domain';

const plain = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const cents = (value: number) => Math.round((Number(value) || 0) * 100);

export function todayInSaoPaulo(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

function entryStatus(status: string): 'pago' | 'pendente' | 'cancelado' {
  const text = plain(status);
  if (['pago', 'recebido', 'quitado'].includes(text)) return 'pago';
  if (['cancelado', 'cancelada'].includes(text)) return 'cancelado';
  return 'pendente';
}

/** Mês (AAAA-MM) somando `offset` meses a partir de `month`. */
export function shiftMonth(month: string, offset: number) {
  const year = Number(month.slice(0, 4)), value = Number(month.slice(5, 7));
  const date = new Date(Date.UTC(year, value - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const monthLabel = (month: string) => `${MONTHS[Number(month.slice(5, 7)) - 1]}/${month.slice(2, 4)}`;

export interface FinanceKpis {
  receivable: number;
  receivableOverdue: number;
  overdueCount: number;
  payable: number;
  payableNext30: number;
  receivedThisMonth: number;
  paidThisMonth: number;
}

export function financeKpis(entries: FinancialEntrySummary[], today = todayInSaoPaulo()): FinanceKpis {
  const limit = new Date(`${today}T12:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + 30);
  const next30 = limit.toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const sum = { receivable: 0, receivableOverdue: 0, payable: 0, payableNext30: 0, receivedThisMonth: 0, paidThisMonth: 0 };
  let overdueCount = 0;
  for (const entry of entries) {
    const status = entryStatus(entry.status);
    if (status === 'cancelado') continue;
    const amount = cents(entry.amount);
    const incoming = entry.type === 'entrada';
    if (status === 'pago') {
      const paidOn = entry.paidAt || entry.date || '';
      if (paidOn.startsWith(month)) sum[incoming ? 'receivedThisMonth' : 'paidThisMonth'] += amount;
      continue;
    }
    const due = entry.dueDate || entry.date || '';
    if (incoming) {
      sum.receivable += amount;
      if (due && due < today) { sum.receivableOverdue += amount; overdueCount++; }
    } else {
      sum.payable += amount;
      if (due && due <= next30) sum.payableNext30 += amount;
    }
  }
  return {
    receivable: sum.receivable / 100, receivableOverdue: sum.receivableOverdue / 100, overdueCount,
    payable: sum.payable / 100, payableNext30: sum.payableNext30 / 100,
    receivedThisMonth: sum.receivedThisMonth / 100, paidThisMonth: sum.paidThisMonth / 100,
  };
}

export interface CashFlowMonth { month: string; label: string; inflow: number; outflow: number; forecast: boolean }

/**
 * Fluxo de caixa mensal: meses passados usam o realizado (data de pagamento);
 * o mês atual e os futuros somam realizado + previsto (vencimento em aberto).
 */
export function cashFlowByMonth(entries: FinancialEntrySummary[], today = todayInSaoPaulo(), past = 5, future = 3): CashFlowMonth[] {
  const current = today.slice(0, 7);
  const months = Array.from({ length: past + future + 1 }, (_, index) => shiftMonth(current, index - past));
  const buckets = new Map(months.map((month) => [month, { inflow: 0, outflow: 0 }]));
  for (const entry of entries) {
    const status = entryStatus(entry.status);
    if (status === 'cancelado') continue;
    const date = status === 'pago' ? entry.paidAt || entry.date : entry.dueDate || entry.date;
    if (!date) continue;
    let month = date.slice(0, 7);
    // Em aberto e já vencido entra no mês atual: ainda é dinheiro a movimentar.
    if (status === 'pendente' && month < current) month = current;
    const bucket = buckets.get(month);
    if (!bucket) continue;
    bucket[entry.type === 'entrada' ? 'inflow' : 'outflow'] += cents(entry.amount);
  }
  return months.map((month) => ({ month, label: monthLabel(month), inflow: buckets.get(month)!.inflow / 100, outflow: buckets.get(month)!.outflow / 100, forecast: month >= current }));
}

const CLOSED_PROJECT = ['concluido', 'concluida', 'cancelado', 'cancelada', 'arquivado', 'arquivada', 'orcamento'];

export interface WorkProgress { id: string; name: string; clientName: string; progress: number | null; finishDate: string | null; late: boolean; noContract: boolean }

export function worksProgress(projects: AdminProjectSummary[], finishDates: Map<string, string | null>, today = todayInSaoPaulo()) {
  const rows: WorkProgress[] = projects
    .filter((project) => !CLOSED_PROJECT.includes(plain(project.status)))
    .map((project) => {
      const finishDate = finishDates.get(project.id) ?? null;
      const late = Boolean(finishDate && finishDate < today && (project.progress ?? 0) < 100);
      return { id: project.id, name: project.name, clientName: project.clientName, progress: project.progress, finishDate, late, noContract: !project.contractId };
    })
    .sort((a, b) => Number(b.late) - Number(a.late) || (a.finishDate ?? '9999').localeCompare(b.finishDate ?? '9999'));
  const known = rows.filter((row) => row.progress !== null);
  return {
    rows,
    active: rows.length,
    late: rows.filter((row) => row.late).length,
    averageProgress: known.length ? Math.round(known.reduce((total, row) => total + (row.progress ?? 0), 0) / known.length) : null,
  };
}

/** Andamento do cliente a partir das etapas publicadas (peso, quando houver). */
export function stagesProgress(stages: ScheduleStageSummary[], today = todayInSaoPaulo()) {
  const valid = stages.filter((stage) => !['cancelado', 'cancelada'].includes(plain(stage.status)));
  const done = valid.filter((stage) => ['concluido', 'concluida'].includes(plain(stage.status)) || (stage.progress ?? 0) >= 100).length;
  const late = valid.filter((stage) => stage.endDate && stage.endDate < today && !['concluido', 'concluida'].includes(plain(stage.status)) && (stage.progress ?? 0) < 100).length;
  const weights = valid.map((stage) => (stage.weight && stage.weight > 0 ? stage.weight : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  const progress = valid.length
    ? Math.round(valid.reduce((sum, stage, index) => {
      const value = ['concluido', 'concluida'].includes(plain(stage.status)) ? 100 : Math.max(0, Math.min(100, stage.progress ?? 0));
      return sum + value * (weights[index] ?? 1);
    }, 0) / total)
    : null;
  return { total: valid.length, done, late, progress };
}

export const CONTRACT_STATUS_LABEL: Record<string, string> = { active: 'Ativos', paused: 'Pausados', completed: 'Concluídos', cancelled: 'Cancelados', archived: 'Arquivados' };

export function contractsOverview(contracts: AdminContractSummary[], receivedByContract: Map<string, number>) {
  const byStatus = new Map<string, number>();
  let activeValue = 0, activeReceived = 0, missingValue = 0;
  for (const contract of contracts) {
    const status = String(contract.status || 'sem status');
    byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
    if (status !== 'active') continue;
    if (contract.contractValue === null) { missingValue++; continue; }
    activeValue += cents(contract.contractValue) + cents(contract.addendumValue ?? 0);
    activeReceived += cents(receivedByContract.get(contract.id) ?? 0);
  }
  return {
    total: contracts.length,
    active: byStatus.get('active') ?? 0,
    activeValue: activeValue / 100,
    activeReceived: activeReceived / 100,
    activeBalance: Math.max(0, activeValue - activeReceived) / 100,
    missingValue,
    byStatus: [...byStatus.entries()].map(([status, count]) => ({ status, label: CONTRACT_STATUS_LABEL[status] ?? status, count })).sort((a, b) => b.count - a.count),
  };
}

/** Recebido por contrato, a partir das entradas pagas do Financeiro. */
export function receivedByContract(entries: FinancialEntrySummary[]) {
  const map = new Map<string, number>();
  for (const entry of entries) {
    if (!entry.contractId || entry.type !== 'entrada' || entryStatus(entry.status) !== 'pago') continue;
    map.set(entry.contractId, (map.get(entry.contractId) ?? 0) + entry.amount);
  }
  return map;
}

export interface AbcRow { name: string; amount: number; share: number; cumulative: number; tier: 'A' | 'B' | 'C' }

/** Curva ABC de fornecedores pelos pedidos de compra não cancelados (A ≤ 80%, B ≤ 95%). */
export function supplierAbc(orders: PurchaseOrderSummary[]): AbcRow[] {
  const totals = new Map<string, number>();
  for (const order of orders) {
    if (order.status === 'cancelado') continue;
    totals.set(order.supplierName, (totals.get(order.supplierName) ?? 0) + cents(order.totalAmount));
  }
  const total = [...totals.values()].reduce((a, b) => a + b, 0);
  if (!total) return [];
  let running = 0;
  return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([name, amount]) => {
    const before = running;
    running += amount;
    return {
      name, amount: amount / 100, share: amount / total, cumulative: running / total,
      tier: before / total < 0.8 ? 'A' : before / total < 0.95 ? 'B' : 'C',
    };
  });
}

export function purchasesOverview(orders: PurchaseOrderSummary[], today = todayInSaoPaulo()) {
  const open = orders.filter((order) => order.status === 'emitido');
  return {
    openOrders: open.length,
    lateDeliveries: open.filter((order) => order.expectedDelivery && order.expectedDelivery < today).length,
    committed: orders.filter((order) => order.status !== 'cancelado').reduce((total, order) => total + cents(order.totalAmount), 0) / 100,
    payablesPending: orders.reduce((total, order) => total + cents(order.payablesPending), 0) / 100,
  };
}
