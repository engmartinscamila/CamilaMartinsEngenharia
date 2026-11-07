import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';

/** Estilos compartilhados pelos componentes do Financeiro. */
export const financialStyleDefinitions = (colors: ThemeColors) => ({
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metric: { flexGrow: 1, flexBasis: 190, minHeight: 105, justifyContent: 'space-between' },
  metricLabel: { color: colors.gold600, fontSize: 11, letterSpacing: 1.3, fontWeight: '700', fontFamily: typography.family },
  metricValue: { color: colors.ink, fontSize: 22, fontWeight: '700', fontFamily: typography.family },
  sectionTitle: { color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '700', fontFamily: typography.family },
  label: { color: colors.ink, fontSize: 13, fontWeight: '700', fontFamily: typography.family },
  selector: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  choice: { minWidth: 0, maxWidth: '100%', flexShrink: 1, minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.sm, backgroundColor: colors.surfaceRaised },
  choiceSelected: { borderColor: colors.gold500, backgroundColor: colors.warningSoft },
  choiceText: { flexShrink: 1, lineHeight: 18, color: colors.slate, fontSize: 12, fontFamily: typography.family },
  choiceTextSelected: { color: colors.gold600, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  rowFields: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  columns: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: spacing.sm },
  column: { flex: 1, minWidth: 280 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm },
  valueColumn: { alignItems: 'flex-end', gap: spacing.xs },
  title: { color: colors.ink, fontSize: 15, fontWeight: '700', fontFamily: typography.family },
  meta: { color: colors.muted, fontSize: 11, marginTop: 5, fontFamily: typography.family },
});
