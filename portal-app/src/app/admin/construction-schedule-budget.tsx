import React, { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { AdminPageHeader } from '@/components/admin-ui';
import { Button, Card, Field, Notice, Screen, StateView } from '@/components/ui';
import { listConstructionScheduleProjects, type ConstructionProjectOption } from '@/services/construction-schedule-service';
import {
  loadCurrentScheduleBudget,
  saveCurrentScheduleBudget,
  type ScheduleBudgetDraft,
} from '@/services/construction-schedule-budget-service';

const asNumber = (value: string) => {
  const normalized = value.trim().replace(',', '.');
  return normalized ? Number(normalized) : null;
};

export default function ConstructionScheduleBudgetScreen() {
  const [projects,setProjects]=useState<ConstructionProjectOption[]>([]);
  const [projectId,setProjectId]=useState('');
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

  const preview=useMemo(()=>{
    if(!draft)return {total:0,invalid:false};
    let total=0;let invalid=false;
    for(const item of draft.items){
      const quantity=asNumber(item.quantity);
      const unitCost=asNumber(item.unitCost);
      const direct=asNumber(item.plannedCost);
      const hasComposition=item.quantity.trim()!==''||item.unit.trim()!==''||item.unitCost.trim()!=='';
      if(!item.costSource.trim()){invalid=true;continue;}
      if(hasComposition){
        if(quantity===null||quantity<=0||unitCost===null||unitCost<0||!item.unit.trim()){invalid=true;continue;}
        total+=quantity*unitCost;
      } else if(direct===null||direct<0){invalid=true;} else total+=direct;
    }
    return {total,invalid};
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
    if(!draft||preview.invalid||loading)return;
    setLoading(true);setError(null);setSuccess(null);
    const result=await saveCurrentScheduleBudget(draft);
    setLoading(false);
    if(result.error){setError(result.error);return;}
    await load(projectId, true);
    setSuccess(`Orçamento de execução salvo. Custo total: ${(result.total??0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}. Os pesos financeiros foram recalculados a partir destes custos.`);
  };

  return <Screen>
    <AdminPageHeader title="Orçamento de execução e quantitativos" description="Custo da obra separado dos honorários. Use composição quantidade × preço unitário quando houver quantitativo; caso contrário, informe custo total e fonte." />
    <Notice tone="info">A composição só altera cronogramas em rascunho. Uma linha de base aprovada exige nova revisão/aditivo. O peso financeiro é derivado do custo da execução.</Notice>
    {error?<Notice tone="danger">{error}</Notice>:null}
    {success?<Notice tone="success">{success}</Notice>:null}
    <Card>
      <Text>Projeto</Text>
      {projects.map(project=><Button key={project.id} title={`${project.clientName} — ${project.name}${projectId===project.id?' ✓':''}`} variant={projectId===project.id?'primary':'secondary'} onPress={()=>void load(project.id)} />)}
      {!projects.length?<StateView icon="briefcase-outline" title="Nenhum projeto" description="Cadastre ou vincule um projeto antes de montar o orçamento da execução." />:null}
    </Card>
    {loading&&!draft?<StateView icon="calculator-outline" title="Carregando orçamento" description="Conferindo a revisão em rascunho e suas atividades." />:null}
    {draft?<>
      <Card>
        <Text>{draft.title} • revisão {draft.revisionNumber}</Text>
        <Text>Previsão atual: {preview.total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</Text>
        {preview.invalid?<Notice tone="warning">Há item sem custo/fonte ou composição incompleta. Corrija antes de salvar.</Notice>:null}
      </Card>
      {draft.items.map(item=>{
        const quantity=asNumber(item.quantity);
        const unitCost=asNumber(item.unitCost);
        const composed=quantity!==null&&unitCost!==null?quantity*unitCost:null;
        const hasComposition=item.quantity.trim()!==''||item.unit.trim()!==''||item.unitCost.trim()!=='';
        return <Card key={item.code}>
          <Text>{item.code} — {item.activity}</Text>
          <Text>Peso financeiro atual: {item.weightPercent.toFixed(2)}%</Text>
          <Field label="Quantidade (opcional; ativa composição unitária)" value={item.quantity} keyboardType="decimal-pad" onChangeText={value=>change(item.code,'quantity',value)} />
          <Field label="Unidade (ex.: m², m³, un, h)" value={item.unit} onChangeText={value=>change(item.code,'unit',value)} />
          <Field label="Preço unitário (R$)" value={item.unitCost} keyboardType="decimal-pad" onChangeText={value=>change(item.code,'unitCost',value)} />
          {hasComposition?<Notice tone="info">Custo calculado: {(composed??0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}. O custo total manual fica desconsiderado enquanto houver composição.</Notice>:<Field label="Custo total da atividade (R$)" value={item.plannedCost} keyboardType="decimal-pad" onChangeText={value=>change(item.code,'plannedCost',value)} />}
          <Field label="Fonte / referência do custo *" value={item.costSource} onChangeText={value=>change(item.code,'costSource',value)} />
        </Card>;
      })}
      <View style={{gap:8}}><Button title="Salvar orçamento e recalcular pesos financeiros" loading={loading} disabled={loading||preview.invalid} onPress={()=>void save()} /></View>
    </>:null}
  </Screen>;
}
