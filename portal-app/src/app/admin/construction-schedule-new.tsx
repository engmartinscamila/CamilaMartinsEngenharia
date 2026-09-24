import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Text } from 'react-native';
import { AdminPageHeader } from '@/components/admin-ui';
import { Button, Card, Field, Notice, Screen, StateView } from '@/components/ui';
import { analyzeConstructionCriticalPath } from '@/lib/construction-schedule-critical-path';
import { isValidIsoDate } from '@/lib/format';
import { planConstructionSchedule, type WorkCalendar } from '@/lib/construction-schedule-engine';
import {
  approveVerifiedSchedule, exportApprovedScheduleXlsx, loadScheduleCommercialOptions,
  previewScheduleTemplate, previewScheduleTemplateFromAdditionalService,
  saveVerifiedSchedule, saveVerifiedScheduleFromAdditionalService,
  type ScheduleCommercialOptions, type ScheduleTemplateItem, type ScheduleTemplatePreview,
} from '@/services/construction-schedule-contract-service';

const templates = [
  { code: 'residential_reference', title: 'Obra residencial nova — referência' },
  { code: 'renovation_reference', title: 'Reforma — referência' },
  { code: 'partial_scope', title: 'Execução parcial — escopo contratado' },
  { code: 'commercial_reference', title: 'Obra comercial — referência' },
] as const;
type DraftRow = ScheduleTemplateItem & {
  selected: boolean; confirmed: boolean; duration: string; cost: string; weight: string;
  sourceCode: string; predecessor: string; physicalWeight: string; physicalBasis: string;
};
const numeric = (value: string) => Number(value.replace(',', '.'));

