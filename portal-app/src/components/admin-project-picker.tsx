import React,{useState} from 'react';
import {Pressable,ScrollView,Text,View} from 'react-native';
import {Button,Field,StatusPill} from '@/components/ui';
import {normalizeDocumentSearch} from '@/lib/document-center-model';
import {useThemeStyles} from '@/providers/theme-provider';
import {spacing,ThemeColors,typography,radius} from '@/theme/tokens';
import type {AdminProjectSummary} from '@/types/domain';

export function AdminProjectPicker({projects,value,onChange,disabled=false}:{projects:AdminProjectSummary[];value:string|null;onChange:(id:string)=>void;disabled?:boolean}){
 const styles=useThemeStyles(styleDefinitions);
 const [editing,setEditing]=useState(false),[query,setQuery]=useState('');
 const selected=projects.find(project=>project.id===value);
 const matches=projects.filter(project=>normalizeDocumentSearch(`${project.clientName} ${project.name} ${project.contractNumber}`).includes(normalizeDocumentSearch(query)));
 return <View style={styles.wrapper}>
  {selected?<View style={styles.summary}>
   <View style={styles.texts}><Text style={styles.title}>{selected.name}</Text><Text style={styles.meta}>{selected.clientName}</Text>
    {selected.contractId?<Text style={styles.meta}>{selected.contractNumber}</Text>:<StatusPill label="Vínculo contratual pendente" tone="warning" />}
   </View><Button debounceMs={0} disabled={disabled} onPress={()=>setEditing(current=>!current)} title={editing?'Fechar seleção':'Trocar projeto'} variant="ghost" />
  </View>:null}
  {!selected||editing?<View style={styles.wrapper}>
   <Field label="Cliente / projeto / contrato" placeholder="Pesquisar cliente, projeto ou contrato" value={query} onChangeText={setQuery} />
   <ScrollView style={styles.results} contentContainerStyle={styles.resultContent} keyboardShouldPersistTaps="handled">{matches.slice(0,20).map(project=><Pressable key={project.id} accessibilityRole="button" accessibilityLabel={`Selecionar projeto ${project.name}`} disabled={disabled} onPress={()=>{onChange(project.id);setEditing(false);setQuery('');}} style={[styles.result,value===project.id&&styles.selected]}>
    <Text style={styles.title}>{project.name}</Text><Text style={styles.meta}>{project.clientName}{project.contractId?` • ${project.contractNumber}`:''}</Text>
   </Pressable>)}</ScrollView>
   {matches.length===0?<Text style={styles.meta}>Nenhum projeto encontrado.</Text>:matches.length>20?<Text style={styles.meta}>Refine a pesquisa para localizar os demais projetos.</Text>:null}
  </View>:null}
 </View>;
}
const styleDefinitions=(colors:ThemeColors)=>({
 wrapper:{gap:spacing.sm},summary:{flexDirection:'row' as const,flexWrap:'wrap' as const,alignItems:'center' as const,gap:spacing.sm},
 texts:{flexGrow:1,flexBasis:240,minWidth:0,gap:4},title:{color:colors.ink,fontFamily:typography.family,fontSize:14,fontWeight:'700' as const},
 meta:{color:colors.muted,fontFamily:typography.family,fontSize:12,lineHeight:18},results:{maxHeight:300},resultContent:{gap:spacing.xs},
 result:{padding:spacing.sm,gap:4,borderWidth:1,borderColor:colors.line,borderRadius:radius.sm,minHeight:48},selected:{borderColor:colors.gold500},
});
