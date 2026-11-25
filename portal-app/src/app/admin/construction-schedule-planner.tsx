import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import Svg, { Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import { AdminPageHeader } from '@/components/admin-ui';
import { DateField } from '@/components/date-field';
import { Button, Card, Field, Notice, Screen, StateView, StatusPill } from '@/components/ui';
import {
  activitiesFromTemplate, blankActivity, blankProject, calendarLabel, formatBr, newId, planProject,
  PLANNER_TEMPLATES, todayIso, type PlannerActivity, type PlannerCalendar, type PlannerProject, type PlannerResult,
} from '@/lib/schedule-planner';
import { exportPlannerXlsx } from '@/lib/schedule-planner-xlsx';
import { useThemeStyles } from '@/providers/theme-provider';
import { loadPlannerProjects, savePlannerProjects } from '@/services/schedule-planner-storage';
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';

const num = (value: string) => {
  const n = Number(String(value).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dayMs = 86_400_000;
const dayOf = (iso: string) => new Date(`${iso}T12:00:00Z`).getTime() / dayMs;

export default function ConstructionSchedulePlannerScreen() {
  const styles = useThemeStyles(styleDefinitions);
  const [projects, setProjects] = useState<PlannerProject[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger' | 'info'; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void loadPlannerProjects().then((list) => {
      setProjects(list);
      setCurrentId(list[0]?.id ?? null);
      setLoaded(true);
    });
  }, []);

  const persist = (next: PlannerProject[]) => {
    setProjects(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void savePlannerProjects(next).then((error) => { if (error) setMessage({ tone: 'danger', text: error }); });
    }, 400);
  };

  const project = projects.find((p) => p.id === currentId) ?? null;
  const updateProject = (changes: Partial<PlannerProject>) => {
    if (!project) return;
    persist(projects.map((p) => (p.id === project.id ? { ...p, ...changes, updatedAt: new Date().toISOString() } : p)));
  };
  const updateActivity = (id: string, changes: Partial<PlannerActivity>) => {
    if (!project) return;
    updateProject({ activities: project.activities.map((a) => (a.id === id ? { ...a, ...changes } : a)) });
  };

  const createProject = (templateKey?: string) => {
    const base = blankProject();
    if (templateKey) {
      base.activities = activitiesFromTemplate(templateKey);
      base.name = PLANNER_TEMPLATES.find((t) => t.key === templateKey)?.label ?? base.name;
    }
    persist([base, ...projects]);
    setCurrentId(base.id); setMessage(null); setConfirmDelete(false);
  };
  const duplicateProject = () => {
    if (!project) return;
    const copy: PlannerProject = { ...project, id: newId(), name: `${project.name} (cópia)`, activities: project.activities.map((a) => ({ ...a, id: newId() })), updatedAt: new Date().toISOString() };
    persist([copy, ...projects]); setCurrentId(copy.id);
  };
  const deleteProject = () => {
    if (!project) return;
    const next = projects.filter((p) => p.id !== project.id);
    persist(next); setCurrentId(next[0]?.id ?? null); setConfirmDelete(false);
    setMessage({ tone: 'info', text: 'Cronograma excluído deste navegador.' });
  };

  const addActivity = () => {
    if (!project) return;
    const codes = project.activities.map((a) => Number(a.code)).filter(Number.isFinite);
    const nextCode = String((codes.length ? Math.max(...codes) : 0) + 1);
    const lastCode = project.activities.at(-1)?.code ?? '';
    updateProject({ activities: [...project.activities, blankActivity(nextCode, lastCode)] });
  };
  const removeActivity = (id: string) => project && updateProject({ activities: project.activities.filter((a) => a.id !== id) });
  const moveActivity = (id: string, delta: number) => {
    if (!project) return;
    const list = [...project.activities];
    const i = list.findIndex((a) => a.id === id), j = i + delta;
    if (i < 0 || j < 0 || j >= list.length) return;
    const moved = list[i]!; list[i] = list[j]!; list[j] = moved;
    updateProject({ activities: list });
  };

  const calc = useMemo((): { result: PlannerResult | null; error: string | null } => {
    const selected = projects.find((p) => p.id === currentId);
    if (!selected) return { result: null, error: null };
    try { return { result: planProject(selected), error: null }; }
    catch (failure) { return { result: null, error: failure instanceof Error ? failure.message : 'Não foi possível calcular.' }; }
  }, [projects, currentId]);
  const result = calc.result;

  const exportExcel = async () => {
    if (!project || !result) return;
    setBusy(true); setMessage(null);
    try {
      const fileName = await exportPlannerXlsx(project, result);
      setMessage({ tone: 'success', text: `Excel gerado: ${fileName}` });
    } catch (failure) {
      setMessage({ tone: 'danger', text: failure instanceof Error ? failure.message : 'Não foi possível gerar o Excel.' });
    }
    setBusy(false);
  };

  if (!loaded) return <Screen><StateView icon="time-outline" title="Carregando cronogramas…" description="" /></Screen>;

  return (
    <Screen>
      <AdminPageHeader title="Cronograma completo" description="Preencha as etapas da obra e o sistema calcula prazos, deadline, caminho crítico, Curva S e desembolso, e gera o Excel completo." />
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

      <Card>
        <Text style={styles.title}>Meus cronogramas</Text>
        <Text style={styles.meta}>Ficam salvos automaticamente neste navegador. Não alteram contratos, projetos nem clientes.</Text>
        <View style={styles.wrap}>
          {projects.map((p) => (
            <Button key={p.id} title={p.id === currentId ? `● ${p.name}` : p.name} variant={p.id === currentId ? 'primary' : 'secondary'} onPress={() => { setCurrentId(p.id); setConfirmDelete(false); setMessage(null); }} />
          ))}
        </View>
        <View style={styles.wrap}>
          <Button title="Novo em branco" variant="secondary" icon="add" onPress={() => createProject()} />
          {PLANNER_TEMPLATES.map((t) => <Button key={t.key} title={`Novo: ${t.label}`} variant="secondary" onPress={() => createProject(t.key)} />)}
        </View>
        {project ? (
          <View style={styles.wrap}>
            <Button title="Duplicar" variant="ghost" onPress={duplicateProject} />
            {confirmDelete
              ? <><Button title="Confirmar exclusão" variant="danger" onPress={deleteProject} /><Button title="Cancelar" variant="ghost" onPress={() => setConfirmDelete(false)} /></>
              : <Button title="Excluir este cronograma" variant="ghost" onPress={() => setConfirmDelete(true)} />}
          </View>
        ) : null}
      </Card>

      {!project ? (
        <StateView icon="calendar-outline" title="Nenhum cronograma ainda" description="Crie um em branco ou comece por um modelo e ajuste as etapas." />
      ) : (
        <>
          <Card>
            <Text style={styles.title}>Dados da obra</Text>
            <View style={styles.grid}>
              <View style={styles.col}><Field label="Nome da obra / projeto" value={project.name} onChangeText={(v) => updateProject({ name: v })} /></View>
              <View style={styles.col}><Field label="Cliente" value={project.client} onChangeText={(v) => updateProject({ client: v })} /></View>
              <View style={styles.col}><Field label="Endereço" value={project.address} onChangeText={(v) => updateProject({ address: v })} /></View>
              <View style={styles.col}><Field label="Responsável técnica" value={project.responsible} onChangeText={(v) => updateProject({ responsible: v })} /></View>
              <View style={styles.col}><DateField label="Início da obra" value={project.startDate} onChange={(v) => updateProject({ startDate: v })} /></View>
              <View style={styles.col}><DateField label="Deadline (prazo final desejado)" optional value={project.deadline} onChange={(v) => updateProject({ deadline: v })} /></View>
              <View style={styles.col}><DateField label="Data de referência do avanço" value={project.statusDate} onChange={(v) => updateProject({ statusDate: v })} /></View>
            </View>
            <Text style={styles.label}>Dias de trabalho</Text>
            <View style={styles.wrap}>
              {(Object.keys(calendarLabel) as PlannerCalendar[]).map((key) => (
                <Button key={key} title={calendarLabel[key]} variant={project.calendar === key ? 'primary' : 'secondary'} onPress={() => updateProject({ calendar: key })} />
              ))}
            </View>
            <View style={styles.wrap}>
              <Button title={project.nationalHolidays ? 'Feriados nacionais: descontar ✓' : 'Feriados nacionais: não descontar'} variant={project.nationalHolidays ? 'primary' : 'secondary'} onPress={() => updateProject({ nationalHolidays: !project.nationalHolidays })} />
              <Button title={project.weightMode === 'cost' ? 'Peso das etapas: pelo custo ✓' : 'Peso das etapas: pela duração ✓'} variant="secondary" onPress={() => updateProject({ weightMode: project.weightMode === 'cost' ? 'duration' : 'cost' })} />
              <Button title="Referência = hoje" variant="ghost" onPress={() => updateProject({ statusDate: todayIso() })} />
            </View>
            <Field label="Outros feriados ou dias parados (dd/mm/aaaa, separados por vírgula)" value={project.extraHolidays} onChangeText={(v) => updateProject({ extraHolidays: v })} placeholder="Ex.: 20/01/2027, 23/04/2027" />
          </Card>

          <Card>
            <Text style={styles.title}>Etapas e atividades ({project.activities.length})</Text>
            <Text style={styles.meta}>Predecessoras: códigos separados por vírgula. Use + ou − para folga entre etapas (ex.: “3+2” começa 2 dias de trabalho depois de terminar a 3).</Text>
            {project.activities.map((a, index) => {
              const row = result?.rows.find((r) => r.id === a.id);
              return (
                <View key={a.id} style={[styles.activity, row?.critical ? styles.activityCritical : null]}>
                  <View style={styles.activityHead}>
                    <Text style={styles.code}>{a.code || index + 1}</Text>
                    <Text style={styles.activityTitle} numberOfLines={1}>{a.name || 'Nova atividade'}</Text>
                    {row ? <StatusPill label={row.status} tone={row.status === 'Concluída' ? 'success' : row.status === 'Atrasada' ? 'danger' : row.status === 'Em andamento' ? 'warning' : 'neutral'} /> : null}
                    {row?.critical ? <StatusPill label="Crítica" tone="danger" /> : null}
                  </View>
                  {row ? <Text style={styles.meta}>{formatBr(row.start)} → {formatBr(row.finish)} · {row.calendarDays} dias corridos · folga {row.totalFloat} {row.totalFloat === 1 ? 'dia' : 'dias'}</Text> : null}
                  <View style={styles.grid}>
                    <View style={styles.colXs}><Field label="Código" value={a.code} onChangeText={(v) => updateActivity(a.id, { code: v })} /></View>
                    <View style={styles.col}><Field label="Etapa / grupo" value={a.group} onChangeText={(v) => updateActivity(a.id, { group: v })} /></View>
                    <View style={styles.colWide}><Field label="Atividade" value={a.name} onChangeText={(v) => updateActivity(a.id, { name: v })} /></View>
                    <View style={styles.colSm}><Field label="Duração (dias)" keyboardType="number-pad" value={String(a.duration)} onChangeText={(v) => updateActivity(a.id, { duration: Math.round(num(v)) })} /></View>
                    <View style={styles.colSm}><Field label="Predecessoras" value={a.predecessors} onChangeText={(v) => updateActivity(a.id, { predecessors: v })} /></View>
                    <View style={styles.colSm}><Field label="Custo (R$)" keyboardType="decimal-pad" value={a.cost ? String(a.cost).replace('.', ',') : ''} onChangeText={(v) => updateActivity(a.id, { cost: num(v) })} /></View>
                    <View style={styles.colSm}><Field label="Avanço (%)" keyboardType="number-pad" value={String(a.progress)} onChangeText={(v) => updateActivity(a.id, { progress: Math.max(0, Math.min(100, num(v))) })} /></View>
                    <View style={styles.col}><DateField label="Não começar antes de" optional value={a.fixedStart} onChange={(v) => updateActivity(a.id, { fixedStart: v })} /></View>
                    <View style={styles.col}><Field label="Responsável" value={a.responsible} onChangeText={(v) => updateActivity(a.id, { responsible: v })} /></View>
                    <View style={styles.colWide}><Field label="Observações" value={a.notes} onChangeText={(v) => updateActivity(a.id, { notes: v })} /></View>
                  </View>
                  <View style={styles.wrap}>
                    <Button title="Subir" variant="ghost" disabled={index === 0} onPress={() => moveActivity(a.id, -1)} />
                    <Button title="Descer" variant="ghost" disabled={index === project.activities.length - 1} onPress={() => moveActivity(a.id, 1)} />
                    <Button title="Remover" variant="ghost" onPress={() => removeActivity(a.id)} />
                  </View>
                </View>
              );
            })}
            <Button title="Adicionar atividade" variant="secondary" icon="add" onPress={addActivity} />
          </Card>

          {calc.error ? <Notice tone="warning">{calc.error}</Notice> : null}
          {result ? <Dashboard result={result} styles={styles} /> : null}
          {result ? (
            <Card>
              <Text style={styles.title}>Excel completo</Text>
              <Text style={styles.meta}>Resumo com indicadores e gráficos, cronograma detalhado com fórmulas, Gantt colorido, Curva S, desembolso mensal, caminho crítico e calendário de feriados.</Text>
              {Platform.OS === 'web'
                ? <Button title="Gerar Excel (.xlsx)" icon="download-outline" loading={busy} onPress={() => void exportExcel()} />
                : <Notice tone="info">Para gerar o Excel, abra o portal pelo navegador do computador.</Notice>}
            </Card>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function Kpi({ label, value, hint, tone, styles }: { label: string; value: string; hint?: string; tone?: 'danger' | 'success'; styles: any }) {
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiValue, tone === 'danger' ? styles.danger : tone === 'success' ? styles.success : null]}>{value}</Text>
      {hint ? <Text style={styles.meta}>{hint}</Text> : null}
    </View>
  );
}

function Dashboard({ result, styles }: { result: PlannerResult; styles: any }) {
  const late = result.forecastMarginCalendarDays !== null && result.forecastMarginCalendarDays < 0;
  const t0 = dayOf(result.start), t1 = Math.max(t0 + 1, dayOf(result.finish) + 1);
  const pos = (iso: string, end = false) => ((dayOf(iso) + (end ? 1 : 0) - t0) / (t1 - t0)) * 100;
  const inRange = (iso: string | null) => !!iso && iso >= result.start && iso <= result.finish;

  const W = 320, H = 170, L = 30, B = 24;
  const cx = (iso: string) => L + ((dayOf(iso) - t0) / Math.max(1, dayOf(result.finish) - t0)) * (W - L - 8);
  const cy = (v: number) => 10 + (1 - v / 100) * (H - B - 10);
  const planned = result.curve.map((p) => `${cx(p.date)},${cy(p.planned)}`).join(' ');
  const actual = result.curve.filter((p) => p.actual !== null).map((p) => `${cx(p.date)},${cy(p.actual as number)}`).join(' ');
  const maxMonth = Math.max(1, ...result.months.map((m) => m.cost));
  const bw = (W - L - 8) / Math.max(1, result.months.length);

  return (
    <>
      {result.warnings.map((w) => <Notice key={w} tone="warning">{w}</Notice>)}
      <Card>
        <Text style={styles.title}>Prazos e andamento</Text>
        <View style={styles.kpis}>
          <Kpi styles={styles} label="Início" value={formatBr(result.start)} />
          <Kpi styles={styles} label="Término planejado" value={formatBr(result.finish)} hint={`${result.workDays} dias de trabalho · ${result.calendarDays} corridos`} />
          <Kpi styles={styles} label="Deadline" value={result.deadline ? formatBr(result.deadline) : 'Não informado'}
            hint={result.deadline ? (result.deadlineMarginCalendarDays! >= 0 ? `${result.deadlineMarginCalendarDays} dias de folga no plano` : `Plano passa ${-result.deadlineMarginCalendarDays!} dias do deadline`) : undefined}
            tone={result.deadline ? (result.deadlineMarginCalendarDays! >= 0 ? 'success' : 'danger') : undefined} />
          <Kpi styles={styles} label="Término previsto no ritmo atual" value={formatBr(result.forecastFinish)}
            hint={result.deadline ? (late ? `Risco: ${-result.forecastMarginCalendarDays!} dias de atraso` : 'Dentro do deadline') : undefined}
            tone={late ? 'danger' : result.deadline ? 'success' : undefined} />
          <Kpi styles={styles} label="Avanço planejado × real" value={`${result.plannedPercent.toFixed(1)}% × ${result.actualPercent.toFixed(1)}%`} hint={`Referência: ${formatBr(result.statusDate)}`}
            tone={result.actualPercent + 2 < result.plannedPercent ? 'danger' : 'success'} />
          <Kpi styles={styles} label="Índice de prazo (SPI)" value={result.spi === null ? '—' : result.spi.toFixed(2)} hint="1,00 = no ritmo; abaixo de 1 = atrasado" tone={result.spi !== null && result.spi < 0.95 ? 'danger' : undefined} />
          <Kpi styles={styles} label="Custo total" value={brl(result.totalCost)} />
          <Kpi styles={styles} label="Atividades" value={`${result.counts.done}/${result.counts.total} concluídas`} hint={`${result.counts.running} em andamento · ${result.counts.delayed} atrasadas`} tone={result.counts.delayed ? 'danger' : undefined} />
        </View>
        <Text style={styles.meta}>Caminho crítico: {result.criticalCodes.join(' → ') || '—'}</Text>
      </Card>

      <Card>
        <Text style={styles.title}>Gantt</Text>
        <View style={styles.gantt}>
          {result.rows.map((r) => (
            <View key={r.id} style={styles.ganttRow}>
              <Text style={styles.ganttLabel} numberOfLines={1}>{r.code} · {r.name}</Text>
              <View style={styles.ganttLane}>
                <View style={[styles.ganttPlan, r.critical ? styles.barCritical : null, { left: `${pos(r.start)}%`, width: `${Math.max(1, pos(r.finish, true) - pos(r.start))}%` }]}>
                  <View style={[styles.ganttDone, r.critical ? styles.barCriticalDone : null, { width: `${r.progress}%` }]} />
                </View>
                {inRange(result.statusDate) ? <View style={[styles.marker, styles.markerToday, { left: `${pos(result.statusDate)}%` }]} /> : null}
                {inRange(result.deadline) ? <View style={[styles.marker, styles.markerDeadline, { left: `${pos(result.deadline!)}%` }]} /> : null}
              </View>
            </View>
          ))}
        </View>
        <Text style={styles.meta}>Parte cheia = avanço realizado · vermelho = caminho crítico · linha dourada = data de referência · linha vermelha = deadline</Text>
      </Card>

      <View style={styles.charts}>
        <Card style={{ flexGrow: 1, flexBasis: 320 }}>
          <Text style={styles.title}>Curva S</Text>
          <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
            {[0, 50, 100].map((v) => <Line key={v} x1={L} x2={W - 8} y1={cy(v)} y2={cy(v)} stroke="#8A94A3" strokeWidth={0.4} />)}
            {[0, 50, 100].map((v) => <SvgText key={`t${v}`} x={2} y={cy(v) + 3} fontSize={8} fill="#8A94A3">{v}%</SvgText>)}
            <Polyline points={planned} fill="none" stroke="#B89A63" strokeWidth={2.5} />
            {actual ? <Polyline points={actual} fill="none" stroke="#346A91" strokeWidth={2.5} /> : null}
            <SvgText x={L} y={H - 6} fontSize={8} fill="#8A94A3">{formatBr(result.start)}</SvgText>
            <SvgText x={W - 60} y={H - 6} fontSize={8} fill="#8A94A3">{formatBr(result.finish)}</SvgText>
          </Svg>
          <Text style={styles.meta}>Dourado = planejado · azul = realizado</Text>
        </Card>
        <Card style={{ flexGrow: 1, flexBasis: 320 }}>
          <Text style={styles.title}>Desembolso mensal</Text>
          {result.totalCost > 0 ? (
            <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
              {result.months.map((m, i) => {
                const h = (m.cost / maxMonth) * (H - B - 10);
                return <Rect key={m.month} x={L + i * bw + bw * 0.15} y={H - B - h} width={bw * 0.7} height={h} fill="#B89A63" />;
              })}
              {result.months.map((m, i) => (result.months.length <= 12 || i % 2 === 0
                ? <SvgText key={`l${m.month}`} x={L + i * bw + 2} y={H - 8} fontSize={7} fill="#8A94A3">{m.label}</SvgText> : null))}
            </Svg>
          ) : <Text style={styles.meta}>Informe custos nas atividades para ver o desembolso.</Text>}
          {result.months.length ? <Text style={styles.meta}>Maior mês: {brl(maxMonth)}</Text> : null}
        </Card>
      </View>
    </>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  title: { color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '700' as const, fontFamily: typography.family, marginBottom: spacing.xs },
  label: { color: colors.slate, fontSize: 13, fontWeight: '600' as const, fontFamily: typography.family, marginTop: spacing.sm },
  meta: { color: colors.slate, fontSize: 12, lineHeight: 18, fontFamily: typography.family },
  wrap: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.sm, marginTop: spacing.sm },
  grid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.sm },
  col: { flexGrow: 1, flexBasis: 220, minWidth: 0 },
  colWide: { flexGrow: 2, flexBasis: 320, minWidth: 0 },
  colSm: { flexGrow: 1, flexBasis: 120, minWidth: 0 },
  colXs: { flexGrow: 0, flexBasis: 80, minWidth: 0 },
  activity: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm, gap: spacing.xs },
  activityCritical: { borderColor: colors.danger },
  activityHead: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm, flexWrap: 'wrap' as const },
  code: { color: colors.gold600, fontWeight: '800' as const, fontSize: 14, fontFamily: typography.family },
  activityTitle: { color: colors.ink, fontWeight: '700' as const, fontSize: 14, flexShrink: 1, fontFamily: typography.family },
  kpis: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.sm, marginVertical: spacing.sm },
  kpi: { flexGrow: 1, flexBasis: 200, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.sm, backgroundColor: colors.surfaceRaised },
  kpiLabel: { color: colors.slate, fontSize: 12, fontFamily: typography.family },
  kpiValue: { color: colors.ink, fontSize: 18, fontWeight: '800' as const, fontFamily: typography.family, marginVertical: 2 },
  danger: { color: colors.danger },
  success: { color: colors.success },
  gantt: { gap: 4, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.sm },
  ganttRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm, minHeight: 22 },
  ganttLabel: { width: 170, color: colors.ink, fontSize: 11, fontFamily: typography.family },
  ganttLane: { flex: 1, height: 16, backgroundColor: colors.surfaceRaised, borderRadius: 4, position: 'relative' as const, overflow: 'hidden' as const },
  ganttPlan: { position: 'absolute' as const, top: 2, bottom: 2, borderRadius: 3, backgroundColor: colors.infoSoft, borderWidth: 1, borderColor: colors.info, overflow: 'hidden' as const },
  ganttDone: { height: '100%' as const, backgroundColor: colors.info },
  barCritical: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  barCriticalDone: { backgroundColor: colors.danger },
  marker: { position: 'absolute' as const, top: 0, bottom: 0, width: 2 },
  markerToday: { backgroundColor: colors.gold600 },
  markerDeadline: { backgroundColor: colors.danger },
  charts: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.sm },
});
