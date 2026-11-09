import React, { useState } from 'react';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';

import { Card } from '@/components/ui';
import { formatCurrency } from '@/lib/format';
import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import { radius, spacing, type ThemeColors, typography } from '@/theme/tokens';

type Tone = 'neutral' | 'success' | 'warning' | 'danger';

/** Bloco de seção do painel: título, descrição curta e ação opcional. */
export function DashboardSection({ title, description, actionLabel, onAction, children }: { title: string; description?: string; actionLabel?: string; onAction?: () => void; children: React.ReactNode }) {
  const styles = useThemeStyles(styleDefinitions);
  return <View style={styles.section}>
    <View style={styles.sectionHeader}>
      <View style={styles.sectionCopy}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {description ? <Text style={styles.sectionDescription}>{description}</Text> : null}
      </View>
      {actionLabel && onAction ? <Pressable accessibilityRole="button" onPress={onAction} style={({ pressed }) => [styles.sectionAction, pressed && styles.pressed]}><Text style={styles.sectionActionText}>{actionLabel} →</Text></Pressable> : null}
    </View>
    {children}
  </View>;
}

export function KpiGrid({ children }: { children: React.ReactNode }) {
  const styles = useThemeStyles(styleDefinitions);
  return <View style={styles.kpiGrid}>{children}</View>;
}

/** Indicador numérico. `value === null` significa fonte indisponível, nunca zero. */
export function KpiTile({ label, value, hint, tone = 'neutral', money = false, onPress }: { label: string; value: number | string | null; hint?: string; tone?: Tone; money?: boolean; onPress?: () => void }) {
  const styles = useThemeStyles(styleDefinitions);
  const { colors } = useAppTheme();
  const accent = { neutral: colors.gold600, success: colors.success, warning: colors.warning, danger: colors.danger }[tone];
  const display = value === null ? 'Indisponível' : typeof value === 'number' && money ? formatCurrency(value) : String(value);
  const body = <Card style={styles.kpi}>
    <View style={[styles.kpiAccent, { backgroundColor: accent }]} />
    <Text style={styles.kpiLabel}>{label}</Text>
    <Text style={[styles.kpiValue, value === null && styles.kpiUnavailable]}>{display}</Text>
    {hint ? <Text style={[styles.kpiHint, tone !== 'neutral' && { color: accent }]}>{hint}</Text> : null}
  </Card>;
  return onPress
    ? <Pressable accessibilityLabel={`${label}: ${display}`} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.kpiWrap, pressed && styles.pressed]}>{body}</Pressable>
    : <View style={styles.kpiWrap}>{body}</View>;
}

export interface BarSeries { label: string; values: number[]; color: string }

/** Gráfico de colunas agrupadas em SVG, responsivo à largura do card. */
export function GroupedBarChart({ categories, series, dimmedFrom, highlightIndex, height = 190 }: { categories: string[]; series: BarSeries[]; dimmedFrom?: number; highlightIndex?: number; height?: number }) {
  const styles = useThemeStyles(styleDefinitions);
  const { colors } = useAppTheme();
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => setWidth(Math.round(event.nativeEvent.layout.width));
  const max = Math.max(0, ...series.flatMap((item) => item.values));
  const top = 14, bottom = 22, plot = height - top - bottom;
  const group = categories.length ? width / categories.length : 0;
  const bar = Math.max(3, Math.min(18, (group * 0.7) / Math.max(1, series.length)));
  return <View>
    <View style={styles.legend}>{series.map((item) => <View key={item.label} style={styles.legendItem}><View style={[styles.legendSwatch, { backgroundColor: item.color }]} /><Text style={styles.legendText}>{item.label}</Text></View>)}{dimmedFrom !== undefined ? <View style={styles.legendItem}><View style={[styles.legendSwatch, { backgroundColor: colors.muted, opacity: 0.45 }]} /><Text style={styles.legendText}>Previsto</Text></View> : null}</View>
    <View accessibilityLabel={series.map((item) => `${item.label}: ${categories.map((c, i) => `${c} ${formatCurrency(item.values[i])}`).join(', ')}`).join('. ')} onLayout={onLayout} style={{ height }}>
      {width > 0 ? <Svg height={height} width={width}>
        {[0, 0.5, 1].map((ratio) => <Line key={ratio} stroke={colors.line} strokeDasharray={ratio === 0 ? undefined : '3 4'} strokeWidth={1} x1={0} x2={width} y1={top + plot * (1 - ratio)} y2={top + plot * (1 - ratio)} />)}
        {max > 0 ? <SvgText fill={colors.muted} fontFamily={typography.family} fontSize={9} x={2} y={top - 3}>{compactMoney(max)}</SvgText> : null}
        {categories.map((category, index) => {
          const groupStart = index * group + (group - bar * series.length - 2 * (series.length - 1)) / 2;
          return <React.Fragment key={category}>
            {series.map((item, s) => {
              const value = item.values[index] ?? 0;
              const h = max > 0 ? Math.max(value > 0 ? 2 : 0, (value / max) * plot) : 0;
              return <Rect fill={item.color} height={h} key={item.label} opacity={dimmedFrom !== undefined && index >= dimmedFrom ? 0.45 : 1} rx={1.5} width={bar} x={groupStart + s * (bar + 2)} y={top + plot - h} />;
            })}
            <SvgText fill={highlightIndex === index ? colors.gold600 : colors.muted} fontFamily={typography.family} fontSize={9} fontWeight={highlightIndex === index ? '700' : '400'} textAnchor="middle" x={index * group + group / 2} y={height - 6}>{category}</SvgText>
          </React.Fragment>;
        })}
      </Svg> : null}
    </View>
  </View>;
}

