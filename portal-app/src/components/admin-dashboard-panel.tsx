import React, { useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { compactMoney, DashboardSection, GroupedBarChart, KpiGrid, KpiTile, ProgressRow, StackedBar } from '@/components/dashboard-ui';
import { Button, Card, Notice } from '@/components/ui';
import { useLiveRefresh } from '@/hooks/use-live-refresh';
import { cashFlowByMonth, contractsOverview, financeKpis, purchasesOverview, receivedByContract, supplierAbc, todayInSaoPaulo, worksProgress } from '@/lib/dashboard-model';
import { formatCurrency, formatDate } from '@/lib/format';
import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import { listProjectFinishDates } from '@/services/dashboard-service';
import { listPurchaseOrders } from '@/services/operations-service';
import { spacing, type ThemeColors, typography } from '@/theme/tokens';
import type { AdminContractSummary, AdminProjectSummary, FinancialEntrySummary, PurchaseOrderSummary } from '@/types/domain';

interface Props {
  contracts: AdminContractSummary[];
  projects: AdminProjectSummary[];
  entries: FinancialEntrySummary[];
  /** Fontes que falharam no carregamento do painel principal: o indicador fica "Indisponível". */
  unavailable: { contracts: boolean; projects: boolean; finance: boolean };
  onOpen: (section: string, projectId?: string | null) => void;
}

const WORKS_PREVIEW = 6;

export function AdminDashboardPanel({ contracts, projects, entries, unavailable, onOpen }: Props) {
  const { colors } = useAppTheme();
  const styles = useThemeStyles(styleDefinitions);
  const [orders, setOrders] = useState<PurchaseOrderSummary[]>([]);
  const [finishDates, setFinishDates] = useState<Map<string, string | null>>(new Map());
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [datesError, setDatesError] = useState<string | null>(null);
  const [showAllWorks, setShowAllWorks] = useState(false);

  const load = useCallback(async () => {
    const [orderResult, dateResult] = await Promise.all([listPurchaseOrders(), listProjectFinishDates()]);
    setOrders(orderResult.data); setOrdersError(orderResult.error);
    setFinishDates(dateResult.data); setDatesError(dateResult.error);
  }, []);
  useLiveRefresh(load);

  const today = todayInSaoPaulo();
  const finance = useMemo(() => financeKpis(entries, today), [entries, today]);
  const flow = useMemo(() => cashFlowByMonth(entries, today), [entries, today]);
  const works = useMemo(() => worksProgress(projects, finishDates, today), [projects, finishDates, today]);
  const contractStats = useMemo(() => contractsOverview(contracts, receivedByContract(entries)), [contracts, entries]);
  const purchases = useMemo(() => purchasesOverview(orders, today), [orders, today]);
  const abc = useMemo(() => supplierAbc(orders), [orders]);

  const fin = (value: number) => (unavailable.finance ? null : value);
  const statusColor: Record<string, string> = { active: colors.gold600, paused: colors.warning, completed: colors.success, cancelled: colors.danger, archived: colors.muted };
  const tierColor = { A: colors.gold600, B: colors.info, C: colors.muted } as const;
  const tierTotals = (['A', 'B', 'C'] as const).map((tier) => ({ tier, amount: abc.filter((row) => row.tier === tier).reduce((sum, row) => sum + row.amount, 0), count: abc.filter((row) => row.tier === tier).length }));
  const visibleWorks = showAllWorks ? works.rows : works.rows.slice(0, WORKS_PREVIEW);
  const currentIndex = flow.findIndex((month) => month.forecast);

  return <View style={styles.panel}>
    <DashboardSection actionLabel="Financeiro" description="Valores do Financeiro, sem cancelados. Vencidos em aberto contam no mês atual." onAction={() => onOpen('financial')} title="Financeiro">
      <KpiGrid>
        <KpiTile hint={finance.overdueCount ? `${formatCurrency(finance.receivableOverdue)} vencidos · ${finance.overdueCount} lanç.` : 'Nada vencido'} label="A receber" money onPress={() => onOpen('financial')} tone={finance.overdueCount ? 'danger' : 'success'} value={fin(finance.receivable)} />
        <KpiTile hint={`${compactMoney(finance.payableNext30)} nos próximos 30 dias`} label="A pagar" money tone={finance.payableNext30 > 0 ? 'warning' : 'neutral'} value={fin(finance.payable)} />
        <KpiTile hint="Entradas pagas neste mês" label="Recebido no mês" money value={fin(finance.receivedThisMonth)} />
        <KpiTile hint={unavailable.finance ? undefined : `Saldo do mês ${formatCurrency(finance.receivedThisMonth - finance.paidThisMonth)}`} label="Pago no mês" money value={fin(finance.paidThisMonth)} />
      </KpiGrid>
      {unavailable.finance ? null : <Card>
        <Text style={styles.cardTitle}>Fluxo de caixa mensal</Text>
        <Text style={styles.cardNote}>Realizado nos meses anteriores; realizado + previsto a partir do mês atual.</Text>
        <GroupedBarChart categories={flow.map((month) => month.label)} dimmedFrom={currentIndex >= 0 ? currentIndex + 1 : undefined} series={[{ label: 'Entradas', values: flow.map((month) => month.inflow), color: colors.gold600 }, { label: 'Saídas', values: flow.map((month) => month.outflow), color: colors.info }]} />
      </Card>}
    </DashboardSection>

    <DashboardSection actionLabel="Gestão da obra" description="Projetos em andamento. Atraso = prazo final vencido com progresso abaixo de 100%." onAction={() => onOpen('works-center')} title="Andamento das obras">
      <KpiGrid>
        <KpiTile label="Obras em andamento" value={unavailable.projects ? null : works.active} />
        <KpiTile hint={datesError ? 'Prazos indisponíveis' : works.late ? 'Prazo final vencido' : 'Todas no prazo'} label="Em atraso" tone={works.late ? 'danger' : 'success'} value={unavailable.projects || datesError ? null : works.late} />
        <KpiTile hint="Média do progresso informado" label="Progresso médio" value={unavailable.projects || works.averageProgress === null ? null : `${works.averageProgress}%`} />
      </KpiGrid>
      {works.rows.length ? <Card>
        {visibleWorks.map((row) => <ProgressRow badge={row.late ? 'Atrasada' : row.noContract ? 'Sem contrato' : undefined} key={row.id} onPress={() => onOpen('workspace', row.id)} subtitle={`${row.clientName} • término ${formatDate(row.finishDate, 'não informado')}`} title={row.name} tone={row.late ? 'danger' : row.noContract ? 'warning' : (row.progress ?? 0) >= 100 ? 'success' : 'neutral'} value={row.progress} />)}
        {works.rows.length > WORKS_PREVIEW ? <Button debounceMs={0} onPress={() => setShowAllWorks((value) => !value)} title={showAllWorks ? 'Mostrar menos' : `Ver todas as ${works.rows.length} obras`} variant="ghost" /> : null}
      </Card> : null}
    </DashboardSection>

    <DashboardSection actionLabel="Contratos" description="Valor contratado inclui aditivos aceitos. Recebido = entradas pagas vinculadas ao contrato." onAction={() => onOpen('commercial-documents')} title="Contratos">
      <KpiGrid>
        <KpiTile hint={`${contractStats.total} contratos no total`} label="Contratos ativos" value={unavailable.contracts ? null : contractStats.active} />
        <KpiTile hint={contractStats.missingValue ? `${contractStats.missingValue} sem valor cadastrado` : undefined} label="Valor contratado" money tone={contractStats.missingValue ? 'warning' : 'neutral'} value={unavailable.contracts ? null : contractStats.activeValue} />
        <KpiTile label="Recebido dos ativos" money tone="success" value={unavailable.contracts || unavailable.finance ? null : contractStats.activeReceived} />
        <KpiTile label="Saldo a receber" money value={unavailable.contracts || unavailable.finance ? null : contractStats.activeBalance} />
      </KpiGrid>
      {!unavailable.contracts && contractStats.total ? <Card>
        <Text style={styles.cardTitle}>Contratos por situação</Text>
        <StackedBar parts={contractStats.byStatus.map((item) => ({ label: item.label, value: item.count, color: statusColor[item.status] ?? colors.slate }))} />
        {contractStats.activeValue > 0 && !unavailable.finance ? <ProgressRow subtitle={`${formatCurrency(contractStats.activeReceived)} de ${formatCurrency(contractStats.activeValue)}`} title="Recebido sobre o contratado (ativos)" tone="success" value={(contractStats.activeReceived / contractStats.activeValue) * 100} /> : null}
      </Card> : null}
    </DashboardSection>

    <DashboardSection actionLabel="Compras" description="Pedidos de compra e as contas a pagar geradas por eles." onAction={() => onOpen('procurement')} title="Compras e custos">
      {ordersError ? <Notice tone="warning">{ordersError} Os indicadores de compras não foram exibidos como zero.</Notice> : null}
      <KpiGrid>
        <KpiTile label="Pedidos em aberto" value={ordersError ? null : purchases.openOrders} />
        <KpiTile hint={purchases.lateDeliveries ? 'Previsão de entrega vencida' : 'Nenhuma entrega atrasada'} label="Entregas atrasadas" tone={purchases.lateDeliveries ? 'danger' : 'success'} value={ordersError ? null : purchases.lateDeliveries} />
        <KpiTile hint="Pedidos não cancelados" label="Total comprado" money value={ordersError ? null : purchases.committed} />
        <KpiTile label="A pagar dos pedidos" money tone={purchases.payablesPending > 0 ? 'warning' : 'neutral'} value={ordersError ? null : purchases.payablesPending} />
      </KpiGrid>
      {!ordersError && abc.length ? <Card>
        <Text style={styles.cardTitle}>Curva ABC de fornecedores</Text>
        <Text style={styles.cardNote}>A: até 80% do valor comprado • B: até 95% • C: restante.</Text>
        <StackedBar parts={tierTotals.map((item) => ({ label: `Classe ${item.tier}`, value: item.amount, color: tierColor[item.tier], detail: `${item.count} forn. · ${compactMoney(item.amount)}` }))} />
        {abc.slice(0, 8).map((row) => <ProgressRow badge={row.tier} key={row.name} subtitle={`${formatCurrency(row.amount)} • acumulado ${Math.round(row.cumulative * 100)}%`} title={row.name} value={row.share * 100} />)}
        {abc.length > 8 ? <Text style={styles.cardNote}>+{abc.length - 8} fornecedores com participação menor.</Text> : null}
      </Card> : null}
    </DashboardSection>
  </View>;
}

const styleDefinitions = (colors: ThemeColors) => ({
  panel: { gap: spacing.lg },
  cardTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' as const, fontFamily: typography.family },
  cardNote: { color: colors.muted, fontSize: 11, lineHeight: 16, fontFamily: typography.family },
});
