import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Text } from 'react-native';

import { AdminPageHeader } from '@/components/admin-ui';
import { Button, Card, Field, Notice, Screen, StateView } from '@/components/ui';
import { isValidIsoDate } from '@/lib/format';
import { planConstructionSchedule, type WorkCalendar } from '@/lib/construction-schedule-engine';
import {
  approveVerifiedSchedule,
  loadScheduleCommercialOptions,
  previewScheduleTemplate,
  saveVerifiedSchedule,
  type ScheduleCommercialOptions,
  type ScheduleTemplateItem,
  type ScheduleTemplatePreview,
} from '@/services/construction-schedule-contract-service';

const templates = [
  { code: 'residential_reference', title: 'Obra residencial nova — referência' },
  { code: 'renovation_reference', title: 'Reforma — referência' },
  { code: 'partial_scope', title: 'Execução parcial — escopo contratado' },
  { code: 'commercial_reference', title: 'Obra comercial — referência' },
] as const;

type DraftRow = ScheduleTemplateItem & {
  selected: boolean;
  confirmed: boolean;
  duration: string;
  cost: string;
  weight: string;
  sourceCode: string;
  predecessor: string;
};
const numeric = (value: string) => Number(value.replace(',', '.'));

export default function NewConstructionScheduleScreen() {
  const router = useRouter();
  const [options, setOptions] = useState<ScheduleCommercialOptions | null>(null);
  const [projectId, setProjectId] = useState('');
  const [quoteId, setQuoteId] = useState('');
  const [contractId, setContractId] = useState('');
  const [templateCode, setTemplateCode] = useState('');
  const [template, setTemplate] = useState<ScheduleTemplatePreview | null>(null);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [startDate, setStartDate] = useState('');
  const [calendar, setCalendar] = useState<WorkCalendar>('weekdays');
  const [manualWeightsApproved, setManualWeightsApproved] = useState(false);
  const [saveConfirmed, setSaveConfirmed] = useState(false);
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void loadScheduleCommercialOptions().then((result) => {
      if (!mounted) return;
      setOptions(result.data);
      setError(result.error);
    });
    return () => { mounted = false; };
  }, []);

  const project = options?.projects.find((item) => item.id === projectId);
  const quote = options?.quotes.find((item) => item.id === quoteId);
  const contracts = options?.contracts.filter((item) =>
    item.linkedProjectId === projectId && item.linkedClientId === project?.clientId &&
    item.linkedContractId === project?.contractId &&
    options.links.some((link) => link.quoteRecordId === quoteId && link.contractRecordId === item.id),
  ) ?? [];
  const quotes = options?.quotes.filter((item) =>
    project && (item.linkedProjectId === project.id || item.linkedClientId === project.clientId) &&
    item.services.some((service) => service.code === 's' && service.included),
  ) ?? [];
  const allowedCodes = useMemo(() => quote?.services.filter((service) => service.included).map((service) => service.code) ?? [], [quote]);
  const selected = useMemo(() => rows.filter((row) => row.selected), [rows]);

  const calculated = useMemo(() => {
    if (!template || !project || selected.length === 0 || !startDate) return { data: null, error: null };
    try {
      if (!isValidIsoDate(startDate)) throw new Error('Informe uma data inicial real no formato AAAA-MM-DD.');
      if (selected.some((row) => !row.confirmed)) throw new Error('Revise e confirme individualmente cada atividade selecionada.');
      if (selected.some((row) => !allowedCodes.includes(row.sourceCode.trim()))) {
        throw new Error('Cada atividade precisa estar associada a um código de serviço presente no orçamento contratado.');
      }
      const activities = selected.map((row) => ({
        code: row.code,
        activity: row.activity.trim(),
        predecessorCode: row.predecessor.trim() || null,
        durationDays: numeric(row.duration),
        plannedCost: row.cost.trim() ? numeric(row.cost) : null,
        weightPercent: row.weight.trim() ? numeric(row.weight) : null,
        actualProgress: 0,
      }));
      const result = planConstructionSchedule(activities, {
        startDate,
        calendar,
        contractualDeadline: project.finishDate,
        manualWeightsApproved,
      });
      if (result.totalConstructionCost === null || result.totalConstructionCost <= 0) {
        throw new Error('Informe os custos de execução da obra, separados dos honorários de engenharia, antes de emitir um plano físico-financeiro.');
      }
      const items = result.activities.map((activity, index) => {
        const source = selected.find((row) => row.code === activity.code);
        if (!source) throw new Error('Atividade sem origem no modelo revisado.');
        return {
          code: activity.code,
          category: source.category,
          activity: activity.activity,
          display_order: index + 1,
          weight_percent: activity.assignedWeightPercent,
          planned_duration_days: activity.durationDays,
          predecessor_code: activity.predecessorCode,
          planned_start: activity.plannedStart,
          planned_finish: activity.plannedFinish,
          planned_cost: activity.plannedCost,
          cost_source: 'Custo da obra informado e conferido pela administradora',
          source_service_code: source.sourceCode.trim(),
        };
      });
      return {
        data: {
          scope_confirmed: true,
          calendar,
          weight_source: result.weightSource,
          planned_start: result.plannedStart,
          planned_finish: result.plannedFinish,
          notes: `Modelo ${template.template_code} v${template.template_version}: referência revisada, custos de execução informados separadamente dos honorários.`,
          items,
        },
        error: null,
      };
    } catch (failure) {
      return { data: null, error: failure instanceof Error ? failure.message : 'Planejamento incompleto.' };
    }
  }, [template, project, selected, startDate, calendar, manualWeightsApproved, allowedCodes]);

  const clearPlan = () => {
    setTemplate(null); setRows([]); setTemplateCode(''); setScheduleId(null); setApproved(false);
    setSaveConfirmed(false); setManualWeightsApproved(false); setError(null); setSuccess(null);
  };
  const updateRow = (code: string, changes: Partial<DraftRow>) => {
    setRows((current) => current.map((row) => row.code === code ? { ...row, ...changes, confirmed: false } : row));
    setSaveConfirmed(false);
  };
  const addManualRow = () => {
    setRows((current) => {
      let index = 1;
      while (current.some((item) => item.code === `M${index}`)) index += 1;
      return [...current, {
        code: `M${index}`, category: 'Escopo específico', activity: '', display_order: current.length + 1,
        reference_weight_percent: null, reference_duration_days: null, predecessor_code: null,
        requires_scope_confirmation: true, selected: true, confirmed: false,
        duration: '', cost: '', weight: '', sourceCode: '', predecessor: '',
      }];
    });
    setSaveConfirmed(false);
  };
  const loadTemplate = async () => {
    if (!projectId || !quoteId || !contractId || !templateCode || busy) return;
    setBusy(true); setError(null); setSuccess(null); setSaveConfirmed(false);
    const result = await previewScheduleTemplate(projectId, quoteId, contractId, templateCode);
    setBusy(false);
    if (result.error || !result.data) { setTemplate(null); setRows([]); setError(result.error ?? 'Prévia não disponível.'); return; }
    setTemplate(result.data);
    setRows(result.data.items.map((item) => ({
      ...item, selected: false, confirmed: false,
      duration: item.reference_duration_days === null ? '' : String(item.reference_duration_days),
      weight: '', cost: '', sourceCode: '', predecessor: item.predecessor_code ?? '',
    })));
  };
  const save = async () => {
    if (!calculated.data || !projectId || !quoteId || !contractId || !saveConfirmed || busy) return;
    setBusy(true); setError(null); setSuccess(null);
    const result = await saveVerifiedSchedule(projectId, quoteId, contractId, calculated.data);
    setBusy(false);
    if (result.error || !result.scheduleId) { setError(result.error ?? 'Não foi possível salvar.'); return; }
    setScheduleId(result.scheduleId);
    setSuccess('Planejamento salvo como rascunho em uma única transação. Confira o resultado antes de aprovar a linha de base.');
  };
  const approve = async () => {
    if (!scheduleId || busy || approved) return;
    setBusy(true); setError(null); setSuccess(null);
    const result = await approveVerifiedSchedule(scheduleId);
    setBusy(false);
    if (result) setError(result);
    else { setApproved(true); setSuccess('Linha de base aprovada pelo banco. Alterações estruturais exigem uma nova versão.'); }
  };

  return (
    <Screen>
      <AdminPageHeader title="Novo cronograma físico-financeiro" description="Selecione a contratação expressa, revise cada atividade e informe custos de obra reais ou orçados antes de salvar." />
      <Button title="Voltar aos cronogramas" variant="ghost" onPress={() => router.replace('/admin/construction-schedule')} />
      <Notice tone="info">A contratação do cronograma não implica execução, fiscalização ou atualizações ilimitadas. O cronograma simples e os registros anteriores serão preservados.</Notice>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}
      {!options ? <StateView title="Carregando vínculos comerciais" description="A seleção permanece bloqueada até carregar projetos, orçamentos e contratos." icon="calendar-outline" /> : null}
      {options && !scheduleId ? <>
        <Card>
          <Text>1. Projeto / cliente</Text>
          {options.projects.map((item) => <Button key={item.id} title={`${item.clientName} — ${item.name}${projectId === item.id ? ' ✓' : ''}`} variant={projectId === item.id ? 'primary' : 'secondary'} onPress={() => { setProjectId(item.id); setQuoteId(''); setContractId(''); clearPlan(); }} />)}
          {options.projects.length === 0 ? <Notice tone="warning">Nenhum projeto foi encontrado.</Notice> : null}
        </Card>
        {project ? <Card>
          <Text>2. Orçamento que inclui o serviço de cronograma completo</Text>
          {quotes.map((item) => <Button key={item.id} title={`${item.number} — ${item.status}${quoteId === item.id ? ' ✓' : ''}`} variant={quoteId === item.id ? 'primary' : 'secondary'} onPress={() => { setQuoteId(item.id); setContractId(''); clearPlan(); }} />)}
          {quotes.length === 0 ? <Notice tone="warning">Nenhum orçamento com o serviço específico encontrado. Não é permitido criar por abertura da tela.</Notice> : null}
        </Card> : null}
        {quote ? <Card>
          <Text>3. Contrato formalmente vinculado ao orçamento</Text>
          {contracts.map((item) => <Button key={item.id} title={`${item.number} — ${item.status}${contractId === item.id ? ' ✓' : ''}`} variant={contractId === item.id ? 'primary' : 'secondary'} onPress={() => { setContractId(item.id); clearPlan(); }} />)}
          {contracts.length === 0 ? <Notice tone="warning">Nenhum contrato compatível encontrado. Verifique vínculo, titularidade e escopo.</Notice> : null}
        </Card> : null}
        {contractId ? <Card>
          <Text>4. Modelo versionado (sempre referência, nunca aprovação automática)</Text>
          {templates.map((item) => <Button key={item.code} title={`${item.title}${templateCode === item.code ? ' ✓' : ''}`} variant={templateCode === item.code ? 'primary' : 'secondary'} onPress={() => { setTemplateCode(item.code); setTemplate(null); setRows([]); setSaveConfirmed(false); }} />)}
          <Button title="Conferir contratação e carregar prévia" loading={busy} disabled={!templateCode || busy} onPress={() => void loadTemplate()} />
        </Card> : null}
        {template ? <>
          <Notice tone="warning">Modelo {template.template_code} v{template.template_version}. Selecione somente atividades efetivamente contratadas. Pesos, duração e custo de referência NÃO são dados da sua obra.</Notice>
          <Text>Códigos permitidos pelo orçamento: {quote?.services.filter((service) => service.included).map((service) => `${service.code} (${service.name ?? 'serviço'})`).join('; ')}</Text>
          {rows.length === 0 ? <Notice tone="info">Este modelo não traz atividades por padrão. Cadastre apenas aquelas previstas no escopo.</Notice> : null}
          <Button title="Adicionar atividade específica do contrato" variant="secondary" onPress={addManualRow} />
          {rows.map((row) => <Card key={row.code}>
            <Text>{row.code} — {row.activity || 'Atividade sem descrição'}</Text>
            <Text>Referência de duração: {row.reference_duration_days ?? 'não definida'} dias; peso apenas ilustrativo: {row.reference_weight_percent ?? 'não definido'}%</Text>
            <Button title={row.selected ? 'Retirar atividade' : 'Selecionar atividade contratada'} variant="secondary" onPress={() => updateRow(row.code, { selected: !row.selected })} />
            {row.selected ? <>
              <Field label="Atividade revisada" value={row.activity} onChangeText={(activity) => updateRow(row.code, { activity })} />
              <Field label="Código do serviço correspondente no orçamento" value={row.sourceCode} onChangeText={(sourceCode) => updateRow(row.code, { sourceCode })} />
              <Field label="Duração prevista em dias de trabalho" value={row.duration} keyboardType="numeric" onChangeText={(duration) => updateRow(row.code, { duration })} />
              <Field label="Código da predecessora selecionada (opcional)" value={row.predecessor} onChangeText={(predecessor) => updateRow(row.code, { predecessor })} />
              <Field label="Custo previsto de execução da obra (R$; não usar honorários)" value={row.cost} keyboardType="decimal-pad" onChangeText={(cost) => updateRow(row.code, { cost })} />
              <Field label="Peso manual (%) — apenas se validado" value={row.weight} keyboardType="decimal-pad" onChangeText={(weight) => updateRow(row.code, { weight })} />
              <Button title={row.confirmed ? 'Atividade confirmada ✓' : 'Confirmar atividade, escopo e premissas'} variant={row.confirmed ? 'secondary' : 'primary'} onPress={() => { setRows((current) => current.map((item) => item.code === row.code ? { ...item, confirmed: !item.confirmed } : item)); setSaveConfirmed(false); }} />
            </> : null}
          </Card>)}
          <Card>
            <Text>5. Planejamento e conferência</Text>
            <Field label="Data de início realista (AAAA-MM-DD)" value={startDate} onChangeText={(value) => { setStartDate(value); setSaveConfirmed(false); }} />
            <Text>Calendário do trabalho</Text>
            <Button title={`Dias úteis, sem feriados cadastrados ${calendar === 'weekdays' ? '✓' : ''}`} variant="secondary" onPress={() => { setCalendar('weekdays'); setSaveConfirmed(false); }} />
            <Button title={`Dias corridos ${calendar === 'calendar_days' ? '✓' : ''}`} variant="secondary" onPress={() => { setCalendar('calendar_days'); setSaveConfirmed(false); }} />
            <Notice tone="info">Quando os custos de obra estão completos, os pesos são calculados a partir deles. Pesos manuais não substituem custos financeiros.</Notice>
            <Button title={manualWeightsApproved ? 'Pesos manuais validados ✓' : 'Validar pesos manuais (se aplicável)'} variant="secondary" onPress={() => { setManualWeightsApproved((current) => !current); setSaveConfirmed(false); }} />
            {calculated.error ? <Notice tone="warning">{calculated.error}</Notice> : null}
            {calculated.data ? <>
              <Notice tone="info">Período: {calculated.data.planned_start} a {calculated.data.planned_finish}; {calculated.data.items.length} atividades confirmadas. Confira predecessoras, custos e prazos antes de salvar.</Notice>
              {calculated.data.items.map((item) => <Text key={item.code}>{item.code}: {item.planned_start} → {item.planned_finish}; peso {item.weight_percent}%; custo de obra R$ {item.planned_cost}</Text>)}
              <Button title={saveConfirmed ? 'Planejamento revisado ✓' : 'Confirmo o planejamento, custos e escopo acima'} variant="secondary" onPress={() => setSaveConfirmed((current) => !current)} />
              <Button title="Salvar rascunho com vínculo verificado" loading={busy} disabled={!saveConfirmed || busy} onPress={() => void save()} />
            </> : null}
          </Card>
        </> : null}
      </> : null}
      {scheduleId ? <Card>
        <Text>Planejamento salvo. A aprovação congela a linha de base, sujeita às validações do banco.</Text>
        <Button title={approved ? 'Linha de base aprovada ✓' : 'Aprovar linha de base após conferência'} loading={busy} disabled={busy || approved} onPress={() => void approve()} />
        <Button title="Consultar cronograma" variant="secondary" onPress={() => router.replace('/admin/construction-schedule')} />
      </Card> : null}
    </Screen>
  );
}
