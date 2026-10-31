import React,{useState} from 'react';
import {Pressable,ScrollView,Text,View} from 'react-native';
import {SelectionChips} from '@/components/admin-ui';
import {Button,Field} from '@/components/ui';
import {normalizeDocumentSearch} from '@/lib/document-center-model';
import {useThemeStyles} from '@/providers/theme-provider';
import {radius,spacing,ThemeColors,typography} from '@/theme/tokens';
import type {AdminClientSummary,AdminContractSummary} from '@/types/domain';

export function AdminClientPicker({clients,contracts,value,onChange}:{clients:AdminClientSummary[];contracts:AdminContractSummary[];value:string|null;onChange:(id:string)=>void}){
 const styles=useThemeStyles(definitions),[query,setQuery]=useState(''),[filter,setFilter]=useState('all'),[open,setOpen]=useState(false);
 const selected=clients.find(client=>client.id===value);
 const matches=[...clients].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')).filter(client=>{
  const linked=contracts.filter(contract=>contract.clientId===client.id);
  return (filter==='all'||(filter==='with'?linked.length>0:linked.length===0))&&normalizeDocumentSearch([client.name,client.email,...linked.map(contract=>contract.contractNumber)].join(' ')).includes(normalizeDocumentSearch(query));
 });
 return <View style={styles.wrapper}>
  {selected?<View style={styles.summary}><View style={styles.text}><Text style={styles.title}>{selected.name}</Text><Text style={styles.meta}>{selected.email||'Cliente selecionado'}</Text></View><Button title={open?'Fechar seleção':'Trocar cliente'} variant="ghost" debounceMs={0} onPress={()=>setOpen(!open)} /></View>:null}
  {!selected||open?<>
   <SelectionChips label="Visualizar clientes" value={filter} onChange={setFilter} items={[{value:'all',label:'Todos os clientes'},{value:'with',label:'Com contrato'},{value:'without',label:'Sem contrato'}]} />
   <Field label="Pesquisar cliente" placeholder="Nome, e-mail ou número do contrato" value={query} onChangeText={setQuery} />
   <ScrollView style={styles.results} contentContainerStyle={styles.wrapper} keyboardShouldPersistTaps="handled">{matches.slice(0,20).map(client=>{
    const count=contracts.filter(contract=>contract.clientId===client.id).length;
    return <Pressable accessibilityRole="button" accessibilityLabel={`Selecionar cliente ${client.name}`} key={client.id} style={styles.option} onPress={()=>{onChange(client.id);setOpen(false);setQuery('');}}><Text style={styles.title}>{client.name}</Text><Text style={styles.meta}>{count?`${count} contrato(s)`:'Sem contrato — serviço avulso'}{client.email?` • ${client.email}`:''}</Text></Pressable>;
   })}</ScrollView>
   {!matches.length?<Text style={styles.meta}>Nenhum cliente encontrado neste filtro.</Text>:matches.length>20?<Text style={styles.meta}>Refine a pesquisa para localizar os demais clientes.</Text>:null}
  </>:null}
 </View>;
}
const definitions=(colors:ThemeColors)=>({
 wrapper:{gap:spacing.sm},summary:{flexDirection:'row' as const,flexWrap:'wrap' as const,gap:spacing.sm,alignItems:'center' as const},text:{flexGrow:1,flexBasis:220,minWidth:0,gap:4},
 title:{fontFamily:typography.family,fontSize:14,fontWeight:'700' as const,color:colors.ink},meta:{fontFamily:typography.family,fontSize:12,lineHeight:18,color:colors.muted},
 results:{maxHeight:280},option:{padding:spacing.sm,minHeight:48,gap:4,borderWidth:1,borderColor:colors.line,borderRadius:radius.sm},
});
