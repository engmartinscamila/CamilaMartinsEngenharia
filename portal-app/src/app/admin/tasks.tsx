import { useNotificationProject } from '@/hooks/use-notification-project';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AdminPageHeader, SelectionChips } from '@/components/admin-ui';
import { Button, Card, Field, Notice, Screen, StateView, StatusPill } from '@/components/ui';
import { formatDate, isValidIsoDate } from '@/lib/format';
import { useThemeStyles } from '@/providers/theme-provider';
import { listAdminProjects } from '@/services/admin-service';
import {
  applyTaskTemplate, createProjectTask, listProjectTasks, listTaskTemplates,
  saveTaskTemplate, updateProjectTask,
} from '@/services/operations-service';
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';
import type { AdminProjectSummary, ProjectTaskSummary, TaskPriority, TaskStatus, TaskTemplateSummary } from '@/types/domain';

const priorities = [
  { value: 'normal', label: 'Normal' }, { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' }, { value: 'low', label: 'Baixa' },
] satisfies { value: TaskPriority; label: string }[];
const statuses: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'A fazer' }, { value: 'doing', label: 'Em execução' },
  { value: 'blocked', label: 'Bloqueada' }, { value: 'done', label: 'Concluída' },
  { value: 'cancelled', label: 'Cancelada' },
];

