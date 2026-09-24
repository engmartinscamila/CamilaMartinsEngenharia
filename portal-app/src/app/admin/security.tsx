import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { AdminPageHeader } from '@/components/admin-ui';
import { Button, Card, Field, Notice, Screen, StateView, StatusPill } from '@/components/ui';
import { formatBytes, formatDate } from '@/lib/format';
import { env } from '@/lib/env';
import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import { getAdminStorageOrphanDetails, getAdminStorageOverview, listAdminAudit } from '@/services/admin-service';
import { spacing, ThemeColors, typography } from '@/theme/tokens';
import type { AuditEntrySummary, StorageOrphanDetails, StorageOverview } from '@/types/domain';

const emptyOverview: StorageOverview = { buckets: [], projects: [], totalObjects: 0, totalBytes: 0, orphanMetadata: 0, orphanObjects: 0 };
const emptyOrphans: StorageOrphanDetails = { orphanMetadata: [], orphanObjects: [] };

export default function AdminSecurityScreen() {
  const [overview, setOverview] = useState(emptyOverview);
  const [orphans, setOrphans] = useState(emptyOrphans);
  const [audit, setAudit] = useState<AuditEntrySummary[]>([]);
  const [showProjectUsage, setShowProjectUsage] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [auditAction, setAuditAction] = useState('');
  const [auditType, setAuditType] = useState('');
  const [auditUser, setAuditUser] = useState('');
  const [auditProject, setAuditProject] = useState('');
  const [auditPeriodDays, setAuditPeriodDays] = useState('');
  const [loading, setLoading] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const { colors } = useAppTheme();
  const styles = useThemeStyles(styleDefinitions);
  const homologationFixtures = env.isHomologation
    ? orphans.orphanMetadata.filter(isKnownHomologationFixture)
    : [];
  const orphanMetadata = env.isHomologation
    ? orphans.orphanMetadata.filter((item) => !isKnownHomologationFixture(item))
    : orphans.orphanMetadata;

  const load = useCallback(async () => {
    setLoading(true);
    const [storageResult, orphanResult, auditResult] = await Promise.all([
      getAdminStorageOverview(), getAdminStorageOrphanDetails(), listAdminAudit(),
    ]);
    setOverview(storageResult.data);
    setOrphans(orphanResult.data);
    setAudit(auditResult.data);
    setStorageError(storageResult.error ?? orphanResult.error);
    setAuditError(auditResult.error);
    setLoading(false);
  }, []);

  useEffect(() => { const task = setTimeout(() => void load(), 0); return () => clearTimeout(task); }, [load]);

  const filteredAudit = useMemo(() => {
    const action = auditAction.trim().toLocaleLowerCase('pt-BR');
    const type = auditType.trim().toLocaleLowerCase('pt-BR');
    const user = auditUser.trim().toLocaleLowerCase('pt-BR');
    const project = auditProject.trim().toLocaleLowerCase('pt-BR');
    const days = Number(auditPeriodDays);
    const cutoff = Number.isFinite(days) && days > 0 ? Date.now() - days * 86_400_000 : null;
    return audit.filter((entry) => {
      if (action && !entry.action.toLocaleLowerCase('pt-BR').includes(action)) return false;
      if (type && !(entry.entityType ?? '').toLocaleLowerCase('pt-BR').includes(type)) return false;
      if (user && !(entry.userId ?? '').toLocaleLowerCase('pt-BR').includes(user)) return false;
      if (cutoff && new Date(entry.createdAt).getTime() < cutoff) return false;
      if (project) {
        const haystack = `${entry.entityId ?? ''} ${JSON.stringify(entry.details ?? {})}`.toLocaleLowerCase('pt-BR');
        if (!haystack.includes(project)) return false;
      }
      return true;
    });
  }, [audit, auditAction, auditPeriodDays, auditProject, auditType, auditUser]);



  return (
    <Screen>
      <AdminPageHeader description="Métricas reais, inconsistências detalhadas, permissões e trilha administrativa." title="Armazenamento e auditoria" />
      {storageError ? <Notice tone="warning">{storageError}</Notice> : null}
      {auditError ? <Notice tone="warning">{auditError}</Notice> : null}
      {loading ? <ActivityIndicator color={colors.gold600} /> : null}
      <View style={styles.metrics}>
        <Card style={styles.metric}><Text style={styles.metricLabel}>ARMAZENAMENTO REAL</Text><Text style={styles.metricValue}>{storageError ? 'Indisponível' : formatBytes(overview.totalBytes)}</Text></Card>
        <Card style={styles.metric}><Text style={styles.metricLabel}>OBJETOS</Text><Text style={styles.metricValue}>{storageError ? '—' : overview.totalObjects}</Text></Card>
        <Card style={styles.metric}><Text style={styles.metricLabel}>METADADOS A REVISAR</Text><Text style={styles.metricValue}>{storageError ? '—' : orphanMetadata.length}</Text></Card>
        <Card style={styles.metric}><Text style={styles.metricLabel}>ARQUIVOS ÓRFÃOS</Text><Text style={styles.metricValue}>{storageError ? '—' : overview.orphanObjects}</Text></Card>
      </View>

      <Card>
        <Text style={styles.sectionTitle}>O que significam os órfãos?</Text>
        <Text style={styles.body}><Text style={styles.strong}>Metadado órfão:</Text> existe uma linha no banco apontando para um arquivo que não existe no Storage.</Text>
        <Text style={styles.body}><Text style={styles.strong}>Arquivo órfão:</Text> existe um arquivo no Storage sem linha correspondente no banco.</Text>
        <Notice tone="warning">Nenhum item é apagado automaticamente. Primeiro confira contrato, projeto e caminho; uma limpeza automática poderia remover prova ou documento válido.</Notice>
      </Card>

      {homologationFixtures.length > 0 ? (
        <Notice tone="info">
          {homologationFixtures.length} registros fictícios do teste A/B foram separados das pendências reais. Eles não representam arquivos de clientes e nenhum dado foi apagado.
        </Notice>
      ) : null}

      {orphanMetadata.length > 0 ? <Text style={styles.sectionTitle}>Metadados sem arquivo</Text> : null}
      {orphanMetadata.map((item) => <Card key={`${item.kind}-${item.id}`}><View style={styles.header}><View style={{ flex: 1 }}><Text style={styles.title}>{item.name}</Text><Text style={styles.meta}>{item.kind} • {item.bucket}/{item.path}</Text><Text style={styles.meta}>Projeto: {item.projectId ?? 'não informado'}</Text></View><StatusPill label="Revisar" tone="warning" /></View></Card>)}
      {orphans.orphanObjects.length > 0 ? <Text style={styles.sectionTitle}>Arquivos sem metadado</Text> : null}
      {orphans.orphanObjects.map((item) => <Card key={`${item.bucket}-${item.path}`}><View style={styles.header}><View style={{ flex: 1 }}><Text style={styles.title}>{item.path}</Text><Text style={styles.meta}>{item.bucket} • {formatBytes(item.size)} • {formatDate(item.createdAt)}</Text></View><StatusPill label="Revisar" tone="warning" /></View></Card>)}

      {overview.buckets.map((bucket) => <Card key={bucket.bucketId}><View style={styles.header}><Text style={styles.title}>{bucket.bucketId}</Text><StatusPill label={`${bucket.objectCount} objetos`} /></View><Text style={styles.meta}>{formatBytes(bucket.bytes)}</Text></Card>)}
      {overview.projects.length ? (
        <Card>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: showProjectUsage }} onPress={() => setShowProjectUsage((current) => !current)} style={styles.accordionHeader}>
            <View style={{ flex: 1 }}><Text style={styles.sectionTitle}>Uso por cliente, contrato e projeto</Text><Text style={styles.meta}>{overview.projects.length} projeto(s) • clique para {showProjectUsage ? 'recolher' : 'detalhar'}</Text></View>
            <Text style={styles.chevron}>{showProjectUsage ? '−' : '+'}</Text>
          </Pressable>
          {showProjectUsage ? <View style={styles.accordionBody}>{overview.projects.map((project) => <View key={project.projectId} style={styles.usageRow}><View style={{ flex: 1 }}><Text style={styles.title}>{project.projectName}</Text><Text style={styles.meta}>{project.clientName} • Contrato {project.contractNumber}</Text><Text style={styles.meta}>{project.objectCount} arquivos vinculados</Text></View><StatusPill label={formatBytes(project.bytes) ?? 'Indisponível'} /></View>)}</View> : null}
        </Card>
      ) : null}

      <Card>
        <Text style={styles.sectionTitle}>Controles de segurança</Text>
        <Text style={styles.body}>RLS por usuário/projeto, extrato somente admin com RLS forçada, originais privados, cópias autorais identificadas, acessos temporários, chave administrativa apenas no servidor, auditoria e exclusão com preservação financeira.</Text>
        <Notice tone="info">As permissões são verificadas novamente no banco e nas funções protegidas. Esta tela apresenta o resultado e não substitui esses controles.</Notice>
      </Card>

      <Card>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: showAudit }} onPress={() => setShowAudit((current) => !current)} style={styles.accordionHeader}>
          <View style={{ flex: 1 }}><Text style={styles.sectionTitle}>Auditoria recente</Text><Text style={styles.meta}>{audit.length} evento(s) carregado(s) • {filteredAudit.length} no filtro atual</Text></View>
          <Text style={styles.chevron}>{showAudit ? '−' : '+'}</Text>
        </Pressable>
        {showAudit ? <View style={styles.accordionBody}>
          <View style={styles.filterGrid}>
            <Field label="Período (últimos N dias)" keyboardType="number-pad" value={auditPeriodDays} onChangeText={setAuditPeriodDays} placeholder="Ex.: 30" />
            <Field label="Ação" value={auditAction} onChangeText={setAuditAction} placeholder="Ex.: generate" />
            <Field label="Usuário / ID" value={auditUser} onChangeText={setAuditUser} placeholder="ID do usuário" />
            <Field label="Projeto / ID / termo" value={auditProject} onChangeText={setAuditProject} />
            <Field label="Tipo de entidade" value={auditType} onChangeText={setAuditType} placeholder="Ex.: documentos" />
          </View>
          {!loading && audit.length === 0 ? <StateView description="Nenhuma ação administrativa auditável foi registrada neste ambiente até agora." icon="receipt-outline" title="Sem eventos de auditoria" /> : null}
          {!loading && audit.length > 0 && filteredAudit.length === 0 ? <StateView description="Nenhum evento atende aos filtros informados." icon="search-outline" title="Filtro sem resultados" /> : null}
          {filteredAudit.map((entry) => <View key={entry.id} style={styles.auditRow}><View style={styles.header}><View style={{ flex: 1 }}><Text style={styles.title}>{entry.action}</Text><Text style={styles.meta}>{entry.entityType ?? 'sistema'} • {formatDate(entry.createdAt)} • usuário {entry.userId ?? 'não registrado'}</Text></View><StatusPill label="Auditado" /></View>{entry.details ? <Text numberOfLines={4} style={styles.code}>{JSON.stringify(entry.details)}</Text> : null}</View>)}
        </View> : null}
      </Card>
      <Button loading={loading} onPress={() => void load()} title="Atualizar métricas" variant="secondary" />
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metric: { flexGrow: 1, flexBasis: 150, minHeight: 105 },
  metricLabel: { color: colors.gold600, fontSize: 10, fontWeight: '700', letterSpacing: 1, fontFamily: typography.family },
  metricValue: { color: colors.ink, fontSize: 22, fontWeight: '700', fontFamily: typography.family },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  title: { flex: 1, color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '700', fontFamily: typography.family },
  meta: { color: colors.muted, fontSize: 12, marginTop: 4, fontFamily: typography.family },
  sectionTitle: { color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '700', fontFamily: typography.family },
  body: { color: colors.slate, fontSize: 13, lineHeight: 20, fontFamily: typography.family },
  strong: { color: colors.ink, fontWeight: '700' },
  code: { color: colors.slate, fontSize: 11, lineHeight: 17, fontFamily: typography.family },
  accordionHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm },
  accordionBody: { gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm },
  usageRow: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm },
  auditRow: { gap: spacing.xs, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm },
  filterGrid: { gap: spacing.sm },
  chevron: { color: colors.gold600, fontSize: 24, fontWeight: '700' as const },
});

function isKnownHomologationFixture(item: StorageOrphanDetails['orphanMetadata'][number]) {
  const normalizedName = item.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /fictici[oa]/.test(normalizedName)
    && Boolean(item.projectId?.startsWith('30000000-0000-4000-8000-0000000000'));
}
