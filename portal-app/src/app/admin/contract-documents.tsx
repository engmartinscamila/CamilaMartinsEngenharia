import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { AdminPageHeader } from '@/components/admin-ui';
import { Button, Card, Notice, Screen, StateView, StatusPill } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import { listAdminProjects } from '@/services/admin-service';
import {
  CONTRACT_SCOPE_PRESETS,
  generateFormalNotice,
  listAdminDocumentAttention,
  listContractScope,
  prepareFormalNotice,
  sendFormalNotice,
  setContractScopeItem,
  type ContractScopeItem,
  type DocumentAttentionItem,
} from '@/services/document-workflow-service';
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';
import type { AdminProjectSummary } from '@/types/domain';

export default function AdminContractDocumentsScreen() {
  const { colors } = useAppTheme();
  const styles = useThemeStyles(styleDefinitions);
  const [projects, setProjects] = useState<AdminProjectSummary[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [scope, setScope] = useState<ContractScopeItem[]>([]);
  const [attention, setAttention] = useState<DocumentAttentionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedProject = useMemo(() => projects.find((item) => item.id === projectId) ?? null, [projectId, projects]);
  const scopeByCode = useMemo(() => new Map(scope.map((item) => [item.serviceCode, item])), [scope]);
  const relevantAttention = useMemo(() => attention.filter((item) => item.projectId === projectId && item.attentionLevel !== 'normal'), [attention, projectId]);

  const loadBase = useCallback(async () => {
    setLoading(true);
    const [projectResult, attentionResult] = await Promise.all([listAdminProjects(), listAdminDocumentAttention()]);
    setProjects(projectResult.data);
    setProjectId((current) => current ?? projectResult.data[0]?.id ?? null);
    setAttention(attentionResult.data);
    setError(projectResult.error ?? attentionResult.error);
    setLoading(false);
  }, []);

  const loadScope = useCallback(async () => {
    if (!selectedProject?.contractId) { setScope([]); return; }
    const result = await listContractScope(selectedProject.contractId);
    setScope(result.data);
    if (result.error) setError(result.error);
  }, [selectedProject?.contractId]);

  useEffect(() => { const task = setTimeout(() => void loadBase(), 0); return () => clearTimeout(task); }, [loadBase]);
  useEffect(() => { const task = setTimeout(() => void loadScope(), 0); return () => clearTimeout(task); }, [loadScope]);

  const toggleScope = async (code: string, name: string, order: number) => {
    if (!selectedProject?.contractId) return;
    const current = scopeByCode.get(code)?.included === true;
    setSavingKey(`scope-${code}`); setError(null); setSuccess(null);
    const saveError = await setContractScopeItem({ contractId: selectedProject.contractId, serviceCode: code, serviceName: name, included: !current, displayOrder: order + 1 });
    setSavingKey(null);
    if (saveError) setError(saveError); else { setSuccess(!current ? `${name} incluído no escopo.` : `${name} marcado como não contratado.`); await loadScope(); }
  };

  const actOnNotice = async (item: DocumentAttentionItem) => {
    setSavingKey(item.approvalId); setError(null); setSuccess(null);
    let actionError: string | null = null;
    if (!item.formalNoticeDocumentId) {
      const result = await prepareFormalNotice(item.approvalId);
      actionError = result.error;
      if (!actionError) setSuccess('Rascunho da Notificação Formal preparado. Revise e gere o Word antes do envio.');
    } else if (item.formalNoticeStatus === 'rascunho') {
      actionError = await generateFormalNotice(item.formalNoticeDocumentId);
      if (!actionError) setSuccess('Word editável da Notificação Formal gerado e salvo em Documentos.');
    } else if (item.formalNoticeStatus === 'gerado') {
      actionError = await sendFormalNotice(item.formalNoticeDocumentId);
      if (!actionError) setSuccess('Notificação Formal disponibilizada ao cliente e registrada no histórico.');
    }
    setSavingKey(null);
    if (actionError) setError(actionError); else await loadBase();
  };

  const actionTitle = (item: DocumentAttentionItem) => {
    if (!item.formalNoticeDocumentId) return 'Preparar Notificação Formal';
    if (item.formalNoticeStatus === 'rascunho') return 'Gerar Word editável';
    if (item.formalNoticeStatus === 'gerado') return 'Enviar ao cliente';
    if (item.formalNoticeStatus === 'enviado') return 'Notificação enviada';
    return 'Atualizar documento';
  };

  return (
    <Screen>
      <AdminPageHeader title="Documentos contratuais" description="Escopo opcional, aprovações e providências contratuais sem transformar documentos eventuais em etapas obrigatórias." />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}
      {loading ? <ActivityIndicator color={colors.gold600} /> : null}

      <Card>
        <Text style={styles.sectionTitle}>Contrato / projeto</Text>
        <View style={styles.projectList}>
          {projects.map((project) => (
            <Pressable key={project.id} onPress={() => setProjectId(project.id)} style={[styles.projectChip, projectId === project.id && styles.selected]}>
              <Text style={[styles.projectText, projectId === project.id && styles.selectedText]}>{project.contractNumber} • {project.name}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      {selectedProject?.contractId ? (
        <Card>
          <Text style={styles.sectionTitle}>Serviços efetivamente contratados</Text>
          <Text style={styles.help}>Marque somente o que integra o Anexo I. Itens não marcados continuam opcionais e não geram pendência automática.</Text>
          <View style={styles.scopeList}>
            {CONTRACT_SCOPE_PRESETS.map(([code, name], index) => {
              const included = scopeByCode.get(code)?.included === true;
              return (
                <Pressable disabled={savingKey === `scope-${code}`} key={code} onPress={() => void toggleScope(code, name, index)} style={[styles.scopeRow, included && styles.scopeIncluded]}>
                  <Text style={styles.scopeMark}>{included ? '☒' : '☐'}</Text>
                  <View style={{ flex: 1 }}><Text style={styles.scopeName}>({code}) {name}</Text><Text style={styles.scopeMeta}>{included ? 'Contratado' : 'Não contratado / opcional'}</Text></View>
                </Pressable>
              );
            })}
          </View>
        </Card>
      ) : <Notice tone="warning">Este projeto ainda não possui vínculo moderno de contrato. O escopo não pode ser automatizado até a regularização desse vínculo.</Notice>}

      <Card>
        <Text style={styles.sectionTitle}>Pendências que exigem sua atenção</Text>
        <Text style={styles.help}>O alerta começa quando faltam 3 dias para completar os 10 dias corridos de manifestação. A Notificação Formal nunca é enviada automaticamente.</Text>
        {relevantAttention.length === 0 ? <StateView icon="checkmark-circle-outline" title="Nenhuma aprovação atrasada" description="Não há providência contratual pendente para este projeto." /> : null}
        {relevantAttention.map((item) => (
          <View key={item.approvalId} style={styles.attentionCard}>
            <View style={styles.attentionHeader}>
              <View style={{ flex: 1 }}><Text style={styles.attentionTitle}>{item.approvalTitle}</Text><Text style={styles.meta}>{item.clientName} • {item.contractNumber}</Text></View>
              <StatusPill label={item.attentionLevel === 'overdue' ? 'Prazo vencido' : 'Prazo próximo'} tone={item.attentionLevel === 'overdue' ? 'danger' : 'warning'} />
            </View>
            <Text style={styles.body}>Entrega: {formatDate(item.deliveredAt)} • limite: {formatDate(item.dueAt)}</Text>
            <Text style={styles.body}>{item.attentionLevel === 'overdue' ? `${Math.abs(item.daysRemaining)} dia(s) além do prazo.` : `${item.daysRemaining} dia(s) para o término do prazo.`}</Text>
            <Button disabled={item.formalNoticeStatus === 'enviado'} loading={savingKey === item.approvalId} onPress={() => void actOnNotice(item)} title={actionTitle(item)} variant={item.formalNoticeStatus === 'gerado' ? 'primary' : 'secondary'} />
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  sectionTitle: { color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '700', fontFamily: typography.family },
  help: { color: colors.slate, fontSize: 12, lineHeight: 18, fontFamily: typography.family },
  projectList: { gap: spacing.xs },
  projectChip: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.sm },
  selected: { borderColor: colors.gold500, backgroundColor: colors.warningSoft },
  projectText: { color: colors.slate, fontSize: 12, fontFamily: typography.family },
  selectedText: { color: colors.gold600, fontWeight: '700' },
  scopeList: { gap: spacing.xs },
  scopeRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.sm },
  scopeIncluded: { borderColor: colors.gold500, backgroundColor: colors.warningSoft },
  scopeMark: { color: colors.gold600, fontSize: 18, fontFamily: typography.family },
  scopeName: { color: colors.ink, fontSize: 13, fontWeight: '700', fontFamily: typography.family },
  scopeMeta: { color: colors.muted, fontSize: 11, marginTop: 2, fontFamily: typography.family },
  attentionCard: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm, gap: spacing.xs },
  attentionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  attentionTitle: { color: colors.ink, fontSize: 14, fontWeight: '700', fontFamily: typography.family },
  meta: { color: colors.muted, fontSize: 11, marginTop: 3, fontFamily: typography.family },
  body: { color: colors.slate, fontSize: 12, lineHeight: 18, fontFamily: typography.family },
});
