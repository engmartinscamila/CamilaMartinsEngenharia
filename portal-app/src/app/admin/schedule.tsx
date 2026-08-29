import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { AdminPageHeader, SelectionChips } from '@/components/admin-ui';
import { Button, Card, Field, Notice, Screen, StateView, StatusPill } from '@/components/ui';
import { formatDate, humanizeStatus, isValidIsoDate } from '@/lib/format';
import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import { createAdminScheduleStage, listAdminProjects, listAdminSchedule, updateAdminScheduleStage } from '@/services/admin-service';
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';
import type { AdminProjectSummary, ScheduleStageSummary } from '@/types/domain';

type StageStatus = 'pendente' | 'em_andamento' | 'concluido' | 'pausado' | 'cancelado';

export default function AdminScheduleScreen() {
  const [projects, setProjects] = useState<AdminProjectSummary[]>([]);
  const [stages, setStages] = useState<ScheduleStageSummary[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [order, setOrder] = useState('1');
  const [editing, setEditing] = useState<ScheduleStageSummary | null>(null);
  const [editStatus, setEditStatus] = useState<StageStatus>('pendente');
  const [editProgress, setEditProgress] = useState('0');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { colors } = useAppTheme();
  const styles = useThemeStyles(styleDefinitions);

  const loadProjects = useCallback(async () => {
    const result = await listAdminProjects(); setProjects(result.data); setProjectId((current) => current ?? result.data[0]?.id ?? null); if (result.error) setError(result.error);
  }, []);
  const loadStages = useCallback(async () => {
    if (!projectId) { setStages([]); return; } setLoading(true); const result = await listAdminSchedule(projectId); setStages(result.data); setError(result.error); setLoading(false);
  }, [projectId]);
  useEffect(() => { const task = setTimeout(() => void loadProjects(), 0); return () => clearTimeout(task); }, [loadProjects]);
  useEffect(() => { const task = setTimeout(() => void loadStages(), 0); return () => clearTimeout(task); }, [loadStages]);

  const create = async () => {
    const project = projects.find((item) => item.id === projectId); const numericOrder = Number(order);
    const invalidRange = Boolean(startDate && endDate && startDate > endDate);
    if (!project || title.trim().length < 2 || !Number.isInteger(numericOrder) || numericOrder < 0 || (startDate && !isValidIsoDate(startDate)) || (endDate && !isValidIsoDate(endDate)) || invalidRange) { setError('Revise projeto, título, ordem e datas. O término não pode ser anterior ao início.'); return; }
    setSaving(true); setError(null); const result = await createAdminScheduleStage({ project, title, startDate, endDate, order: numericOrder }); setSaving(false);
    if (result) setError(result); else { setTitle(''); setStartDate(''); setEndDate(''); setOrder(String(stages.length + 2)); await loadStages(); }
  };

  const save = async () => {
    if (!editing) return; const progress = Number(editProgress.replace(',', '.'));
    if (!Number.isFinite(progress) || progress < 0 || progress > 100) { setError('O progresso precisa ficar entre 0 e 100.'); return; }
    setSaving(true); setError(null); const result = await updateAdminScheduleStage(editing.id, editStatus, progress); setSaving(false);
    if (result) setError(result); else { setEditing(null); await loadStages(); }
  };

  return (
    <Screen>
      <AdminPageHeader description="Cadastre etapas em ordem e publique andamento real para o cliente." title="Cronogramas" />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Card>
        <Text style={styles.sectionTitle}>Projeto do cronograma</Text>
        <View style={styles.projectList}>{projects.map((project) => <Pressable key={project.id} onPress={() => setProjectId(project.id)} style={[styles.projectChip, projectId === project.id && styles.selected]}><Text style={[styles.projectText, projectId === project.id && styles.selectedText]}>{project.contractNumber} • {project.name}</Text></Pressable>)}</View>
      </Card>
      <Card>
        <Text style={styles.sectionTitle}>Nova etapa</Text>
        <Field label="Nome da etapa" onChangeText={setTitle} value={title} />
        <View style={styles.row}><View style={styles.grow}><Field label="Início (AAAA-MM-DD)" maxLength={10} onChangeText={setStartDate} value={startDate} /></View><View style={styles.grow}><Field label="Fim (AAAA-MM-DD)" maxLength={10} onChangeText={setEndDate} value={endDate} /></View></View>
        <Field keyboardType="number-pad" label="Ordem" onChangeText={setOrder} value={order} />
        <Button loading={saving} onPress={() => void create()} title="Adicionar etapa" />
      </Card>
      {loading ? <ActivityIndicator color={colors.gold600} /> : null}
      {!loading && projectId && stages.length === 0 ? <StateView description="Adicione a primeira etapa deste projeto." icon="git-branch-outline" title="Cronograma vazio" /> : null}
      {stages.map((stage, index) => <Card key={stage.id}><View style={styles.header}><View style={{ flex: 1 }}><Text style={styles.order}>ETAPA {index + 1}</Text><Text style={styles.title}>{stage.title}</Text><Text style={styles.meta}>{formatDate(stage.startDate, 'Sem início')} — {formatDate(stage.endDate, 'Sem término')} • {stage.progress ?? 0}%</Text></View><StatusPill label={humanizeStatus(stage.status)} tone={stage.status === 'concluido' ? 'success' : stage.status === 'cancelado' ? 'danger' : stage.status === 'em_andamento' ? 'warning' : 'neutral'} /></View><Button onPress={() => { setEditing(stage); setEditStatus(stage.status as StageStatus); setEditProgress(String(stage.progress ?? 0)); }} title="Atualizar etapa" variant="secondary" /></Card>)}
      {editing ? <Card><Text style={styles.sectionTitle}>Atualizar {editing.title}</Text><SelectionChips<StageStatus> items={[{ value: 'pendente', label: 'Pendente' }, { value: 'em_andamento', label: 'Em andamento' }, { value: 'concluido', label: 'Concluído' }, { value: 'pausado', label: 'Pausado' }, { value: 'cancelado', label: 'Cancelado' }]} label="Status" onChange={setEditStatus} value={editStatus} /><Field keyboardType="decimal-pad" label="Progresso (%)" onChangeText={setEditProgress} value={editProgress} /><View style={styles.row}><View style={styles.grow}><Button loading={saving} onPress={() => void save()} title="Salvar" /></View><View style={styles.grow}><Button onPress={() => setEditing(null)} title="Cancelar" variant="ghost" /></View></View></Card> : null}
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  sectionTitle: { color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '700', fontFamily: typography.family },
  projectList: { gap: spacing.xs }, projectChip: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.sm }, selected: { borderColor: colors.gold500, backgroundColor: colors.warningSoft },
  projectText: { color: colors.slate, fontSize: 12, fontFamily: typography.family }, selectedText: { color: colors.gold600, fontWeight: '700' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, grow: { flexGrow: 1, flexBasis: 150 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, order: { color: colors.gold600, fontSize: 10, fontWeight: '700', letterSpacing: 1, fontFamily: typography.family },
  title: { color: colors.ink, fontSize: typography.size.bodyLarge, marginTop: 3, fontWeight: '700', fontFamily: typography.family }, meta: { color: colors.muted, fontSize: 12, marginTop: 4, fontFamily: typography.family },
});
