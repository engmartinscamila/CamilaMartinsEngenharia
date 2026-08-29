import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { ProjectPicker } from '@/components/project-picker';
import { Button, Card, Notice, PageHeader, Screen, StateView, StatusPill } from '@/components/ui';
import { formatDate, formatTime } from '@/lib/format';
import { getDisplayName, getFirstName } from '@/lib/user-name';
import { useAuth } from '@/providers/auth-provider';
import { useProject } from '@/providers/project-provider';
import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import { getProjectHighlights } from '@/services/portal-service';
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';
import type { ProjectHighlights } from '@/types/domain';

export default function HomeScreen() {
  const router = useRouter();
  const { client, user } = useAuth();
  const { selectedProject, loading, error, projects, refresh } = useProject();
  const [highlights, setHighlights] = useState<ProjectHighlights | null>(null);
  const [highlightsLoading, setHighlightsLoading] = useState(false);
  const [highlightsError, setHighlightsError] = useState<string | null>(null);
  const firstName = getFirstName(getDisplayName(user, client?.name, 'Cliente'));
  const { colors } = useAppTheme();
  const styles = useThemeStyles(styleDefinitions);

  const loadHighlights = useCallback(async () => {
    if (!selectedProject) {
      setHighlights(null);
      return;
    }
    setHighlightsLoading(true);
    const result = await getProjectHighlights(selectedProject.id, selectedProject.clientId);
    setHighlights(result.data);
    setHighlightsError(result.error);
    setHighlightsLoading(false);
  }, [selectedProject]);

  useEffect(() => {
    const task = setTimeout(() => void loadHighlights(), 0);
    return () => clearTimeout(task);
  }, [loadHighlights]);

  return (
    <Screen>
      <PageHeader eyebrow="Central digital" title={`Olá, ${firstName}.`} description="Veja o que está acontecendo com seu projeto." />
      <ProjectPicker />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {highlightsError ? <Notice tone="warning">{highlightsError}</Notice> : null}
      {!loading && projects.length === 0 ? (
        <Card>
          <StateView
            actionLabel="Tentar novamente"
            description="Quando um projeto for vinculado à sua conta, ele aparecerá aqui."
            icon="business-outline"
            onAction={() => void refresh()}
            title="Nenhum projeto disponível"
          />
        </Card>
      ) : null}
      {selectedProject ? (
        <>
          <Card style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={styles.heroCopy}>
                <Text style={styles.contract}>CONTRATO {selectedProject.contractNumber}</Text>
                <Text style={styles.projectName}>{selectedProject.name}</Text>
                <Text style={styles.service}>{selectedProject.serviceType ?? 'Serviço de engenharia'}</Text>
              </View>
              <StatusPill label={selectedProject.status} tone={selectedProject.status === 'ativo' ? 'success' : 'neutral'} />
            </View>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Progresso informado</Text>
              <Text style={styles.progressValue}>{selectedProject.progress === null ? 'Indisponível' : `${selectedProject.progress}%`}</Text>
            </View>
            {selectedProject.progress !== null ? (
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${selectedProject.progress}%` }]} />
              </View>
            ) : null}
          </Card>
          <View style={styles.grid}>
            <Card style={styles.smallCard}>
              <Text style={styles.smallLabel}>Próximo passo</Text>
              <Text style={styles.smallValue}>{highlights?.nextStage?.title ?? 'Cronograma em preparação'}</Text>
              {highlights?.nextStage?.endDate ? <Text style={styles.smallMeta}>Previsão: {formatDate(highlights.nextStage.endDate)}</Text> : null}
            </Card>
            <Card style={styles.smallCard}>
              <Text style={styles.smallLabel}>Próximo compromisso</Text>
              <Text style={styles.smallValue}>{highlights?.nextEvent?.title ?? 'Nenhum evento futuro'}</Text>
              {highlights?.nextEvent ? <Text style={styles.smallMeta}>{formatDate(highlights.nextEvent.date)}{formatTime(highlights.nextEvent.startTime) ? ` • ${formatTime(highlights.nextEvent.startTime)}` : ''}</Text> : null}
            </Card>
          </View>
          {highlightsLoading ? <ActivityIndicator color={colors.gold600} /> : null}
          {highlights ? (
            <View style={styles.metrics}>
              <View style={styles.metric}><Text style={styles.metricValue}>{highlights.pendingApprovals ?? '—'}</Text><Text style={styles.metricLabel}>Aprovações pendentes</Text></View>
              <View style={styles.metric}><Text style={styles.metricValue}>{highlights.openRequests ?? '—'}</Text><Text style={styles.metricLabel}>Solicitações abertas</Text></View>
              <View style={styles.metric}><Text style={styles.metricValue}>{highlights.recentDocuments ?? '—'}</Text><Text style={styles.metricLabel}>Documentos publicados</Text></View>
            </View>
          ) : null}
          <Button icon="alert-circle-outline" onPress={() => router.push('/(client)/pending')} title="Ver minhas pendências" variant="secondary" />
          {selectedProject.contractId === null ? (
            <Notice tone="warning">Este projeto usa um cadastro anterior sem vínculo formal de contrato. Solicite a revisão administrativa antes de incluir novos dados.</Notice>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  hero: { backgroundColor: colors.navy900, borderColor: colors.navy700, padding: spacing.lg },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  heroCopy: { flex: 1, gap: spacing.xs },
  contract: { color: colors.gold300, fontSize: 10, fontWeight: '700', letterSpacing: 1.2, fontFamily: typography.family },
  projectName: { color: colors.surface, fontSize: 22, fontWeight: '700', fontFamily: typography.family },
  service: { color: '#B9C4CC', fontSize: 13, fontFamily: typography.family },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  progressLabel: { color: '#B9C4CC', fontSize: 12, fontFamily: typography.family },
  progressValue: { color: colors.gold300, fontSize: 12, fontWeight: '700', fontFamily: typography.family },
  progressTrack: { height: 7, backgroundColor: colors.navy700, borderRadius: radius.pill, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.gold500, borderRadius: radius.pill },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  smallCard: { flexGrow: 1, flexBasis: 150 },
  smallLabel: { color: colors.gold600, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: typography.family },
  smallValue: { color: colors.ink, fontSize: typography.size.body, lineHeight: 21, fontWeight: '600', fontFamily: typography.family },
  smallMeta: { color: colors.muted, fontSize: 11, fontFamily: typography.family },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metric: { flexGrow: 1, flexBasis: 120, minHeight: 86, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: spacing.sm, justifyContent: 'center', gap: 3 },
  metricValue: { color: colors.gold600, fontSize: 22, fontWeight: '700', fontFamily: typography.family },
  metricLabel: { color: colors.slate, fontSize: 11, lineHeight: 16, fontFamily: typography.family },
});
