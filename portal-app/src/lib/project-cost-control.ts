/**
 * Demonstrativo gerencial de custo de obra. Os grupos são fontes distintas:
 * orçamento aprovado, custo medido, saídas de caixa e propostas escolhidas.
 * NÃO somar os grupos: medição, pagamento e cotação podem representar a mesma despesa.
 */
export interface CostActivity {
  code: string;
  activity: string;
  plannedCost: number | null;
  measuredCost: number | null;
}
export interface CostExpense {
  id: string;
  type: string;
  status: string | null;
  amount: number;
}
export interface SelectedQuote {
  id: string;
  title: string;
  status: string;
  selectedAmount: number | null;
  selectedSupplierId: string | null;
}

export interface ProjectCostEvidence {
  plannedTotal: number | null;
  budgetItems: number;
  unpricedItems: number;
  measuredTotal: number;
  measuredItems: number;
  unmeasuredItems: number;
  paidExpenses: number;
  pendingExpenses: number;
  selectedQuoteTotal: number;
  selectedQuoteCount: number;
  missingSelectedBids: number;
  unclassifiedExpenses: number;
  budgetMinusRegisteredExpenses: number | null;
}

function cents(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 90_000_000_000_000) {
    throw new Error('Foi encontrado um custo inválido; o demonstrativo não pode ser calculado.');
  }
  const result = Math.round((value + Number.EPSILON) * 100);
  if (!Number.isSafeInteger(result)) throw new Error('O valor acumulado ultrapassa o limite seguro.');
  return result;
}
function sumCents(values: number[]): number {
  let total = 0;
  for (const value of values) {
    total += cents(value);
    if (!Number.isSafeInteger(total)) throw new Error('O somatório de custos ultrapassa o limite seguro.');
  }
  return total;
}
const reais = (value: number) => value / 100;

export function calculateProjectCostEvidence(
  activities: CostActivity[],
  expenses: CostExpense[],
  quotes: SelectedQuote[],
  hasCurrentBudget: boolean,
): ProjectCostEvidence {
  const unpricedItems = activities.filter(item => item.plannedCost === null).length;
  const unmeasuredItems = activities.filter(item => item.measuredCost === null).length;
  // Mesmo com atividade sem preço, validar as demais evita ocultar valor inválido.
  const planned = sumCents(activities.filter(item => item.plannedCost !== null).map(item => item.plannedCost!));
  const measured = sumCents(activities.filter(item => item.measuredCost !== null).map(item => item.measuredCost!));
  const paid: number[] = [];
  const pending: number[] = [];
  let unclassifiedExpenses = 0;
  const seenExpenses = new Set<string>();
  for (const entry of expenses) {
    if (seenExpenses.has(entry.id)) throw new Error('Lançamento financeiro duplicado na leitura. Corrija antes de somar.');
    seenExpenses.add(entry.id);
    if (entry.type !== 'saida') continue;
    cents(entry.amount);
    const status = (entry.status ?? '').trim().toLowerCase();
    if (status === 'pago' || status === 'recebido') paid.push(entry.amount);
    else if (status === 'pendente') pending.push(entry.amount);
    else if (!['cancelado', 'cancelada', 'estornado', 'estornada', 'anulado', 'anulada'].includes(status)) unclassifiedExpenses++;
  }

  const selectedAmounts: number[] = [];
  let missingSelectedBids = 0;
  const seenQuotes = new Set<string>();
  for (const quote of quotes) {
    if (seenQuotes.has(quote.id)) throw new Error('Cotação duplicada na leitura. Corrija antes de somar.');
    seenQuotes.add(quote.id);
    if (quote.status !== 'approved') continue;
    if (!quote.selectedSupplierId || quote.selectedAmount === null) {
      missingSelectedBids++;
      continue;
    }
    selectedAmounts.push(quote.selectedAmount);
  }

  const paidCents = sumCents(paid);
  const pendingCents = sumCents(pending);
  const completeBudget = hasCurrentBudget && activities.length > 0 && unpricedItems === 0;
  return {
    plannedTotal: completeBudget ? reais(planned) : null,
    budgetItems: activities.length,
    unpricedItems,
    measuredTotal: reais(measured),
    measuredItems: activities.length - unmeasuredItems,
    unmeasuredItems,
    paidExpenses: reais(paidCents),
    pendingExpenses: reais(pendingCents),
    selectedQuoteTotal: reais(sumCents(selectedAmounts)),
    selectedQuoteCount: selectedAmounts.length,
    missingSelectedBids,
    unclassifiedExpenses,
    budgetMinusRegisteredExpenses: completeBudget && !unclassifiedExpenses
      ? reais(planned - paidCents - pendingCents)
      : null,
  };
}
