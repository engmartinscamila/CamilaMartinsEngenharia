import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { ProjectPicker } from '@/components/project-picker';
import { Button, Card, Field, Notice, PageHeader, Screen, StateView, StatusPill } from '@/components/ui';
import { formatDate, humanizeStatus } from '@/lib/format';
import { useAuth } from '@/providers/auth-provider';
import { useProject } from '@/providers/project-provider';
import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import { listApprovals, respondToApproval } from '@/services/portal-service';
import { spacing, ThemeColors, typography } from '@/theme/tokens';
import type { ApprovalSummary } from '@/types/domain';

type Decision = 'aprovado' | 'rejeitado';

function tone(status: string): 'neutral' | 'success' | 'warning' | 'danger' {
  if (status === 'aprovado') return 'success';
  if (status === 'rejeitado') return 'danger';
  if (status === 'aguardando') return 'warning';
  return 'neutral';
}

export default function ApprovalsScreen() {
  const { role } = useAuth();
  const { selectedProject } = useProject();
  const [items, setItems] = useState<ApprovalSummary[]>([]);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [confirmation, setConfirmation] = useState<{ id: string; decision: Decision } | null>(null);
  const [loading, setLoading] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { colors } = useAppTheme();
  const styles = useThemeStyles(styleDefinitions);

  const load = useCallback(async () => {
    if (!selectedProject) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    const result = await listApprovals(selectedProject.id);
    setItems(result.data);
    setError(result.error);
    setLoading(false);
  }, [selectedProject]);

  useEffect(() => {
    const task = setTimeout(() => void load(), 0);
    return () => clearTimeout(task);
  }, [load]);

  const confirm = async (item: ApprovalSummary, decision: Decision) => {
    const comment = comments[item.id]?.trim() ?? '';
    if (decision === 'rejeitado' && comment.length < 3) {
      setError('Explique brevemente o motivo antes de solicitar uma alteração.');
      setConfirmation(null);
      return;
    }
    setSubmittingId(item.id);
    setError(null);
    setSuccess(null);
    const responseError = await respondToApproval(item.id, decision, comment);
    setSubmittingId(null);
    setConfirmation(null);
    if (responseError) {
      setError(responseError);
      return;
    }
    setSuccess(decision === 'aprovado' ? 'Aprovação registrada com sucesso.' : 'Solicitação de alteração registrada com sucesso.');
    await load();
  };

  return (
    <Screen>
      <PageHeader eyebrow="Decisões do cliente" title="Aprovações" description="Analise cada item e registre sua decisão com histórico vinculado ao projeto." />
      <ProjectPicker />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}
      {loading ? <ActivityIndicator color={colors.gold600} /> : null}
      {!loading && selectedProject && items.length === 0 ? (
        <StateView actionLabel="Atualizar" description="Quando houver uma decisão pendente, ela aparecerá aqui." icon="checkmark-done-outline" onAction={() => void load()} title="Nenhuma aprovação disponível" />
      ) : null}
      {items.map((item) => {
        const pending = item.status === 'aguardando';
        const activeConfirmation = confirmation?.id === item.id ? confirmation.decision : null;
        return (
          <Card key={item.id}>
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.type}>{item.type.toUpperCase()}</Text>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.date}>Enviado em {formatDate(item.createdAt)}</Text>
              </View>
              <StatusPill label={humanizeStatus(item.status)} tone={tone(item.status)} />
            </View>
            {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
            {pending && role === 'client' ? (
              <>
                <Field
                  label="Comentário (obrigatório ao solicitar alteração)"
                  multiline
                  onChangeText={(value) => setComments((current) => ({ ...current, [item.id]: value }))}
                  placeholder="Escreva uma observação clara para a equipe"
                  style={styles.comment}
                  value={comments[item.id] ?? ''}
                />
                {!activeConfirmation ? (
                  <View style={styles.actions}>
                    <View style={styles.action}><Button icon="checkmark-outline" onPress={() => setConfirmation({ id: item.id, decision: 'aprovado' })} title="Aprovar" /></View>
                    <View style={styles.action}><Button icon="create-outline" onPress={() => setConfirmation({ id: item.id, decision: 'rejeitado' })} title="Solicitar alteração" variant="secondary" /></View>
                  </View>
                ) : (
                  <Notice tone={activeConfirmation === 'aprovado' ? 'success' : 'warning'}>
                    {activeConfirmation === 'aprovado' ? 'Confirme para registrar a aprovação definitiva deste item.' : 'Confirme para devolver o item à equipe com seu comentário.'}
                  </Notice>
                )}
                {activeConfirmation ? (
                  <View style={styles.actions}>
                    <View style={styles.action}><Button loading={submittingId === item.id} onPress={() => void confirm(item, activeConfirmation)} title="Confirmar decisão" /></View>
                    <View style={styles.action}><Button disabled={submittingId === item.id} onPress={() => setConfirmation(null)} title="Cancelar" variant="ghost" /></View>
                  </View>
                ) : null}
              </>
            ) : pending ? (
              <Notice tone="info">Somente o cliente responsável pode registrar esta decisão.</Notice>
            ) : (
              <View style={styles.response}>
                <Text style={styles.responseTitle}>Resposta registrada {item.respondedAt ? `em ${formatDate(item.respondedAt)}` : ''}</Text>
                <Text style={styles.responseText}>{item.comment || 'Sem comentário adicional.'}</Text>
              </View>
            )}
          </Card>
        );
      })}
      {items.length > 0 ? <Button loading={loading} onPress={() => void load()} title="Atualizar aprovações" variant="ghost" /> : null}
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  type: { color: colors.gold600, fontSize: 10, fontWeight: '700', letterSpacing: 1, fontFamily: typography.family },
  title: { color: colors.ink, fontSize: typography.size.bodyLarge, marginTop: 3, fontWeight: '700', fontFamily: typography.family },
  date: { color: colors.muted, fontSize: 11, marginTop: 4, fontFamily: typography.family },
  description: { color: colors.slate, fontSize: 13, lineHeight: 20, fontFamily: typography.family },
  comment: { minHeight: 92, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: { minWidth: 160, flexGrow: 1, flexBasis: 0 },
  response: { backgroundColor: colors.background, borderRadius: 12, padding: spacing.sm, gap: 4 },
  responseTitle: { color: colors.ink, fontSize: 12, fontWeight: '700', fontFamily: typography.family },
  responseText: { color: colors.slate, fontSize: 13, lineHeight: 19, fontFamily: typography.family },
});
