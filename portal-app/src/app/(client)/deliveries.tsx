import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { ProjectPicker } from '@/components/project-picker';
import { Button, Card, Notice, PageHeader, Screen, StateView, StatusPill } from '@/components/ui';
import { useProject } from '@/providers/project-provider';
import { useThemeStyles } from '@/providers/theme-provider';
import { listDocuments, listSchedule } from '@/services/portal-service';
import { spacing, ThemeColors, typography } from '@/theme/tokens';
import type { DocumentSummary, ScheduleStageSummary } from '@/types/domain';

function completed(status: string) {
  return ['concluido', 'concluida', 'entregue', 'finalizado', 'finalizada'].includes(status.toLowerCase());
}

export default function DeliveriesScreen() {
  const { selectedProject } = useProject();
  const [stages, setStages] = useState<ScheduleStageSummary[]>([]);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const styles = useThemeStyles(styleDefinitions);

  const load = useCallback(async () => {
    if (!selectedProject) { setStages([]); setDocuments([]); return; }
    setLoading(true);
    const [schedule, docs] = await Promise.all([listSchedule(selectedProject.id), listDocuments(selectedProject.id)]);
    setStages(schedule.data);
    setDocuments(docs.data);
    setError(schedule.error ?? docs.error);
    setLoading(false);
  }, [selectedProject]);

  useEffect(() => { const task = setTimeout(() => void load(), 0); return () => clearTimeout(task); }, [load]);

  return (
    <Screen>
      <PageHeader eyebrow="Escopo acompanhado" title="Entregas e checklist" description="Etapas concluídas e documentos efetivamente publicados no projeto selecionado." />
      <ProjectPicker />
      {error ? <Notice tone="warning">Parte do checklist está temporariamente indisponível.</Notice> : null}
      {!loading && selectedProject && stages.length === 0 && documents.length === 0 ? (
        <Card><StateView description="Os itens aparecerão quando a equipe publicar etapas ou documentos reais." icon="checkbox-outline" title="Checklist em preparação" /></Card>
      ) : null}
      {stages.length > 0 ? (
        <Card>
          <Text style={styles.sectionTitle}>Etapas da contratação</Text>
          {stages.map((stage) => (
            <View key={stage.id} style={styles.row}>
              <Text style={styles.rowTitle}>{stage.title}</Text>
              <StatusPill label={completed(stage.status) ? 'Concluída' : stage.status.replaceAll('_', ' ')} tone={completed(stage.status) ? 'success' : 'neutral'} />
            </View>
          ))}
        </Card>
      ) : null}
      {documents.length > 0 ? (
        <Card>
          <Text style={styles.sectionTitle}>Arquivos já disponibilizados</Text>
          {documents.map((document) => (
            <View key={document.id} style={styles.documentRow}>
              <Text style={styles.rowTitle}>✓ {document.title}</Text>
              <Text style={styles.meta}>{document.category}{document.version ? ` • ${document.version}` : ''}</Text>
            </View>
          ))}
        </Card>
      ) : null}
      <Notice tone="info">Este checklist reflete somente informações publicadas. Uma previsão nunca é tratada como prazo contratual confirmado.</Notice>
      <Button loading={loading} onPress={() => void load()} title="Atualizar checklist" variant="ghost" />
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  sectionTitle: { color: colors.ink, fontFamily: typography.family, fontSize: typography.size.bodyLarge, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.line },
  documentRow: { gap: 3, paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.line },
  rowTitle: { flex: 1, color: colors.ink, fontFamily: typography.family, fontSize: typography.size.body, lineHeight: 21 },
  meta: { color: colors.muted, fontFamily: typography.family, fontSize: 11 },
});
