import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { AdminPageHeader } from '@/components/admin-ui';
import { Button, Card, Field, Notice, Screen, StateView, StatusPill } from '@/components/ui';
import {
  listServiceLevelScopeReviews,
  reviewServiceLevelScope,
  type AdminServiceLevelScopeReview,
  type ServiceLevelReviewStatus,
} from '@/services/document-governance-service';
import { useThemeStyles } from '@/providers/theme-provider';
import { spacing, ThemeColors, typography } from '@/theme/tokens';

type Draft = {
  budgetDescription: string;
  contractScope: string;
  annexScope: string;
  reason: string;
};

const PAGE_SIZE = 12;
const keyOf = (item: AdminServiceLevelScopeReview) => `${item.serviceCode}:${item.levelCode}`;

export default function ServiceLevelGovernanceScreen() {
  const styles = useThemeStyles(styleDefinitions);
  const [items, setItems] = useState<AdminServiceLevelScopeReview[]>([]);
  const [status, setStatus] = useState<ServiceLevelReviewStatus | 'all'>('pending');
  const [offset, setOffset] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const result = await listServiceLevelScopeReviews(status, PAGE_SIZE, offset);
    setItems(result.data);
    setDrafts(Object.fromEntries(result.data.map(item => [keyOf(item), {
      budgetDescription: item.budgetDescription,
      contractScope: item.contractScope,
      annexScope: item.annexScope,
      reason: '',
    }])));
    setError(result.error); setLoading(false);
  }, [offset, status]);

  useEffect(() => { const task = setTimeout(() => void load(), 0); return () => clearTimeout(task); }, [load]);

  const changeStatus = (next: ServiceLevelReviewStatus | 'all') => {
    setStatus(next); setOffset(0); setSuccess(null);
  };

  const updateDraft = (key: string, field: keyof Draft, value: string) => {
    setDrafts(current => ({ ...current, [key]: { ...current[key], [field]: value } }));
  };

  const save = async (item: AdminServiceLevelScopeReview, decision: ServiceLevelReviewStatus) => {
    const key = keyOf(item);
    const draft = drafts[key];
    if (!draft) return;
    if (draft.reason.trim().length < 5) {
      setError('Informe uma justificativa objetiva com pelo menos 5 caracteres antes de salvar a decisão.');
      return;
    }
    setSaving(key); setError(null); setSuccess(null);
    const result = await reviewServiceLevelScope({
      serviceCode: item.serviceCode,
      levelCode: item.levelCode,
      decision,
      reason: draft.reason,
      budgetDescription: draft.budgetDescription,
      contractScope: draft.contractScope,
      annexScope: draft.annexScope,
    });
    setSaving(null);
    if (result.error) { setError(result.error); return; }
    setSuccess(`${item.serviceName} • ${item.levelLabel} salvo como ${decision === 'approved' ? 'APROVADO' : decision === 'rejected' ? 'REJEITADO' : 'PENDENTE'} na versão ${result.version}.`);
    await load();
  };

  return (
    <Screen>
      <AdminPageHeader
        title="Serviços × níveis — revisão individual"
        description="Revise os textos de orçamento, contrato e Anexo I para cada combinação Bronze, Prata e Ouro. Não existe aprovação em massa."
      />
      <Notice tone="info">Somente combinações com status APROVADO passam a substituir os textos legados nos documentos oficiais. Rascunhos pendentes e rejeitados nunca são publicados automaticamente.</Notice>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}

      <Card>
        <Text style={styles.title}>Filtro</Text>
        <View style={styles.actions}>
          <Button onPress={() => changeStatus('pending')} title="Pendentes" variant={status === 'pending' ? 'secondary' : 'ghost'} />
          <Button onPress={() => changeStatus('rejected')} title="Rejeitados" variant={status === 'rejected' ? 'secondary' : 'ghost'} />
          <Button onPress={() => changeStatus('approved')} title="Aprovados" variant={status === 'approved' ? 'secondary' : 'ghost'} />
          <Button onPress={() => changeStatus('all')} title="Todos" variant={status === 'all' ? 'secondary' : 'ghost'} />
        </View>
      </Card>

      {items.length === 0 && !loading ? <StateView icon="checkmark-done-outline" title="Nenhum item neste filtro" description="Não há combinações para revisar nesta página." /> : null}

      {items.map(item => {
        const key = keyOf(item);
        const draft = drafts[key] ?? { budgetDescription: item.budgetDescription, contractScope: item.contractScope, annexScope: item.annexScope, reason: '' };
        return (
          <Card key={key}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{item.serviceName}</Text>
                <Text style={styles.meta}>Código {item.serviceCode} • {item.category} • matriz v{item.version}</Text>
              </View>
              <StatusPill
                label={item.reviewStatus === 'approved' ? 'APROVADO' : item.reviewStatus === 'rejected' ? 'REJEITADO' : 'PENDENTE'}
                tone={item.reviewStatus === 'approved' ? 'success' : item.reviewStatus === 'rejected' ? 'danger' : 'warning'}
              />
            </View>
            <Text style={styles.level}>{item.levelLabel}</Text>
            {item.professionalScopeCheckRequired ? <Notice tone="warning">Antes da aprovação comercial definitiva deste serviço, confirme a atribuição profissional aplicável ao caso concreto.</Notice> : null}
            <Field label="Texto do orçamento" multiline value={draft.budgetDescription} onChangeText={value => updateDraft(key, 'budgetDescription', value)} />
            <Field label="Texto do contrato" multiline value={draft.contractScope} onChangeText={value => updateDraft(key, 'contractScope', value)} />
            <Field label="Escopo do Anexo I" multiline value={draft.annexScope} onChangeText={value => updateDraft(key, 'annexScope', value)} />
            <Text style={styles.meta}>Entregáveis de referência: {item.includedDeliverables.join(' • ') || 'não definidos'}</Text>
            <Text style={styles.meta}>Exclusões de referência: {item.excludedDeliverables.join(' • ') || 'não definidas'}</Text>
            <Field label="Justificativa da revisão *" multiline value={draft.reason} onChangeText={value => updateDraft(key, 'reason', value)} />
            <View style={styles.actions}>
              <Button loading={saving === key} onPress={() => void save(item, 'approved')} title="Aprovar esta combinação" />
              <Button disabled={saving === key} onPress={() => void save(item, 'pending')} title="Salvar como pendente" variant="secondary" />
              <Button disabled={saving === key} onPress={() => void save(item, 'rejected')} title="Rejeitar esta combinação" variant="ghost" />
            </View>
          </Card>
        );
      })}

      <Card>
        <View style={styles.actions}>
          <Button disabled={offset === 0 || loading} onPress={() => setOffset(value => Math.max(0, value - PAGE_SIZE))} title="Página anterior" variant="ghost" />
          <Button disabled={items.length < PAGE_SIZE || loading} onPress={() => setOffset(value => value + PAGE_SIZE)} title="Próxima página" variant="ghost" />
          <Button loading={loading} onPress={() => void load()} title="Atualizar" variant="secondary" />
        </View>
      </Card>
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  title: { color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '700', fontFamily: typography.family },
  level: { color: colors.gold600, fontSize: 13, fontWeight: '700', fontFamily: typography.family },
  meta: { color: colors.slate, fontSize: 12, lineHeight: 18, fontFamily: typography.family },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
