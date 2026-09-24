import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Line, Polyline, Text as SvgText } from 'react-native-svg';

import { AdminPageHeader } from '@/components/admin-ui';
import { DateField } from '@/components/date-field';
import { Button, Card, Field, Notice, Screen, StateView } from '@/components/ui';
import { analyzeConstructionCriticalPath } from '@/lib/construction-schedule-critical-path';
import { isValidIsoDate } from '@/lib/format';
import { planConstructionSchedule, type WorkCalendar } from '@/lib/construction-schedule-engine';
import { exportTestScheduleXlsx } from '@/services/construction-schedule-contract-service';
import { useThemeStyles } from '@/providers/theme-provider';
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';

type TestRow = {
  code: string;
  activity: string;
  predecessor: string;
  duration: string;
  quantity: string;
  unit: string;
  unitCost: string;
  cost: string;
  progress: string;
};

const today = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};
const numeric = (value: string) => Number(value.replace(',', '.'));
const dayNumber = (value: string) => Math.floor(new Date(`${value}T12:00:00Z`).getTime() / 86_400_000);

const initialRows: TestRow[] = [
  { code: 'T1', activity: 'Mobilização e preparação', predecessor: '', duration: '3', quantity: '1', unit: 'etapa', unitCost: '1500', cost: '1500', progress: '100' },
  { code: 'T2', activity: 'Execução da etapa principal', predecessor: 'T1', duration: '10', quantity: '100', unit: 'm²', unitCost: '120', cost: '12000', progress: '45' },
  { code: 'T3', activity: 'Acabamentos e conferência', predecessor: 'T2', duration: '5', quantity: '1', unit: 'etapa', unitCost: '3500', cost: '3500', progress: '0' },
];

