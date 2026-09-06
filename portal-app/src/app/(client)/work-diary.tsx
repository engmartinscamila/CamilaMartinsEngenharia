import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { ProjectPicker } from '@/components/project-picker';
import { Button, Card, Notice, PageHeader, Screen, StateView, StatusPill } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useProject } from '@/providers/project-provider';
import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import { getProjectPortalSettings, listWorkDiary } from '@/services/operations-service';
import { spacing, ThemeColors, typography } from '@/theme/tokens';
import type { WorkDiarySummary } from '@/types/domain';

export default function ClientWorkDiaryScreen() {
  const { selectedProject } = useProject();
  const { colors } = useAppTheme();
  const styles = useThemeStyles(styleDefinitions);
  const [entries, setEntries] = useState<WorkDiarySummary[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!selectedProject) return;
    setLoading(true);
    const [diary, config] = await Promise.all([listWorkDiary(selectedProject.id), getProjectPortalSettings(selectedProject.id)]);
    setEntries(diary.data); setEnabled(config.data.showWorkDiary); setError(diary.error ?? config.error); setLoading(false);
  }, [selectedProject]);
  useEffect(() => { const task = setTimeout(() => void load(), 0); return () => clearTimeout(task); }, [load]);

  return <Screen>
    <PageHeader eyebrow="Evolução da obra" title="Diário de obra" description="Registros oficiais compartilhados pela equipe técnica." />
    <ProjectPicker />
    {error ? <Notice tone="warning">{error}</Notice> : null}
    {loading ? <ActivityIndicator color={colors.gold600} /> : null}
    {!enabled ? <StateView icon="eye-off-outline" title="Módulo não liberado" description="O diário deste projeto ainda é interno." /> : !loading && entries.length === 0 ? <StateView icon="book-outline" title="Nenhum registro compartilhado" description="Os registros liberados aparecerão aqui." /> : entries.map((entry) => <Card key={entry.id}><View style={styles.header}><Text style={styles.title}>{formatDate(entry.entryDate)}</Text><StatusPill label="registro técnico" tone="success" /></View><Text style={styles.meta}>{entry.weather || 'Clima não informado'} • {entry.teamCount ?? '—'} pessoa(s)</Text><Text style={styles.body}>{entry.activities}</Text>{entry.occurrences ? <Notice tone="warning">Ocorrências: {entry.occurrences}</Notice> : null}{entry.nextSteps ? <Text style={styles.meta}>Próximos passos: {entry.nextSteps}</Text> : null}</Card>)}
    <Button loading={loading} onPress={() => void load()} title="Atualizar diário" variant="secondary" />
  </Screen>;
}

const styleDefinitions = (colors: ThemeColors) => ({
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  title: { color: colors.ink, fontSize: 15, fontWeight: '700', fontFamily: typography.family },
  body: { color: colors.slate, fontSize: 13, lineHeight: 20, fontFamily: typography.family },
  meta: { color: colors.muted, fontSize: 11, lineHeight: 17, fontFamily: typography.family },
});
