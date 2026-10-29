import React,{useState} from 'react';
import {View} from 'react-native';
import {useLocalSearchParams,useRouter} from 'expo-router';
import {AdminPageHeader,SelectionChips} from '@/components/admin-ui';
import {Notice} from '@/components/ui';
import {AdminContractDocumentsScreen as GeneratedDocuments} from './contract-documents';
import {AdminApprovalsScreen as Approvals} from './approvals';
import {AdminDocumentGovernanceScreen as DocumentTracking} from './document-governance';
export default function DocumentCenter(){
 const {view}=useLocalSearchParams<{view?:string}>(),router=useRouter();
 const selected=['emissions','approvals','tracking'].includes(view??'')?view!:'emissions';
 const [visited,setVisited]=useState<string[]>([selected]);
 const choose=(next:string)=>{setVisited(current=>current.includes(next)?current:[...current,next]);router.setParams({view:next});};
 return <View style={{flex:1,minWidth:0}}>
  <View style={{width:'100%',maxWidth:1360,alignSelf:'center',padding:20,gap:12}}>
   <AdminPageHeader title="Emissões e aprovações" description="Documentos gerados, manifestações do cliente e acompanhamento em uma única área." />
   <SelectionChips label="O que deseja consultar?" value={selected} onChange={choose} items={[{value:'emissions',label:'Documentos e aceites'},{value:'approvals',label:'Aprovações'},{value:'tracking',label:'Versões e liberações'}]} />
   {selected==='tracking'?<Notice tone="info">Aqui você confere a versão vigente, libera documentos para o cliente e acompanha o que ainda precisa de aceite. Uma nova versão mantém o histórico e exige seu próprio aceite.</Notice>:null}
  </View>
  {(visited.includes('emissions')||selected==='emissions')?<View style={{flex:1,minHeight:0,display:selected==='emissions'?'flex':'none'}}><GeneratedDocuments embedded onProjectChange={projectId=>router.setParams({projectId})} /></View>:null}
  {(visited.includes('approvals')||selected==='approvals')?<View style={{flex:1,minHeight:0,display:selected==='approvals'?'flex':'none'}}><Approvals embedded onProjectChange={projectId=>router.setParams({projectId})} /></View>:null}
  {(visited.includes('tracking')||selected==='tracking')?<View style={{flex:1,minHeight:0,display:selected==='tracking'?'flex':'none'}}><DocumentTracking embedded onProjectChange={projectId=>router.setParams({projectId})} /></View>:null}
 </View>;
}