export default function ConstructionScheduleTestScreen() {
  const styles = useThemeStyles(styleDefinitions);
  const [rows, setRows] = useState<TestRow[]>(initialRows);
  const [startDate, setStartDate] = useState(today());
  const [calendar, setCalendar] = useState<WorkCalendar>('weekdays');
  const [revision, setRevision] = useState(1);
  const [notes, setNotes] = useState('Cenário fictício para homologação visual e funcional.');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const calculation = useMemo(() => {
    try {
      if (!isValidIsoDate(startDate)) throw new Error('Selecione uma data inicial válida.');
      if (!rows.length) throw new Error('Inclua ao menos uma atividade de teste.');
      const seen = new Set<string>();
      const activities = rows.map((row, index) => {
        const code = row.code.trim().toUpperCase() || `T${index + 1}`;
        if (seen.has(code)) throw new Error(`O código ${code} está repetido.`);
        seen.add(code);
        const duration = numeric(row.duration);
        const quantity = row.quantity.trim() ? numeric(row.quantity) : null;
        const unitCost = row.unitCost.trim() ? numeric(row.unitCost) : null;
        const typedCost = row.cost.trim() ? numeric(row.cost) : null;
        const derivedCost = quantity !== null && unitCost !== null ? quantity * unitCost : null;
        const cost = typedCost ?? derivedCost;
        const progress = numeric(row.progress || '0');
        if (!row.activity.trim()) throw new Error(`Informe a atividade da linha ${index + 1}.`);
        if (!Number.isFinite(duration) || duration < 1 || duration > 3660) throw new Error(`Duração inválida em ${code}.`);
        if (cost === null || !Number.isFinite(cost) || cost < 0) throw new Error(`Informe um custo de teste válido em ${code}.`);
        if (!Number.isFinite(progress) || progress < 0 || progress > 100) throw new Error(`Progresso de teste inválido em ${code}.`);
        return {
          code,
          activity: row.activity.trim(),
          predecessorCode: row.predecessor.trim().toUpperCase() || null,
          durationDays: duration,
          plannedCost: cost,
          weightPercent: null,
          actualProgress: progress,
          quantity,
          unit: row.unit.trim() || null,
          unitCost,
        };
      });
      for (const activity of activities) {
        if (activity.predecessorCode && !seen.has(activity.predecessorCode)) throw new Error(`Predecessora ${activity.predecessorCode} não existe no cenário de teste.`);
        if (activity.predecessorCode === activity.code) throw new Error(`${activity.code} não pode depender dela mesma.`);
      }
      const plan = planConstructionSchedule(activities.map(({ quantity: _q, unit: _u, unitCost: _uc, ...item }) => item), {
        startDate,
        calendar,
        holidays: [],
        contractualDeadline: null,
        manualWeightsApproved: false,
      });
      const critical = analyzeConstructionCriticalPath(plan.activities, { calendar, holidays: [] });
      const byCode = new Map(activities.map((item) => [item.code, item]));
      const items = plan.activities.map((item) => {
        const source = byCode.get(item.code)!;
        return {
          ...item,
          quantity: source.quantity,
          unit: source.unit,
          unitCost: source.unitCost,
          actualProgress: source.actualProgress,
        };
      });
      const totalCost = items.reduce((sum, item) => sum + (item.plannedCost ?? 0), 0);
      const actualWeighted = items.reduce((sum, item) => sum + item.assignedWeightPercent * item.actualProgress / 100, 0);
      return { plan, critical, items, totalCost, actualWeighted, error: null as string | null };
    } catch (failure) {
      return { plan: null, critical: null, items: [], totalCost: 0, actualWeighted: 0, error: failure instanceof Error ? failure.message : 'Cenário de teste inválido.' };
    }
  }, [calendar, rows, startDate]);

  const update = (index: number, changes: Partial<TestRow>) => setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...changes } : row));
  const addRow = () => setRows((current) => [...current, {
    code: `T${current.length + 1}`, activity: '', predecessor: current.at(-1)?.code ?? '', duration: '1',
    quantity: '', unit: 'un', unitCost: '', cost: '', progress: '0',
  }]);
  const removeRow = (index: number) => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));

  const gantt = useMemo(() => {
    if (!calculation.plan) return [];
    const start = dayNumber(calculation.plan.plannedStart);
    const finish = dayNumber(calculation.plan.plannedFinish);
    const span = Math.max(1, finish - start + 1);
    return calculation.items.map((item) => ({
      code: item.code,
      label: item.activity,
      left: Math.max(0, (dayNumber(item.plannedStart) - start) / span * 100),
      width: Math.max(3, (dayNumber(item.plannedFinish) - dayNumber(item.plannedStart) + 1) / span * 100),
      critical: calculation.critical?.criticalCodes.includes(item.code) === true,
    }));
  }, [calculation]);

  const curve = useMemo(() => {
    if (!calculation.plan || !calculation.items.length) return { planned: '', real: '', labels: [] as string[] };
    const start = dayNumber(calculation.plan.plannedStart);
    const finish = dayNumber(calculation.plan.plannedFinish);
    const samples = 12;
    const plannedPoints: string[] = [];
    const realPoints: string[] = [];
    const labels: string[] = [];
    for (let index = 0; index < samples; index += 1) {
      const day = Math.round(start + (finish - start) * index / Math.max(1, samples - 1));
      const date = new Date(day * 86_400_000).toISOString().slice(0, 10);
      let planned = 0;
      let real = 0;
      for (const item of calculation.items) {
        const itemStart = dayNumber(item.plannedStart);
        const itemFinish = dayNumber(item.plannedFinish);
        const fraction = day < itemStart ? 0 : day >= itemFinish ? 1 : (day - itemStart + 1) / Math.max(1, itemFinish - itemStart + 1);
        planned += item.assignedWeightPercent * fraction;
        const realFraction = Math.min(item.actualProgress / 100, fraction);
        real += item.assignedWeightPercent * realFraction;
      }
      const x = 20 + index * 260 / (samples - 1);
      plannedPoints.push(`${x},${130 - Math.min(100, planned) * 1.05}`);
      realPoints.push(`${x},${130 - Math.min(100, real) * 1.05}`);
      labels.push(date.slice(5));
    }
    return { planned: plannedPoints.join(' '), real: realPoints.join(' '), labels };
  }, [calculation]);

  const exportExcel = async () => {
    if (!calculation.plan || calculation.error) { setError(calculation.error ?? 'Calcule um cenário válido antes de exportar.'); return; }
    setBusy(true); setError(null); setSuccess(null);
    const actionError = await exportTestScheduleXlsx({
      revision,
      startDate: calculation.plan.plannedStart,
      finishDate: calculation.plan.plannedFinish,
      calendar,
      notes,
      items: calculation.items.map((item) => ({
        code: item.code,
        activity: item.activity,
        predecessorCode: item.predecessorCode,
        plannedStart: item.plannedStart,
        plannedFinish: item.plannedFinish,
        durationDays: item.durationDays,
        plannedCost: item.plannedCost ?? 0,
        weightPercent: item.assignedWeightPercent,
        quantity: item.quantity,
        unit: item.unit,
        unitCost: item.unitCost,
        actualProgress: item.actualProgress,
      })),
    });
    setBusy(false);
    if (actionError) setError(actionError);
    else setSuccess('Excel TESTE / NÃO CONTRATUAL gerado sem gravar cliente, contrato, faturamento, aceite ou linha de base.');
  };

  return (
    <Screen>
      <AdminPageHeader title="Cronograma de teste" description="Sandbox isolado para testar planejamento, Gantt, Curva S, medições, revisões, quantitativos e Excel sem vínculo contratual." />
      <Notice tone="warning">TESTE / NÃO CONTRATUAL. Nada nesta tela cria cliente, contrato, cobrança, aceite, comunicação, cronograma oficial ou linha de base.</Notice>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}

      <Card>
        <Text style={styles.title}>Cenário</Text>
        <DateField label="Data inicial fictícia" value={startDate} onChange={setStartDate} />
        <Field label="Revisão do teste" keyboardType="number-pad" value={String(revision)} onChangeText={(value) => setRevision(Math.max(1, Math.min(999, Math.trunc(Number(value) || 1))))} />
        <Field label="Observação do cenário" multiline value={notes} onChangeText={setNotes} />
        <View style={styles.actions}>
          <Button title={calendar === 'weekdays' ? 'Dias úteis ✓' : 'Dias úteis'} variant={calendar === 'weekdays' ? 'primary' : 'secondary'} onPress={() => setCalendar('weekdays')} />
          <Button title={calendar === 'calendar_days' ? 'Dias corridos ✓' : 'Dias corridos'} variant={calendar === 'calendar_days' ? 'primary' : 'secondary'} onPress={() => setCalendar('calendar_days')} />
        </View>
      </Card>

      <Text style={styles.title}>Atividades, custos, quantitativos e medição simulada</Text>
      {rows.map((row, index) => (
        <Card key={`${row.code}-${index}`}>
          <View style={styles.actions}>
            <Field label="Código" value={row.code} onChangeText={(value) => update(index, { code: value })} />
            <Field label="Predecessora" value={row.predecessor} onChangeText={(value) => update(index, { predecessor: value })} />
            <Field label="Duração (dias)" keyboardType="number-pad" value={row.duration} onChangeText={(value) => update(index, { duration: value })} />
          </View>
          <Field label="Atividade fictícia" value={row.activity} onChangeText={(value) => update(index, { activity: value })} />
          <View style={styles.actions}>
            <Field label="Quantidade" keyboardType="decimal-pad" value={row.quantity} onChangeText={(value) => update(index, { quantity: value })} />
            <Field label="Unidade" value={row.unit} onChangeText={(value) => update(index, { unit: value })} />
            <Field label="Preço unitário TESTE" keyboardType="decimal-pad" value={row.unitCost} onChangeText={(value) => update(index, { unitCost: value })} />
            <Field label="Custo TESTE" keyboardType="decimal-pad" value={row.cost} onChangeText={(value) => update(index, { cost: value })} />
            <Field label="Medição TESTE (%)" keyboardType="decimal-pad" value={row.progress} onChangeText={(value) => update(index, { progress: value })} />
          </View>
          <Button title="Remover atividade de teste" variant="ghost" onPress={() => removeRow(index)} />
        </Card>
      ))}
      <Button title="Adicionar atividade fictícia" variant="secondary" onPress={addRow} />

      {calculation.error ? <Notice tone="warning">{calculation.error}</Notice> : null}
      {calculation.plan ? (
        <>
          <Card>
            <Text style={styles.title}>Planejamento calculado</Text>
            <Text style={styles.meta}>Período TESTE: {calculation.plan.plannedStart} → {calculation.plan.plannedFinish}</Text>
            <Text style={styles.meta}>Custo fictício: R$ {calculation.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</Text>
            <Text style={styles.meta}>Avanço ponderado simulado: {calculation.actualWeighted.toFixed(2)}%</Text>
            <Text style={styles.meta}>Caminho crítico: {calculation.critical?.criticalCodes.join(' → ') || '—'}</Text>
          </Card>

          <Card>
            <Text style={styles.title}>Gantt TESTE</Text>
            <View style={styles.ganttTrack}>
              {gantt.map((item) => (
                <View key={item.code} style={styles.ganttRow}>
                  <Text style={styles.ganttLabel}>{item.code}</Text>
                  <View style={styles.ganttLane}>
                    <View style={[styles.ganttBar, { left: `${item.left}%`, width: `${item.width}%`, opacity: item.critical ? 1 : 0.65 }]} />
                  </View>
                </View>
              ))}
            </View>
            <Text style={styles.meta}>Barras mais destacadas pertencem ao caminho crítico calculado.</Text>
          </Card>

          <Card>
            <Text style={styles.title}>Curva S TESTE</Text>
            <View style={styles.chartWrap}>
              <Svg width="100%" height={150} viewBox="0 0 300 150">
                <Line x1="20" y1="130" x2="285" y2="130" stroke="#8A94A3" strokeWidth="1" />
                <Line x1="20" y1="25" x2="20" y2="130" stroke="#8A94A3" strokeWidth="1" />
                <Polyline points={curve.planned} fill="none" stroke="#C39C54" strokeWidth="3" />
                <Polyline points={curve.real} fill="none" stroke="#556579" strokeWidth="2" />
                <SvgText x="22" y="18" fontSize="10" fill="#8A94A3">100%</SvgText>
                <SvgText x="24" y="145" fontSize="9" fill="#8A94A3">Planejado × medição simulada</SvgText>
              </Svg>
            </View>
          </Card>

          <Card>
            <Text style={styles.title}>Revisão e Excel</Text>
            <Notice tone="info">Alterar atividades, datas, custos ou medição apenas recalcula este sandbox. Não existe salvamento contratual nesta tela.</Notice>
            <View style={styles.actions}>
              <Button title="Nova revisão de TESTE" variant="secondary" onPress={() => setRevision((value) => value + 1)} />
              <Button loading={busy} title="Gerar Excel TESTE (.xlsx)" onPress={() => void exportExcel()} />
            </View>
          </Card>
        </>
      ) : <StateView icon="bar-chart-outline" title="Cenário ainda não calculável" description="Corrija os campos indicados para visualizar o teste." />}
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  title: { color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '700' as const, fontFamily: typography.family },
  meta: { color: colors.slate, fontSize: 12, lineHeight: 18, fontFamily: typography.family },
  actions: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.sm },
  ganttTrack: { gap: spacing.xs, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.sm },
  ganttRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm, minHeight: 28 },
  ganttLabel: { width: 34, color: colors.ink, fontSize: 11, fontWeight: '700' as const, fontFamily: typography.family },
  ganttLane: { flex: 1, height: 16, backgroundColor: colors.surfaceRaised, borderRadius: radius.pill, overflow: 'hidden' as const, position: 'relative' as const },
  ganttBar: { position: 'absolute' as const, top: 2, bottom: 2, borderRadius: radius.pill, backgroundColor: colors.gold600 },
  chartWrap: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.xs, overflow: 'hidden' as const },
});
