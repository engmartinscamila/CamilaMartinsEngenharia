import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { AdminPageHeader } from '@/components/admin-ui';
import { Button, Card, Notice, Screen, StateView, StatusPill } from '@/components/ui';
import { listAdminProjects } from '@/services/admin-service';
import { listAdminDocumentAlerts, listAdminDocumentMap, releaseDocumentForClient, type AdminDocumentAlertItem, type AdminDocumentMapItem } from '@/services/document-governance-service';
import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';
import type { AdminProjectSummary } from '@/types/domain';

const labels: Record<string, string> = {
  nao_gerado: 'Não gerado', preparado: 'Preparado', emitido: 'Emitido', liberado_cliente: 'Liberado ao cliente', aguardando_aceite: 'Aguardando aceite', aceito: 'Aceito', aceito_com_ressalvas: 'Aceito com ressalvas', recusado: 'Recusado', substituido: 'Substituído', expirado: 'Expirado',
};

export default function AdminDocumentGovernanceScreen() {
  const { colors } = useAppTheme();
  const styles = useThemeStyles(styleDefinitions);
  const [projects, setProjects] = useState<AdminProjectSummary[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [map, setMap] = useState<AdminDocumentMapItem[]>([]);
  const [alerts, setAlerts] = useState<AdminDocumentAlertItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const selectedProject = useMemo(() => projects.find((item) => item.id === projectId) ?? null, [projectId, projects]);

  const loadProjects = useCallback(async () => {
    const result = await listAdminProjects();
    setProjects(result.data);
    setProjectId((current) => current ?? result.data[0]?.id ?? null);
    setError(result.error);
  }, []);

  const load = useCallback(async () => {
    if (!projectId) { setMap([]); setAlerts([]); return; }
    setLoading(true); setError(null);
    const [mapResult, alertResult] = await Promise.all([listAdminDocumentMap(projectId), listAdminDocumentAlerts(projectId)]);
    setMap(mapResult.data); setAlerts(alertResult.data); setError(mapResult.error ?? alertResult.error); setLoading(false);
  }, [projectId]);

  useEffect(() => { const task = setTimeout(() => void loadProjects(), 0); return () => clearTimeout(task); }, [loadProjects]);
  useEffect(() => { const task = setTimeout(() => void load(), 0); return () => clearTimeout(task); }, [load]);

  const release = async (item: AdminDocumentMapItem, acceptanceRequired: boolean) => {
    if (!item.documentId) return;
    setSaving(item.documentId); setError(null); setSuccess(null);
    const actionError = await releaseDocumentForClient(item.documentId, acceptanceRequired);
    setSaving(null);
    if (actionError) setError(actionError); else { setSuccess(acceptanceRequired ? 'Documento liberado ao cliente com aceite obrigatório.' : 'Documento liberado ao cliente para consulta.'); await load(); }
  };

  return (
    <Screen>
      <AdminPageHeader title="Governança documental" description="Mapa por projeto, aceites do cliente, validade, substituições e pendências documentais." />
      {error ? <Notice tone="danger">{error}</Notice> : null}{success ? <Notice tone="success">{success}</Notice> : null}
      <Card><Text style={styles.sectionTitle}>Projeto</Text><View style={styles.projectList}>{projects.map((project) => <Pressable key={project.id} onPress={() => setProjectId(project.id)} style={[styles.projectChip, projectId === project.id && styles.selected]}><Text style={[styles.projectText, projectId === project.id && styles.selectedText]}>{project.contractNumber} • {project.name}</Text></Pressable>)}</View></Card>
      {loading ? <ActivityIndicator color={colors.gold600} /> : null}
      {selectedProject ? <Card><Text style={styles.sectionTitle}>Mapa documental</Text><Text style={styles.help}>Uma versão aceita não transfere o aceite para uma nova versão.</Text>{map.length === 0 ? <StateView icon="documents-outline" title="Nenhum item" description="Não foi possível montar o mapa documental deste projeto." /> : map.map((item) => <View key={item.documentKind} style={styles.row}><View style={styles.rowHead}><View style={{ flex: 1 }}><Text style={styles.title}>{item.label}{item.requiredNow ? ' • necessário agora' : ''}</Text><Text style={styles.help}>{item.documentName ? `${item.documentName} • v${item.version ?? '1.0'}` : 'Nenhuma versão emitida'}</Text></View><StatusPill label={labels[item.lifecycleStatus] ?? item.lifecycleStatus} tone={item.lifecycleStatus.startsWith('aceito') ? 'success' : item.lifecycleStatus === 'recusado' || item.lifecycleStatus === 'expirado' ? 'danger' : item.lifecycleStatus === 'aguardando_aceite' ? 'warning' : 'neutral'} /></View>{item.documentId && ['emitido','liberado_cliente','aguardando_aceite'].includes(item.lifecycleStatus) ? <View style={styles.actions}><View style={styles.action}><Button loading={saving === item.documentId} onPress={() => void release(item, true)} title="Liberar + exigir aceite" /></View><View style={styles.action}><Button disabled={saving === item.documentId} onPress={() => void release(item, false)} title="Liberar sem aceite" variant="secondary" /></View></View> : null}</View>)}</Card> : null}
      <Card><Text style={styles.sectionTitle}>Pendências documentais</Text>{alerts.length === 0 ? <Notice tone="success">Nenhuma pendência documental ativa para este projeto.</Notice> : alerts.map((item) => <View key={item.id} style={styles.row}><View style={styles.rowHead}><Text style={styles.title}>{item.title}</Text><StatusPill label={item.isDue ? 'Atenção agora' : 'Programado'} tone={item.isDue ? 'danger' : 'warning'} /></View><Text style={styles.help}>{item.message}</Text><Text style={styles.help}>Data de atenção: {new Date(item.dueAt).toLocaleDateString('pt-BR')}</Text></View>)}</Card>
      <Notice tone="info">Controle avançado de validade e substituição de versões também está disponível na central web de Contratos gerais.</Notice>
      <Button loading={loading} onPress={() => void load()} title="Atualizar governança" variant="ghost" />
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  sectionTitle: { color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '700', fontFamily: typography.family },
  projectList: { gap: spacing.xs }, projectChip: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.sm }, selected: { borderColor: colors.gold500, backgroundColor: colors.warningSoft }, projectText: { color: colors.slate, fontSize: 12, fontFamily: typography.family }, selectedText: { color: colors.gold600, fontWeight: '700' },
  row: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm, marginTop: spacing.sm, gap: spacing.xs }, rowHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, title: { color: colors.ink, fontSize: 13, fontWeight: '700', fontFamily: typography.family }, help: { color: colors.slate, fontSize: 12, lineHeight: 18, fontFamily: typography.family }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, action: { minWidth: 160, flexGrow: 1, flexBasis: 0 },
});
