import React,{useEffect,useMemo,useState} from 'react';
import {Text} from 'react-native';
import {useRouter} from 'expo-router';
import {AdminPageHeader} from '@/components/admin-ui';
import {Button,Card,Field,Notice,Screen,StateView} from '@/components/ui';
import {loadScheduleCommercialOptions,type CommercialScheduleDocument,type ScheduleCommercialOptions} from '@/services/construction-schedule-contract-service';
import {listCurrentApprovedSchedules,prepareScheduleRevision,type CurrentApprovedSchedule} from '@/services/construction-schedule-revision-service';

export default function ConstructionScheduleRevisionScreen(){
 const router=useRouter();
 const [schedules,setSchedules]=useState<CurrentApprovedSchedule[]>([]);
 const [options,setOptions]=useState<ScheduleCommercialOptions|null>(null);
 const [active,setActive]=useState<CurrentApprovedSchedule|null>(null);
 const [quoteId,setQuoteId]=useState('');
 const [contractId,setContractId]=useState('');
 const [reason,setReason]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState<string|null>(null);
 const [success,setSuccess]=useState<string|null>(null);
 useEffect(()=>{let mounted=true;void Promise.all([listCurrentApprovedSchedules(),loadScheduleCommercialOptions()]).then(([current,commercial])=>{
   if(!mounted)return;setSchedules(current.data);setOptions(commercial.data);setError(current.error??commercial.error);
 });return()=>{mounted=false;};},[]);
 const quotes=useMemo(()=>{
   if(!active||!options)return [];
   return options.quotes.filter(item=>
     (item.linkedProjectId===active.projectId||item.linkedClientId===active.clientId)&&
     item.services.some(service=>service.code==='s'&&service.included)
   );
 },[active,options]);
 const quote=quotes.find(item=>item.id===quoteId)??null;
 const contracts=useMemo(()=>{
   if(!active||!quote||!options)return [];
   return options.contracts.filter(item=>
     item.linkedProjectId===active.projectId&&item.linkedClientId===active.clientId&&
     item.linkedContractId===active.contractId&&
     options.links.some(link=>link.quoteRecordId===quote.id&&link.contractRecordId===item.id)
   );
 },[active,quote,options]);
 const choose=(schedule:CurrentApprovedSchedule)=>{setActive(schedule);setQuoteId('');setContractId('');setReason('');setError(null);setSuccess(null);};
 const prepare=async()=>{
   if(!active||!quoteId||!contractId||reason.trim().length<10||busy)return;
   setBusy(true);setError(null);setSuccess(null);
   const result=await prepareScheduleRevision(active.id,quoteId,contractId,reason);
   setBusy(false);
   if(result.error){setError(result.error);return;}
   setSuccess('Reprogramação preparada por 24 horas. O próximo plano salvo para este projeto deve usar exatamente o orçamento e contrato selecionados. A revisão anterior permanecerá intacta.');
 };
 return <Screen>
   <AdminPageHeader title="Reprogramação / aditivo do cronograma" description="Prepare uma nova revisão sem editar ou apagar a linha de base aprovada. Depois monte o novo plano no formulário guiado."/>
   <Notice tone="warning">A reprogramação não copia automaticamente custos, datas, pesos ou avanço da versão anterior. Todos esses dados precisam ser revisados novamente antes da nova aprovação.</Notice>
   {error?<Notice tone="danger">{error}</Notice>:null}{success?<Notice tone="success">{success}</Notice>:null}
   {!active?<Card>
     <Text>1. Selecione a revisão vigente e aprovada</Text>
     {schedules.map(item=><Button key={item.id} title={`${item.title} — revisão ${item.revisionNumber} / baseline ${item.baselineVersion}`} variant="secondary" onPress={()=>choose(item)}/>)}
     {!schedules.length?<StateView icon="git-branch-outline" title="Nenhuma revisão vigente aprovada" description="Aditivos só são criados a partir de um cronograma completo já aprovado."/>:null}
   </Card>:<>
     <Button title="Trocar cronograma" variant="ghost" onPress={()=>setActive(null)}/>
     <Card><Text>{active.title}</Text><Text>Revisão vigente: {active.revisionNumber} • linha de base: {active.baselineVersion}</Text></Card>
     <Card>
       <Text>2. Novo orçamento que contém o serviço de cronograma completo</Text>
       {quotes.map((item:CommercialScheduleDocument)=><Button key={item.id} title={`${item.number} — ${item.status}${quoteId===item.id?' ✓':''}`} variant={quoteId===item.id?'primary':'secondary'} onPress={()=>{setQuoteId(item.id);setContractId('');}}/>)}
       {!quotes.length?<Notice tone="warning">Nenhum orçamento compatível com este projeto e com o serviço de cronograma completo foi encontrado.</Notice>:null}
     </Card>
     {quote?<Card>
       <Text>3. Contrato formalmente vinculado ao novo orçamento</Text>
       {contracts.map((item:CommercialScheduleDocument)=><Button key={item.id} title={`${item.number} — ${item.status}${contractId===item.id?' ✓':''}`} variant={contractId===item.id?'primary':'secondary'} onPress={()=>setContractId(item.id)}/>)}
       {!contracts.length?<Notice tone="warning">Nenhum contrato compatível foi encontrado. O vínculo comercial precisa ser regularizado antes do aditivo.</Notice>:null}
     </Card>:null}
     {contractId?<Card>
       <Text>4. Justificativa da reprogramação / aditivo</Text>
       <Field label="Motivo auditável *" multiline value={reason} onChangeText={setReason}/>
       <Button title="Preparar nova revisão" loading={busy} disabled={busy||reason.trim().length<10} onPress={()=>void prepare()}/>
       {success?<Button title="Montar o novo plano no formulário guiado" variant="secondary" onPress={()=>router.push('/admin/construction-schedule-new')}/>:null}
     </Card>:null}
   </>}
 </Screen>;
}
