import React, {useEffect, useState} from 'react';
import {Text, View} from 'react-native';
import {useAdminModule, useAdminProjectSelection} from '@/providers/admin-module-context';
import {AdminPageHeader} from '@/components/admin-ui';
import {Button, Card, Notice, Screen, StateView} from '@/components/ui';
import {formatCurrency} from '@/lib/format';
import {listConstructionScheduleProjects, type ConstructionProjectOption} from '@/services/construction-schedule-service';
import {loadProjectCostReport, type ProjectCostReport} from '@/services/project-cost-control-service';

const money = (value: number | null) => value === null ? 'Indisponível' : formatCurrency(value);

export default function ProjectCostControlScreen() {
  const embedded = useAdminModule();
  const [projectId, setProjectId] = useAdminProjectSelection(null);
  const [projects, setProjects] = useState<ConstructionProjectOption[]>([]);
  const [report, setReport] = useState<ProjectCostReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let live = true;
    void listConstructionScheduleProjects().then(result => {
      if (!live) return;
      setProjects(result.data);
      if (result.error) setError(result.error);
      else if (!embedded) setProjectId(current =>
        current && result.data.some(item => item.id === current) ? current : result.data[0]?.id ?? null);
    });
    return () => {live = false;};
  }, [embedded, setProjectId]);

  useEffect(() => {
    let live = true;
    if (!projectId) {
      setReport(null);
      return () => {live = false;};
    }
    setReport(null); setBusy(true); setError(null);
    void loadProjectCostReport(projectId).then(result => {
      if (!live) return;
      setReport(result.data); setError(result.error); setBusy(false);
    });
    return () => {live = false;};
  }, [projectId, refresh]);

  const values = report?.evidence;

  return <Screen>
    <AdminPageHeader title="Controle de custos por projeto"
      description="Conferência financeira da obra com fontes separadas: orçamento vigente, medições, saídas registradas e cotações." />
    <Notice tone="info">Este demonstrativo é somente leitura. Cotação aprovada não é compra empenhada; custo medido não é pagamento. Horas e honorários não são somados novamente ao caixa.</Notice>
    {error ? <Notice tone="danger">{error}</Notice> : null}
    {!embedded ? <Card>
      <Text>Selecionar projeto</Text>
      <View style={{gap: 6}}>
        {projects.map(project => <Button key={project.id}
          title={`${project.clientName} — ${project.name}${project.id === projectId ? ' ✓' : ''}`}
          variant={project.id === projectId ? 'primary' : 'secondary'}
          onPress={() => setProjectId(project.id)} />)}
      </View>
      {!projects.length ? <StateView icon="briefcase-outline" title="Nenhum projeto"
        description="Cadastre um projeto antes de consultar os custos." /> : null}
    </Card> : null}
    {projectId ? <View style={{gap: 8}}>
      <Button title="Atualizar conferência" disabled={busy} loading={busy}
        onPress={() => setRefresh(n => n + 1)} />
    </View> : null}
    {busy ? <StateView icon="calculator-outline" title="Conferindo os custos"
      description="A consulta precisa estar completa antes de mostrar qualquer total." /> : null}
    {report && values && !busy ? <>
      <Card>
        <Text style={{fontWeight: '700'}}>Orçamento da obra — linha-base vigente</Text>
        <Text>{report.scheduleTitle ?? 'Sem cronograma'}</Text>
        <Text>Previsão: {money(values.plannedTotal)}</Text>
        <Text>{values.budgetItems} atividades; {values.unpricedItems} sem preço.</Text>
        {report.budgetStatus !== 'approved'
          ? <Notice tone="warning">Não há linha-base aprovada vigente. Não é correto apresentar um orçamento consolidado como definitivo.</Notice>
          : values.unpricedItems > 0
            ? <Notice tone="warning">O orçamento possui atividades sem custo; total e diferença orçamentária ficaram indisponíveis.</Notice>
            : null}
      </Card>
      <Card>
        <Text style={{fontWeight: '700'}}>Medições de execução</Text>
        <Text>Custo registrado em medições: {money(values.measuredTotal)}</Text>
        <Text>{values.measuredItems} atividades medidas; {values.unmeasuredItems} sem custo medido.</Text>
        <Notice tone="info">O custo de medição acompanha a execução e não representa necessariamente uma saída de caixa.</Notice>
      </Card>
      <Card>
        <Text style={{fontWeight: '700'}}>Saídas financeiras do projeto</Text>
        <Text>Despesas pagas identificadas: {money(values.paidExpenses)}</Text>
        <Text>Despesas pendentes identificadas: {money(values.pendingExpenses)}</Text>
        <Text>Diferença entre previsão e saídas cadastradas: {money(values.budgetMinusRegisteredExpenses)}</Text>
        <Notice tone="info">A diferença é parcial: não inclui despesas ainda não lançadas, não representa lucro nem saldo bancário.</Notice>
        {values.unclassifiedExpenses > 0
          ? <Notice tone="warning">{values.unclassifiedExpenses} saídas com status não classificado. Diferença indisponível até conferência.</Notice>
          : null}
        {values.budgetMinusRegisteredExpenses !== null && values.budgetMinusRegisteredExpenses < 0
          ? <Notice tone="warning">As saídas cadastradas já ultrapassam a previsão aprovada. Conferir lançamentos e escopo.</Notice>
          : null}
      </Card>
      <Card>
        <Text style={{fontWeight: '700'}}>Propostas de fornecedores selecionadas</Text>
        <Text>Valor informativo: {money(values.selectedQuoteTotal)}</Text>
        <Text>{values.selectedQuoteCount} propostas aprovadas com valor identificado.</Text>
        <Notice tone="info">Não há vínculo automático com pedido de compra nem empenho. Este valor não entra no gasto ou no total previsto.</Notice>
        {values.missingSelectedBids > 0
          ? <Notice tone="warning">{values.missingSelectedBids} cotações aprovadas sem uma proposta selecionada recuperável; confira Compras.</Notice>
          : null}
      </Card>
      {report.activities.length ? <Card>
        <Text style={{fontWeight: '700'}}>Conferência por atividade</Text>
        {report.activities.map((item, index) => <View key={`${item.code}-${index}`}
          style={{paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#d3d3d3'}}>
          <Text>{item.code} — {item.activity}</Text>
          <Text>Previsto: {money(item.plannedCost)} • Medido: {money(item.measuredCost)}</Text>
        </View>)}
      </Card> : null}
    </> : null}
  </Screen>;
}
