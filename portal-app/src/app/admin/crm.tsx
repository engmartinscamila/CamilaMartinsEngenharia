import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AdminPageHeader } from '@/components/admin-ui';
import { Button, Card, Field, Notice, Screen, StateView, StatusPill } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/format';
import { useThemeStyles } from '@/providers/theme-provider';
import { listCommercialRecords, type CommercialRecord } from '@/services/commercial-service';
import { updateCrmRecord } from '@/services/operations-service';
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';

const stages = [
  { value: 'novo', label: 'Novos' }, { value: 'qualificacao', label: 'Qualificação' },
  { value: 'proposta', label: 'Proposta' }, { value: 'negociacao', label: 'Negociação' },
  { value: 'ganho', label: 'Ganhos' }, { value: 'perdido', label: 'Perdidos' },
] as const;

export default function AdminCrmScreen() {
  const styles = useThemeStyles(styleDefinitions);
  const [records, setRecords] = useState<CommercialRecord[]>([]);
  const [selected, setSelected] = useState<CommercialRecord | null>(null);
  const [nextAction, setNextAction] = useState('');
  const [lostReason, setLostReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await listCommercialRecords();
    setRecords(result.data); setError(result.error); setLoading(false);
  }, []);
  useEffect(() => { const task = setTimeout(() => void load(), 0); return () => clearTimeout(task); }, [load]);

  const totalPipeline = useMemo(() => records.filter((record) => !['ganho', 'perdido'].includes(record.crmStage))
    .reduce((sum, record) => sum + (record.totalValue ?? 0), 0), [records]);

  const move = async (record: CommercialRecord, stage: string) => {
    if (stage === 'perdido') { setSelected({ ...record, crmStage: 'perdido' }); setLostReason(record.lostReason ?? ''); return; }
    setError(null); setSuccess(null);
    const actionError = await updateCrmRecord({ id: record.id, stage, priority: record.crmPriority, nextActionAt: record.nextActionAt });
    if (actionError) setError(actionError);
    else { setSuccess(`${record.prospectName} movido para ${stages.find((item) => item.value === stage)?.label}.`); await load(); }
  };

  const savePlanning = async () => {
    if (!selected) return;
    if (selected.crmStage === 'perdido' && !lostReason.trim()) { setError('Informe o motivo da perda para preservar o histórico comercial.'); return; }
    const actionError = await updateCrmRecord({
      id: selected.id, stage: selected.crmStage, priority: selected.crmPriority,
      nextActionAt: nextAction ? `${nextAction}T12:00:00-03:00` : selected.nextActionAt,
      lostReason,
    });
    if (actionError) setError(actionError);
    else { setSuccess('Planejamento comercial atualizado.'); setSelected(null); setNextAction(''); setLostReason(''); await load(); }
  };

  return (
    <Screen>
      <AdminPageHeader title="CRM comercial" description="Pipeline visual ligado aos orçamentos, contratos e projetos, sem redigitação." />
      <View style={styles.metrics}>
        <Card style={styles.metric}><Text style={styles.metricLabel}>PIPELINE ABERTO</Text><Text style={styles.metricValue}>{formatCurrency(totalPipeline)}</Text></Card>
        <Card style={styles.metric}><Text style={styles.metricLabel}>OPORTUNIDADES</Text><Text style={styles.metricValue}>{records.filter((record) => !['ganho', 'perdido'].includes(record.crmStage)).length}</Text></Card>
        <Card style={styles.metric}><Text style={styles.metricLabel}>CONVERTIDOS</Text><Text style={styles.metricValue}>{records.filter((record) => record.crmStage === 'ganho').length}</Text></Card>
      </View>
      {error ? <Notice tone="danger">{error}</Notice> : null}{success ? <Notice tone="success">{success}</Notice> : null}
      {selected ? <Card><Text style={styles.title}>{selected.prospectName}</Text>
        {selected.crmStage === 'perdido'
          ? <Field label="Motivo da perda *" multiline onChangeText={setLostReason} value={lostReason} />
          : <Field label="Próxima ação (AAAA-MM-DD)" maxLength={10} onChangeText={setNextAction} value={nextAction} />}
        <View style={styles.actions}><Button onPress={() => void savePlanning()} title="Salvar planejamento" /><Button onPress={() => setSelected(null)} title="Cancelar" variant="ghost" /></View>
      </Card> : null}

      {records.length === 0 && !loading ? <StateView icon="funnel-outline" title="Pipeline vazio" description="Crie o primeiro orçamento para iniciar o fluxo comercial." /> :
        <View style={styles.board}>{stages.map((stage) => {
          const items = records.filter((record) => record.crmStage === stage.value);
          return <View key={stage.value} style={styles.column}>
            <View style={styles.columnHeader}><Text style={styles.columnTitle}>{stage.label}</Text><StatusPill label={String(items.length)} /></View>
            {items.length === 0 ? <Text style={styles.empty}>Nenhum registro</Text> : items.map((record) =>
              <Card key={record.id} style={styles.lead}>
                <Pressable onPress={() => { setSelected(record); setNextAction(record.nextActionAt?.slice(0, 10) ?? ''); }}>
                  <Text style={styles.title}>{record.prospectName}</Text>
                  <Text style={styles.meta}>{record.quoteNumber} • {formatCurrency(record.totalValue)}</Text>
                  <Text style={styles.meta}>Próxima ação: {record.nextActionAt ? formatDate(record.nextActionAt) : 'não definida'}</Text>
                </Pressable>
                <View style={styles.stageActions}>{stages.filter((target) => target.value !== stage.value).map((target) =>
                  <Button key={target.value} onPress={() => void move(record, target.value)} title={target.label} variant="ghost" />)}
                </View>
              </Card>)}
          </View>;
        })}</View>}
      <Button loading={loading} onPress={() => void load()} title="Atualizar pipeline" variant="secondary" />
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metric: { flexGrow: 1, flexBasis: 180, minHeight: 92 },
  metricLabel: { color: colors.gold600, fontSize: 11, fontWeight: '700', letterSpacing: 1, fontFamily: typography.family },
  metricValue: { color: colors.ink, fontSize: 22, fontWeight: '700', marginTop: spacing.xs, fontFamily: typography.family },
  board: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: spacing.sm },
  column: { flexGrow: 1, flexBasis: 270, minWidth: 250, gap: spacing.xs, padding: spacing.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, backgroundColor: colors.surfaceRaised },
  columnHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  columnTitle: { color: colors.ink, fontSize: 14, fontWeight: '700', fontFamily: typography.family },
  lead: { gap: spacing.xs, padding: spacing.sm }, title: { color: colors.ink, fontSize: 14, fontWeight: '700', fontFamily: typography.family },
  meta: { color: colors.muted, fontSize: 11, lineHeight: 17, fontFamily: typography.family },
  empty: { color: colors.muted, fontSize: 12, paddingVertical: spacing.md, textAlign: 'center', fontFamily: typography.family },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }, stageActions: { gap: 2 },
});
