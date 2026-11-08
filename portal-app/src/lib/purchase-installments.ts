/** Divide o valor do pedido em parcelas com centavos exatos (a última absorve o resto). Puro, sem banco. */
export interface PurchaseInstallment { dueDate: string; amount: number }
const iso = /^\d{4}-\d{2}-\d{2}$/;
function addMonths(day: string, months: number): string {
  const [y = 0, m = 1, d = 1] = day.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1, 12));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}
export function splitPurchaseInstallments(total: number, count: number, firstDueDate: string): PurchaseInstallment[] {
  if (!Number.isFinite(total) || total <= 0 || Math.abs(total * 100 - Math.round(total * 100)) > 1e-6) throw new Error('Valor do pedido inválido.');
  if (!Number.isInteger(count) || count < 1 || count > 60) throw new Error('Informe de 1 a 60 parcelas.');
  if (!iso.test(firstDueDate) || new Date(`${firstDueDate}T12:00:00Z`).toISOString().slice(0, 10) !== firstDueDate) throw new Error('Informe o primeiro vencimento no formato AAAA-MM-DD.');
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / count);
  return Array.from({ length: count }, (_, index) => ({
    dueDate: addMonths(firstDueDate, index),
    amount: (index === count - 1 ? cents - base * (count - 1) : base) / 100,
  }));
}
