import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Text } from 'react-native';

import { DashboardSection, KpiGrid, KpiTile, ProgressRow, StackedBar } from '@/components/dashboard-ui';
import { Card, Notice } from '@/components/ui';
import { stagesProgress, todayInSaoPaulo } from '@/lib/dashboard-model';
import { formatDate } from '@/lib/format';
import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import { listSchedule } from '@/services/portal-service';
import { type ThemeColors, typography } from '@/theme/tokens';
import type { ScheduleStageSummary } from '@/types/domain';

const DONE = ['concluido', 'concluida'];
const plain = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Painel do cliente: somente o acompanhamento simples das etapas (tabela cronograma),
 * que já é exibido ao cliente. O cronograma físico-financeiro completo continua
 * restrito à tela de Cronograma e à publicação contratada.
 */
export function ClientProgressPanel({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useThemeStyles(styleDefinitions);
  const [stages, setStages] = useState<ScheduleStageSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // O componente é montado com key do projeto: uma troca de projeto recomeça do zero.
    let active = true;
    void listSchedule(projectId).then((result) => {
      if (!active) return;
      setStages(result.data); setError(result.error); setLoaded(true);
    });
    return () => { active = false; };
  }, [projectId]);

  const today = todayInSaoPaulo();
  const summary = useMemo(() => stagesProgress(stages, today), [stages, today]);
  if (!loaded) return null;
  if (error) return <Notice tone="warning">{error} O andamento por etapas não foi exibido.</Notice>;
  if (!summary.total) return null;

  const isDone = (stage: ScheduleStageSummary) => DONE.includes(plain(stage.status)) || (stage.progress ?? 0) >= 100;
  const isLate = (stage: ScheduleStageSummary) => Boolean(stage.endDate && stage.endDate < today && !isDone(stage));
  const open = stages.filter((stage) => !['cancelado', 'cancelada'].includes(plain(stage.status)) && !isDone(stage));
  const upcoming = open.slice(0, 5);
  const inProgress = open.filter((stage) => (stage.progress ?? 0) > 0).length;

  return <DashboardSection actionLabel="Cronograma" description="Atualizado pela equipe técnica a cada etapa." onAction={() => router.push('/(client)/schedule')} title="Andamento do seu projeto">
    <KpiGrid>
      <KpiTile hint="Média ponderada das etapas" label="Andamento" value={summary.progress === null ? null : `${summary.progress}%`} />
      <KpiTile hint={`de ${summary.total} etapas`} label="Etapas concluídas" tone="success" value={summary.done} />
      <KpiTile hint={summary.late ? 'Prazo previsto ultrapassado' : 'Dentro dos prazos previstos'} label="Etapas com prazo vencido" tone={summary.late ? 'warning' : 'success'} value={summary.late} />
    </KpiGrid>
    <Card>
      <StackedBar parts={[
        { label: 'Concluídas', value: summary.done, color: colors.success },
        { label: 'Em andamento', value: inProgress, color: colors.gold600 },
        { label: 'A iniciar', value: open.length - inProgress, color: colors.line },
      ]} />
      {upcoming.length ? <Text style={styles.subtitle}>Próximas etapas</Text> : <Text style={styles.subtitle}>Todas as etapas foram concluídas.</Text>}
      {upcoming.map((stage) => <ProgressRow badge={isLate(stage) ? 'Prazo vencido' : undefined} key={stage.id} subtitle={stage.endDate ? `Previsão ${formatDate(stage.endDate)}` : 'Previsão a definir'} title={stage.title} tone={isLate(stage) ? 'warning' : 'neutral'} value={stage.progress ?? 0} />)}
    </Card>
  </DashboardSection>;
}

const styleDefinitions = (colors: ThemeColors) => ({
  subtitle: { color: colors.slate, fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.8, textTransform: 'uppercase' as const, marginTop: 8, fontFamily: typography.family },
});
