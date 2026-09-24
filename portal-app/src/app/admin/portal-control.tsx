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
  const [previewData, setPreviewData] = useState<Record<string, { primary: string; secondary?: string }[]>>({});
  const [showClientPreview, setShowClientPreview] = useState(false);
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
    setLoading(true); setSettings(null); setCounts({}); setPreviewData({});
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
    const clientTasks = tasks.data.filter((item) => item.clientVisible);
    const clientDiary = diary.data.filter((item) => item.clientVisible);
    setPreviewData({
      showDocuments: documents.data.slice(0, 6).map((item: any) => ({ primary: item.title || 'Documento', secondary: item.version ? `Versão ${item.version}` : undefined })),
      showPhotos: photos.data.slice(0, 6).map((item: any) => ({ primary: item.caption || item.title || 'Registro fotográfico', secondary: item.createdAt ? new Date(item.createdAt).toLocaleDateString('pt-BR') : undefined })),
      showLibrary: library.data.slice(0, 6).map((item: any) => ({ primary: item.title || item.name || 'Material da biblioteca', secondary: item.category || undefined })),
      showAgenda: agenda.data.slice(0, 6).map((item: any) => ({ primary: item.title || 'Compromisso', secondary: item.startAt ? new Date(item.startAt).toLocaleString('pt-BR') : undefined })),
      showSchedule: schedule.data.slice(0, 8).map((item: any) => ({ primary: item.title || 'Etapa', secondary: item.status || undefined })),
      showApprovals: approvals.data.slice(0, 8).map((item: any) => ({ primary: item.title || 'Aprovação', secondary: item.status || undefined })),
      showRequests: requests.data.slice(0, 8).map((item: any) => ({ primary: item.title || 'Solicitação', secondary: item.status || undefined })),
      showTasks: clientTasks.slice(0, 8).map((item: any) => ({ primary: item.title || 'Tarefa', secondary: item.status || undefined })),
      showWorkDiary: clientDiary.slice(0, 6).map((item: any) => ({ primary: item.entryDate || 'Diário de obra', secondary: item.activities ? String(item.activities).slice(0, 100) : undefined })),
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
      <AdminPageHeader title="Prévia do portal do cliente" description="Veja os módulos que o cliente verá e escolha o que ficará disponível em cada projeto." />
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
          <View style={styles.header}>
            <View style={{ flex: 1 }}><Text style={styles.sectionTitle}>Prévia real do portal</Text><Text style={styles.meta}>{project.contractNumber} • {project.name}</Text></View>
            <StatusPill label="admin • somente leitura" tone="success" />
          </View>
          <Notice tone="info">A prévia usa o projeto selecionado, as permissões salvas e os mesmos dados que podem ser consultados pelo portal. Nenhuma sessão de cliente é criada e nenhuma ação do cliente pode ser executada daqui.</Notice>
          <Button onPress={() => setShowClientPreview((current) => !current)} title={showClientPreview ? 'Fechar visualização do cliente' : 'Visualizar como este cliente'} variant="secondary" />
          {showClientPreview ? (
            <View style={styles.clientShell}>
              <View style={styles.clientHeader}>
                <Text style={styles.clientBrand}>Camila Martins</Text>
                <Text style={styles.meta}>Engenharia Civil • Portal do Cliente</Text>
                <Text style={styles.title}>{project.name}</Text>
              </View>
              {labels.filter((item) => settings[item.key]).map((item) => {
                const rows = previewData[item.key] ?? [];
                return (
                  <View key={item.key} style={styles.clientModule}>
                    <View style={styles.header}><Text style={styles.title}>{item.label}</Text><Text style={styles.meta}>{counts[item.key] ?? '—'} registro(s)</Text></View>
                    {rows.length ? rows.map((row, index) => (
                      <View key={`${item.key}-${index}`} style={styles.previewRow}>
                        <Text style={styles.previewPrimary}>{row.primary}</Text>
                        {row.secondary ? <Text style={styles.meta}>{row.secondary}</Text> : null}
                      </View>
                    )) : <Text style={styles.meta}>Nenhum conteúdo visível neste módulo.</Text>}
                    {(counts[item.key] ?? 0) > rows.length ? <Text style={styles.meta}>+ {(counts[item.key] ?? 0) - rows.length} item(ns) adicionais</Text> : null}
                  </View>
                );
              })}
              {labels.every((item) => !settings[item.key]) ? <Notice tone="warning">Nenhum módulo está liberado para este projeto.</Notice> : null}
            </View>
          ) : null}
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
  clientShell: { gap: spacing.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.surfaceRaised },
  clientHeader: { gap: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: spacing.sm },
  clientBrand: { color: colors.gold600, fontSize: 24, fontWeight: '700' as const, fontFamily: typography.family },
  clientModule: { gap: spacing.xs, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.sm, backgroundColor: colors.surface },
  previewRow: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.xs },
  previewPrimary: { color: colors.ink, fontSize: 12, fontWeight: '600' as const, fontFamily: typography.family },
});
