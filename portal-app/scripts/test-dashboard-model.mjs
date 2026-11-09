import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const file = fs.readFileSync(new URL('../src/lib/dashboard-model.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(file, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
const m = await import(`data:text/javascript,${encodeURIComponent(compiled.outputText)}`);
let checks = 0;
const equal = (actual, expected, description) => { assert.deepEqual(actual, expected, description); checks++; };
const entry = (o) => ({ id: Math.random().toString(36), projectId: 'p1', projectName: 'P', clientName: 'C', contractNumber: 'X', type: 'entrada', description: '', amount: 0, date: null, notes: null, category: 'outros', status: 'pendente', dueDate: null, paidAt: null, accountId: null, ...o });
const today = '2026-11-08';

equal(m.todayInSaoPaulo(new Date('2026-11-08T01:00:00Z')), '2026-11-07', 'Dia em São Paulo');
equal(m.shiftMonth('2026-11', 3), '2027-02', 'Virada de ano');
equal(m.shiftMonth('2026-01', -1), '2025-12', 'Mês anterior');
equal(m.monthLabel('2026-03'), 'mar/26', 'Rótulo do mês');

const entries = [
  entry({ amount: 1000.1, dueDate: '2026-10-30' }), // vencida
  entry({ amount: 500, dueDate: '2026-12-10' }),
  entry({ amount: 300, status: 'pago', paidAt: '2026-11-02', contractId: 'k1' }),
  entry({ amount: 200, status: 'cancelado', dueDate: '2026-10-01' }),
  entry({ type: 'saida', amount: 150, dueDate: '2026-11-20' }),
  entry({ type: 'saida', amount: 90, dueDate: '2027-01-15' }),
  entry({ type: 'saida', amount: 40, status: 'pago', paidAt: '2026-09-05' }),
];
const k = m.financeKpis(entries, today);
equal([k.receivable, k.receivableOverdue, k.overdueCount], [1500.1, 1000.1, 1], 'A receber e vencidos (sem cancelados)');
equal([k.payable, k.payableNext30], [240, 150], 'A pagar e próximos 30 dias');
equal([k.receivedThisMonth, k.paidThisMonth], [300, 0], 'Realizado no mês');

const flow = m.cashFlowByMonth(entries, today, 2, 2);
equal(flow.map((x) => x.month), ['2026-09', '2026-10', '2026-11', '2026-12', '2027-01'], 'Janela de meses');
equal(flow.find((x) => x.month === '2026-10').inflow, 0, 'Vencido em aberto não fica no mês passado');
equal(flow.find((x) => x.month === '2026-11').inflow, 1300.1, 'Vencido entra no mês atual com o realizado');
equal(flow.find((x) => x.month === '2026-09').outflow, 40, 'Saída paga no mês do pagamento');
equal(flow.filter((x) => x.forecast).length, 3, 'Previsto a partir do mês atual');

const project = (id, o) => ({ id, clientId: 'c', contractId: 'k', contractNumber: '', name: id, serviceType: null, status: 'ativo', progress: 50, city: null, state: null, contract: null, clientName: 'C', ...o });
const works = m.worksProgress([project('a'), project('b', { progress: 100 }), project('c', { status: 'concluido' }), project('d', { contractId: null, progress: null })], new Map([['a', '2026-11-01'], ['b', '2026-10-01']]), today);
equal([works.active, works.late, works.averageProgress], [3, 1, 75], 'Obras ativas, atrasadas e média');
equal(works.rows[0].id, 'a', 'Atrasada aparece primeiro');
equal(works.rows.find((x) => x.id === 'd').noContract, true, 'Obra sem contrato sinalizada');

const stage = (o) => ({ id: Math.random().toString(36), projectId: 'p', title: 's', description: null, startDate: null, endDate: null, status: 'pendente', progress: 0, weight: null, order: 0, ...o });
const st = m.stagesProgress([stage({ status: 'concluido', weight: 30 }), stage({ progress: 50, weight: 70, endDate: '2026-11-01' }), stage({ status: 'cancelado' })], today);
equal(st, { total: 2, done: 1, late: 1, progress: 65 }, 'Etapas ponderadas, sem canceladas');
equal(m.stagesProgress([], today).progress, null, 'Sem etapas: indisponível');

const contracts = [
  { id: 'k1', contractNumber: '1', clientId: 'c', serviceType: null, status: 'active', contractValue: 1000, currency: 'BRL', clientName: 'C', addendumValue: 200 },
  { id: 'k2', contractNumber: '2', clientId: 'c', serviceType: null, status: 'active', contractValue: null, currency: 'BRL', clientName: 'C' },
  { id: 'k3', contractNumber: '3', clientId: 'c', serviceType: null, status: 'completed', contractValue: 5000, currency: 'BRL', clientName: 'C' },
];
const co = m.contractsOverview(contracts, m.receivedByContract(entries));
equal([co.active, co.activeValue, co.activeReceived, co.activeBalance, co.missingValue], [2, 1200, 300, 900, 1], 'Contratos ativos com aditivos');
equal(co.byStatus[0], { status: 'active', label: 'Ativos', count: 2 }, 'Distribuição por situação');

const order = (o) => ({ id: Math.random().toString(36), orderNumber: '', quoteId: '', projectId: 'p', supplierName: 'S', totalAmount: 0, status: 'emitido', expectedDelivery: null, receivedOn: null, payablesPending: 0, payablesPaid: 0, ...o });
const orders = [order({ supplierName: 'Aço', totalAmount: 7000, expectedDelivery: '2026-11-01', payablesPending: 3500 }), order({ supplierName: 'Cimento', totalAmount: 2000, status: 'recebido' }), order({ supplierName: 'Elétrica', totalAmount: 600 }), order({ supplierName: 'Pintura', totalAmount: 400 }), order({ supplierName: 'Cancelado', totalAmount: 9999, status: 'cancelado' })];
const abc = m.supplierAbc(orders);
equal(abc.map((x) => [x.name, x.tier]), [['Aço', 'A'], ['Cimento', 'A'], ['Elétrica', 'B'], ['Pintura', 'C']], 'Curva ABC ignora cancelados');
const po = m.purchasesOverview(orders, today);
equal([po.openOrders, po.lateDeliveries, po.committed, po.payablesPending], [3, 1, 10000, 3500], 'Compras em aberto e comprometido');
equal(m.supplierAbc([]), [], 'Sem pedidos: curva vazia');

console.log(`dashboard-model: ${checks} verificações aprovadas.`);
