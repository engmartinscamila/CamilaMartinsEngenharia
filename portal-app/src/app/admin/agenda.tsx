import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { AdminPageHeader } from '@/components/admin-ui';
import { Button, Card, Field, Notice, Screen, StateView, StatusPill } from '@/components/ui';
import { formatDate, formatTime, humanizeStatus, isValidIsoDate, isValidTime } from '@/lib/format';
import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import { cancelAdminAgenda, createAdminAgenda, listAdminAgenda, listAdminProjects } from '@/services/admin-service';
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';
import type { AdminProjectSummary, AgendaSummary } from '@/types/domain';

export default function AdminAgendaScreen() {
  const [projects, setProjects] = useState<AdminProjectSummary[]>([]);
  const [items, setItems] = useState<AgendaSummary[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { colors } = useAppTheme();
  const styles = useThemeStyles(styleDefinitions);

  const load = useCallback(async () => {
    setLoading(true);
    const [projectResult, agendaResult] = await Promise.all([listAdminProjects(), listAdminAgenda()]);
    setProjects(projectResult.data); setItems(agendaResult.data);
    setProjectId((current) => current ?? projectResult.data[0]?.id ?? null);
    setError(projectResult.error ?? agendaResult.error); setLoading(false);
  }, []);

  useEffect(() => { const task = setTimeout(() => void load(), 0); return () => clearTimeout(task); }, [load]);

  const create = async () => {
    setError(null); setSuccess(null);
    const project = projects.find((item) => item.id === projectId);
    if (!project || title.trim().length < 3 || !isValidIsoDate(date) || (time && !isValidTime(time))) {
      setError('Selecione o projeto e informe uma data e um horário válidos.'); return;
    }
    setSaving(true);
    const result = await createAdminAgenda({ project, title, date, time, description });
    setSaving(false);
    if (result) setError(result); else { setSuccess('Compromisso criado.'); setTitle(''); setDate(''); setTime(''); setDescription(''); await load(); }
  };

  const cancel = async (id: string) => {
    setSaving(true); setError(null); setSuccess(null); const result = await cancelAdminAgenda(id); setSaving(false);
    if (result) setError(result); else { setSuccess('Compromisso cancelado.'); await load(); }
  };

  return (
    <Screen>
      <AdminPageHeader description="Crie e cancele compromissos vinculados a contratos e projetos." title="Agenda administrativa" />
      {error ? <Notice tone="danger">{error}</Notice> : null}{success ? <Notice tone="success">{success}</Notice> : null}
      <Card>
        <Text style={styles.sectionTitle}>Novo compromisso</Text>
        <View style={styles.projectList}>{projects.map((project) => <Pressable key={project.id} onPress={() => setProjectId(project.id)} style={[styles.projectChip, projectId === project.id && styles.selected]}><Text style={[styles.projectText, projectId === project.id && styles.selectedText]}>{project.contractNumber} • {project.name}</Text></Pressable>)}</View>
        <Field label="Título" onChangeText={setTitle} value={title} />
        <View style={styles.row}><View style={styles.grow}><Field label="Data (AAAA-MM-DD)" maxLength={10} onChangeText={setDate} placeholder="2026-08-20" value={date} /></View><View style={styles.time}><Field label="Horário" maxLength={5} onChangeText={setTime} placeholder="14:30" value={time} /></View></View>
        <Field label="Descrição" multiline onChangeText={setDescription} value={description} />
        <Button loading={saving} onPress={() => void create()} title="Criar compromisso" />
      </Card>
      {loading ? <ActivityIndicator color={colors.gold600} /> : null}
      {!loading && items.length === 0 ? <StateView description="Nenhum compromisso cadastrado." icon="calendar-outline" title="Agenda vazia" /> : null}
      {items.map((item) => (
        <Card key={item.id}>
          <View style={styles.header}><View style={{ flex: 1 }}><Text style={styles.title}>{item.title}</Text><Text style={styles.meta}>{formatDate(item.date)}{formatTime(item.startTime) ? ` • ${formatTime(item.startTime)}` : ''}</Text></View><StatusPill label={item.cancelled ? 'Cancelado' : humanizeStatus(item.invitationStatus)} tone={item.cancelled ? 'danger' : item.invitationStatus === 'accepted' ? 'success' : 'warning'} /></View>
          {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
          {!item.cancelled ? <Button loading={saving} onPress={() => void cancel(item.id)} title="Cancelar compromisso" variant="danger" /> : null}
        </Card>
      ))}
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  sectionTitle: { color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '700', fontFamily: typography.family },
  projectList: { gap: spacing.xs }, projectChip: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.sm }, selected: { borderColor: colors.gold500, backgroundColor: colors.warningSoft },
  projectText: { color: colors.slate, fontSize: 12, fontFamily: typography.family }, selectedText: { color: colors.gold600, fontWeight: '700' },
  row: { flexDirection: 'row', gap: spacing.sm }, grow: { flex: 1 }, time: { width: 105 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, title: { color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '700', fontFamily: typography.family },
  meta: { color: colors.muted, fontSize: 12, marginTop: 4, fontFamily: typography.family }, description: { color: colors.slate, fontSize: 13, lineHeight: 19, fontFamily: typography.family },
});
