import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { AdminPageHeader } from '@/components/admin-ui';
import { Button, Card, Notice, Screen, StateView, StatusPill } from '@/components/ui';
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

  return (
    <Screen>
      <AdminPageHeader description="Métricas reais, inconsistências detalhadas, permissões e trilha administrativa." title="Segurança e Storage" />
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
      {overview.projects.length ? <Text style={styles.sectionTitle}>Uso por cliente, contrato e projeto</Text> : null}
      {overview.projects.map((project) => <Card key={project.projectId}><View style={styles.header}><View style={{ flex: 1 }}><Text style={styles.title}>{project.projectName}</Text><Text style={styles.meta}>{project.clientName} • Contrato {project.contractNumber}</Text></View><StatusPill label={formatBytes(project.bytes) ?? 'Indisponível'} /></View><Text style={styles.meta}>{project.objectCount} arquivos vinculados</Text></Card>)}

      <Card>
        <Text style={styles.sectionTitle}>Controles de segurança</Text>
        <Text style={styles.body}>RLS por usuário/projeto, extrato somente admin com RLS forçada, originais privados, cópias autorais identificadas, acessos temporários, chave administrativa apenas no servidor, auditoria e exclusão com preservação financeira.</Text>
        <Notice tone="info">As permissões são verificadas novamente no banco e nas funções protegidas. Esta tela apresenta o resultado e não substitui esses controles.</Notice>
      </Card>

      <Text style={styles.sectionTitle}>Auditoria recente</Text>
      {!loading && audit.length === 0 ? <StateView description="Nenhuma ação administrativa auditável foi registrada neste ambiente até agora." icon="receipt-outline" title="Sem eventos de auditoria" /> : null}
      {audit.map((entry) => <Card key={entry.id}><View style={styles.header}><View style={{ flex: 1 }}><Text style={styles.title}>{entry.action}</Text><Text style={styles.meta}>{entry.entityType ?? 'sistema'} • {formatDate(entry.createdAt)}</Text></View><StatusPill label="Auditado" /></View>{entry.details ? <Text numberOfLines={4} style={styles.code}>{JSON.stringify(entry.details)}</Text> : null}</Card>)}
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
});

function isKnownHomologationFixture(item: StorageOrphanDetails['orphanMetadata'][number]) {
  const normalizedName = item.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /fictici[oa]/.test(normalizedName)
    && Boolean(item.projectId?.startsWith('30000000-0000-4000-8000-0000000000'));
}
