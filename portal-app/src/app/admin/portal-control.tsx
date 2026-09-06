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
  const [counts, setCounts] = useState<Record<string, number>>({});
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
    setLoading(true);
    const [config, documents, photos, library, agenda, schedule, approvals, requests, tasks, diary] = await Promise.all([
      getProjectPortalSettings(project.id), listDocuments(project.id), listPhotos(project.id),
      listLibraryItems(project.id, project.clientId), listAgenda(project.id, project.clientId),
      listSchedule(project.id), listApprovals(project.id), listRequests(project.id),
      listProjectTasks(project.id), listWorkDiary(project.id),
    ]);
    setSettings(config.data);
    setCounts({
      showDocuments: documents.data.length, showPhotos: photos.data.length, showLibrary: library.data.length,
      showAgenda: agenda.data.length, showSchedule: schedule.data.length, showApprovals: approvals.data.length,
      showRequests: requests.data.length, showTasks: tasks.data.filter((item) => item.clientVisible).length,
      showWorkDiary: diary.data.filter((item) => item.clientVisible).length,
    });
    setError(config.error ?? documents.error ?? photos.error ?? library.error ?? agenda.error ?? schedule.error ?? approvals.error ?? requests.error ?? tasks.error ?? diary.error);
    setLoading(false);
  }, [projectId, projects]);
  useEffect(() => { const task = setTimeout(() => void loadProjects(), 0); return () => clearTimeout(task); }, [loadProjects]);
  useEffect(() => { const task = setTimeout(() => void loadProject(), 0); return () => clearTimeout(task); }, [loadProject]);

  const project = projects.find((item) => item.id === projectId) ?? null;
  const toggle = (key: Exclude<keyof ProjectPortalSettings, 'projectId'>) => setSettings((current) => current ? { ...current, [key]: !current[key] } : current);
  const save = async () => {
    if (!settings) return;
    const actionError = await updateProjectPortalSettings(settings);
    if (actionError) setError(actionError); else { setSuccess('Visibilidade do portal atualizada.'); await loadProject(); }
  };

  return (
    <Screen>
      <AdminPageHeader title="Portal do cliente" description="Escolha o que será exibido e confira a visão do cliente antes de liberar." />
      {error ? <Notice tone="warning">{error}</Notice> : null}{success ? <Notice tone="success">{success}</Notice> : null}
      <Card><Text style={styles.sectionTitle}>Projeto</Text><View style={styles.chips}>{projects.map((item) => <Pressable key={item.id} onPress={() => setProjectId(item.id)} style={[styles.chip, projectId === item.id && styles.selected]}><Text style={styles.chipText}>{item.contractNumber} • {item.name}</Text></Pressable>)}</View></Card>
      {!project || !settings ? <StateView icon="person-circle-outline" title="Selecione um projeto" description="A configuração é individual por contrato e projeto." /> : <>
        <Card>
          <Text style={styles.sectionTitle}>Módulos liberados</Text>
          <Text style={styles.meta}>Desativar um módulo não apaga dados; somente retira sua exposição no portal deste projeto.</Text>
          <View style={styles.modules}>{labels.map((item) => <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: settings[item.key] }} key={item.key} onPress={() => toggle(item.key)} style={[styles.module, settings[item.key] && styles.moduleEnabled]}><Text style={styles.mark}>{settings[item.key] ? '☒' : '☐'}</Text><View style={{ flex: 1 }}><Text style={styles.title}>{item.label}</Text><Text style={styles.meta}>{counts[item.key] ?? 0} registro(s) atualmente visíveis</Text></View></Pressable>)}</View>
          <Button loading={loading} onPress={() => void save()} title="Salvar visibilidade" />
        </Card>
        <Card>
          <View style={styles.header}><View><Text style={styles.sectionTitle}>Visualizar como cliente</Text><Text style={styles.meta}>{project.contractNumber} • {project.name}</Text></View><StatusPill label="prévia administrativa" tone="warning" /></View>
          <View style={styles.preview}>{labels.filter((item) => settings[item.key]).map((item) => <View key={item.key} style={styles.previewCard}><Text style={styles.title}>{item.label}</Text><Text style={styles.previewValue}>{counts[item.key] ?? 0}</Text><Text style={styles.meta}>item(ns) liberados</Text></View>)}</View>
          {labels.every((item) => !settings[item.key]) ? <Notice tone="warning">Nenhum módulo está liberado para este projeto.</Notice> : null}
        </Card>
      </>}
      <Button loading={loading} onPress={() => void loadProject()} title="Atualizar prévia" variant="secondary" />
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
