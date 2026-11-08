import {useAdminModule,useAdminProjectSelection} from '@/providers/admin-module-context';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
 const isEmbedded=Boolean(embedded);
  const [projects,setProjects]=useState<ConstructionProjectOption[]>([]);
  const [projectId,setProjectId]=useAdminProjectSelection('');
  const [loadedDraft,setDraft]=useState<ScheduleBudgetDraft|null>(null);
  const draft=loadedDraft?.projectId===projectId?loadedDraft:null;
  const request=useRef(0), saving=useRef(false);
  const selectedProject=useRef(projectId);
  useLayoutEffect(()=>{selectedProject.current=projectId;},[projectId]);
  const [reload,setReload]=useState(0);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [success,setSuccess]=useState<string|null>(null);

  useEffect(()=>{
    if(isEmbedded)return;
    let mounted=true;
    void listConstructionScheduleProjects().then(result=>{
      if(!mounted)return;
      setProjects(result.data);if(result.error)setError(result.error);
    });
    return()=>{mounted=false;};
  },[isEmbedded]);

  const preview=useMemo(()=>draft?analyzeExecutionBudget(draft.items):{
    total:null,valid:false,errors:[],lineCosts:{} as Record<string,number>,
  },[draft]);

  useEffect(()=>{
    const token=++request.current;
    let active=true;
    void (async()=>{
      await Promise.resolve();
      if(!active||request.current!==token)return;
      setDraft(null);setError(null);setSuccess(null);setLoading(Boolean(projectId));
      if(!projectId)return;
      try {
        const result=await loadCurrentScheduleBudget(projectId);
        if(!active||request.current!==token)return;
        if(result.error||!result.data){setError(result.error??'Orçamento indisponível.');return;}
        setDraft(result.data);
      } catch {
        if(active&&request.current===token)setError('Não foi possível carregar o orçamento. Tente novamente.');
      } finally {
        if(active&&request.current===token)setLoading(false);
      }
    })();
    return()=>{active=false;};
  },[projectId,reload]);

  const change=(code:string,key:'quantity'|'unit'|'unitCost'|'plannedCost'|'costSource',value:string)=>{
    setDraft(current=>current?{...current,items:current.items.map(item=>item.code===code?{...item,[key]:value}:item)}:current);
    setSuccess(null);
  };

  const save=async()=>{
    if(!projectId||!draft||!preview.valid||loading||saving.current)return;
    const id=projectId, token=request.current;
    saving.current=true;setLoading(true);setError(null);setSuccess(null);
    try {
      const result=await saveCurrentScheduleBudget(draft);
      if(selectedProject.current!==id||request.current!==token)return;
      if(result.error){setError(result.error);return;}
      const refreshed=await loadCurrentScheduleBudget(id);
      if(selectedProject.current!==id||request.current!==token)return;
      if(refreshed.error||!refreshed.data){setError(refreshed.error??'Orçamento salvo, mas a releitura não foi confirmada. Atualize para conferir.');return;}
      setDraft(refreshed.data);
      setSuccess(`Orçamento de execução salvo. Custo total: ${(result.total??0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}. Os pesos financeiros foram recalculados a partir destes custos.`);
    } catch {
      if(selectedProject.current===id&&request.current===token)setError('Não foi possível confirmar a gravação. Atualize o orçamento antes de tentar novamente.');
    } finally {
      saving.current=false;
      if(selectedProject.current===id&&request.current===token)setLoading(false);
    }
  };

  return <Screen>
    <AdminPageHeader title="Orçamento de execução e quantitativos" description="Custo da obra separado dos honorários. Use composição quantidade × preço unitário quando houver quantitativo; caso contrário, informe custo total e fonte." />
    <Notice tone="info">A composição só altera cronogramas em rascunho. Uma linha de base aprovada exige nova revisão/aditivo. Use fontes rastreáveis (ex.: SINAPI, mês/UF, fornecedor ou cotação) e informe quantidades e valores em formato brasileiro. O peso financeiro é derivado do custo da execução, não dos honorários.</Notice>
    {error?<><Notice tone="danger">{error}</Notice><Button title="Recarregar orçamento" variant="secondary" onPress={()=>setReload(value=>value+1)} /></>:null}
    {success?<Notice tone="success">{success}</Notice>:null}
    {!embedded ? <Card>
      <Text>Projeto</Text>
      {projects.map(project=><Button key={project.id} title={`${project.clientName} — ${project.name}${projectId===project.id?' ✓':''}`} variant={projectId===project.id?'primary':'secondary'} onPress={()=>setProjectId(project.id)} />)}
      {!projects.length?<StateView icon="briefcase-outline" title="Nenhum projeto" description="Cadastre ou vincule um projeto antes de montar o orçamento da execução." />:null}
    </Card> : null}
    {!projectId?<StateView icon="briefcase-outline" title="Selecione um projeto" description="Escolha a obra para carregar o orçamento em rascunho." />:null}
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
