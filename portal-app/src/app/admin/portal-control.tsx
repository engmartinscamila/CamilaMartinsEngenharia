import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AdminPageHeader } from '@/components/admin-ui';
import { Button, Card, Notice, Screen, StateView, StatusPill } from '@/components/ui';
import { useThemeStyles } from '@/providers/theme-provider';
import { listAdminProjects } from '@/services/admin-service';
import { getProjectPortalSettings, listProjectTasks, listWorkDiary, updateProjectPortalSettings } from '@/services/operations-service';
import { listAgenda, listApprovals, listDocuments, listLibraryItems, listPhotos, listRequests, listSchedule } from '@/services/portal-service';
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';
import type { AdminProjectSummary, ProjectPortalSettings } from '@/types/domain';

const labels: { key: Exclude<keyof ProjectPortalSettings, 'projectId'>; label: string }[] = [
  { key: 'showDocuments', label: 'Documentos' }, { key: 'showPhotos', label: 'Fotos' },
  { key: 'showLibrary', label: 'Biblioteca' }, { key: 'showAgenda', label: 'Agenda' },
  { key: 'showSchedule', label: 'Cronograma' }, { key: 'showApprovals', label: 'Aprovações' },
  { key: 'showRequests', label: 'Solicitações' }, { key: 'showTasks', label: 'Tarefas' },
  { key: 'showWorkDiary', label: 'Diário de obra' },
];

export default function AdminPortalControlScreen() {
  const styles = useThemeStyles(styleDefinitions);
  const [projects, setProjects] = useState<AdminProjectSummary[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [settings, setSettings] = useState<ProjectPortalSettings | null>(null);
  const [counts, setCounts] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    const result = await listAdminProjects(); const valid = result.data.filter((project) => project.contractId);
    setProjects(valid); setProjectId((current) => current ?? valid[0]?.id ?? null); setError(result.error);
  }, []);
  const loadProject = useCallback(async () => {
    const project = projects.find((item) => item.id === projectId);
    if (!project) return;
    setLoading(true); setSettings(null); setCounts({});
    const [config, documents, photos, library, agenda, schedule, approvals, requests, tasks, diary] = await Promise.all([
      getProjectPortalSettings(project.id), listDocuments(project.id), listPhotos(project.id),
      listLibraryItems(project.id, project.clientId), listAgenda(project.id, project.clientId),
      listSchedule(project.id), listApprovals(project.id), listRequests(project.id),
      listProjectTasks(project.id), listWorkDiary(project.id),
    ]);
    setSettings(config.data);
    setCounts({
      showDocuments: documents.error ? null : documents.data.length, showPhotos: photos.error ? null : photos.data.length, showLibrary: library.error ? null : library.data.length,
      showAgenda: agenda.error ? null : agenda.data.length, showSchedule: schedule.error ? null : schedule.data.length, showApprovals: approvals.error ? null : approvals.data.length,
      showRequests: requests.error ? null : requests.data.length, showTasks: tasks.error ? null : tasks.data.filter((item) => item.clientVisible).length,
      showWorkDiary: diary.error ? null : diary.data.filter((item) => item.clientVisible).length,
    });
    setError(config.error ?? documents.error ?? photos.error ?? library.error ?? agenda.error ?? schedule.error ?? approvals.error ?? requests.error ?? tasks.error ?? diary.error);
    setLoading(false);
  }, [projectId, projects]);
  useEffect(() => { const task = setTimeout(() => void loadProjects(), 0); return () => clearTimeout(task); }, [loadProjects]);
  useEffect(() => { const task = setTimeout(() => void loadProject(), 0); return () => clearTimeout(task); }, [loadProject]);

  const project = projects.find((item) => item.id === projectId) ?? null;
  const toggle = (key: Exclude<keyof ProjectPortalSettings, 'projectId'>) => setSettings((current) => current ? { ...current, [key]: !current[key] } : current);
  const save = async () => {
    if (!settings || loading) return;
    setLoading(true); setError(null); setSuccess(null);
    const actionError = await updateProjectPortalSettings(settings);
    setLoading(false);
    if (actionError) setError(actionError); else { setSuccess('Visibilidade do portal atualizada.'); await loadProject(); }
  };

  return (
    <Screen>
      <AdminPageHeader title="Módulos do portal do cliente" description="Escolha as áreas disponíveis para cada projeto e consulte seus registros." />
      {error ? <Notice tone="warning">{error}</Notice> : null}{success ? <Notice tone="success">{success}</Notice> : null}
      <Card><Text style={styles.sectionTitle}>Projeto</Text><View style={styles.chips}>{projects.map((item) => <Pressable key={item.id} onPress={() => setProjectId(item.id)} style={[styles.chip, projectId === item.id && styles.selected]}><Text style={styles.chipText}>{item.contractNumber} • {item.name}</Text></Pressable>)}</View></Card>
      {!project || !settings ? <StateView icon="person-circle-outline" title="Selecione um projeto" description="A configuração é individual por contrato e projeto." /> : <>
        <Card>
          <Text style={styles.sectionTitle}>Módulos liberados</Text>
          <Text style={styles.meta}>Desativar um módulo não apaga dados; somente retira sua exposição no portal deste projeto.</Text>
          <View style={styles.modules}>{labels.map((item) => <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: settings[item.key] }} key={item.key} onPress={() => toggle(item.key)} style={[styles.module, settings[item.key] && styles.moduleEnabled]}><Text style={styles.mark}>{settings[item.key] ? '☒' : '☐'}</Text><View style={{ flex: 1 }}><Text style={styles.title}>{item.label}</Text><Text style={styles.meta}>{counts[item.key] ?? 'Indisponível'} registro(s) cadastrados</Text></View></Pressable>)}</View>
          <Button loading={loading} onPress={() => void save()} title="Salvar visibilidade" />
        </Card>
        <Card>
          <View style={styles.header}><View><Text style={styles.sectionTitle}>Resumo dos módulos selecionados</Text><Text style={styles.meta}>{project.contractNumber} • {project.name}</Text></View><StatusPill label="resumo administrativo" tone="warning" /></View>
          <View style={styles.preview}>{labels.filter((item) => settings[item.key]).map((item) => <View key={item.key} style={styles.previewCard}><Text style={styles.title}>{item.label}</Text><Text style={styles.previewValue}>{counts[item.key] ?? 'Indisponível'}</Text><Text style={styles.meta}>registro(s) cadastrados</Text></View>)}</View>
          {labels.every((item) => !settings[item.key]) ? <Notice tone="warning">Nenhum módulo está liberado para este projeto.</Notice> : null}
        </Card>
      </>}
      <Button loading={loading} onPress={() => void loadProject()} title="Atualizar resumo" variant="secondary" />
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  sectionTitle: { color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '700', fontFamily: typography.family },
  title: { color: colors.ink, fontSize: 14, fontWeight: '700', fontFamily: typography.family },
  meta: { color: colors.muted, fontSize: 11, lineHeight: 17, fontFamily: typography.family },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 8 },
  selected: { borderColor: colors.gold500, backgroundColor: colors.warningSoft },
  chipText: { color: colors.slate, fontSize: 11, fontFamily: typography.family },
  modules: { gap: spacing.xs },
  module: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.sm },
  moduleEnabled: { borderColor: colors.gold500, backgroundColor: colors.warningSoft },
  mark: { color: colors.gold600, fontSize: 18, fontFamily: typography.family },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  preview: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  previewCard: { flexGrow: 1, flexBasis: 150, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.sm },
  previewValue: { color: colors.gold600, fontSize: 24, fontWeight: '700', fontFamily: typography.family },
});