export default function AdminTasksScreen() {
  const styles = useThemeStyles(styleDefinitions);
  const [projects, setProjects] = useState<AdminProjectSummary[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<ProjectTaskSummary[]>([]);
  const [templates, setTemplates] = useState<TaskTemplateSummary[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [hours, setHours] = useState('');
  const [clientVisible, setClientVisible] = useState(false);
  const [parentTaskId, setParentTaskId] = useState<string | null>(null);
  const [dependencyId, setDependencyId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useNotificationProject(projects, setProjectId);

  const loadProjects = useCallback(async () => {
    const [projectResult, templateResult] = await Promise.all([listAdminProjects(), listTaskTemplates()]);
    setProjects(projectResult.data.filter((item) => item.contractId));
    setTemplates(templateResult.data);
    setError(projectResult.error ?? templateResult.error);
    setProjectId((current) => current ?? projectResult.data.find((item) => item.contractId)?.id ?? null);
  }, []);
  const loadTasks = useCallback(async () => {
    if (!projectId) { setTasks([]); return; }
    setLoading(true);
    const result = await listProjectTasks(projectId);
    setTasks(result.data); setError(result.error); setLoading(false);
  }, [projectId]);
  useEffect(() => { const task = setTimeout(() => void loadProjects(), 0); return () => clearTimeout(task); }, [loadProjects]);
  useEffect(() => { const task = setTimeout(() => void loadTasks(), 0); return () => clearTimeout(task); }, [loadTasks]);

  const selectedProject = projects.find((project) => project.id === projectId) ?? null;
  const progress = useMemo(() => {
    const active = tasks.filter((task) => task.status !== 'cancelled');
    const total = active.reduce((sum, task) => sum + task.weight, 0);
    return total ? Math.round(100 * active.filter((task) => task.status === 'done').reduce((sum, task) => sum + task.weight, 0) / total) : 0;
  }, [tasks]);

  const create = async () => {
    if (!projectId || title.trim().length < 3) { setError('Selecione o projeto e informe uma tarefa válida.'); return; }
    if (startDate && !isValidIsoDate(startDate)) { setError('A data inicial deve usar AAAA-MM-DD.'); return; }
    if (dueDate && !isValidIsoDate(dueDate)) { setError('O prazo deve usar AAAA-MM-DD.'); return; }
    if (startDate && dueDate && dueDate < startDate) { setError('O prazo não pode ser anterior ao início.'); return; }
    setLoading(true); setError(null); setSuccess(null);
    const actionError = await createProjectTask({
      projectId, title, description, priority, startDate, dueDate,
      estimatedHours: hours ? Number(hours.replace(',', '.')) : null,
      clientVisible, parentTaskId, dependencyId,
    });
    if (actionError) setError(actionError);
    else {
      setSuccess('Tarefa criada e progresso do projeto recalculado automaticamente.');
      setTitle(''); setDescription(''); setStartDate(''); setDueDate(''); setHours('');
      setParentTaskId(null); setDependencyId(null); setClientVisible(false); await loadTasks();
    }
    setLoading(false);
  };

  const changeStatus = async (task: ProjectTaskSummary, status: TaskStatus) => {
    setError(null); const actionError = await updateProjectTask({ id: task.id, status });
    if (actionError) setError(actionError); else await loadTasks();
  };
  const toggleVisible = async (task: ProjectTaskSummary) => {
    const actionError = await updateProjectTask({ id: task.id, clientVisible: !task.clientVisible });
    if (actionError) setError(actionError); else await loadTasks();
  };
  const saveTemplate = async () => {
    if (templateName.trim().length < 3 || tasks.length === 0) { setError('Informe o nome e mantenha ao menos uma tarefa no projeto.'); return; }
    const actionError = await saveTaskTemplate(templateName, `Modelo criado a partir de ${selectedProject?.name ?? 'projeto'}`, tasks);
    if (actionError) setError(actionError); else { setTemplateName(''); setSuccess('Modelo salvo para reutilização.'); await loadProjects(); }
  };
  const applyTemplate = async (templateId: string) => {
    if (!projectId) return;
    const baseDate = startDate && isValidIsoDate(startDate) ? startDate : new Date().toISOString().slice(0, 10);
    const actionError = await applyTaskTemplate(templateId, projectId, baseDate);
    if (actionError) setError(actionError); else { setSuccess('Modelo aplicado e cronograma operacional criado.'); await loadTasks(); }
  };

  return (
    <Screen>
      <AdminPageHeader title="Tarefas do projeto" description="Subtarefas, dependências, modelos, prazos e progresso automático por projeto." />
      {error ? <Notice tone="danger">{error}</Notice> : null}{success ? <Notice tone="success">{success}</Notice> : null}
      <Card>
        <Text style={styles.sectionTitle}>Projeto</Text>
        <View style={styles.chips}>{projects.map((project) => <Pressable key={project.id} onPress={() => setProjectId(project.id)} style={[styles.chip, projectId === project.id && styles.selected]}><Text style={[styles.chipText, projectId === project.id && styles.selectedText]}>{project.contractNumber} • {project.name}</Text></Pressable>)}</View>
        {selectedProject ? <View style={styles.progressRow}><Text style={styles.title}>{selectedProject.name}</Text><StatusPill label={`${progress}% concluído`} tone={progress === 100 ? 'success' : 'warning'} /></View> : null}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Nova tarefa</Text>
        <Field label="Título *" onChangeText={setTitle} value={title} />
        <Field label="Descrição" multiline onChangeText={setDescription} value={description} />
        <SelectionChips label="Prioridade" items={priorities} onChange={setPriority} value={priority} />
        <View style={styles.twoColumns}><Field label="Início (AAAA-MM-DD)" onChangeText={setStartDate} value={startDate} /><Field label="Prazo (AAAA-MM-DD)" onChangeText={setDueDate} value={dueDate} /><Field keyboardType="decimal-pad" label="Horas previstas" onChangeText={setHours} value={hours} /></View>
        {tasks.length ? <><Text style={styles.label}>Subtarefa de</Text><View style={styles.chips}><Pressable onPress={() => setParentTaskId(null)} style={[styles.chip, !parentTaskId && styles.selected]}><Text style={styles.chipText}>Nenhuma</Text></Pressable>{tasks.filter((task) => !task.parentTaskId).map((task) => <Pressable key={task.id} onPress={() => setParentTaskId(task.id)} style={[styles.chip, parentTaskId === task.id && styles.selected]}><Text style={styles.chipText}>{task.title}</Text></Pressable>)}</View>
        <Text style={styles.label}>Depende de</Text><View style={styles.chips}><Pressable onPress={() => setDependencyId(null)} style={[styles.chip, !dependencyId && styles.selected]}><Text style={styles.chipText}>Nenhuma</Text></Pressable>{tasks.filter((task) => task.status !== 'cancelled').map((task) => <Pressable key={task.id} onPress={() => setDependencyId(task.id)} style={[styles.chip, dependencyId === task.id && styles.selected]}><Text style={styles.chipText}>{task.title}</Text></Pressable>)}</View></> : null}
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: clientVisible }} onPress={() => setClientVisible((current) => !current)} style={[styles.toggle, clientVisible && styles.selected]}><Text style={styles.toggleText}>{clientVisible ? '☒ Visível no portal do cliente' : '☐ Manter somente na administração'}</Text></Pressable>
        <Button loading={loading} onPress={() => void create()} title="Criar tarefa" />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Modelos reutilizáveis</Text>
        <Field label="Salvar tarefas atuais como modelo" onChangeText={setTemplateName} value={templateName} />
        <Button onPress={() => void saveTemplate()} title="Salvar modelo" variant="secondary" />
        {templates.map((template) => <View key={template.id} style={styles.template}><View style={{ flex: 1 }}><Text style={styles.title}>{template.name}</Text><Text style={styles.meta}>{template.itemCount} tarefa(s)</Text></View><Button onPress={() => void applyTemplate(template.id)} title="Aplicar" variant="ghost" /></View>)}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Quadro e linha do tempo</Text>
        {tasks.length === 0 ? <StateView icon="checkbox-outline" title="Nenhuma tarefa" description="Crie tarefas manualmente ou aplique um modelo." /> : tasks.map((task) => {
          const blocked = task.dependencyIds.some((id) => tasks.find((item) => item.id === id)?.status !== 'done');
          return <View key={task.id} style={[styles.task, task.parentTaskId && styles.subtask]}>
            <View style={styles.progressRow}><View style={{ flex: 1 }}><Text style={styles.title}>{task.parentTaskId ? '↳ ' : ''}{task.title}</Text><Text style={styles.meta}>{task.startDate ? formatDate(task.startDate) : 'Sem início'} → {task.dueDate ? formatDate(task.dueDate) : 'Sem prazo'} • {task.estimatedHours ?? '—'} h</Text><Text style={styles.meta}>{task.dependencyIds.length ? `${task.dependencyIds.length} dependência(s)` : 'Sem dependência'} • {task.clientVisible ? 'cliente acompanha' : 'interno'}</Text></View><StatusPill label={blocked && task.status !== 'done' ? 'aguarda dependência' : statuses.find((item) => item.value === task.status)?.label ?? task.status} tone={task.status === 'done' ? 'success' : blocked ? 'danger' : 'warning'} /></View>
            <View style={styles.actions}>{statuses.filter((status) => status.value !== task.status).map((status) => <Button key={status.value} onPress={() => void changeStatus(task, status.value)} title={status.label} variant="ghost" />)}</View>
            <Button onPress={() => void toggleVisible(task)} title={task.clientVisible ? 'Ocultar do cliente' : 'Compartilhar com cliente'} variant="secondary" />
          </View>;
        })}
      </Card>
      <Button loading={loading} onPress={() => void loadTasks()} title="Atualizar tarefas" variant="secondary" />
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  sectionTitle: { color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '700', fontFamily: typography.family },
  title: { color: colors.ink, fontSize: 14, fontWeight: '700', fontFamily: typography.family },
  label: { color: colors.ink, fontSize: 13, fontWeight: '700', fontFamily: typography.family },
  meta: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 3, fontFamily: typography.family },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 8 },
  selected: { borderColor: colors.gold500, backgroundColor: colors.warningSoft },
  chipText: { color: colors.slate, fontSize: 11, fontFamily: typography.family },
  selectedText: { color: colors.gold600, fontWeight: '700' },
  twoColumns: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  toggle: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.sm },
  toggleText: { color: colors.ink, fontSize: 12, fontFamily: typography.family },
  progressRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  template: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm },
  task: { gap: spacing.xs, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm },
  subtask: { marginLeft: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.gold500, paddingLeft: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
});
