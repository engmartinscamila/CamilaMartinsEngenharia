import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { AdminPageHeader } from '@/components/admin-ui';
import { Button, Card, Field, Notice, Screen, StateView } from '@/components/ui';
import { formatCurrency, isValidIsoDate } from '@/lib/format';
import {
  listApprovedSchedules, loadScheduleMeasurementOverview, recordScheduleMeasurement,
  type ApprovedScheduleOption, type ScheduleMeasurementOverview, type NewScheduleMeasurement,
} from '@/services/construction-schedule-measurement-service';

interface EntryDraft {
  selected: boolean;
  progress: string;
  cost: string;
  actualStart: string;
  actualFinish: string;
}
const displayPercent = (value: number | null) => value === null ? 'Não medido' : `${value.toFixed(2)}%`;
const displayCost = (value: number | null) => value === null ? 'Não informado' : formatCurrency(value);

export default function ConstructionScheduleMeasurementsScreen() {
  const [schedules, setSchedules] = useState<ApprovedScheduleOption[]>([]);
  const [active, setActive] = useState<ApprovedScheduleOption | null>(null);
  const [overview, setOverview] = useState<ScheduleMeasurementOverview | null>(null);
  const [drafts, setDrafts] = useState<Record<string, EntryDraft>>({});
  const [reference, setReference] = useState(new Date().toISOString().slice(0, 10));
  const [measuredOn, setMeasuredOn] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void listApprovedSchedules().then((result) => {
      if (!mounted) return;
      setSchedules(result.data);
      setError(result.error);
    });
    return () => { mounted = false; };
  }, []);

  const load = async (schedule: ApprovedScheduleOption, date: string) => {
    if (!isValidIsoDate(date) || busy) { setError('Data de consulta inválida.'); return; }
    setBusy(true); setError(null);
    const result = await loadScheduleMeasurementOverview(schedule.id, date);
    setBusy(false);
    if (result.error || !result.data) { setError(result.error ?? 'Não foi possível conferir medições.'); return; }
    setActive(schedule); setOverview(result.data);
    setDrafts({});
  };
  const update = (code: string, changes: Partial<EntryDraft>) => {
    setDrafts((current) => ({...current, [code]: {
      selected: false, progress: '', cost: '', actualStart: '', actualFinish: '', ...current[code], ...changes,
    }}));
    setSuccess(null);
  };
  const save = async () => {
    if (!active || !overview || busy) return;
    if (!isValidIsoDate(measuredOn) || measuredOn > new Date().toISOString().slice(0, 10)) {
      setError('Informe uma data real de medição que não esteja no futuro.'); return;
    }
    if (reason.trim().length < 10) { setError('Descreva a vistoria, a evidência ou o motivo da correção (mínimo de 10 caracteres).'); return; }
    const entries: NewScheduleMeasurement[] = [];
    for (const row of overview.items) {
      const draft = drafts[row.code];
      if (!draft?.selected) continue;
      if (!/^(100|[1-9]?[0-9])$/.test(draft.progress.trim())) {
        setError(`Informe avanço inteiro entre 0 e 100 para a atividade ${row.code}.`); return;
      }
      const costText = draft.cost.trim().replace(',', '.');
      if (costText && !/^\d+(\.\d{1,2})?$/.test(costText)) {
        setError(`Informe custo acumulado em reais, com até duas casas, para ${row.code}.`); return;
      }
      if ([draft.actualStart, draft.actualFinish].some((date) => date && (!isValidIsoDate(date) || date > measuredOn))) {
        setError(`Datas reais da atividade ${row.code} devem ser válidas e anteriores ou iguais à medição.`); return;
      }
      if (draft.actualStart && draft.actualFinish && draft.actualFinish < draft.actualStart) {
        setError(`Fim real da atividade ${row.code} não pode anteceder o início.`); return;
      }
      entries.push({code: row.code, progress: Number(draft.progress.trim()),
        actualCost: costText ? Number(costText) : null,
        actualStart: draft.actualStart || null, actualFinish: draft.actualFinish || null});
    }
    if (!entries.length) { setError('Marque pelo menos uma atividade efetivamente medida.'); return; }
    setBusy(true); setError(null); setSuccess(null);
    const result = await recordScheduleMeasurement(active.id, measuredOn, entries, reason);
    setBusy(false);
    if (result) { setError(result); return; }
    setSuccess(`${entries.length} atividade(s) medida(s) e registradas com histórico imutável. A linha de base permanece preservada.`);
    setReason(''); setDrafts({});
    const refreshed = await loadScheduleMeasurementOverview(active.id, reference);
    if (refreshed.error || !refreshed.data) setError(refreshed.error ?? 'Medição registrada, mas não foi possível recarregar o acompanhamento.');
    else setOverview(refreshed.data);
  };

  return <Screen>
    <AdminPageHeader title="Medições do cronograma contratado" description="Registre avanço e custo real somente a partir de vistoria/evidência; preserve a linha de base." />
    <Notice tone="info">Medições e correções são eventos datados e imutáveis. Custos da obra são separados dos honorários; um campo vazio não significa custo zero.</Notice>
    {error ? <Notice tone="danger">{error}</Notice> : null}
    {success ? <Notice tone="success">{success}</Notice> : null}
    {!active ? <Card>
      <Text>Selecione um cronograma completo já aprovado</Text>
      {schedules.map((item) => <Button key={item.id} loading={busy} title={`${item.title} — linha de base v${item.baselineVersion}`} variant="secondary" onPress={() => void load(item, reference)} />)}
      {!schedules.length ? <StateView icon="calendar-outline" title="Nenhuma linha de base disponível" description="O cronograma deve estar formalmente contratado e aprovado antes de registrar medições." /> : null}
    </Card> : null}
    {active && overview ? <>
      <Button title="Trocar cronograma" variant="ghost" onPress={() => {setActive(null);setOverview(null);setDrafts({});setError(null);}} />
      <Card>
        <Text>{active.title} — linha de base v{overview.baselineVersion}</Text>
        <Field label="Data de consulta dos indicadores (AAAA-MM-DD)" value={reference} onChangeText={setReference} />
        <Button title="Recalcular na data informada" loading={busy} disabled={busy} variant="secondary" onPress={() => void load(active, reference)} />
        <Text>Planejado financeiro no corte: {displayPercent(overview.summary.plannedFinancialPercent)}</Text>
        <Text>Real medido ponderado: {displayPercent(overview.summary.actualWeightedProgressPercent)}</Text>
        <Text>Desvio de avanço: {overview.summary.progressDeviationPoints === null ? 'Indisponível até medir todas as atividades' : `${overview.summary.progressDeviationPoints.toFixed(2)} p.p.`}</Text>
        <Text>Orçamento de execução: {displayCost(overview.summary.totalConstructionCost)}</Text>
        <Text>Custo previsto no corte: {displayCost(overview.summary.plannedConstructionCostAtDate)}</Text>
        <Text>Custo real registrado: {displayCost(overview.summary.actualConstructionCostAtDate)}</Text>
        <Text>Progresso físico: {displayPercent(overview.summary.actualPhysicalPercent)}</Text>
        <Notice tone="info">O peso físico separado exige quantitativos conferidos. Sem esses dados, não será substituído artificialmente pelo peso financeiro.</Notice>
      </Card>
      <Card>
        <Text>Nova medição / correção auditável</Text>
        <Field label="Data da vistoria (AAAA-MM-DD)" value={measuredOn} onChangeText={setMeasuredOn} />
        <Field label="Justificativa, evidência ou correção" value={reason} multiline onChangeText={setReason} />
        {overview.items.map((item) => {
          const draft = drafts[item.code] ?? {selected:false,progress:'',cost:'',actualStart:'',actualFinish:''};
          return <Card key={item.id}>
            <Text>{item.code} — {item.activity}</Text>
            <Text>Peso financeiro {item.weightPercent}% • Previsto de obra {displayCost(item.plannedCost)}</Text>
            <Text>Última medição: {displayPercent(item.progress)} • Custo registrado: {displayCost(item.cost)}</Text>
            <Button title={draft.selected ? 'Selecionada para medir ✓' : 'Medir esta atividade'} variant="secondary" onPress={() => update(item.code, {selected: !draft.selected})} />
            {draft.selected ? <>
              <Field label="Avanço constatado (0–100%; inteiro)" value={draft.progress} keyboardType="numeric" onChangeText={(progress) => update(item.code,{progress})} />
              <Field label="Custo acumulado realizado desta atividade (R$; opcional)" value={draft.cost} keyboardType="decimal-pad" onChangeText={(cost) => update(item.code,{cost})} />
              <Field label="Início real, se comprovado (AAAA-MM-DD)" value={draft.actualStart} onChangeText={(actualStart) => update(item.code,{actualStart})} />
              <Field label="Fim real, se comprovado (AAAA-MM-DD)" value={draft.actualFinish} onChangeText={(actualFinish) => update(item.code,{actualFinish})} />
            </> : null}
          </Card>;
        })}
        <Button title="Registrar medição datada (não altera a linha de base)" loading={busy} disabled={busy} onPress={() => void save()} />
      </Card>
      <Card>
        <Text>Curva S — planejado × medido</Text>
        {overview.curve.map((point) => <Text key={point.date}>{point.date}: planejado {displayPercent(point.plannedFinancialPercent)} • realizado {displayPercent(point.measuredFinancialPercent)}{point.measurementDate ? ` (vistoria ${point.measurementDate})` : ''}</Text>)}
      </Card>
      <Card>
        <Text>Histórico auditável: {overview.history.length} evento(s)</Text>
        {overview.history.slice(-30).reverse().map((event) => <Text key={event.id}>{event.measuredOn} — {event.code}: {event.progress}% • custo {displayCost(event.cost)} • {event.reason}</Text>)}
        {overview.history.length > 30 ? <Notice tone="info">Exibindo as 30 últimas entradas; o cálculo usa o histórico completo consultado.</Notice> : null}
      </Card>
    </> : null}
  </Screen>;
}
