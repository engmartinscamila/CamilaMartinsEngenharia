import React,{useCallback,useEffect,useState} from 'react';
import {Pressable,ScrollView,Text,useWindowDimensions,View} from 'react-native';
import {useLocalSearchParams,useRouter,type Href} from 'expo-router';
import {AdminPageHeader,SelectionChips} from '@/components/admin-ui';
import {AdminProjectPicker} from '@/components/admin-project-picker';
import {AdminAreaModule} from '@/components/admin-area-modules';
import {Button,Notice,StateView} from '@/components/ui';
import {adminAreas,adminAreaForModule,type AdminAreaKey,type AdminAreaView} from '@/lib/admin-area-navigation';
import {AdminModuleProvider} from '@/providers/admin-module-context';
import {useThemeStyles} from '@/providers/theme-provider';
import {listAdminProjects} from '@/services/admin-service';
import type {AdminProjectSummary} from '@/types/domain';
import {spacing,ThemeColors,typography} from '@/theme/tokens';
interface CachedModule {key:string;module:string;projectId:string|null;subview?:string;view:string;financialId?:string;params:Record<string,string>}
export function AdminArea({area}:{area:AdminAreaKey}){
 const router=useRouter(),params=useLocalSearchParams<{view?:string;projectId?:string;financialId?:string;receiptId?:string;clientId?:string;novo?:string;visao?:string;foto?:string}>();
 const definition=adminAreas[area],views=definition.groups.flatMap(group=>group.views);
 const selected=views.find(view=>view.key===params.view)??views[0]!;
 const group=definition.groups.find(item=>item.views.includes(selected))!;
 const projectId=typeof params.projectId==='string'?params.projectId:null;
 const scoped=selected.project||selected.scope;
 const styles=useThemeStyles(styleDefinitions);
 const [projects,setProjects]=useState<AdminProjectSummary[]>([]),[error,setError]=useState<string|null>(null);
 const [cache,setCache]=useState<CachedModule[]>([]),[showProjects,setShowProjects]=useState(false);
 // Cabeçalho recolhível: em telas baixas começa recolhido para sobrar espaço ao conteúdo.
 const {height}=useWindowDimensions();
 const [headerOpen,setHeaderOpen]=useState(()=>height>=900);
 useEffect(()=>{let active=true;void listAdminProjects().then(result=>{if(active){setProjects(result.data);setError(result.error);}}).catch(()=>{if(active)setError('Não foi possível carregar os projetos.');});return()=>{active=false;};},[]);
 const navigate=useCallback((module:string,values:Record<string,string>={})=>{
  const local=definition.groups.flatMap(item=>item.views).find(item=>item.module===module&&(!values.view||item.key===values.view))??definition.groups.flatMap(item=>item.views).find(item=>item.module===module);
  const destination=local?{area,view:local.key}:adminAreaForModule(module);
  const next={...(projectId?{projectId}:{}),...values};
  if(destination?.area===area){router.setParams({...next,view:destination.view,...(module==='receipts'&&values.receiptId?{financialId:undefined}:module==='receipts'&&values.financialId?{receiptId:undefined}:{}),...(module!=='receipts'?{financialId:undefined,receiptId:undefined}:{})});return;}
  if(destination){router.push({pathname:`/admin/${destination.area}`,params:{...next,view:destination.view}} as Href);return;}
  router.push({pathname:`/admin/${module}`,params:next} as Href);
 },[area,definition.groups,projectId,router]);
 const selectProject=useCallback((id:string|null)=>router.setParams({projectId:id??undefined}),[router]);
 const viewProject=scoped?projectId:null;
 const financialId=selected.module==='receipts'&&typeof params.financialId==='string'?params.financialId:undefined;
 const names=selected.module==='receipts'?['financialId','receiptId']:['clients','projects','workspace'].includes(selected.module)?['clientId']:['documents','photos'].includes(selected.module)?['novo','visao','foto']:[];
 const contextual=Object.fromEntries(Object.entries(params).filter(([name,value])=>names.includes(name)&&typeof value==='string')) as Record<string,string>;
 const extraKey=JSON.stringify(contextual);
 const key=`${selected.module}:${viewProject??'all'}:${extraKey}`;
 const available=!selected.project||!!projects.find(item=>item.id===projectId);
 useEffect(()=>{
  if(!available)return;
  const entry={key,module:selected.module,projectId:viewProject,subview:selected.subview,view:selected.key,financialId,params:JSON.parse(extraKey) as Record<string,string>};
  const timer=setTimeout(()=>setCache(current=>current.some(item=>item.key===key)?current:current.concat(entry)),0);
  return()=>clearTimeout(timer);
 },[available,key,selected.module,selected.subview,selected.key,viewProject,financialId,extraKey]);
 const choose=(view:AdminAreaView)=>{router.setParams({view:view.key,...(view.module!=='receipts'?{financialId:undefined,receiptId:undefined}:{})});setShowProjects(false);};
 const currentProject=projects.find(item=>item.id===projectId);
 if(!headerOpen)return <View style={styles.container}>
  <View style={[styles.heading,styles.headingCompact]}>
   <Pressable accessibilityRole="button" accessibilityLabel="Mostrar abas e projeto" onPress={()=>setHeaderOpen(true)} style={styles.compactBar}>
    <Text style={styles.compactTitle} numberOfLines={1}>{definition.title} • {selected.label}{scoped&&currentProject?` • ${currentProject.name}`:''}</Text>
    <Text style={styles.compactAction}>Mostrar abas ▾</Text>
   </Pressable>
  </View>
  {renderModules()}
 </View>;
 return <View style={styles.container}>
  <View style={styles.heading}><AdminPageHeader title={definition.title} description="" />
   <SelectionChips label="Área de trabalho" value={group.key} onChange={value=>choose(definition.groups.find(item=>item.key===value)!.views[0]!)} items={definition.groups.map(item=>({value:item.key,label:item.label}))} />
   {group.views.length>1?<SelectionChips label="Planejamento e ações" value={selected.key} onChange={value=>choose(group.views.find(item=>item.key===value)!)} items={group.views.map(item=>({value:item.key,label:item.label}))} />:null}
   {scoped?<View style={styles.context}>
    {!projectId&&!selected.project&&!showProjects?<Button debounceMs={0} title="Filtrar por projeto" variant="ghost" onPress={()=>setShowProjects(true)} />:<>
     <AdminProjectPicker projects={projects} value={projectId} onChange={selectProject} disabled={!!financialId} />
     {!selected.project&&projectId?<Button debounceMs={0} title="Todos os projetos" disabled={!!financialId} variant="ghost" onPress={()=>selectProject(null)} />:null}
    </>}
   </View>:null}
   {error?<Notice tone="warning">{error}</Notice>:null}
   {area==='finance-center'&&selected.module==='receipts'&&financialId?<View style={styles.receiptContext}><Text style={styles.meta}>Recibo vinculado ao recebimento selecionado.</Text><Button debounceMs={0} title="Novo recibo avulso" variant="ghost" onPress={()=>router.setParams({financialId:undefined,receiptId:undefined})} /></View>:null}
   <Pressable accessibilityRole="button" accessibilityLabel="Recolher abas e projeto" onPress={()=>setHeaderOpen(false)} style={styles.collapse}><Text style={styles.compactAction}>Recolher abas ▴</Text></Pressable>
  </View>
  {renderModules()}
 </View>;
 function renderModules(){return <>
  {!available?<ScrollView contentContainerStyle={styles.empty}><StateView title="Selecione o projeto" description="O planejamento e os registros serão abertos no projeto escolhido." icon="briefcase-outline" /></ScrollView>:null}
  {cache.map(entry=>{
   const active=available&&entry.key===key;
   return <View key={entry.key} style={[styles.module,{display:active?'flex':'none'}]}>
    <AdminModuleProvider value={{module:entry.module,projectId:entry.projectId,subview:active?selected.subview:entry.subview,params:entry.params,onProjectChange:selectProject,onNavigate:navigate}}>
     <AdminAreaModule module={entry.module} />
    </AdminModuleProvider>
   </View>;
  })}
 </>;}
}
const styleDefinitions=(colors:ThemeColors)=>({
 container:{flex:1,minWidth:0},heading:{paddingHorizontal:spacing.md,paddingVertical:spacing.sm,gap:spacing.xs,borderBottomWidth:1,borderBottomColor:colors.line},
 headingCompact:{paddingVertical:spacing.xs},
 compactBar:{flexDirection:'row' as const,alignItems:'center' as const,justifyContent:'space-between' as const,gap:spacing.sm,minHeight:44},
 compactTitle:{flex:1,minWidth:0,color:colors.ink,fontFamily:typography.family,fontSize:15,fontWeight:'700' as const},
 compactAction:{color:colors.gold600,fontFamily:typography.family,fontSize:13,fontWeight:'700' as const},
 collapse:{alignSelf:'flex-end' as const,minHeight:32,justifyContent:'center' as const},
 context:{gap:spacing.xs},module:{flex:1,minHeight:0},empty:{padding:spacing.lg},
 receiptContext:{flexDirection:'row' as const,flexWrap:'wrap' as const,alignItems:'center' as const,gap:spacing.sm},
 meta:{color:colors.muted,fontFamily:typography.family,fontSize:12,lineHeight:18},
});