export default function NewConstructionScheduleScreen() {
  const router = useRouter();
  const [options, setOptions] = useState<ScheduleCommercialOptions | null>(null);
  const [projectId, setProjectId] = useState('');
  const [quoteId, setQuoteId] = useState('');
  const [contractId, setContractId] = useState('');
  const [additionalAuthorizationId, setAdditionalAuthorizationId] = useState('');
  const [templateCode, setTemplateCode] = useState('');
  const [template, setTemplate] = useState<ScheduleTemplatePreview | null>(null);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [startDate, setStartDate] = useState('');
  const [calendar, setCalendar] = useState<WorkCalendar>('weekdays');
  const [holidaysText, setHolidaysText] = useState('');
  const [manualWeightsApproved, setManualWeightsApproved] = useState(false);
  const [physicalWeightsApproved, setPhysicalWeightsApproved] = useState(false);
  const [advancedMode,setAdvancedMode]=useState(false);
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
  const additionalAuthorization = options?.additionalAuthorizations.find((item) => item.documentId === additionalAuthorizationId);
  const additionalAuthorizations = options?.additionalAuthorizations.filter((item) =>
    project && item.projectId === project.id && item.contractId === project.contractId && item.serviceCode === 's',
  ) ?? [];
  const quotes = options?.quotes.filter((item) =>
    project && (item.linkedProjectId === project.id || item.linkedClientId === project.clientId) &&
    item.services.some((service) => service.code === 's' && service.included),
  ) ?? [];
  const contracts = options?.contracts.filter((item) =>
    item.linkedProjectId === projectId && item.linkedClientId === project?.clientId &&
    item.linkedContractId === project?.contractId &&
    options.links.some((link) => link.quoteRecordId === quoteId && link.contractRecordId === item.id),
  ) ?? [];
  const allowedCodes = additionalAuthorization
    ? ['s']
    : quote?.services.filter((service) => service.included).map((service) => service.code) ?? [];
  const selected = rows.filter((row) => row.selected);

  // Cálculo puro: datas, custos e peso financeiro não dependem da regra física.
  const calculated = (() => {
    if (!template || !project || selected.length === 0 || !startDate) return { data: null, critical: null, error: null };
    try {
      if (!isValidIsoDate(startDate)) throw new Error('Informe uma data inicial real no formato AAAA-MM-DD.');
      const holidays = holidaysText.trim() ? holidaysText.split(/[,;\n]+/).map((value) => value.trim()) : [];
      if (holidays.length > 366 || holidays.some((day) => !isValidIsoDate(day)) || new Set(holidays).size !== holidays.length) {
        throw new Error('Informe até 366 feriados distintos no formato AAAA-MM-DD, separados por vírgula.');
      }
      if (selected.some((row) => !row.confirmed)) throw new Error('Revise e confirme individualmente cada atividade selecionada.');
      if (selected.some((row) => !allowedCodes.includes(row.sourceCode.trim()))) {
        throw new Error('Cada atividade precisa corresponder a um código de serviço da contratação selecionada.');
      }
      const activities = selected.map((row) => ({
        code: row.code, activity: row.activity.trim(), predecessorCode: row.predecessor.trim() || null,
        durationDays: numeric(row.duration), plannedCost: row.cost.trim() ? numeric(row.cost) : null,
        weightPercent: row.weight.trim() ? numeric(row.weight) : null, actualProgress: 0,
      }));
      const result = planConstructionSchedule(activities, {
        startDate, calendar, holidays, contractualDeadline: project.finishDate, manualWeightsApproved,
      });
      const critical=analyzeConstructionCriticalPath(result.activities,{calendar,holidays});
      if (result.totalConstructionCost === null || result.totalConstructionCost <= 0) {
        throw new Error('Informe custos de execução da obra, separados dos honorários, antes de emitir o plano físico-financeiro.');
      }
      if (holidays.some((day) => day < result.plannedStart || day > result.plannedFinish)) {
        throw new Error('Um feriado está fora do período calculado da obra. Confira as datas antes de confirmar.');
      }
      const physicalWeights = physicalWeightsApproved ? selected.map((row) => {
        const percent = numeric(row.physicalWeight);
        if (!row.physicalWeight.trim() || !Number.isFinite(percent) || percent < 0 || percent > 100 ||
          row.physicalBasis.trim().length < 10) {
          throw new Error(`A atividade ${row.code} exige peso físico de 0–100% e critério técnico confirmado com 10 caracteres.`);
        }
        return { code: row.code, percent, basis: row.physicalBasis.trim() };
      }) : [];
      if (physicalWeights.length && Math.abs(physicalWeights.reduce((sum, weight) => sum + weight.percent, 0) - 100) > 0.01) {
        throw new Error('Pesos FÍSICOS independentes devem somar 100% e ter critério específico por atividade.');
      }
      const items = result.activities.map((activity, index) => {
        const source = selected.find((row) => row.code === activity.code);
        if (!source) throw new Error('Atividade não localizada entre os itens revisados.');
        return {
          code: activity.code, category: source.category, activity: activity.activity,
          display_order: index + 1, weight_percent: activity.assignedWeightPercent,
          planned_duration_days: activity.durationDays, predecessor_code: activity.predecessorCode,
          planned_start: activity.plannedStart, planned_finish: activity.plannedFinish,
          planned_cost: activity.plannedCost, cost_source: 'Custo da execução informado e confirmado pela administradora',
          source_service_code: source.sourceCode.trim(),
        };
      });
      return {
        data: {
          scope_confirmed: true, calendar, holidays, physical_weights: physicalWeights, weight_source: result.weightSource,
          planned_start: result.plannedStart, planned_finish: result.plannedFinish,
          notes: `Modelo ${template.template_code} v${template.template_version}: referência revisada, custos de obra separados dos honorários.`,
          items,
        }, critical, error: null,
      };
    } catch (failure) {
      return { data: null, critical: null, error: failure instanceof Error ? failure.message : 'Planejamento incompleto.' };
    }
  })();

  const clearPlan = () => {
    setTemplate(null); setRows([]); setTemplateCode(''); setScheduleId(null); setApproved(false);
    setSaveConfirmed(false); setManualWeightsApproved(false); setPhysicalWeightsApproved(false); setHolidaysText(''); setAdvancedMode(false); setError(null); setSuccess(null);
  };
  const updateRow = (code: string, changes: Partial<DraftRow>) => {
    setRows((current) => current.map((row) => row.code === code ? { ...row, ...changes, confirmed: false } : row));
    setSaveConfirmed(false); setPhysicalWeightsApproved(false);
  };
  const addManualRow = () => {
    setRows((current) => {
      let index = 1;
      while (current.some((item) => item.code === `M${index}`)) index += 1;
      return [...current, {
        code: `M${index}`, category: 'Escopo específico', activity: '', display_order: current.length + 1,
        reference_weight_percent: null, reference_duration_days: null, predecessor_code: null,
        requires_scope_confirmation: true, selected: true, confirmed: false,
        duration: '', cost: '', weight: '', sourceCode: '', predecessor: '', physicalWeight: '', physicalBasis: '',
      }];
    });
    setSaveConfirmed(false); setPhysicalWeightsApproved(false);
  };
  const loadTemplate = async () => {
    if (!projectId || !templateCode || busy || (!additionalAuthorizationId && (!quoteId || !contractId))) return;
    setBusy(true); setError(null); setSuccess(null); setSaveConfirmed(false);
    const result = additionalAuthorizationId
      ? await previewScheduleTemplateFromAdditionalService(projectId, additionalAuthorizationId, templateCode)
      : await previewScheduleTemplate(projectId, quoteId, contractId, templateCode);
    setBusy(false);
    if (result.error || !result.data) {
      setTemplate(null); setRows([]); setError(result.error ?? 'Prévia não disponível.'); return;
    }
    setTemplate(result.data);
    setRows(result.data.items.map((item) => ({
      ...item, selected: false, confirmed: false,
      duration: item.reference_duration_days === null ? '' : String(item.reference_duration_days),
      weight: '', cost: '', sourceCode: '', predecessor: item.predecessor_code ?? '', physicalWeight: '', physicalBasis: '',
    })));
    setPhysicalWeightsApproved(false);
  };
  const save = async () => {
    if (!calculated.data || !projectId || !saveConfirmed || busy || (!additionalAuthorizationId && (!quoteId || !contractId))) return;
    setBusy(true); setError(null); setSuccess(null);
    const result = additionalAuthorizationId
      ? await saveVerifiedScheduleFromAdditionalService(projectId, additionalAuthorizationId, calculated.data)
      : await saveVerifiedSchedule(projectId, quoteId, contractId, calculated.data);
    setBusy(false);
    if (result.error || !result.scheduleId) { setError(result.error ?? 'Não foi possível salvar.'); return; }
    setScheduleId(result.scheduleId);
    setSuccess('Planejamento, feriados e pesos físicos confirmados salvos em rascunho numa única transação. Confira antes de aprovar.');
  };
  const approve = async () => {
    if (!scheduleId || busy || approved) return;
    setBusy(true); setError(null); setSuccess(null);
    const result = await approveVerifiedSchedule(scheduleId);
    setBusy(false);
    if (result) setError(result);
    else { setApproved(true); setSuccess('Linha de base, feriados e critérios físicos aprovados pelo banco. Alterações estruturais exigem nova versão.'); }
  };
  const exportExcel = async () => {
    if (!scheduleId || !approved || busy) return;
    setBusy(true); setError(null); setSuccess(null);
    const result = await exportApprovedScheduleXlsx(scheduleId);
    setBusy(false);
    if (result) setError(result);
    else setSuccess('Excel extraído da linha de base aprovada. O arquivo é editável e não altera os registros do portal.');
  };

  return (
    <Screen>
      <AdminPageHeader title="Novo cronograma físico-financeiro" description="Modo guiado por padrão: selecione a contratação, confirme atividades e custos; detalhes técnicos ficam sob demanda." />
      <Button title="Voltar aos cronogramas" variant="ghost" onPress={() => router.replace('/admin/construction-schedule')} />
      <Button title="Abrir Cronograma de TESTE / NÃO CONTRATUAL" variant="secondary" onPress={() => router.push('/admin/construction-schedule-test')} />
      <Notice tone="info">A contratação do cronograma não implica execução, fiscalização ou atualizações ilimitadas. O cronograma simples e os registros antigos serão preservados.</Notice>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}
      {!options ? <StateView title="Carregando vínculos comerciais" description="A seleção permanece bloqueada até carregar os documentos comerciais." icon="calendar-outline" /> : null}
      {options && !scheduleId ? <>
        <Card>
          <Text>1. Projeto / cliente</Text>
          {options.projects.map((item) => <Button key={item.id} title={`${item.clientName} — ${item.name}${projectId === item.id ? ' ✓' : ''}`} variant={projectId === item.id ? 'primary' : 'secondary'} onPress={() => { setProjectId(item.id); setQuoteId(''); setContractId(''); setAdditionalAuthorizationId(''); clearPlan(); }} />)}
          {options.projects.length === 0 ? <Notice tone="warning">Nenhum projeto foi encontrado.</Notice> : null}
        </Card>
        {project ? <Card>
          <Text>2A. Contratação original por orçamento + contrato</Text>
          {quotes.map((item) => <Button key={item.id} title={`${item.number} — ${item.status}${quoteId === item.id ? ' ✓' : ''}`} variant={quoteId === item.id ? 'primary' : 'secondary'} onPress={() => { setQuoteId(item.id); setContractId(''); setAdditionalAuthorizationId(''); clearPlan(); }} />)}
          {quotes.length === 0 ? <Notice tone="info">Nenhum orçamento original com cronograma completo foi localizado para este projeto.</Notice> : null}
        </Card> : null}
        {project ? <Card>
          <Text>2B. Contratação posterior por Serviço Adicional aceito</Text>
          <Notice tone="info">Use esta opção quando o cronograma completo foi contratado depois do contrato original. Só aparecem termos da versão vigente, congelados e já aceitos pelo cliente.</Notice>
          {additionalAuthorizations.map((item) => <Button key={item.documentId} title={`${item.serviceName} • v${item.documentVersion}${item.serviceLevel ? ` • ${item.serviceLevel.toUpperCase()}` : ''}${additionalAuthorizationId === item.documentId ? ' ✓' : ''}`} variant={additionalAuthorizationId === item.documentId ? 'primary' : 'secondary'} onPress={() => { setAdditionalAuthorizationId(item.documentId); setQuoteId(''); setContractId(''); clearPlan(); }} />)}
          {additionalAuthorizations.length === 0 ? <Notice tone="warning">Nenhum Serviço Adicional de cronograma completo aceito foi encontrado. Prepare o adicional, envie ao cliente e aguarde o aceite da versão antes de criar o cronograma.</Notice> : null}
        </Card> : null}
        {quote ? <Card>
          <Text>3. Contrato formalmente vinculado ao orçamento</Text>
          {contracts.map((item) => <Button key={item.id} title={`${item.number} — ${item.status}${contractId === item.id ? ' ✓' : ''}`} variant={contractId === item.id ? 'primary' : 'secondary'} onPress={() => { setContractId(item.id); clearPlan(); }} />)}
          {contracts.length === 0 ? <Notice tone="warning">Nenhum contrato compatível encontrado. Confira titularidade, vínculo e escopo.</Notice> : null}
        </Card> : null}
        {(contractId || additionalAuthorizationId) ? <Card>
          <Text>4. Modelo versionado (apenas referência)</Text>
          {templates.map((item) => <Button key={item.code} title={`${item.title}${templateCode === item.code ? ' ✓' : ''}`} variant={templateCode === item.code ? 'primary' : 'secondary'} onPress={() => { setTemplateCode(item.code); setTemplate(null); setRows([]); setPhysicalWeightsApproved(false); setSaveConfirmed(false); }} />)}
          <Button title="Conferir contratação e carregar modelo" loading={busy} disabled={!templateCode || busy} onPress={() => void loadTemplate()} />
        </Card> : null}
        {template ? <>
          <Notice tone="warning">Modelo {template.template_code} v{template.template_version}: selecione só atividades contratadas. Pesos, durações e custos de referência não descrevem automaticamente sua obra.</Notice>
          <Text>Códigos permitidos: {additionalAuthorization ? `s (${additionalAuthorization.serviceName})` : quote?.services.filter((service) => service.included).map((service) => `${service.code} (${service.name ?? 'serviço'})`).join('; ')}</Text>
          {rows.length === 0 ? <Notice tone="info">Modelo sem atividades predefinidas. Cadastre apenas as previstas no escopo.</Notice> : null}
          <Button title="Adicionar atividade específica do contrato" variant="secondary" onPress={addManualRow} />
          <Button title={advancedMode?'Ocultar opções avançadas':'Mostrar opções avançadas'} variant="ghost" onPress={()=>setAdvancedMode(current=>!current)} />
          {rows.map((row) => <Card key={row.code}>
            <Text>{row.code} — {row.activity || 'Atividade sem descrição'}</Text>
            <Text>Referência de duração: {row.reference_duration_days ?? 'não definida'} dias; peso ilustrativo: {row.reference_weight_percent ?? 'não definido'}%</Text>
            <Button title={row.selected ? 'Retirar atividade' : 'Selecionar atividade contratada'} variant="secondary" onPress={() => updateRow(row.code, { selected: !row.selected })} />
            {row.selected ? <>
              <Field label="Atividade revisada" value={row.activity} onChangeText={(activity) => updateRow(row.code, { activity })} />
              <Field label="Código de serviço correspondente à contratação" value={row.sourceCode} onChangeText={(sourceCode) => updateRow(row.code, { sourceCode })} />
              <Field label="Duração prevista (dias)" value={row.duration} keyboardType="numeric" onChangeText={(duration) => updateRow(row.code, { duration })} />
              <Field label="Custo da execução (R$, sem honorários)" value={row.cost} keyboardType="decimal-pad" onChangeText={(cost) => updateRow(row.code, { cost })} />
              {advancedMode?<>
                <Field label="Código da predecessora selecionada (opcional)" value={row.predecessor} onChangeText={(predecessor) => updateRow(row.code, { predecessor })} />
                <Field label="Peso manual FINANCEIRO (%) — somente se validado" value={row.weight} keyboardType="decimal-pad" onChangeText={(weight) => updateRow(row.code, { weight })} />
                <Field label="Peso FÍSICO independente (%) — se houver critério técnico" value={row.physicalWeight} keyboardType="decimal-pad" onChangeText={(physicalWeight) => updateRow(row.code, { physicalWeight })} />
                <Field label="Critério do peso físico (quantitativo, unidade ou evidência)" value={row.physicalBasis} multiline onChangeText={(physicalBasis) => updateRow(row.code, { physicalBasis })} />
              </>:null}
              <Button title={row.confirmed ? 'Atividade confirmada ✓' : 'Confirmar atividade, escopo e premissas'} variant={row.confirmed ? 'secondary' : 'primary'} onPress={() => { setRows((current) => current.map((item) => item.code === row.code ? { ...item, confirmed: !item.confirmed } : item)); setSaveConfirmed(false); }} />
            </> : null}
          </Card>)}
          <Card>
            <Text>5. Planejamento e conferência</Text>
            <Field label="Data de início (AAAA-MM-DD)" value={startDate} onChangeText={(value) => { setStartDate(value); setSaveConfirmed(false); }} />
            <Text>Calendário de execução</Text>
            <Button title={`Dias úteis ${calendar === 'weekdays' ? '✓' : ''}`} variant="secondary" onPress={() => { setCalendar('weekdays'); setSaveConfirmed(false); }} />
            <Button title={`Dias corridos ${calendar === 'calendar_days' ? '✓' : ''}`} variant="secondary" onPress={() => { setCalendar('calendar_days'); setSaveConfirmed(false); }} />
            {advancedMode?<>
              <Field label="Datas não úteis/feriados da obra (AAAA-MM-DD; separados por vírgula)" value={holidaysText} multiline onChangeText={(value) => { setHolidaysText(value); setSaveConfirmed(false); }} />
              <Notice tone="info">Cadastre apenas datas conferidas para esta obra. Em dias úteis, elas são descontadas; em dias corridos, não estendem o prazo. O calendário ficará congelado na aprovação.</Notice>
              <Notice tone="info">Pesos financeiros decorrem de custos completos. Pesos físicos são independentes: só informe e aprove se houver critério técnico conferido para TODAS as atividades. Caso contrário, o indicador físico permanece indisponível.</Notice>
              <Button title={manualWeightsApproved ? 'Pesos manuais financeiros validados ✓' : 'Validar pesos manuais financeiros (se aplicável)'} variant="secondary" onPress={() => { setManualWeightsApproved((current) => !current); setSaveConfirmed(false); }} />
              <Button title={physicalWeightsApproved ? 'Pesos físicos independentes confirmados ✓' : 'Confirmar critério físico de todas as atividades (se conferido)'} variant="secondary" onPress={() => { setPhysicalWeightsApproved((current) => !current); setSaveConfirmed(false); }} />
            </>:<Notice tone="info">Modo guiado: dependências do modelo são preservadas e pesos financeiros são derivados dos custos informados. Abra opções avançadas apenas para exceções, feriados ou critério físico.</Notice>}
            {calculated.error ? <Notice tone="warning">{calculated.error}</Notice> : null}
            {calculated.data ? <>
              <Notice tone="info">Período: {calculated.data.planned_start} a {calculated.data.planned_finish}; {calculated.data.items.length} atividades; {calculated.data.holidays.length} feriado(s); pesos físicos {calculated.data.physical_weights.length ? 'conferidos' : 'não informados'}.</Notice>
              {calculated.critical?<Notice tone="info">Caminho crítico: {calculated.critical.criticalCodes.join(' → ')||'nenhuma atividade marcada como crítica'}. Folga total é exibida abaixo e deve ser revisada antes de aprovar.</Notice>:null}
              {calculated.data.items.map((item) => {const cpm=calculated.critical?.activities.find(entry=>entry.code===item.code);return <Text key={item.code}>{item.code}: {item.planned_start} → {item.planned_finish}; peso financeiro {item.weight_percent}%; custo R$ {item.planned_cost}; {cpm?.isCritical?'CRÍTICA':`folga ${cpm?.totalFloatDays??0} dia(s)`}</Text>;})}
              <Button title={saveConfirmed ? 'Planejamento revisado ✓' : 'Confirmo planejamento, custos, caminho crítico e escopo acima'} variant="secondary" onPress={() => setSaveConfirmed((current) => !current)} />
              <Button title="Salvar rascunho, feriados e pesos com vínculo verificado" loading={busy} disabled={!saveConfirmed || busy} onPress={() => void save()} />
            </> : null}
          </Card>
        </> : null}
      </> : null}
      {scheduleId ? <Card>
        <Text>Planejamento salvo. Aprovação congela linha de base, feriados e critérios físicos, sujeita a validações do banco.</Text>
        <Button title={approved ? 'Linha de base aprovada ✓' : 'Aprovar linha de base após conferência'} loading={busy} disabled={busy || approved} onPress={() => void approve()} />
        {approved ? <>
          <Notice tone="info">Excel editável com cronograma, Gantt, Curva S, indicadores e versão aprovada. Dados históricos reais exigem medições datadas, sem inventar evolução.</Notice>
          <Button title="Extrair cronograma completo em Excel (.xlsx)" loading={busy} disabled={busy} onPress={() => void exportExcel()} />
        </> : null}
        <Button title="Consultar cronograma" variant="secondary" onPress={() => router.replace('/admin/construction-schedule')} />
      </Card> : null}
    </Screen>
  );
}