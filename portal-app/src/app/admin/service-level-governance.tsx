import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AdminPageHeader } from '@/components/admin-ui';
import { Button, Card, Field, Notice, Screen, StateView, StatusPill } from '@/components/ui';
import {
  listServiceLevelScopeReviews,
  reviewServiceLevelScope,
  type AdminServiceLevelScopeReview,
  type ServiceLevelReviewStatus,
} from '@/services/document-governance-service';
import { useThemeStyles } from '@/providers/theme-provider';
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';

type Draft = {
  budgetDescription: string;
  contractScope: string;
  annexScope: string;
  reason: string;
};

type ServiceGroup = {
  serviceCode: string;
  serviceName: string;
  category: string;
  items: AdminServiceLevelScopeReview[];
};

const FETCH_LIMIT = 200;
const keyOf = (item: AdminServiceLevelScopeReview) => `${item.serviceCode}:${item.levelCode}`;

export default function ServiceLevelGovernanceScreen() {
  const styles = useThemeStyles(styleDefinitions);
  const [items, setItems] = useState<AdminServiceLevelScopeReview[]>([]);
  const [status, setStatus] = useState<ServiceLevelReviewStatus | 'all'>('pending');
  const [serviceFilter, setServiceFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | 'bronze' | 'prata' | 'ouro'>('all');
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const result = await listServiceLevelScopeReviews(status, FETCH_LIMIT, 0);
    setItems(result.data);
    setDrafts(Object.fromEntries(result.data.map((item: AdminServiceLevelScopeReview) => [keyOf(item), {
      budgetDescription: item.budgetDescription,
      contractScope: item.contractScope,
      annexScope: item.annexScope,
      reason: '',
    }])));
    setError(result.error); setLoading(false);
  }, [status]);

  useEffect(() => { const task = setTimeout(() => void load(), 0); return () => clearTimeout(task); }, [load]);

  const categories = useMemo(
    () => [...new Set(items.map((item) => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [items],
  );

  const groups = useMemo(() => {
    const byService = new Map<string, ServiceGroup>();
    const normalizedSearch = serviceFilter.trim().toLocaleLowerCase('pt-BR');
    items.forEach((item) => {
      if (levelFilter !== 'all' && item.levelCode !== levelFilter) return;
      if (categoryFilter && item.category !== categoryFilter) return;
      if (normalizedSearch && !`${item.serviceName} ${item.serviceCode}`.toLocaleLowerCase('pt-BR').includes(normalizedSearch)) return;
      const current = byService.get(item.serviceCode) ?? {
        serviceCode: item.serviceCode,
        serviceName: item.serviceName,
        category: item.category,
        items: [],
      };
      current.items.push(item);
      byService.set(item.serviceCode, current);
    });
    return [...byService.values()].sort((a, b) => a.serviceName.localeCompare(b.serviceName, 'pt-BR'));
  }, [categoryFilter, items, levelFilter, serviceFilter]);

  const changeStatus = (next: ServiceLevelReviewStatus | 'all') => {
    setStatus(next); setSuccess(null); setExpandedServices(new Set()); setExpandedLevels(new Set());
  };

  const updateDraft = (key: string, field: keyof Draft, value: string) => {
    setDrafts(current => {
      const base: Draft = current[key] ?? { budgetDescription: '', contractScope: '', annexScope: '', reason: '' };
      return { ...current, [key]: { ...base, [field]: value } };
    });
  };

  const toggleService = (code: string) => {
    setExpandedServices((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  };

  const toggleLevel = (key: string) => {
    setExpandedLevels((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
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
        title="Serviços × Bronze/Prata/Ouro"
        description="Abra somente o serviço e o nível que deseja revisar. Os demais permanecem recolhidos para evitar uma tela extensa."
      />
      <Notice tone="info">Somente combinações APROVADAS substituem textos legados nos documentos oficiais. Pendentes e rejeitadas nunca são publicadas automaticamente.</Notice>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}

      <Card>
        <Text style={styles.title}>Filtros</Text>
        <View style={styles.actions}>
          <Button onPress={() => changeStatus('pending')} title="Pendentes" variant={status === 'pending' ? 'secondary' : 'ghost'} />
          <Button onPress={() => changeStatus('rejected')} title="Rejeitados" variant={status === 'rejected' ? 'secondary' : 'ghost'} />
          <Button onPress={() => changeStatus('approved')} title="Aprovados" variant={status === 'approved' ? 'secondary' : 'ghost'} />
          <Button onPress={() => changeStatus('all')} title="Todos" variant={status === 'all' ? 'secondary' : 'ghost'} />
        </View>
        <Field label="Serviço" placeholder="Buscar por nome ou código" value={serviceFilter} onChangeText={setServiceFilter} />
        <Text style={styles.meta}>Categoria</Text>
        <View style={styles.actions}>
          <Button onPress={() => setCategoryFilter('')} title="Todas" variant={!categoryFilter ? 'secondary' : 'ghost'} />
          {categories.map((category) => <Button key={category} onPress={() => setCategoryFilter(category)} title={category} variant={categoryFilter === category ? 'secondary' : 'ghost'} />)}
        </View>
        <Text style={styles.meta}>Nível</Text>
        <View style={styles.actions}>
          {([
            ['all', 'Todos os níveis'],
            ['bronze', 'Bronze'],
            ['prata', 'Prata'],
            ['ouro', 'Ouro'],
          ] as const).map(([value, label]) => <Button key={value} onPress={() => setLevelFilter(value)} title={label} variant={levelFilter === value ? 'secondary' : 'ghost'} />)}
        </View>
      </Card>

      {!loading && groups.length === 0 ? <StateView icon="search-outline" title="Nenhum item neste filtro" description="Ajuste os filtros ou selecione outro status." /> : null}

      {groups.map((group) => {
        const open = expandedServices.has(group.serviceCode);
        const approved = group.items.filter((item) => item.reviewStatus === 'approved').length;
        const pending = group.items.filter((item) => item.reviewStatus === 'pending').length;
        const rejected = group.items.filter((item) => item.reviewStatus === 'rejected').length;
        return (
          <Card key={group.serviceCode}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => toggleService(group.serviceCode)} style={styles.groupHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{group.serviceName}</Text>
                <Text style={styles.meta}>Código {group.serviceCode} • {group.category} • Bronze · Prata · Ouro</Text>
                <Text style={styles.meta}>{approved} aprovado(s) · {pending} pendente(s) · {rejected} rejeitado(s)</Text>
              </View>
              <Text style={styles.chevron}>{open ? '−' : '+'}</Text>
            </Pressable>

            {open ? group.items.map((item) => {
              const key = keyOf(item);
              const levelOpen = expandedLevels.has(key);
              const draft = drafts[key] ?? { budgetDescription: item.budgetDescription, contractScope: item.contractScope, annexScope: item.annexScope, reason: '' };
              return (
                <View key={key} style={styles.levelBlock}>
                  <Pressable accessibilityRole="button" accessibilityState={{ expanded: levelOpen }} onPress={() => toggleLevel(key)} style={styles.levelHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.level}>{item.levelLabel}</Text>
                      <Text style={styles.meta}>{item.levelSubtitle || 'Clique para revisar os textos desta combinação.'}</Text>
                    </View>
                    <StatusPill
                      label={item.reviewStatus === 'approved' ? 'APROVADO' : item.reviewStatus === 'rejected' ? 'REJEITADO' : 'PENDENTE'}
                      tone={item.reviewStatus === 'approved' ? 'success' : item.reviewStatus === 'rejected' ? 'danger' : 'warning'}
                    />
                    <Text style={styles.chevron}>{levelOpen ? '−' : '+'}</Text>
                  </Pressable>
                  {levelOpen ? <View style={styles.levelContent}>
                    {item.professionalScopeCheckRequired ? <Notice tone="warning">Antes da aprovação comercial definitiva deste serviço, confirme a atribuição profissional aplicável ao caso concreto.</Notice> : null}
                    <Field label="Texto do orçamento" multiline value={draft.budgetDescription} onChangeText={value => updateDraft(key, 'budgetDescription', value)} style={styles.largeField} />
                    <Field label="Texto do contrato" multiline value={draft.contractScope} onChangeText={value => updateDraft(key, 'contractScope', value)} style={styles.largeField} />
                    <Field label="Escopo do Anexo I" multiline value={draft.annexScope} onChangeText={value => updateDraft(key, 'annexScope', value)} style={styles.largeField} />
                    <Text style={styles.meta}>Entregáveis: {item.includedDeliverables.join(' • ') || 'não definidos'}</Text>
                    <Text style={styles.meta}>Exclusões: {item.excludedDeliverables.join(' • ') || 'não definidas'}</Text>
                    <Field label="Justificativa da revisão *" multiline value={draft.reason} onChangeText={value => updateDraft(key, 'reason', value)} />
                    <View style={styles.actions}>
                      <Button loading={saving === key} onPress={() => void save(item, 'approved')} title="Aprovar esta combinação" />
                      <Button disabled={saving === key} onPress={() => void save(item, 'pending')} title="Salvar como pendente" variant="secondary" />
                      <Button disabled={saving === key} onPress={() => void save(item, 'rejected')} title="Rejeitar esta combinação" variant="ghost" />
                    </View>
                  </View> : null}
                </View>
              );
            }) : null}
          </Card>
        );
      })}

      <Card>
        <Text style={styles.meta}>{items.length} combinação(ões) carregadas; somente níveis abertos renderizam campos de edição.</Text>
        <Button loading={loading} onPress={() => void load()} title="Atualizar" variant="secondary" />
      </Card>
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  title: { color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '700' as const, fontFamily: typography.family },
  level: { color: colors.gold600, fontSize: 13, fontWeight: '700' as const, fontFamily: typography.family },
  meta: { color: colors.slate, fontSize: 12, lineHeight: 18, fontFamily: typography.family },
  actions: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.sm },
  groupHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm },
  levelHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm, paddingVertical: spacing.sm },
  levelBlock: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: spacing.sm },
  levelContent: { gap: spacing.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.sm },
  chevron: { color: colors.gold600, fontSize: 24, fontWeight: '600' as const, minWidth: 24, textAlign: 'center' as const },
  largeField: { minHeight: 110, textAlignVertical: 'top' as const },
});
