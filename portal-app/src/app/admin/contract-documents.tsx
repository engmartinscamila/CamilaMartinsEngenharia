import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { AdminPageHeader } from '@/components/admin-ui';
import { Button, Card, Notice, Screen, StateView, StatusPill } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import { listAdminProjects } from '@/services/admin-service';
import {
  CONTRACT_DOCUMENT_OPTIONS,
  CONTRACT_SCOPE_PRESETS,
  generateContractDocument,
  generateFormalNotice,
  listAdminDocumentAttention,
  listContractScope,
  listProjectApprovals,
  listProjectContractDocuments,
  prepareContractDocument,
  prepareFormalNotice,
  sendContractDocument,
  sendFormalNotice,
  setContractScopeItem,
  type ContractDocumentKind,
  type ContractDocumentSummary,
  type ContractScopeItem,
  type DocumentAttentionItem,
  type ProjectApprovalItem,
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
  const [approvals, setApprovals] = useState<ProjectApprovalItem[]>([]);
  const [documents, setDocuments] = useState<ContractDocumentSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedProject = useMemo(() => projects.find((item) => item.id === projectId) ?? null, [projectId, projects]);
  const scopeByCode = useMemo(() => new Map(scope.map((item) => [item.serviceCode, item])), [scope]);
  const relevantAttention = useMemo(() => attention.filter((item) => item.projectId === projectId && item.attentionLevel !== 'normal'), [attention, projectId]);
  const preliminaryIncluded = scopeByCode.get('a')?.included === true;

  const loadBase = useCallback(async () => {
    setLoading(true);
    const [projectResult, attentionResult] = await Promise.all([listAdminProjects(), listAdminDocumentAttention()]);
    setProjects(projectResult.data);
    setProjectId((current) => current ?? projectResult.data[0]?.id ?? null);
    setAttention(attentionResult.data);
    setError(projectResult.error ?? attentionResult.error);
    setLoading(false);
  }, []);

  const loadProjectData = useCallback(async () => {
    if (!selectedProject?.contractId || !selectedProject.id) { setScope([]); setApprovals([]); setDocuments([]); return; }
    const [scopeResult, approvalResult, documentResult] = await Promise.all([
      listContractScope(selectedProject.contractId), listProjectApprovals(selectedProject.id), listProjectContractDocuments(selectedProject.id),
    ]);
    setScope(scopeResult.data); setApprovals(approvalResult.data); setDocuments(documentResult.data);
    if (scopeResult.error || approvalResult.error || documentResult.error) setError(scopeResult.error ?? approvalResult.error ?? documentResult.error);
  }, [selectedProject?.contractId, selectedProject?.id]);

  useEffect(() => { const task = setTimeout(() => void loadBase(), 0); return () => clearTimeout(task); }, [loadBase]);
  useEffect(() => { const task = setTimeout(() => void loadProjectData(), 0); return () => clearTimeout(task); }, [loadProjectData]);

  const toggleScope = async (code: string, name: string, order: number) => {
    if (!selectedProject?.contractId) return;
    const current = scopeByCode.get(code)?.included === true;
    setSavingKey(`scope-${code}`); setError(null); setSuccess(null);
    const saveError = await setContractScopeItem({ contractId: selectedProject.contractId, serviceCode: code, serviceName: name, included: !current, displayOrder: order + 1 });
    setSavingKey(null);
    if (saveError) setError(saveError); else { setSuccess(!current ? `${name} incluído no escopo.` : `${name} marcado como não contratado.`); await loadProjectData(); }
  };

  const prepare = async (kind: Exclude<ContractDocumentKind, 'notificacao_formal'>, approvalId?: string) => {
    if (!selectedProject) return;
    setSavingKey(`prepare-${kind}-${approvalId ?? ''}`); setError(null); setSuccess(null);
    const result = await prepareContractDocument({ projectId: selectedProject.id, kind, approvalId: approvalId ?? null });
    setSavingKey(null);
    if (result.error) setError(result.error); else { setSuccess('Rascunho preparado. O Word pode ser gerado e editado antes do envio.'); await loadProjectData(); }
  };

  const actOnDocument = async (item: ContractDocumentSummary) => {
    setSavingKey(`doc-${item.id}`); setError(null); setSuccess(null);
    let actionError: string | null = null;
    if (item.status === 'rascunho') { actionError = await generateContractDocument(item.id); if (!actionError) setSuccess('Word editável gerado e salvo em Documentos.'); }
    else if (item.status === 'gerado') { actionError = await sendContractDocument(item.id); if (!actionError) setSuccess('Documento disponibilizado ao cliente e registrado no histórico.'); }
    setSavingKey(null);
    if (actionError) setError(actionError); else await loadProjectData();
  };

  const actOnNotice = async (item: DocumentAttentionItem) => {
    setSavingKey(item.approvalId); setError(null); setSuccess(null);
    let actionError: string | null = null;
    if (!item.formalNoticeDocumentId) {
      const result = await prepareFormalNotice(item.approvalId); actionError = result.error;
      if (!actionError) setSuccess('Rascunho da Notificação Formal preparado. Revise e gere o Word antes do envio.');
    } else if (item.formalNoticeStatus === 'rascunho') {
      actionError = await generateFormalNotice(item.formalNoticeDocumentId); if (!actionError) setSuccess('Word editável da Notificação Formal gerado.');
    } else if (item.formalNoticeStatus === 'gerado') {
      actionError = await sendFormalNotice(item.formalNoticeDocumentId); if (!actionError) setSuccess('Notificação Formal disponibilizada ao cliente.');
    }
    setSavingKey(null); if (actionError) setError(actionError); else { await loadBase(); await loadProjectData(); }
  };

  const documentActionTitle = (status: string) => status === 'rascunho' ? 'Gerar Word editável' : status === 'gerado' ? 'Enviar ao cliente' : status === 'enviado' ? 'Enviado ao cliente' : 'Sem ação pendente';
  const noticeActionTitle = (item: DocumentAttentionItem) => !item.formalNoticeDocumentId ? 'Preparar Notificação Formal' : item.formalNoticeStatus === 'rascunho' ? 'Gerar Word editável' : item.formalNoticeStatus === 'gerado' ? 'Enviar ao cliente' : 'Notificação enviada';

  return (
    <Screen>
      <AdminPageHeader title="Documentos contratuais" description="Gere somente os documentos aplicáveis ao contrato. Documentos opcionais nunca viram pendência automática por existirem no sistema." />
      {error ? <Notice tone="danger">{error}</Notice> : null}{success ? <Notice tone="success">{success}</Notice> : null}{loading ? <ActivityIndicator color={colors.gold600} /> : null}

      <Card><Text style={styles.sectionTitle}>Contrato / projeto</Text><View style={styles.projectList}>{projects.map((project) => <Pressable key={project.id} onPress={() => setProjectId(project.id)} style={[styles.projectChip, projectId === project.id && styles.selected]}><Text style={[styles.projectText, projectId === project.id && styles.selectedText]}>{project.contractNumber} • {project.name}</Text></Pressable>)}</View></Card>

      {selectedProject?.contractId ? <Card><Text style={styles.sectionTitle}>Serviços efetivamente contratados</Text><Text style={styles.help}>Marque somente o que integra o Anexo I. Itens não marcados continuam fora do escopo.</Text><View style={styles.scopeList}>{CONTRACT_SCOPE_PRESETS.map(([code, name], index) => { const included = scopeByCode.get(code)?.included === true; return <Pressable disabled={savingKey === `scope-${code}`} key={code} onPress={() => void toggleScope(code, name, index)} style={[styles.scopeRow, included && styles.scopeIncluded]}><Text style={styles.scopeMark}>{included ? '☒' : '☐'}</Text><View style={{ flex: 1 }}><Text style={styles.scopeName}>({code}) {name}</Text><Text style={styles.scopeMeta}>{included ? 'Contratado' : 'Não contratado / opcional'}</Text></View></Pressable>; })}</View></Card> : <Notice tone="warning">Este projeto ainda não possui vínculo moderno de contrato.</Notice>}

      <Card>
        <Text style={styles.sectionTitle}>Gerar documento</Text><Text style={styles.help}>O sistema cria primeiro um rascunho com os dados já conhecidos. Depois você gera o Word editável e decide se deseja enviá-lo ao cliente.</Text>
        {CONTRACT_DOCUMENT_OPTIONS.map((option) => {
          const disabled = option.kind === 'estudo_preliminar' && !preliminaryIncluded;
          return <View key={option.kind} style={styles.generatorRow}><View style={{ flex: 1 }}><Text style={styles.generatorTitle}>{option.title}</Text><Text style={styles.help}>{disabled ? 'Não contratado neste Anexo I.' : option.description}</Text></View><Button disabled={disabled} loading={savingKey === `prepare-${option.kind}-`} onPress={() => void prepare(option.kind)} title="Preparar" variant="secondary" /></View>;
        })}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Termos de Aceite por etapa</Text><Text style={styles.help}>O Termo de Aceite é ligado à etapa/aprovação correspondente e mantém o prazo contratual de 10 dias.</Text>
        {approvals.length === 0 ? <StateView title="Nenhuma etapa disponível" description="Crie ou entregue uma aprovação de etapa para gerar o Termo de Aceite correspondente." icon="checkmark-done-outline" /> : approvals.map((approval) => <View key={approval.id} style={styles.generatorRow}><View style={{ flex: 1 }}><Text style={styles.generatorTitle}>{approval.title}</Text><Text style={styles.help}>{approval.type} • {approval.status}{approval.deliveredAt ? ` • entregue em ${formatDate(approval.deliveredAt)}` : ''}</Text></View><Button loading={savingKey === `prepare-termo_aceite-${approval.id}`} onPress={() => void prepare('termo_aceite', approval.id)} title="Preparar Termo" variant="secondary" /></View>)}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Documentos preparados</Text>
        {documents.length === 0 ? <StateView title="Nenhum documento preparado" description="Use as opções acima para criar um rascunho." icon="document-text-outline" /> : documents.map((item) => <View key={item.id} style={styles.attentionCard}><View style={styles.attentionHeader}><View style={{ flex: 1 }}><Text style={styles.attentionTitle}>{item.title}</Text><Text style={styles.meta}>{item.optional ? 'Opcional' : 'Vinculado ao fluxo'} • criado em {formatDate(item.createdAt)}</Text></View><StatusPill label={item.status} tone={item.status === 'enviado' || item.status === 'aceito' ? 'success' : item.status === 'rascunho' ? 'warning' : 'neutral'} /></View><Button disabled={!['rascunho', 'gerado'].includes(item.status)} loading={savingKey === `doc-${item.id}`} onPress={() => void actOnDocument(item)} title={documentActionTitle(item.status)} variant={item.status === 'gerado' ? 'primary' : 'secondary'} /></View>)}
      </Card>

      <Card><Text style={styles.sectionTitle}>Pendências que exigem sua atenção</Text><Text style={styles.help}>O alerta começa quando faltam 3 dias para completar os 10 dias corridos. A Notificação Formal nunca é enviada automaticamente.</Text>{relevantAttention.length === 0 ? <StateView icon="checkmark-circle-outline" title="Nenhuma aprovação atrasada" description="Não há providência contratual pendente para este projeto." /> : null}{relevantAttention.map((item) => <View key={item.approvalId} style={styles.attentionCard}><View style={styles.attentionHeader}><View style={{ flex: 1 }}><Text style={styles.attentionTitle}>{item.approvalTitle}</Text><Text style={styles.meta}>{item.clientName} • {item.contractNumber}</Text></View><StatusPill label={item.attentionLevel === 'overdue' ? 'Prazo vencido' : 'Prazo próximo'} tone={item.attentionLevel === 'overdue' ? 'danger' : 'warning'} /></View><Text style={styles.body}>Entrega: {formatDate(item.deliveredAt)} • limite: {formatDate(item.dueAt)}</Text><Text style={styles.body}>{item.attentionLevel === 'overdue' ? `${Math.abs(item.daysRemaining)} dia(s) além do prazo.` : `${item.daysRemaining} dia(s) para o término do prazo.`}</Text><Button disabled={item.formalNoticeStatus === 'enviado'} loading={savingKey === item.approvalId} onPress={() => void actOnNotice(item)} title={noticeActionTitle(item)} variant={item.formalNoticeStatus === 'gerado' ? 'primary' : 'secondary'} /></View>)}</Card>
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  sectionTitle: { color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '700', fontFamily: typography.family }, help: { color: colors.slate, fontSize: 12, lineHeight: 18, fontFamily: typography.family },
  projectList: { gap: spacing.xs }, projectChip: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.sm }, selected: { borderColor: colors.gold500, backgroundColor: colors.warningSoft }, projectText: { color: colors.slate, fontSize: 12, fontFamily: typography.family }, selectedText: { color: colors.gold600, fontWeight: '700' },
  scopeList: { gap: spacing.xs }, scopeRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.sm }, scopeIncluded: { borderColor: colors.gold500, backgroundColor: colors.warningSoft }, scopeMark: { color: colors.gold600, fontSize: 18, fontFamily: typography.family }, scopeName: { color: colors.ink, fontSize: 13, fontWeight: '700', fontFamily: typography.family }, scopeMeta: { color: colors.muted, fontSize: 11, marginTop: 2, fontFamily: typography.family },
  generatorRow: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm, gap: spacing.sm }, generatorTitle: { color: colors.ink, fontSize: 13, fontWeight: '700', fontFamily: typography.family },
  attentionCard: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm, gap: spacing.xs }, attentionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, attentionTitle: { color: colors.ink, fontSize: 14, fontWeight: '700', fontFamily: typography.family }, meta: { color: colors.muted, fontSize: 11, marginTop: 3, fontFamily: typography.family }, body: { color: colors.slate, fontSize: 12, lineHeight: 18, fontFamily: typography.family },
});
