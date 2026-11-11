/* Painel de indicadores do admin: cálculos puros a partir dos registros reais já carregados.
   Nada é estimado: valores ausentes ficam fora das somas e são sinalizados na tela. */
import { categoryLabel, effectiveStatus, financialStatus, financialToday } from '@/lib/financial-model';
import type { AdminContractSummary, AdminProjectSummary, FinancialEntrySummary } from '@/types/domain';

export type DashboardPeriod = 3 | 6 | 12;

export interface MonthBucket {
  key: string; // AAAA-MM
  label: string; // "nov/26"
  received: number;
  paid: number;
  entries: FinancialEntrySummary[];
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const cents = (value: number) => Math.round(value * 100);
const sum = (values: number[]) => values.reduce((total, value) => total + cents(value), 0) / 100;

export function monthKeys(period: DashboardPeriod, today = financialToday()) {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7)) - 1;
  const keys: string[] = [];
  for (let offset = period - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(year, month - offset, 1));
    keys.push(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

export function monthLabel(key: string) {
  return `${MONTHS[Number(key.slice(5, 7)) - 1]}/${key.slice(2, 4)}`;
}

/** Entradas recebidas e saídas pagas por mês, pela data efetiva de pagamento. */
export function cashByMonth(entries: FinancialEntrySummary[], period: DashboardPeriod, today = financialToday()): MonthBucket[] {
  return monthKeys(period, today).map((key) => {
    const settled = entries.filter((entry) => financialStatus(entry.status) === 'pago' && (entry.paidAt || entry.date || '').startsWith(key));
    return {
      key,
      label: monthLabel(key),
      received: sum(settled.filter((entry) => entry.type === 'entrada').map((entry) => entry.amount)),
      paid: sum(settled.filter((entry) => entry.type === 'saida').map((entry) => entry.amount)),
      entries: settled,
    };
  });
}

export interface DashboardKpis {
  receivedInPeriod: number;
  paidInPeriod: number;
  balanceInPeriod: number;
  receivable: number;
  overdueCount: number;
  overdueAmount: number;
  payable: number;
  dueNext30: FinancialEntrySummary[];
}

export function dashboardKpis(entries: FinancialEntrySummary[], buckets: MonthBucket[], today = financialToday()): DashboardKpis {
  const open = entries.filter((entry) => financialStatus(entry.status) === 'pendente');
  const overdue = open.filter((entry) => entry.type === 'entrada' && effectiveStatus(entry, today) === 'atrasado');
  const limit = new Date(`${today}T12:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + 30);
  const until = limit.toISOString().slice(0, 10);
  const receivedInPeriod = sum(buckets.map((bucket) => bucket.received));
  const paidInPeriod = sum(buckets.map((bucket) => bucket.paid));
  return {
    receivedInPeriod,
    paidInPeriod,
    balanceInPeriod: (cents(receivedInPeriod) - cents(paidInPeriod)) / 100,
    receivable: sum(open.filter((entry) => entry.type === 'entrada').map((entry) => entry.amount)),
    overdueCount: overdue.length,
    overdueAmount: sum(overdue.map((entry) => entry.amount)),
    payable: sum(open.filter((entry) => entry.type === 'saida').map((entry) => entry.amount)),
    dueNext30: open
      .filter((entry) => entry.type === 'entrada' && entry.dueDate && entry.dueDate >= today && entry.dueDate <= until)
      .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '')),
  };
}

export interface CategoryCost { category: string; label: string; amount: number }

/** Custos e compras (saídas pagas e a pagar) no período, por categoria. */
export function costsByCategory(entries: FinancialEntrySummary[], buckets: MonthBucket[]): CategoryCost[] {
  const months = new Set(buckets.map((bucket) => bucket.key));
  const totals = new Map<string, number>();
  for (const entry of entries) {
    if (entry.type !== 'saida' || financialStatus(entry.status) === 'cancelado') continue;
    const date = financialStatus(entry.status) === 'pago' ? entry.paidAt || entry.date : entry.dueDate || entry.date;
    if (!date || !months.has(date.slice(0, 7))) continue;
    totals.set(entry.category, (totals.get(entry.category) ?? 0) + cents(entry.amount));
  }
  return [...totals.entries()]
    .map(([category, total]) => ({ category, label: categoryLabel(category), amount: total / 100 }))
    .sort((a, b) => b.amount - a.amount);
}

export interface ProjectProgress { id: string; name: string; clientName: string; progress: number | null; status: string }

export function activeProjectProgress(projects: AdminProjectSummary[]): ProjectProgress[] {
  return projects
    .filter((project) => !['concluido', 'arquivado', 'cancelado'].includes(String(project.status)))
    .map((project) => ({ id: project.id, name: project.name, clientName: project.clientName, progress: project.progress, status: String(project.status) }))
    .sort((a, b) => (a.progress ?? -1) - (b.progress ?? -1));
}

export interface ContractOverview { active: number; activeValue: number; missingValue: number; byStatus: { status: string; label: string; count: number }[] }

const CONTRACT_LABELS: Record<string, string> = { active: 'Ativos', paused: 'Pausados', completed: 'Concluídos', cancelled: 'Cancelados', archived: 'Arquivados' };

export function contractOverview(contracts: AdminContractSummary[]): ContractOverview {
  const counts = new Map<string, number>();
  for (const contract of contracts) counts.set(String(contract.status), (counts.get(String(contract.status)) ?? 0) + 1);
  const active = contracts.filter((contract) => contract.status === 'active');
  return {
    active: active.length,
    activeValue: sum(active.filter((contract) => contract.contractValue !== null).map((contract) => (contract.contractValue ?? 0) + (contract.addendumValue ?? 0))),
    missingValue: active.filter((contract) => contract.contractValue === null).length,
    byStatus: [...counts.entries()].map(([status, count]) => ({ status, label: CONTRACT_LABELS[status] ?? status, count })).sort((a, b) => b.count - a.count),
  };
}
