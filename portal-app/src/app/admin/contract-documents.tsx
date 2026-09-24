import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { AdminPageHeader } from '@/components/admin-ui';
import { Button, Card, Notice, Screen, StateView, StatusPill } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { openWebsiteAdminSection } from '@/lib/admin-navigation';
import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import { listAdminProjects } from '@/services/admin-service';
import {
  generateContractDocument,
  listAdminDocumentAttention,
  listProjectContractDocuments,
  sendContractDocument,
  type ContractDocumentSummary,
  type DocumentAttentionItem,
} from '@/services/document-workflow-service';
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';
import type { AdminProjectSummary } from '@/types/domain';

export default function AdminContractDocumentsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useThemeStyles(styleDefinitions);
  const [projects, setProjects] = useState<AdminProjectSummary[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [attention, setAttention] = useState<DocumentAttentionItem[]>([]);
  const [documents, setDocuments] = useState<ContractDocumentSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedProject = useMemo(() => projects.find((item) => item.id === projectId) ?? null, [projectId, projects]);
  const relevantAttention = useMemo(
    () => attention.filter((item) => item.projectId === projectId && item.attentionLevel !== 'normal'),
    [attention, projectId],
  );

  const loadBase = useCallback(async () => {
    setLoading(true);
    const [projectResult, attentionResult] = await Promise.all([
      listAdminProjects(),
      listAdminDocumentAttention(),
    ]);
    setProjects(projectResult.data);
    setProjectId((current) => current ?? projectResult.data[0]?.id ?? null);
    setAttention(attentionResult.data);
    setError(projectResult.error ?? attentionResult.error);
    setLoading(false);
  }, []);

  const loadProjectData = useCallback(async () => {
    if (!projectId) { setDocuments([]); return; }
    const result = await listProjectContractDocuments(projectId);
    setDocuments(result.data);
    if (result.error) setError(result.error);
  }, [projectId]);

  useEffect(() => { const task = setTimeout(() => void loadBase(), 0); return () => clearTimeout(task); }, [loadBase]);
  useEffect(() => { const task = setTimeout(() => void loadProjectData(), 0); return () => clearTimeout(task); }, [loadProjectData]);

  const openCanonicalCreation = () => {
    if (!openWebsiteAdminSection('commercial-documents')) router.push('/admin/document-preparation');
  };

  const generate = async (item: ContractDocumentSummary, archive: boolean) => {
    setSavingKey(`${archive ? 'archive' : 'download'}-${item.id}`); setError(null); setSuccess(null);
    const actionError = await generateContractDocument(item.id, item.kind, archive);
    if (actionError) setError(actionError);
    else setSuccess(archive
      ? 'Word gerado, baixado e arquivado. O histórico da emissão foi preservado.'
      : 'Word gerado para download; o histórico leve da emissão foi preservado.');
    setSavingKey(null);
    await loadProjectData();
  };

  const send = async (item: ContractDocumentSummary) => {
    if (!item.archived) { setError('Para disponibilizar ao cliente, primeiro arquive a versão que será enviada.'); return; }
    setSavingKey(`send-${item.id}`); setError(null); setSuccess(null);
    const actionError = await sendContractDocument(item.id, item.kind);
    if (actionError) setError(actionError);
    else setSuccess('Documento disponibilizado ao cliente; governança e eventual aceite permaneceram vinculados à versão correta.');
    setSavingKey(null);
    await Promise.all([loadProjectData(), loadBase()]);
  };

  return (
    <Screen>
      <AdminPageHeader
        title="Documentos gerados"
        description="Histórico, download, arquivamento e disponibilização ao cliente. A criação de novos documentos permanece centralizada em Contratos Gerais."
      />
      <Notice tone="info">
        Esta tela não altera escopo, não cria aceite e não prepara um segundo documento concorrente. Use Contratos Gerais para criar; use Versões e pendências para governança; use Aprovações somente quando o cliente realmente precisar decidir algo.
      </Notice>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}
      {loading ? <ActivityIndicator color={colors.gold600} /> : null}

      <Card>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Contrato / projeto</Text>
            <Text style={styles.help}>Selecione o projeto para consultar somente as emissões relacionadas a ele.</Text>
          </View>
          <Button onPress={openCanonicalCreation} title="Abrir Contratos Gerais" variant="secondary" />
        </View>
        <View style={styles.projectList}>
          {projects.map((project) => (
            <Pressable key={project.id} onPress={() => setProjectId(project.id)} style={[styles.projectChip, projectId === project.id && styles.selected]}>
              <Text style={[styles.projectText, projectId === project.id && styles.selectedText]}>{project.contractNumber} • {project.name}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      {!selectedProject ? <StateView icon="document-text-outline" title="Selecione um projeto" description="O histórico documental será carregado depois da seleção." /> : (
        <Card>
          <Text style={styles.sectionTitle}>Histórico de emissões</Text>
          <Text style={styles.help}>{selectedProject.contractNumber} • {selectedProject.name}</Text>
          {documents.length === 0 ? (
            <StateView title="Nenhum documento preparado" description="Crie o documento em Contratos Gerais; ele aparecerá aqui para download, arquivo e disponibilização." icon="document-text-outline" />
          ) : documents.map((item) => (
            <View key={item.id} style={styles.documentRow}>
              <View style={styles.header}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.meta}>
                    {item.optional ? 'Complementar' : 'Vinculado ao fluxo'} • {item.archived ? 'Word arquivado' : 'sem arquivo persistido'} • criado em {formatDate(item.createdAt)}
                  </Text>
                </View>
                <StatusPill
                  label={item.status}
                  tone={item.status === 'enviado' || item.status === 'aceito' ? 'success' : item.status === 'rascunho' ? 'warning' : 'neutral'}
                />
              </View>
              <View style={styles.actions}>
                <Button disabled={item.status === 'enviado' || item.status === 'aceito'} loading={savingKey === `download-${item.id}`} onPress={() => void generate(item, false)} title="Baixar Word" variant="secondary" />
                <Button disabled={item.status === 'enviado' || item.status === 'aceito'} loading={savingKey === `archive-${item.id}`} onPress={() => void generate(item, true)} title="Baixar + arquivar" variant="ghost" />
                {item.archived && item.status === 'gerado' ? <Button loading={savingKey === `send-${item.id}`} onPress={() => void send(item)} title="Disponibilizar ao cliente" /> : null}
              </View>
            </View>
          ))}
        </Card>
      )}

      <Card>
        <Text style={styles.sectionTitle}>Pendências de manifestação do cliente</Text>
        <Text style={styles.help}>Este é apenas um resumo operacional. Decisões e prazos são tratados em Aprovações/Termo de Aceite e a validade das versões em Versões e pendências.</Text>
        {relevantAttention.length === 0 ? (
          <StateView icon="checkmark-circle-outline" title="Nenhuma pendência crítica" description="Não há prazo próximo ou vencido para o projeto selecionado." />
        ) : relevantAttention.map((item) => (
          <View key={item.approvalId} style={styles.documentRow}>
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{item.approvalTitle}</Text>
                <Text style={styles.meta}>{item.clientName} • {item.contractNumber} • limite {formatDate(item.dueAt)}</Text>
              </View>
              <StatusPill label={item.attentionLevel === 'overdue' ? 'Prazo vencido' : 'Prazo próximo'} tone={item.attentionLevel === 'overdue' ? 'danger' : 'warning'} />
            </View>
            <Text style={styles.help}>A Notificação Formal só é enviada por uma ação explícita de envio imediato ou por um agendamento confirmado; preparar o documento não o envia.</Text>
          </View>
        ))}
      </Card>

      <Button loading={loading} onPress={() => void Promise.all([loadBase(), loadProjectData()])} title="Atualizar histórico" variant="secondary" />
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  sectionTitle: { color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '700' as const, fontFamily: typography.family },
  help: { color: colors.slate, fontSize: 12, lineHeight: 18, fontFamily: typography.family },
  projectList: { gap: spacing.xs },
  projectChip: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.sm },
  selected: { borderColor: colors.gold500, backgroundColor: colors.warningSoft },
  projectText: { color: colors.slate, fontSize: 12, fontFamily: typography.family },
  selectedText: { color: colors.gold600, fontWeight: '700' as const },
  header: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, alignItems: 'flex-start' as const, gap: spacing.sm },
  documentRow: { gap: spacing.xs, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm },
  title: { color: colors.ink, fontSize: 14, fontWeight: '700' as const, fontFamily: typography.family },
  meta: { color: colors.muted, fontSize: 11, lineHeight: 17, fontFamily: typography.family },
  actions: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.xs },
});
