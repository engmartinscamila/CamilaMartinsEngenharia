import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { ProjectPicker } from '@/components/project-picker';
import { Button, Card, Notice, PageHeader, Screen, StateView, StatusPill } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useProject } from '@/providers/project-provider';
import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import { getProjectPortalSettings, listProjectTasks } from '@/services/operations-service';
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';
import type { ProjectTaskSummary } from '@/types/domain';

export default function ClientTasksScreen() {
  const { selectedProject } = useProject();
  const { colors } = useAppTheme();
  const styles = useThemeStyles(styleDefinitions);
  const [tasks, setTasks] = useState<ProjectTaskSummary[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedProject) return;
    setLoading(true);
    const [taskResult, config] = await Promise.all([listProjectTasks(selectedProject.id), getProjectPortalSettings(selectedProject.id)]);
    setTasks(taskResult.data); setEnabled(config.data.showTasks); setError(taskResult.error ?? config.error); setLoading(false);
  }, [selectedProject]);
  useEffect(() => { const task = setTimeout(() => void load(), 0); return () => clearTimeout(task); }, [load]);
  const progress = useMemo(() => tasks.length ? Math.round(100 * tasks.filter((task) => task.status === 'done').length / tasks.length) : 0, [tasks]);

  return <Screen>
    <PageHeader eyebrow="Acompanhamento" title="Tarefas do projeto" description="Atividades que a equipe liberou para seu acompanhamento." />
    <ProjectPicker />
    {error ? <Notice tone="warning">{error}</Notice> : null}
    {loading ? <ActivityIndicator color={colors.gold600} /> : null}
    {!enabled ? <StateView icon="eye-off-outline" title="Módulo não liberado" description="A equipe ainda não compartilhou as tarefas deste projeto." /> : <>
      {tasks.length ? <Card><View style={styles.header}><Text style={styles.title}>Progresso das tarefas compartilhadas</Text><Text style={styles.progressValue}>{progress}%</Text></View><View style={styles.track}><View style={[styles.progress, { width: `${progress}%` }]} /></View></Card> : null}
      {!loading && tasks.length === 0 ? <StateView icon="checkbox-outline" title="Nenhuma tarefa compartilhada" description="As próximas atividades aparecerão aqui quando forem liberadas." /> : tasks.map((task) => <Card key={task.id}><View style={styles.header}><View style={{ flex: 1 }}><Text style={styles.title}>{task.parentTaskId ? '↳ ' : ''}{task.title}</Text><Text style={styles.meta}>{task.startDate ? formatDate(task.startDate) : 'Sem início'} → {task.dueDate ? formatDate(task.dueDate) : 'Sem prazo'}</Text></View><StatusPill label={task.status === 'done' ? 'concluída' : task.status === 'doing' ? 'em execução' : task.status === 'blocked' ? 'aguardando' : 'a fazer'} tone={task.status === 'done' ? 'success' : task.status === 'blocked' ? 'danger' : 'warning'} /></View>{task.description ? <Text style={styles.body}>{task.description}</Text> : null}</Card>)}
    </>}
    <Button loading={loading} onPress={() => void load()} title="Atualizar tarefas" variant="secondary" />
  </Screen>;
}

const styleDefinitions = (colors: ThemeColors) => ({
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  title: { color: colors.ink, fontSize: 14, fontWeight: '700', fontFamily: typography.family },
  body: { color: colors.slate, fontSize: 13, lineHeight: 19, fontFamily: typography.family },
  meta: { color: colors.muted, fontSize: 11, marginTop: 4, fontFamily: typography.family },
  progressValue: { color: colors.gold600, fontSize: 20, fontWeight: '700', fontFamily: typography.family },
  track: { height: 8, borderRadius: radius.pill, overflow: 'hidden', backgroundColor: colors.line },
  progress: { height: '100%', backgroundColor: colors.gold500 },
});
