import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { AdminPageHeader } from '@/components/admin-ui';
import { Button, Card, Notice, Screen, StateView, StatusPill } from '@/components/ui';
import { formatBytes, formatDate } from '@/lib/format';
import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import { getAdminStorageOverview, listAdminAudit } from '@/services/admin-service';
import { spacing, ThemeColors, typography } from '@/theme/tokens';
import type { AuditEntrySummary, StorageOverview } from '@/types/domain';

const emptyOverview: StorageOverview = { buckets: [], projects: [], totalObjects: 0, totalBytes: 0, orphanMetadata: 0, orphanObjects: 0 };

export default function AdminSecurityScreen() {
  const [overview, setOverview] = useState(emptyOverview);
  const [audit, setAudit] = useState<AuditEntrySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const { colors } = useAppTheme();
  const styles = useThemeStyles(styleDefinitions);

  const load = useCallback(async () => {
    setLoading(true);
    const [storageResult, auditResult] = await Promise.all([getAdminStorageOverview(), listAdminAudit()]);
    setOverview(storageResult.data);
    setAudit(auditResult.data);
    setStorageError(storageResult.error);
    setAuditError(auditResult.error);
    setLoading(false);
  }, []);

  useEffect(() => { const task = setTimeout(() => void load(), 0); return () => clearTimeout(task); }, [load]);

  return (
    <Screen>
      <AdminPageHeader description="Uso de armazenamento, proteção de acesso e trilha administrativa." title="Segurança" />
      {storageError ? <Notice tone="warning">Não foi possível atualizar o consumo de armazenamento agora. Tente novamente em instantes.</Notice> : null}
      {auditError ? <Notice tone="warning">A auditoria está temporariamente indisponível.</Notice> : null}
      {loading ? <ActivityIndicator color={colors.gold600} /> : null}
      <View style={styles.metrics}>
        <Card style={styles.metric}><Text style={styles.metricLabel}>ARMAZENAMENTO UTILIZADO</Text><Text style={styles.metricValue}>{storageError ? '—' : formatBytes(overview.totalBytes)}</Text></Card>
        <Card style={styles.metric}><Text style={styles.metricLabel}>ARQUIVOS ARMAZENADOS</Text><Text style={styles.metricValue}>{storageError ? '—' : overview.totalObjects}</Text></Card>
      </View>

      {overview.buckets.length > 0 ? <Text style={styles.sectionTitle}>Uso por área</Text> : null}
      {overview.buckets.map((bucket) => <Card key={bucket.bucketId}><View style={styles.header}><Text style={styles.title}>{bucket.bucketId}</Text><StatusPill label={`${bucket.objectCount} arquivos`} /></View><Text style={styles.meta}>{formatBytes(bucket.bytes)}</Text></Card>)}
      {overview.projects.length ? <Text style={styles.sectionTitle}>Uso por cliente, contrato e projeto</Text> : null}
      {overview.projects.map((project) => <Card key={project.projectId}><View style={styles.header}><View style={{ flex: 1 }}><Text style={styles.title}>{project.projectName}</Text><Text style={styles.meta}>{project.clientName} • Contrato {project.contractNumber}</Text></View><StatusPill label={formatBytes(project.bytes) ?? '—'} /></View><Text style={styles.meta}>{project.objectCount} arquivos vinculados</Text></Card>)}

      <Card>
        <Text style={styles.sectionTitle}>Proteção e privacidade</Text>
        <Text style={styles.body}>O aplicativo utiliza autenticação individual, controle de acesso por usuário e projeto, arquivos privados, acessos temporários e trilha administrativa para proteger documentos e informações dos clientes.</Text>
        <Notice tone="info">Os controles são aplicados no servidor e no banco de dados. O tratamento de dados pessoais observa os princípios de segurança, prevenção, necessidade e responsabilização previstos na LGPD (Lei nº 13.709/2018).</Notice>
      </Card>

      <Text style={styles.sectionTitle}>Auditoria recente</Text>
      {!loading && audit.length === 0 ? <StateView description="Nenhuma ação administrativa auditável foi registrada até agora." icon="receipt-outline" title="Sem eventos de auditoria" /> : null}
      {audit.map((entry) => <Card key={entry.id}><View style={styles.header}><View style={{ flex: 1 }}><Text style={styles.title}>{entry.action}</Text><Text style={styles.meta}>{entry.entityType ?? 'sistema'} • {formatDate(entry.createdAt)}</Text></View><StatusPill label="Auditado" /></View></Card>)}
      <Button loading={loading} onPress={() => void load()} title="Atualizar informações" variant="secondary" />
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
});
