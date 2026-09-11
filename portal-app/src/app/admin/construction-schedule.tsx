import React, { useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { AdminPageHeader } from '@/components/admin-ui';
import { Button, Card, Field, Notice, Screen, StateView, StatusPill } from '@/components/ui';
import { useLiveRefresh } from '@/hooks/use-live-refresh';
import { formatCurrency, formatDate, isValidIsoDate } from '@/lib/format';
import { useThemeStyles } from '@/providers/theme-provider';
import {
  addConstructionScheduleItem,
  deleteConstructionScheduleItem,
  exportConstructionScheduleXlsx,
  initializeConstructionSchedule,
  listConstructionScheduleProjects,
  loadConstructionSchedule,
  updateConstructionSchedule,
  updateConstructionScheduleItem,
  type ConstructionProjectOption,
  type ConstructionScheduleHeader,
  type ConstructionScheduleItem,
} from '@/services/construction-schedule-service';
import { spacing, ThemeColors, typography } from '@/theme/tokens';

const parseNumber = (value: string, fallback = 0) => {
  const number = Number(value.replace(',', '.'));
  return Number.isFinite(number) ? number : fallback;
};

function plannedPercent(item: ConstructionScheduleItem, referenceDate: string) {
  if (!item.plannedStart || !item.plannedFinish || !referenceDate) return 0;
  const start = new Date(`${item.plannedStart}T12:00:00`);
  const finish = new Date(`${item.plannedFinish}T12:00:00`);
  const reference = new Date(`${referenceDate}T12:00:00`);
  if (reference < start) return 0;
  if (reference >= finish) return 100;
  const total = Math.max(1, finish.getTime() - start.getTime());
  return Math.max(0, Math.min(100, ((reference.getTime() - start.getTime()) / total) * 100));
}

export default function ConstructionScheduleScreen() {
  const styles = useThemeStyles(styleDefinitions);
  const [projects, setProjects] = useState<ConstructionProjectOption[]>([]);
  const [project, setProject] = useState<ConstructionProjectOption | null>(null);
  const [header, setHeader] = useState<ConstructionScheduleHeader | null>(null);
  const [items, setItems] = useState<ConstructionScheduleItem[]>([]);
  const [editItem, setEditItem] = useState<ConstructionScheduleItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    const result = await listConstructionScheduleProjects();
    setProjects(result.data);
    setError(result.error);
    setLoading(false);
  }, []);
  useLiveRefresh(loadProjects);

  const openProject = async (selected: ConstructionProjectOption) => {
    setLoading(true); setError(null); setSuccess(null); setEditItem(null);
    const initialized = await initializeConstructionSchedule(selected.id);
    if (initialized.error) { setLoading(false); setError(initialized.error); return; }
    const result = await loadConstructionSchedule(selected.id);
    setProject(selected); setHeader(result.header); setItems(result.items); setError(result.error); setLoading(false);
  };

  const reload = async () => {
    if (!project) return;
    const result = await loadConstructionSchedule(project.id);
    setHeader(result.header); setItems(result.items); setError(result.error);
  };

  const metrics = useMemo(() => {
    const reference = header?.referenceDate ?? new Date().toISOString().slice(0, 10);
    const totalWeight = items.reduce((sum, item) => sum + item.weightPercent, 0);
    const planned = items.reduce((sum, item) => sum + item.weightPercent * plannedPercent(item, reference) / 100, 0);
    const actual = items.reduce((sum, item) => sum + item.weightPercent * item.actualProgress / 100, 0);
    const plannedCost = items.reduce((sum, item) => sum + (item.plannedCost ?? 0), 0);
    const actualCost = items.reduce((sum, item) => sum + (item.actualCost ?? 0), 0);
    return { totalWeight, planned, actual, deviation: actual - planned, plannedCost, actualCost };
  }, [header?.referenceDate, items]);

  const saveHeader = async () => {
    if (!header || saving) return;
    if (header.referenceDate && !isValidIsoDate(header.referenceDate)) { setError('Data de referência inválida. Use AAAA-MM-DD.'); return; }
    if (header.plannedStart && !isValidIsoDate(header.plannedStart)) { setError('Data inicial inválida. Use AAAA-MM-DD.'); return; }
    if (header.plannedFinish && !isValidIsoDate(header.plannedFinish)) { setError('Data final inválida. Use AAAA-MM-DD.'); return; }
    setSaving(true); setError(null); setSuccess(null);
    const actionError = await updateConstructionSchedule(header);
    setSaving(false);
    if (actionError) setError(actionError); else setSuccess('Dados gerais do cronograma atualizados.');
  };

  const saveItem = async () => {
    if (!editItem || saving) return;
    if (!editItem.activity.trim()) { setError('Informe a atividade.'); return; }
    if (editItem.weightPercent < 0 || editItem.weightPercent > 100) { setError('O peso deve ficar entre 0 e 100%.'); return; }
    if (editItem.actualProgress < 0 || editItem.actualProgress > 100) { setError('O avanço real deve ficar entre 0 e 100%.'); return; }
    for (const value of [editItem.plannedStart, editItem.plannedFinish, editItem.actualStart, editItem.actualFinish]) {
      if (value && !isValidIsoDate(value)) { setError('Use datas válidas no formato AAAA-MM-DD.'); return; }
    }
    setSaving(true); setError(null); setSuccess(null);
    const actionError = await updateConstructionScheduleItem(editItem);
    setSaving(false);
    if (actionError) setError(actionError); else { setSuccess('Atividade atualizada.'); setEditItem(null); await reload(); }
  };

  const addItem = async () => {
    if (!header || saving || !project) return;
    setSaving(true); setError(null); setSuccess(null);
    const result = await addConstructionScheduleItem(header.id, Math.max(0, ...items.map((item) => item.displayOrder)) + 1);
    if (result.error) { setSaving(false); setError(result.error); return; }
    const refreshed = await loadConstructionSchedule(project.id);
    setHeader(refreshed.header); setItems(refreshed.items); setError(refreshed.error);
    const created = refreshed.items.find((item) => item.id === result.id);
    if (created) setEditItem(created);
    setSuccess('Atividade específica criada. Edite os dados conforme a obra.');
    setSaving(false);
  };

  const removeItem = async () => {
    if (!editItem || saving) return;
    setSaving(true); setError(null); setSuccess(null);
    const actionError = await deleteConstructionScheduleItem(editItem.id);
    setSaving(false);
    if (actionError) setError(actionError); else { setSuccess('Atividade removida do cronograma.'); setEditItem(null); await reload(); }
  };

  const exportExcel = async () => {
    if (!project || exporting) return;
    setExporting(true); setError(null); setSuccess(null);
    const actionError = await exportConstructionScheduleXlsx(project.id);
    setExporting(false);
    if (actionError) setError(actionError); else setSuccess('Excel gerado com fórmulas, Gantt, Curva S e indicadores.');
  };

  return (
    <Screen>
      <AdminPageHeader title="Cronograma de obra completo" description="Planejamento físico-financeiro com dados do cliente preenchidos automaticamente, pesos padrão editáveis, dependências, planejado × realizado, Gantt, Curva S e exportação Excel." />
      <Notice tone="info">O cronograma simples continua separado. Use esta área quando o cliente contratar o serviço completo de cronograma de obra.</Notice>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}

      {!project ? <>
        <Text style={styles.sectionTitle}>Selecione a obra/projeto</Text>
        {projects.length === 0 && !loading ? <StateView icon="calendar-outline" title="Nenhum projeto disponível" description="Cadastre um projeto para criar o cronograma completo." /> : null}
        <View style={styles.projectList}>{projects.map((item) => <Card key={item.id} style={styles.projectCard}>
          <Text style={styles.title}>{item.name}</Text>
          <Text style={styles.meta}>{item.clientName}{item.contractNumber ? ` • Contrato ${item.contractNumber}` : ''}</Text>
          {item.workAddress ? <Text style={styles.detail}>{item.workAddress}</Text> : null}
          <Button onPress={() => void openProject(item)} title="Abrir cronograma completo" variant="secondary" />
        </Card>)}</View>
        <Button loading={loading} onPress={() => void loadProjects()} title="Atualizar projetos" variant="secondary" />
      </> : <>
        <View style={styles.actions}><Button onPress={() => { setProject(null); setHeader(null); setItems([]); setEditItem(null); }} title="Trocar obra" variant="ghost" /><Button loading={exporting} onPress={() => void exportExcel()} title="Gerar Excel completo" icon="download-outline" /></View>
        <Card>
          <Text style={styles.title}>{project.name}</Text>
          <Text style={styles.meta}>Cliente: {project.clientName}{project.contractNumber ? ` • Contrato ${project.contractNumber}` : ''}</Text>
          {project.workAddress ? <Text style={styles.detail}>Obra: {project.workAddress}</Text> : null}
          <View style={styles.metaGrid}><Text style={styles.detail}>Área construída: {project.builtArea ?? '—'} m²</Text><Text style={styles.detail}>Área do terreno: {project.landArea ?? '—'} m²</Text></View>
        </Card>

        <View style={styles.metrics}>
          <Card style={styles.metric}><Text style={styles.metricLabel}>PESO TOTAL</Text><Text style={styles.metricValue}>{metrics.totalWeight.toFixed(2)}%</Text></Card>
          <Card style={styles.metric}><Text style={styles.metricLabel}>PLANEJADO</Text><Text style={styles.metricValue}>{metrics.planned.toFixed(1)}%</Text></Card>
          <Card style={styles.metric}><Text style={styles.metricLabel}>REALIZADO</Text><Text style={styles.metricValue}>{metrics.actual.toFixed(1)}%</Text></Card>
          <Card style={styles.metric}><Text style={styles.metricLabel}>DESVIO</Text><Text style={styles.metricValue}>{metrics.deviation.toFixed(1)} p.p.</Text></Card>
          <Card style={styles.metric}><Text style={styles.metricLabel}>CUSTO PREVISTO</Text><Text style={styles.metricValueSmall}>{formatCurrency(metrics.plannedCost)}</Text></Card>
          <Card style={styles.metric}><Text style={styles.metricLabel}>CUSTO REAL</Text><Text style={styles.metricValueSmall}>{formatCurrency(metrics.actualCost)}</Text></Card>
        </View>
        {Math.abs(metrics.totalWeight - 100) > 0.01 ? <Notice tone="warning">Os pesos atuais somam {metrics.totalWeight.toFixed(2)}%. Ajuste para 100% se quiser que o avanço ponderado represente o total da obra.</Notice> : null}

        {header ? <Card><Text style={styles.sectionTitle}>Dados gerais</Text>
          <View style={styles.formGrid}>
            <Field label="Título" value={header.title} onChangeText={(title) => setHeader({ ...header, title })} />
            <Field label="Data de referência (AAAA-MM-DD)" value={header.referenceDate ?? ''} onChangeText={(referenceDate) => setHeader({ ...header, referenceDate })} />
            <Field label="Início previsto (AAAA-MM-DD)" value={header.plannedStart ?? ''} onChangeText={(plannedStart) => setHeader({ ...header, plannedStart })} />
            <Field label="Fim previsto (AAAA-MM-DD)" value={header.plannedFinish ?? ''} onChangeText={(plannedFinish) => setHeader({ ...header, plannedFinish })} />
          </View>
          <Field label="Observações gerais" multiline value={header.notes ?? ''} onChangeText={(notes) => setHeader({ ...header, notes })} />
          <Button loading={saving} onPress={() => void saveHeader()} title="Salvar dados gerais" variant="secondary" />
        </Card> : null}

        {editItem ? <Card><Text style={styles.sectionTitle}>Editar atividade {editItem.code}</Text>
          <View style={styles.formGrid}>
            <Field label="Código" value={editItem.code} onChangeText={(code) => setEditItem({ ...editItem, code })} />
            <Field label="Categoria" value={editItem.category} onChangeText={(category) => setEditItem({ ...editItem, category })} />
            <Field label="Atividade" value={editItem.activity} onChangeText={(activity) => setEditItem({ ...editItem, activity })} />
            <Field label="Ordem" keyboardType="numeric" value={String(editItem.displayOrder)} onChangeText={(value) => setEditItem({ ...editItem, displayOrder: Math.max(0, Math.round(parseNumber(value))) })} />
            <Field label="Peso (%)" keyboardType="decimal-pad" value={String(editItem.weightPercent)} onChangeText={(value) => setEditItem({ ...editItem, weightPercent: parseNumber(value) })} />
            <Field label="Duração planejada (dias)" keyboardType="numeric" value={String(editItem.plannedDurationDays)} onChangeText={(value) => setEditItem({ ...editItem, plannedDurationDays: Math.max(0, Math.round(parseNumber(value))) })} />
            <Field label="Código predecessora" value={editItem.predecessorCode ?? ''} onChangeText={(predecessorCode) => setEditItem({ ...editItem, predecessorCode })} />
            <Field label="Início previsto" value={editItem.plannedStart ?? ''} onChangeText={(plannedStart) => setEditItem({ ...editItem, plannedStart })} />
            <Field label="Fim previsto" value={editItem.plannedFinish ?? ''} onChangeText={(plannedFinish) => setEditItem({ ...editItem, plannedFinish })} />
            <Field label="Início real" value={editItem.actualStart ?? ''} onChangeText={(actualStart) => setEditItem({ ...editItem, actualStart })} />
            <Field label="Fim real" value={editItem.actualFinish ?? ''} onChangeText={(actualFinish) => setEditItem({ ...editItem, actualFinish })} />
            <Field label="Avanço real (%)" keyboardType="numeric" value={String(editItem.actualProgress)} onChangeText={(value) => setEditItem({ ...editItem, actualProgress: parseNumber(value) })} />
            <Field label="Custo previsto (R$)" keyboardType="decimal-pad" value={editItem.plannedCost === null ? '' : String(editItem.plannedCost)} onChangeText={(value) => setEditItem({ ...editItem, plannedCost: value.trim() ? parseNumber(value) : null })} />
            <Field label="Custo real (R$)" keyboardType="decimal-pad" value={editItem.actualCost === null ? '' : String(editItem.actualCost)} onChangeText={(value) => setEditItem({ ...editItem, actualCost: value.trim() ? parseNumber(value) : null })} />
            <Field label="Status" value={editItem.status} onChangeText={(status) => setEditItem({ ...editItem, status })} />
          </View>
          <Field label="Observações / especificidades da obra" multiline value={editItem.notes ?? ''} onChangeText={(notes) => setEditItem({ ...editItem, notes })} />
          <View style={styles.actions}><Button loading={saving} onPress={() => void saveItem()} title="Salvar atividade" /><Button disabled={saving} onPress={() => setEditItem(null)} title="Cancelar" variant="ghost" /><Button disabled={saving} onPress={() => void removeItem()} title="Remover atividade" variant="danger" /></View>
        </Card> : null}

        <View style={styles.actions}><Text style={styles.sectionTitle}>Atividades do cronograma</Text><Button loading={saving} onPress={() => void addItem()} title="Adicionar atividade específica" icon="add-outline" variant="secondary" /></View>
        <View style={styles.itemList}>{items.map((item) => {
          const planned = plannedPercent(item, header?.referenceDate ?? new Date().toISOString().slice(0, 10));
          return <Card key={item.id} style={styles.itemCard}>
            <View style={styles.itemTop}><View style={styles.itemIdentity}><Text style={styles.title}>{item.code} • {item.activity}</Text><Text style={styles.meta}>{item.category}{item.predecessorCode ? ` • predecessora ${item.predecessorCode}` : ''}</Text></View><StatusPill label={item.status} tone={item.actualProgress >= 100 ? 'success' : item.actualProgress > 0 ? 'warning' : 'neutral'} /></View>
            <View style={styles.metaGrid}><Text style={styles.detail}>Peso: {item.weightPercent.toFixed(2)}%</Text><Text style={styles.detail}>Duração: {item.plannedDurationDays} dias</Text><Text style={styles.detail}>Previsto: {planned.toFixed(0)}%</Text><Text style={styles.detail}>Real: {item.actualProgress.toFixed(0)}%</Text></View>
            <Text style={styles.detail}>Planejado: {item.plannedStart ? formatDate(item.plannedStart) : '—'} → {item.plannedFinish ? formatDate(item.plannedFinish) : '—'}</Text>
            {(item.plannedCost ?? item.actualCost) !== null ? <Text style={styles.detail}>Custos: {formatCurrency(item.plannedCost ?? 0)} previsto • {formatCurrency(item.actualCost ?? 0)} realizado</Text> : null}
            <Button onPress={() => { setError(null); setSuccess(null); setEditItem({ ...item }); }} title="Editar atividade" variant="secondary" />
          </Card>;
        })}</View>
        <Button loading={loading} onPress={() => void reload()} title="Atualizar cronograma" variant="secondary" />
      </>}
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  sectionTitle: { color: colors.ink, fontSize: 17, lineHeight: 24, fontWeight: '700', fontFamily: typography.family },
  title: { color: colors.ink, fontSize: 14, lineHeight: 20, fontWeight: '700', fontFamily: typography.family, flexShrink: 1 },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 18, fontFamily: typography.family, flexShrink: 1 },
  detail: { color: colors.slate, fontSize: 12, lineHeight: 18, fontFamily: typography.family, flexShrink: 1 },
  projectList: { gap: spacing.sm },
  projectCard: { gap: spacing.xs },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', gap: spacing.sm },
  metric: { flexGrow: 1, flexBasis: 150, minHeight: 88 },
  metricLabel: { color: colors.gold600, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, fontFamily: typography.family },
  metricValue: { color: colors.ink, fontSize: 21, fontWeight: '700', fontFamily: typography.family },
  metricValueSmall: { color: colors.ink, fontSize: 16, fontWeight: '700', fontFamily: typography.family },
  formGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  itemList: { gap: spacing.sm },
  itemCard: { gap: spacing.xs },
  itemTop: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  itemIdentity: { flex: 1, minWidth: 220, gap: 2 },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
