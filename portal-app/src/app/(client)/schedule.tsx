import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { ConstructionScheduleClientGantt } from '@/components/construction-schedule-client-gantt';
import { ConstructionScheduleCurve } from '@/components/construction-schedule-curve';
import { ProjectPicker } from '@/components/project-picker';
import { Button, Card, Notice, PageHeader, Screen, StateView, StatusPill } from '@/components/ui';
import { formatDate, humanizeStatus } from '@/lib/format';
import { useProject } from '@/providers/project-provider';
import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import { listSchedule } from '@/services/portal-service';
import {
  loadClientConstructionSchedulePublication,
  type ClientConstructionSchedulePublication,
} from '@/services/construction-schedule-publication-service';
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';
import type { ScheduleStageSummary } from '@/types/domain';

function statusTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' {
  if (status === 'concluido' || status === 'concluida') return 'success';
  if (status === 'cancelado' || status === 'cancelada') return 'danger';
  if (status === 'em_andamento') return 'warning';
  return 'neutral';
}

export default function ScheduleScreen() {
  const { selectedProject } = useProject();
  const [stages, setStages] = useState<ScheduleStageSummary[]>([]);
  const [published, setPublished] = useState<ClientConstructionSchedulePublication | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { colors } = useAppTheme();
  const styles = useThemeStyles(styleDefinitions);

  const load = useCallback(async () => {
    if (!selectedProject) {
      setStages([]);
      setPublished(null);
      return;
    }
    // Limpar antes da nova leitura evita exibir momentaneamente dados do
    // cliente/projeto anterior durante uma troca de contrato.
    setStages([]);
    setPublished(null);
    setLoading(true);
    setError(null);
    const projectId = selectedProject.id;
    const [simple, approved] = await Promise.all([
      listSchedule(projectId), loadClientConstructionSchedulePublication(projectId),
    ]);
    setStages(simple.data);
    setPublished(approved.data?.projectId === projectId ? approved.data : null);
    setError(simple.error ?? approved.error);
    setLoading(false);
  }, [selectedProject]);

  useEffect(() => {
    const task = setTimeout(() => void load(), 0);
    return () => clearTimeout(task);
  }, [load]);

  const overall = useMemo(() => {
    const known = stages.filter((stage) => stage.progress !== null);
    if (!known.length) return null;
    const weighted = known.filter((stage) => stage.weight !== null && stage.weight! > 0);
    if (weighted.length === known.length) {
      const totalWeight = weighted.reduce((sum, stage) => sum + stage.weight!, 0);
      return totalWeight ? Math.round(weighted.reduce((sum, stage) => sum + stage.progress! * stage.weight!, 0) / totalWeight) : null;
    }
    return Math.round(known.reduce((sum, stage) => sum + stage.progress!, 0) / known.length);
  }, [stages]);

  const publishedDeviation=published?.summary?.actualPercent===null||published?.summary?.actualPercent===undefined
    ? null
    : published.summary.actualPercent-published.summary.plannedPercent;

  return (
    <Screen>
      <PageHeader eyebrow="Planejamento" title="Cronograma e linha do tempo" description="Etapas reais, datas e andamento do projeto selecionado." />
      <ProjectPicker />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {loading ? <ActivityIndicator color={colors.gold600} /> : null}
      {published && !loading ? <>
        <Card>
          <Text style={styles.overallTitle}>Cronograma físico-financeiro contratado — versão publicada {published.version}</Text>
          <Text style={styles.dates}>{published.title}</Text>
          <Text style={styles.dates}>Planejamento: {formatDate(published.plannedStart, 'Não informado')} — {formatDate(published.plannedFinish, 'Não informado')}</Text>
          {published.summary?<>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}><Text style={styles.order}>PLANEJADO</Text><Text style={styles.overallValue}>{published.summary.plannedPercent.toFixed(1)}%</Text></View>
              <View style={styles.summaryItem}><Text style={styles.order}>REALIZADO MEDIDO</Text><Text style={styles.overallValue}>{published.summary.actualPercent===null?'—':`${published.summary.actualPercent.toFixed(1)}%`}</Text></View>
              <View style={styles.summaryItem}><Text style={styles.order}>DESVIO</Text><Text style={styles.overallValue}>{publishedDeviation===null?'—':`${publishedDeviation.toFixed(1)} p.p.`}</Text></View>
              <View style={styles.summaryItem}><Text style={styles.order}>PRAZO</Text><Text style={styles.summaryDate}>{formatDate(published.summary.deadline,'Não informado')}</Text></View>
            </View>
            <Text style={styles.description}>Indicadores na data de referência {formatDate(published.summary.referenceDate)}. O realizado só considera medições registradas.</Text>
          </>:null}
          <Text style={styles.description}>Resumo liberado pela engenharia em {formatDate(published.publishedAt)}. Custos, pesos internos, honorários e documentos comerciais não são compartilhados aqui.</Text>
          <ConstructionScheduleClientGantt publication={published} />
        </Card>
        {published.curve.length?<ConstructionScheduleCurve
          title="Curva S simplificada"
          description="Comparação do planejamento acumulado com o avanço efetivamente medido."
          points={published.curve.map(point=>({date:point.date,planned:point.plannedPercent,actual:point.actualPercent}))}
        />:null}
        <Card>
          <Text style={styles.overallTitle}>Etapas publicadas</Text>
          {published.activities.map((activity) => <View key={activity.code} style={styles.publishedStage}>
            <Text style={styles.title}>{activity.code} — {activity.activity}</Text>
            <Text style={styles.dates}>{formatDate(activity.planned_start, 'Início não informado')} — {formatDate(activity.planned_finish, 'Fim não informado')}</Text>
            {activity.actual_progress === null ? <Text style={styles.progressLabel}>Avanço ainda não medido</Text> : <>
              <View style={styles.track}><View style={[styles.progress, {width:`${Math.max(0,Math.min(100,activity.actual_progress))}%`}]} /></View>
              <Text style={styles.progressLabel}>{activity.actual_progress}% medido em {formatDate(activity.measurement_date)}</Text>
            </>}
          </View>)}
        </Card>
      </> : null}
      {overall !== null && !loading ? (
        <Card>
          <View style={styles.overallHeader}><Text style={styles.overallTitle}>Progresso calculado das etapas simples</Text><Text style={styles.overallValue}>{overall}%</Text></View>
          <View style={styles.track}><View style={[styles.progress, { width: `${overall}%` }]} /></View>
        </Card>
      ) : null}
      {!loading && selectedProject && stages.length === 0 && !published ? (
        <StateView actionLabel="Atualizar" description="As etapas aparecerão assim que o cronograma for publicado pela equipe." icon="git-branch-outline" onAction={() => void load()} title="Cronograma em preparação" />
      ) : null}
      <View style={styles.timeline}>
        {stages.map((stage, index) => (
          <View key={stage.id} style={styles.stageRow}>
            <View style={styles.rail}>
              <View style={[styles.dot, statusTone(stage.status) === 'success' && styles.dotComplete]} />
              {index < stages.length - 1 ? <View style={styles.line} /> : null}
            </View>
            <Card style={styles.stageCard}>
              <View style={styles.stageHeader}>
                <View style={{ flex: 1 }}><Text style={styles.order}>ETAPA {index + 1}</Text><Text style={styles.title}>{stage.title}</Text></View>
                <StatusPill label={humanizeStatus(stage.status)} tone={statusTone(stage.status)} />
              </View>
              <Text style={styles.dates}>{formatDate(stage.startDate, 'Início não informado')} — {formatDate(stage.endDate, 'Término não informado')}</Text>
              {stage.description ? <Text style={styles.description}>{stage.description}</Text> : null}
              {stage.progress !== null ? <><View style={styles.track}><View style={[styles.progress, { width: `${stage.progress}%` }]} /></View><Text style={styles.progressLabel}>{stage.progress}% concluído</Text></> : <Text style={styles.progressLabel}>Progresso não informado</Text>}
            </Card>
          </View>
        ))}
      </View>
      {stages.length > 0 || published ? <Button loading={loading} onPress={() => void load()} title="Atualizar cronograma" variant="ghost" /> : null}
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  overallHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  overallTitle: { color: colors.ink, fontSize: typography.size.body, fontWeight: '700', fontFamily: typography.family },
  overallValue: { color: colors.gold600, fontSize: 22, fontWeight: '700', fontFamily: typography.family },
  summaryGrid:{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm},
  summaryItem:{minWidth:130,flexGrow:1,borderWidth:1,borderColor:colors.line,borderRadius:radius.md,padding:spacing.sm},
  summaryDate:{color:colors.ink,fontSize:typography.size.body,fontWeight:'700',fontFamily:typography.family},
  timeline: { gap: 0 },
  stageRow: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm },
  rail: { width: 22, alignItems: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7, marginTop: spacing.lg, backgroundColor: colors.surface, borderWidth: 3, borderColor: colors.gold500, zIndex: 1 },
  dotComplete: { backgroundColor: colors.success, borderColor: colors.success },
  line: { width: 2, flex: 1, minHeight: 30, backgroundColor: colors.line },
  stageCard: { flex: 1, marginBottom: spacing.sm },
  stageHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  order: { color: colors.gold600, fontSize: 10, fontWeight: '700', letterSpacing: 1, fontFamily: typography.family },
  title: { color: colors.ink, fontSize: typography.size.bodyLarge, marginTop: 3, fontWeight: '700', fontFamily: typography.family },
  dates: { color: colors.muted, fontSize: 12, fontFamily: typography.family },
  description: { color: colors.slate, fontSize: 13, lineHeight: 19, fontFamily: typography.family },
  track: { height: 8, borderRadius: radius.pill, overflow: 'hidden', backgroundColor: colors.line },
  progress: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.gold500 },
  progressLabel: { color: colors.muted, fontSize: 11, fontFamily: typography.family },
  publishedStage: {paddingVertical:spacing.sm,borderTopWidth:1,borderTopColor:colors.line,gap:spacing.xs},
});