/** Linha com barra de progresso (obra, contrato, etapa). */
export function ProgressRow({ title, subtitle, value, badge, tone = 'neutral', onPress }: { title: string; subtitle?: string; value: number | null; badge?: string; tone?: Tone; onPress?: () => void }) {
  const styles = useThemeStyles(styleDefinitions);
  const { colors } = useAppTheme();
  const fill = { neutral: colors.gold500, success: colors.success, warning: colors.warning, danger: colors.danger }[tone];
  const pct = value === null ? null : Math.max(0, Math.min(100, Math.round(value)));
  const content = <View style={styles.progressRow}>
    <View style={styles.progressTop}>
      <View style={styles.progressCopy}>
        <Text numberOfLines={1} style={styles.progressTitle}>{title}</Text>
        {subtitle ? <Text numberOfLines={1} style={styles.progressSubtitle}>{subtitle}</Text> : null}
      </View>
      {badge ? <Text style={[styles.badge, { color: fill, borderColor: fill }]}>{badge}</Text> : null}
      <Text style={styles.progressValue}>{pct === null ? '—' : `${pct}%`}</Text>
    </View>
    <View style={styles.track}><View style={[styles.trackFill, { width: `${pct ?? 0}%`, backgroundColor: fill }]} /></View>
  </View>;
  return onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>{content}</Pressable> : content;
}

/** Barra empilhada horizontal com legenda (distribuição por status, curva ABC). */
export function StackedBar({ parts }: { parts: { label: string; value: number; color: string; detail?: string }[] }) {
  const styles = useThemeStyles(styleDefinitions);
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  if (!total) return null;
  return <View style={styles.stackWrap}>
    <View style={styles.stack}>{parts.filter((part) => part.value > 0).map((part) => <View key={part.label} style={{ flex: part.value, backgroundColor: part.color }} />)}</View>
    <View style={styles.legend}>{parts.map((part) => <View key={part.label} style={styles.legendItem}><View style={[styles.legendSwatch, { backgroundColor: part.color }]} /><Text style={styles.legendText}>{part.label} · {part.detail ?? part.value}</Text></View>)}</View>
  </View>;
}

export function compactMoney(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `R$ ${(value / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1_000) return `R$ ${(value / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return formatCurrency(value);
}

const styleDefinitions = (colors: ThemeColors) => ({
  section: { gap: spacing.sm },
  sectionHeader: { flexDirection: 'row' as const, alignItems: 'flex-end' as const, justifyContent: 'space-between' as const, gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: spacing.xs },
  sectionCopy: { flex: 1, minWidth: 0, gap: 2 },
  sectionTitle: { color: colors.gold600, fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.4, textTransform: 'uppercase' as const, fontFamily: typography.family },
  sectionDescription: { color: colors.muted, fontSize: 12, lineHeight: 17, fontFamily: typography.family },
  sectionAction: { paddingVertical: 4 },
  sectionActionText: { color: colors.gold600, fontSize: 12, fontWeight: '700' as const, fontFamily: typography.family },
  pressed: { opacity: 0.72 },
  kpiGrid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.sm },
  kpiWrap: { flexGrow: 1, flexBasis: 150, minWidth: 0 },
  kpi: { minHeight: 104, gap: 4, overflow: 'hidden' as const, paddingLeft: spacing.md },
  kpiAccent: { position: 'absolute' as const, left: 0, top: 0, bottom: 0, width: 3 },
  kpiLabel: { color: colors.slate, fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.3, fontFamily: typography.family },
  kpiValue: { color: colors.ink, fontSize: 20, lineHeight: 26, fontWeight: '700' as const, fontFamily: typography.family, fontVariant: ['tabular-nums' as const] },
  kpiUnavailable: { color: colors.muted, fontSize: 15 },
  kpiHint: { color: colors.muted, fontSize: 11, lineHeight: 15, fontFamily: typography.family },
  legend: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.sm, marginBottom: spacing.xs },
  legendItem: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5 },
  legendSwatch: { width: 9, height: 9, borderRadius: 2 },
  legendText: { color: colors.slate, fontSize: 11, fontFamily: typography.family },
  progressRow: { gap: 5, paddingVertical: spacing.xs, borderTopWidth: 1, borderTopColor: colors.line },
  progressTop: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.xs },
  progressCopy: { flex: 1, minWidth: 0 },
  progressTitle: { color: colors.ink, fontSize: 13, fontWeight: '600' as const, fontFamily: typography.family },
  progressSubtitle: { color: colors.muted, fontSize: 11, fontFamily: typography.family },
  progressValue: { color: colors.ink, fontSize: 13, fontWeight: '700' as const, minWidth: 40, textAlign: 'right' as const, fontFamily: typography.family, fontVariant: ['tabular-nums' as const] },
  badge: { fontSize: 9, fontWeight: '700' as const, letterSpacing: 0.6, textTransform: 'uppercase' as const, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 1, fontFamily: typography.family },
  track: { height: 6, borderRadius: radius.pill, overflow: 'hidden' as const, backgroundColor: colors.line },
  trackFill: { height: '100%' as const, borderRadius: radius.pill },
  stackWrap: { gap: spacing.xs },
  stack: { flexDirection: 'row' as const, height: 12, borderRadius: radius.pill, overflow: 'hidden' as const, gap: 2 },
});
