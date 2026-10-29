import React,{useCallback,useEffect,useState} from 'react';
import {ScrollView,Text,View} from 'react-native';
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
 const router=useRouter(),params=useLocalSearchParams<{view?:string;projectId?:string;financialId?:string;clientId?:string;novo?:string;visao?:string;foto?:string}>();
 const definition=adminAreas[area],views=definition.groups.flatMap(group=>group.views);
 const selected=views.find(view=>view.key===params.view)??views[0]!;
 const group=definition.groups.find(item=>item.views.includes(selected))!;
 const projectId=typeof params.projectId==='string'?params.projectId:null;
 const scoped=selected.project||selected.scope;
 const styles=useThemeStyles(styleDefinitions);
 const [projects,setProjects]=useState<AdminProjectSummary[]>([]),[error,setError]=useState<string|null>(null);
 const [cache,setCache]=useState<CachedModule[]>([]),[showProjects,setShowProjects]=useState(false);
 useEffect(()=>{let active=true;void listAdminProjects().then(result=>{if(active){setProjects(result.data);setError(result.error);}}).catch(()=>{if(active)setError('Não foi possível carregar os projetos.');});return()=>{active=false;};},[]);
 const navigate=useCallback((module:string,values:Record<string,string>={})=>{
  const local=definition.groups.flatMap(item=>item.views).find(item=>item.module===module&&(!values.view||item.key===values.view))??definition.groups.flatMap(item=>item.views).find(item=>item.module===module);
  const destination=local?{area,view:local.key}:adminAreaForModule(module);
  const next={...(projectId?{projectId}:{}),...values};
  if(destination?.area===area){router.setParams({...next,view:destination.view});return;}
  if(destination){router.push({pathname:`/admin/${destination.area}`,params:{...next,view:destination.view}} as Href);return;}
  router.push({pathname:`/admin/${module}`,params:next} as Href);
 },[area,definition.groups,projectId,router]);
 const selectProject=useCallback((id:string|null)=>router.setParams({projectId:id??undefined}),[router]);
 const viewProject=scoped?projectId:null;
 const financialId=selected.module==='receipts'&&typeof params.financialId==='string'?params.financialId:undefined;
 const names=selected.module==='receipts'?['financialId']:['clients','projects','workspace'].includes(selected.module)?['clientId']:['documents','photos'].includes(selected.module)?['novo','visao','foto']:[];
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
 const choose=(view:AdminAreaView)=>{router.setParams({view:view.key});setShowProjects(false);};
 return <View style={styles.container}>
  <View style={styles.heading}><AdminPageHeader title={definition.title} description={definition.description} />
   <SelectionChips label="Área de trabalho" value={group.key} onChange={value=>choose(definition.groups.find(item=>item.key===value)!.views[0]!)} items={definition.groups.map(item=>({value:item.key,label:item.label}))} />
   {group.views.length>1?<SelectionChips label="Planejamento e ações" value={selected.key} onChange={value=>choose(group.views.find(item=>item.key===value)!)} items={group.views.map(item=>({value:item.key,label:item.label}))} />:null}
   {scoped?<View style={styles.context}>
    {!projectId&&!selected.project&&!showProjects?<Button debounceMs={0} title="Filtrar por projeto" variant="ghost" onPress={()=>setShowProjects(true)} />:<>
     <AdminProjectPicker projects={projects} value={projectId} onChange={selectProject} disabled={!!financialId} />
     {!selected.project&&projectId?<Button debounceMs={0} title="Todos os projetos" variant="ghost" onPress={()=>selectProject(null)} />:null}
    </>}
   </View>:null}
   {error?<Notice tone="warning">{error}</Notice>:null}
   {area==='finance-center'&&selected.module==='receipts'&&financialId?<View style={styles.receiptContext}><Text style={styles.meta}>Recibo vinculado ao recebimento selecionado.</Text><Button debounceMs={0} title="Novo recibo avulso" variant="ghost" onPress={()=>router.setParams({financialId:undefined})} /></View>:null}
  </View>
  {!available?<ScrollView contentContainerStyle={styles.empty}><StateView title="Selecione o projeto" description="O planejamento e os registros serão abertos no projeto escolhido." icon="briefcase-outline" /></ScrollView>:null}
  {cache.map(entry=>{
   const active=available&&entry.key===key;
   return <View key={entry.key} style={[styles.module,{display:active?'flex':'none'}]}>
    <AdminModuleProvider value={{module:entry.module,projectId:entry.projectId,subview:active?selected.subview:entry.subview,params:entry.params,onProjectChange:selectProject,onNavigate:navigate}}>
     <AdminAreaModule module={entry.module} />
    </AdminModuleProvider>
   </View>;
  })}
 </View>;
}
const styleDefinitions=(colors:ThemeColors)=>({
 container:{flex:1,minWidth:0},heading:{padding:spacing.md,gap:spacing.sm,borderBottomWidth:1,borderBottomColor:colors.line},
 context:{gap:spacing.xs},module:{flex:1,minHeight:0},empty:{padding:spacing.lg},
 receiptContext:{flexDirection:'row' as const,flexWrap:'wrap' as const,alignItems:'center' as const,gap:spacing.sm},
 meta:{color:colors.muted,fontFamily:typography.family,fontSize:12,lineHeight:18},
});
