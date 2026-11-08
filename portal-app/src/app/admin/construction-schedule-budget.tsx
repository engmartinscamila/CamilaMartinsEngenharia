import {useAdminModule,useAdminProjectSelection} from '@/providers/admin-module-context';
import React, { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { AdminPageHeader } from '@/components/admin-ui';
import { Button, Card, Field, Notice, Screen, StateView } from '@/components/ui';
import { listConstructionScheduleProjects, type ConstructionProjectOption } from '@/services/construction-schedule-service';
import { analyzeExecutionBudget } from '@/lib/construction-budget-validation';
import {
  loadCurrentScheduleBudget,
  saveCurrentScheduleBudget,
  type ScheduleBudgetDraft,
} from '@/services/construction-schedule-budget-service';

export default function ConstructionScheduleBudgetScreen() {
 const embedded=useAdminModule();
  const [projects,setProjects]=useState<ConstructionProjectOption[]>([]);
  const [projectId,setProjectId]=useAdminProjectSelection('');
  const [draft,setDraft]=useState<ScheduleBudgetDraft|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [success,setSuccess]=useState<string|null>(null);

  useEffect(()=>{
    let mounted=true;
    void listConstructionScheduleProjects().then(result=>{
      if(!mounted)return;
      setProjects(result.data);setError(result.error);
    });
    return()=>{mounted=false;};
  },[]);

  const preview=useMemo(()=>draft?analyzeExecutionBudget(draft.items):{
    total:null,valid:false,errors:[],lineCosts:{} as Record<string,number>,
  },[draft]);

  const load=async(id:string, preserveSuccess=false)=>{
    setProjectId(id);setDraft(null);setLoading(true);setError(null);
    if(!preserveSuccess)setSuccess(null);
    const result=await loadCurrentScheduleBudget(id);
    setLoading(false);
    if(result.error||!result.data){setError(result.error??'Orçamento indisponível.');return;}
    setDraft(result.data);
  };

  const change=(code:string,key:'quantity'|'unit'|'unitCost'|'plannedCost'|'costSource',value:string)=>{
    setDraft(current=>current?{...current,items:current.items.map(item=>item.code===code?{...item,[key]:value}:item)}:current);
    setSuccess(null);
  };

  const save=async()=>{
    if(!projectId||!draft||!preview.valid||loading)return;
    setLoading(true);setError(null);setSuccess(null);
    const result=await saveCurrentScheduleBudget(draft);
    setLoading(false);
    if(result.error){setError(result.error);return;}
    await load(projectId, true);
    setSuccess(`Orçamento de execução salvo. Custo total: ${(result.total??0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}. Os pesos financeiros foram recalculados a partir destes custos.`);
  };

  return <Screen>
    <AdminPageHeader title="Orçamento de execução e quantitativos" description="Custo da obra separado dos honorários. Use composição quantidade × preço unitário quando houver quantitativo; caso contrário, informe custo total e fonte." />
    <Notice tone="info">A composição só altera cronogramas em rascunho. Uma linha de base aprovada exige nova revisão/aditivo. Use fontes rastreáveis (ex.: SINAPI, mês/UF, fornecedor ou cotação) e informe quantidades e valores em formato brasileiro. O peso financeiro é derivado do custo da execução, não dos honorários.</Notice>
    {error?<Notice tone="danger">{error}</Notice>:null}
    {success?<Notice tone="success">{success}</Notice>:null}
    {!embedded ? <Card>
      <Text>Projeto</Text>
      {projects.map(project=><Button key={project.id} title={`${project.clientName} — ${project.name}${projectId===project.id?' ✓':''}`} variant={projectId===project.id?'primary':'secondary'} onPress={()=>void load(project.id)} />)}
      {!projects.length?<StateView icon="briefcase-outline" title="Nenhum projeto" description="Cadastre ou vincule um projeto antes de montar o orçamento da execução." />:null}
    </Card> : null}
    {loading&&!draft?<StateView icon="calculator-outline" title="Carregando orçamento" description="Conferindo a revisão em rascunho e suas atividades." />:null}
    {draft?<>
      <Card>
        <Text>{draft.title} • revisão {draft.revisionNumber}</Text>
        <Text>Previsão atual: {(preview.total??0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</Text>
        {!preview.valid?<Notice tone="warning">{preview.errors.slice(0,4).join(' ')}</Notice>:null}
      </Card>
      {draft.items.map(item=>{
        const composed=preview.lineCosts[item.code]??null;
        const hasComposition=item.quantity.trim()!==''||item.unit.trim()!==''||item.unitCost.trim()!=='';
        return <Card key={item.code}>
          <Text>{item.code} — {item.activity}</Text>
          <Text>Peso financeiro atual: {item.weightPercent.toFixed(2)}%</Text>
          <Field label="Quantidade (opcional; ativa composição unitária)" value={item.quantity} keyboardType="decimal-pad" onChangeText={value=>change(item.code,'quantity',value)} />
          <Field label="Unidade (ex.: m², m³, un, h)" value={item.unit} onChangeText={value=>change(item.code,'unit',value)} />
          <Field label="Preço unitário (R$)" value={item.unitCost} keyboardType="decimal-pad" onChangeText={value=>change(item.code,'unitCost',value)} />
          {hasComposition?<Notice tone="info">Custo calculado: {composed===null?'Composição incompleta':composed.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}. O custo total manual fica desconsiderado enquanto houver composição.</Notice>:<Field label="Custo total da atividade (R$)" value={item.plannedCost} keyboardType="decimal-pad" onChangeText={value=>change(item.code,'plannedCost',value)} />}
          <Field label="Fonte / referência do custo *" value={item.costSource} onChangeText={value=>change(item.code,'costSource',value)} />
        </Card>;
      })}
      <View style={{gap:8}}><Button title="Salvar orçamento e recalcular pesos financeiros" loading={loading} disabled={loading||!preview.valid} onPress={()=>void save()} /></View>
    </>:null}
  </Screen>;
}
