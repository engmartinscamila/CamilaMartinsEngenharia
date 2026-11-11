/* Painel interativo da Visão geral do admin: período, indicadores clicáveis, gráfico mensal,
   andamento das obras, vencimentos, custos por categoria e contratos. Só dados reais. */
import React, { useMemo, useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';

import { SelectionChips } from '@/components/admin-ui';
import { Button, Card, Notice } from '@/components/ui';
import {
  activeProjectProgress, cashByMonth, contractOverview, costsByCategory, dashboardKpis, type DashboardPeriod,
} from '@/lib/admin-dashboard-model';
import { formatCurrency, formatDate } from '@/lib/format';
import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';
import type { AdminContractSummary, AdminProjectSummary, DashboardCounts, FinancialEntrySummary } from '@/types/domain';

type Props = {
  entries: FinancialEntrySummary[];
  projects: AdminProjectSummary[];
  contracts: AdminContractSummary[];
  counts: DashboardCounts;
  loading: boolean;
  unavailable: boolean;
  onOpen: (section: string, projectId?: string | null, extra?: Record<string, string>) => void;
  onSelectProject: (projectId: string) => void;
};

export function AdminDashboardPanel({ entries, projects, contracts, counts, loading, unavailable, onOpen, onSelectProject }: Props) {
  const { colors } = useAppTheme();
  const styles = useThemeStyles(styleDefinitions);
  const phone = useWindowDimensions().width < 600;
  const [period, setPeriod] = useState<DashboardPeriod>(6);
  const [month, setMonth] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [showAllProjects, setShowAllProjects] = useState(false);

  const buckets = useMemo(() => cashByMonth(entries, period), [entries, period]);
  const kpis = useMemo(() => dashboardKpis(entries, buckets), [entries, buckets]);
  const costs = useMemo(() => costsByCategory(entries, buckets), [entries, buckets]);
  const progress = useMemo(() => activeProjectProgress(projects), [projects]);
  const contractsInfo = useMemo(() => contractOverview(contracts), [contracts]);
  const maxBar = Math.max(1, ...buckets.map((bucket) => Math.max(bucket.received, bucket.paid)));
  const maxCost = Math.max(1, ...costs.map((item) => item.amount));
  const selectedMonth = buckets.find((bucket) => bucket.key === month) ?? null;
  const value = (amount: number) => (unavailable ? 'Indisponível' : loading && !entries.length ? '…' : formatCurrency(amount));
  const withProgress = progress.filter((item) => item.progress !== null);
  const averageProgress = withProgress.length ? Math.round(withProgress.reduce((total, item) => total + (item.progress ?? 0), 0) / withProgress.length) : null;

  const tiles: { label: string; value: string; hint: string; tone?: 'danger' | 'success'; onPress: () => void }[] = [
    { label: `Recebido em ${period} meses`, value: value(kpis.receivedInPeriod), hint: `Saldo do período ${value(kpis.balanceInPeriod)}`, tone: 'success', onPress: () => onOpen('financial', null, { view: 'entries' }) },
    { label: 'A receber', value: value(kpis.receivable), hint: `${kpis.dueNext30.length} parcela(s) vencem em 30 dias`, onPress: () => onOpen('financial', null, { view: 'installments' }) },
    { label: 'Em atraso', value: value(kpis.overdueAmount), hint: `${kpis.overdueCount} parcela(s)`, tone: kpis.overdueCount ? 'danger' : undefined, onPress: () => onOpen('financial', null, { view: 'installments' }) },
    { label: 'A pagar', value: value(kpis.payable), hint: 'Contas e compras em aberto', onPress: () => onOpen('financial', null, { view: 'entries' }) },
    { label: 'Obras em andamento', value: unavailable ? 'Indisponível' : String(progress.length), hint: averageProgress === null ? 'Progresso não informado' : `Média de ${averageProgress}% concluído`, onPress: () => onOpen('construction-schedule') },
    { label: 'Contratos ativos', value: unavailable ? 'Indisponível' : String(contractsInfo.active), hint: `${value(contractsInfo.activeValue)} contratados${contractsInfo.missingValue ? ` • ${contractsInfo.missingValue} sem valor` : ''}`, onPress: () => onOpen('clients') },
    { label: 'Solicitações abertas', value: counts.openRequests === null ? 'Indisponível' : String(counts.openRequests), hint: 'Clientes aguardando retorno', onPress: () => onOpen('requests') },
    { label: 'Aprovações pendentes', value: counts.pendingApprovals === null ? 'Indisponível' : String(counts.pendingApprovals), hint: 'Documentos com o cliente', onPress: () => onOpen('approvals') },
  ];

  return (
    <View style={styles.wrapper}>
      <SelectionChips label="Período" value={String(period)} onChange={(next) => { setPeriod(Number(next) as DashboardPeriod); setMonth(null); setCategory(null); }}
        items={[{ value: '3', label: 'Últimos 3 meses' }, { value: '6', label: 'Últimos 6 meses' }, { value: '12', label: 'Últimos 12 meses' }]} />
      {unavailable ? <Notice tone="warning">Parte dos dados não carregou. Os indicadores aparecem como “Indisponível” até atualizar.</Notice> : null}

      <View style={styles.tiles}>
        {tiles.map((tile) => (
          <Pressable key={tile.label} accessibilityRole="button" accessibilityLabel={`${tile.label}: ${tile.value}. Abrir detalhes`} onPress={tile.onPress}
            style={({ pressed }) => [styles.tile, phone && styles.tilePhone, tile.tone === 'danger' && styles.tileDanger, pressed && styles.pressed]}>
            <Text style={styles.tileLabel}>{tile.label.toUpperCase()}</Text>
            <Text style={[styles.tileValue, phone && styles.tileValuePhone, tile.tone === 'danger' && { color: colors.danger }, tile.tone === 'success' && { color: colors.success }]} numberOfLines={1} adjustsFontSizeToFit>{tile.value}</Text>
            <Text style={styles.tileHint}>{tile.hint}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.columns}>
        <Card style={styles.wide}>
          <Text style={styles.title}>Entradas e saídas por mês</Text>
          <View style={styles.legend}>
            <View style={styles.legendItem}><View style={[styles.swatch, { backgroundColor: colors.gold500 }]} /><Text style={styles.meta}>Recebido</Text></View>
            <View style={styles.legendItem}><View style={[styles.swatch, { backgroundColor: colors.slate }]} /><Text style={styles.meta}>Pago</Text></View>
          </View>
          <View style={styles.chart} accessibilityLabel="Gráfico de entradas e saídas por mês">
            {buckets.map((bucket) => {
              const active = bucket.key === month;
              return (
                <Pressable key={bucket.key} accessibilityRole="button" accessibilityLabel={`${bucket.label}: recebido ${formatCurrency(bucket.received)}, pago ${formatCurrency(bucket.paid)}`}
                  onPress={() => setMonth(active ? null : bucket.key)} style={[styles.chartColumn, active && styles.chartColumnActive]}>
                  <View style={styles.bars}>
                    <View style={[styles.bar, { height: `${Math.max(2, (bucket.received / maxBar) * 100)}%`, backgroundColor: colors.gold500 }]} />
                    <View style={[styles.bar, { height: `${Math.max(2, (bucket.paid / maxBar) * 100)}%`, backgroundColor: colors.slate }]} />
                  </View>
                  <Text style={[styles.chartLabel, active && styles.chartLabelActive]}>{bucket.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {selectedMonth ? (
            <View style={styles.detail}>
              <Text style={styles.subtitle}>{selectedMonth.label}: recebido {formatCurrency(selectedMonth.received)} • pago {formatCurrency(selectedMonth.paid)}</Text>
              {selectedMonth.entries.length === 0 ? <Text style={styles.meta}>Nenhum pagamento registrado neste mês.</Text> : selectedMonth.entries.slice(0, 8).map((entry) => (
                <View key={entry.id} style={styles.row}>
                  <Text style={styles.rowText} numberOfLines={1}>{entry.type === 'entrada' ? '↑' : '↓'} {entry.clientName} • {entry.description}</Text>
                  <Text style={[styles.rowValue, { color: entry.type === 'entrada' ? colors.success : colors.ink }]}>{formatCurrency(entry.amount)}</Text>
                </View>
              ))}
              {selectedMonth.entries.length > 8 ? <Button title={`Ver os ${selectedMonth.entries.length} lançamentos no Financeiro`} variant="ghost" onPress={() => onOpen('financial', null, { view: 'entries' })} /> : null}
            </View>
          ) : <Text style={styles.meta}>Toque em um mês para ver os pagamentos.</Text>}
        </Card>

        <Card style={styles.narrow}>
          <Text style={styles.title}>Vencimentos nos próximos 30 dias</Text>
          {kpis.dueNext30.length === 0 ? <Text style={styles.meta}>Nenhuma parcela a vencer nos próximos 30 dias.</Text> : kpis.dueNext30.slice(0, 6).map((entry) => (
            <Pressable key={entry.id} accessibilityRole="button" onPress={() => onOpen('financial', entry.projectId, { view: 'installments' })} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <View style={styles.rowTexts}><Text style={styles.rowText} numberOfLines={1}>{entry.clientName}</Text><Text style={styles.meta} numberOfLines={1}>{formatDate(entry.dueDate)} • {entry.description}</Text></View>
              <Text style={styles.rowValue}>{formatCurrency(entry.amount)}</Text>
            </Pressable>
          ))}
          <Button title="Dar baixa em parcelas" variant="secondary" onPress={() => onOpen('financial', null, { view: 'installments' })} />
        </Card>
      </View>

      <View style={styles.columns}>
        <Card style={styles.wide}>
          <Text style={styles.title}>Andamento das obras</Text>
          {progress.length === 0 ? <Text style={styles.meta}>Nenhuma obra em andamento.</Text> : (showAllProjects ? progress : progress.slice(0, 6)).map((item) => (
            <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${item.name}: ${item.progress ?? 'sem'} por cento. Abrir ficha`} onPress={() => onSelectProject(item.id)} style={({ pressed }) => [styles.progressRow, pressed && styles.pressed]}>
              <View style={styles.progressHead}><Text style={styles.rowText} numberOfLines={1}>{item.name}</Text><Text style={styles.rowValue}>{item.progress === null ? '—' : `${item.progress}%`}</Text></View>
              <Text style={styles.meta} numberOfLines={1}>{item.clientName}{item.status === 'pausado' ? ' • pausada' : ''}</Text>
              <View style={styles.track}><View style={[styles.fill, { width: `${Math.min(100, Math.max(0, item.progress ?? 0))}%` }]} /></View>
            </Pressable>
          ))}
          {progress.length > 6 ? <Button title={showAllProjects ? 'Mostrar menos' : `Mostrar todas (${progress.length})`} variant="ghost" onPress={() => setShowAllProjects((current) => !current)} /> : null}
        </Card>

        <Card style={styles.narrow}>
          <Text style={styles.title}>Custos e compras no período</Text>
          {costs.length === 0 ? <Text style={styles.meta}>Nenhuma saída registrada no período.</Text> : costs.slice(0, 7).map((item) => {
            const active = item.category === category;
            return (
              <Pressable key={item.category} accessibilityRole="button" onPress={() => setCategory(active ? null : item.category)} style={({ pressed }) => [styles.costRow, active && styles.costActive, pressed && styles.pressed]}>
                <View style={styles.progressHead}><Text style={styles.rowText} numberOfLines={1}>{item.label}</Text><Text style={styles.rowValue}>{formatCurrency(item.amount)}</Text></View>
                <View style={styles.track}><View style={[styles.fill, { width: `${(item.amount / maxCost) * 100}%`, backgroundColor: active ? colors.gold300 : colors.slate }]} /></View>
              </Pressable>
            );
          })}
          {category ? <Button title="Ver lançamentos desta categoria" variant="ghost" onPress={() => onOpen('financial', null, { view: 'entries' })} /> : null}
          <Text style={styles.title}>Contratos</Text>
          <View style={styles.statusChips}>{contractsInfo.byStatus.map((item) => <View key={item.status} style={styles.statusChip}><Text style={styles.statusText}>{item.label}: {item.count}</Text></View>)}</View>
        </Card>
      </View>
    </View>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  wrapper: { gap: spacing.md },
  tiles: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.sm },
  tile: { flexGrow: 1, flexShrink: 1, flexBasis: 200, minHeight: 112, padding: spacing.md, gap: 6, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surfaceRaised },
  tilePhone: { flexBasis: 140, minHeight: 96, padding: spacing.sm },
  tileValuePhone: { fontSize: 19 },
  tileDanger: { borderColor: colors.danger },
  pressed: { opacity: 0.75 },
  tileLabel: { color: colors.gold600, fontFamily: typography.family, fontSize: 11, fontWeight: '700' as const, letterSpacing: 1 },
  tileValue: { color: colors.ink, fontFamily: typography.family, fontSize: 24, fontWeight: '700' as const },
  tileHint: { color: colors.slate, fontFamily: typography.family, fontSize: 12, lineHeight: 17 },
  columns: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.md, alignItems: 'flex-start' as const },
  wide: { flexGrow: 2, flexShrink: 1, flexBasis: 420, minWidth: 0, gap: spacing.sm },
  narrow: { flexGrow: 1, flexShrink: 1, flexBasis: 300, minWidth: 0, gap: spacing.sm },
  title: { color: colors.ink, fontFamily: typography.family, fontSize: 16, fontWeight: '700' as const },
  subtitle: { color: colors.ink, fontFamily: typography.family, fontSize: 14, fontWeight: '700' as const },
  meta: { color: colors.slate, fontFamily: typography.family, fontSize: 12, lineHeight: 17 },
  legend: { flexDirection: 'row' as const, gap: spacing.md },
  legendItem: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  chart: { flexDirection: 'row' as const, alignItems: 'flex-end' as const, gap: 4, height: 190 },
  chartColumn: { flex: 1, minWidth: 0, height: '100%' as const, alignItems: 'center' as const, gap: 6, paddingTop: 6, paddingHorizontal: 2, borderRadius: radius.sm },
  chartColumnActive: { backgroundColor: colors.warningSoft },
  bars: { flex: 1, width: '100%' as const, flexDirection: 'row' as const, alignItems: 'flex-end' as const, justifyContent: 'center' as const, gap: 3 },
  bar: { flex: 1, maxWidth: 18, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  chartLabel: { color: colors.slate, fontFamily: typography.family, fontSize: 11 },
  chartLabelActive: { color: colors.gold600, fontWeight: '700' as const },
  detail: { gap: 6, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm },
  row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.line },
  rowTexts: { flex: 1, minWidth: 0 },
  rowText: { flex: 1, minWidth: 0, color: colors.ink, fontFamily: typography.family, fontSize: 13, fontWeight: '600' as const },
  rowValue: { color: colors.ink, fontFamily: typography.family, fontSize: 13, fontWeight: '700' as const },
  progressRow: { gap: 4, paddingVertical: 6 },
  progressHead: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.line, overflow: 'hidden' as const },
  fill: { height: '100%' as const, borderRadius: 4, backgroundColor: colors.gold500 },
  costRow: { gap: 4, padding: 6, borderRadius: radius.sm },
  costActive: { backgroundColor: colors.warningSoft },
  statusChips: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.xs },
  statusChip: { paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line },
  statusText: { color: colors.ink, fontFamily: typography.family, fontSize: 12 },
});
