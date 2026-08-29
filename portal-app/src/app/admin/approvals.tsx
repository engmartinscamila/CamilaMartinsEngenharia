import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { AdminPageHeader } from '@/components/admin-ui';
import { Button, Card, Field, Notice, Screen, StateView, StatusPill } from '@/components/ui';
import { formatDate, humanizeStatus } from '@/lib/format';
import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import { createAdminApproval, listAdminApprovals, listAdminProjects } from '@/services/admin-service';
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';
import type { AdminProjectSummary, ApprovalSummary } from '@/types/domain';

export default function AdminApprovalsScreen() {
  const [projects, setProjects] = useState<AdminProjectSummary[]>([]); const [items, setItems] = useState<ApprovalSummary[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null); const [type, setType] = useState('Projeto'); const [title, setTitle] = useState(''); const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null); const [success, setSuccess] = useState<string | null>(null);
  const { colors } = useAppTheme(); const styles = useThemeStyles(styleDefinitions);
  const load = useCallback(async () => { setLoading(true); const [p, a] = await Promise.all([listAdminProjects(), listAdminApprovals()]); setProjects(p.data); setItems(a.data); setProjectId((current) => current ?? p.data[0]?.id ?? null); setError(p.error ?? a.error); setLoading(false); }, []);
  useEffect(() => { const task = setTimeout(() => void load(), 0); return () => clearTimeout(task); }, [load]);
  const create = async () => { const project = projects.find((item) => item.id === projectId); if (!project || type.trim().length < 2 || title.trim().length < 3) { setError('Selecione o projeto e preencha tipo e título.'); return; } setSaving(true); setError(null); setSuccess(null); const result = await createAdminApproval({ project, type, title, description }); setSaving(false); if (result) setError(result); else { setSuccess('Aprovação enviada ao cliente.'); setTitle(''); setDescription(''); await load(); } };
  return (
    <Screen>
      <AdminPageHeader description="Envie decisões vinculadas ao projeto e acompanhe o histórico da resposta." title="Aprovações" />
      {error ? <Notice tone="danger">{error}</Notice> : null}{success ? <Notice tone="success">{success}</Notice> : null}
      <Card><Text style={styles.sectionTitle}>Nova aprovação</Text><View style={styles.projectList}>{projects.map((project) => <Pressable key={project.id} onPress={() => setProjectId(project.id)} style={[styles.projectChip, projectId === project.id && styles.selected]}><Text style={[styles.projectText, projectId === project.id && styles.selectedText]}>{project.contractNumber} • {project.name}</Text></Pressable>)}</View><Field label="Tipo" onChangeText={setType} placeholder="Ex.: Layout, material, projeto" value={type} /><Field label="Título" onChangeText={setTitle} value={title} /><Field label="Descrição do que deve ser avaliado" multiline onChangeText={setDescription} style={styles.descriptionField} value={description} /><Button loading={saving} onPress={() => void create()} title="Enviar para aprovação" /></Card>
      {loading ? <ActivityIndicator color={colors.gold600} /> : null}{!loading && items.length === 0 ? <StateView description="Nenhuma aprovação cadastrada." icon="checkmark-done-outline" title="Sem aprovações" /> : null}
      {items.map((item) => <Card key={item.id}><View style={styles.header}><View style={{ flex: 1 }}><Text style={styles.type}>{item.type.toUpperCase()}</Text><Text style={styles.title}>{item.title}</Text><Text style={styles.meta}>{formatDate(item.createdAt)}</Text></View><StatusPill label={humanizeStatus(item.status)} tone={item.status === 'aprovado' ? 'success' : item.status === 'rejeitado' ? 'danger' : 'warning'} /></View>{item.description ? <Text style={styles.description}>{item.description}</Text> : null}{item.status !== 'aguardando' ? <Notice tone={item.status === 'aprovado' ? 'success' : 'warning'}>{item.comment || 'Resposta registrada sem comentário.'}</Notice> : null}</Card>)}
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  sectionTitle: { color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '700', fontFamily: typography.family }, projectList: { gap: spacing.xs }, projectChip: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.sm }, selected: { borderColor: colors.gold500, backgroundColor: colors.warningSoft }, projectText: { color: colors.slate, fontSize: 12, fontFamily: typography.family }, selectedText: { color: colors.gold600, fontWeight: '700' }, descriptionField: { minHeight: 92, textAlignVertical: 'top' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, type: { color: colors.gold600, fontSize: 10, fontWeight: '700', letterSpacing: 1, fontFamily: typography.family }, title: { color: colors.ink, fontSize: typography.size.bodyLarge, marginTop: 3, fontWeight: '700', fontFamily: typography.family }, meta: { color: colors.muted, fontSize: 11, marginTop: 4, fontFamily: typography.family }, description: { color: colors.slate, fontSize: 13, lineHeight: 19, fontFamily: typography.family },
});
