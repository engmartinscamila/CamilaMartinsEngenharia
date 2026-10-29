import React,{useCallback,useMemo,useState} from 'react';
import {Text,View} from 'react-native';
import {useLocalSearchParams,useRouter,type Href} from 'expo-router';
import {AdminPageHeader,SelectionChips} from '@/components/admin-ui';
import {AdminProjectPicker} from '@/components/admin-project-picker';
import {Button,Card,Field,Notice,Screen,StateView} from '@/components/ui';
import {useLiveRefresh} from '@/hooks/use-live-refresh';
import {useNotificationProject} from '@/hooks/use-notification-project';
import {useAdminModule,useAdminProjectSelection} from '@/providers/admin-module-context';
import {openWebsiteAdminSection} from '@/lib/admin-navigation';
import {financialStatus,financialToday,financialTotals} from '@/lib/financial-model';
import {formatCurrency,formatDate} from '@/lib/format';
import {useThemeStyles} from '@/providers/theme-provider';
import {listAdminClients,listAdminContracts,listAdminProjects,listAdminContent,listAdminFinancialEntries,listAdminApprovals,listAdminRequests} from '@/services/admin-service';
import {getAdminDashboard} from '@/services/portal-service';
import {listPendingEmailJobs} from '@/services/admin-email-history';
import {spacing,type ThemeColors,typography} from '@/theme/tokens';
import type {AdminClientSummary,AdminContractSummary,AdminProjectSummary,AdminContentSummary,FinancialEntrySummary,ApprovalSummary,AdminRequestSummary,DashboardCounts} from '@/types/domain';
type Result={id:string;label:string;detail:string;section:string;projectId?:string|null;clientId?:string};
const text=(value:unknown)=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
export default function AdminWorkspace(){
 const embedded=useAdminModule(),router=useRouter(),params=useLocalSearchParams<{projectId?:string;clientId?:string;mode?:string}>();
 const [clients,setClients]=useState<AdminClientSummary[]>([]),[contracts,setContracts]=useState<AdminContractSummary[]>([]),[projects,setProjects]=useState<AdminProjectSummary[]>([]),[files,setFiles]=useState<AdminContentSummary[]>([]),[entries,setEntries]=useState<FinancialEntrySummary[]>([]),[approvals,setApprovals]=useState<ApprovalSummary[]>([]),[requests,setRequests]=useState<AdminRequestSummary[]>([]);
 const [counts,setCounts]=useState<DashboardCounts>({activeClients:null,activeProjects:null,openRequests:null,pendingApprovals:null});
 const [emailJobs,setEmailJobs]=useState<{id:string;client_id:string;kind:string;status:string;last_error:string|null}[]>([]);
 const [query,setQuery]=useState(''),[projectId,setProjectId]=useAdminProjectSelection(params.projectId??null),[clientId,setClientId]=useState(typeof params.clientId==='string'?params.clientId:''),[mode,setMode]=useState(embedded?.subview??params.mode??'summary'),[page,setPage]=useState(0),[error,setError]=useState<string|null>(null),[loading,setLoading]=useState(false);
 const styles=useThemeStyles(style);
 useNotificationProject(projects,setProjectId);
 const load=useCallback(async()=>{setLoading(true);try{
  const [c,ct,p,f,e,a,r,m,d]=await Promise.all([listAdminClients(),listAdminContracts(),listAdminProjects(),listAdminContent(),listAdminFinancialEntries(),listAdminApprovals(),listAdminRequests(),listPendingEmailJobs(),getAdminDashboard()]);
  setClients(c.data);setContracts(ct.data);setProjects(p.data);setFiles(f.data);setEntries(e.data);setApprovals(a.data);setRequests(r.data);setEmailJobs(m.data??[]);setCounts(d.data);
  setError(c.error??ct.error??p.error??f.error??e.error??a.error??r.error??m.error??d.error);
 }catch{setError('Não foi possível atualizar a visão geral. Confira a conexão e tente novamente.');}finally{setLoading(false);}},[]);
 useLiveRefresh(load);
 const project=projects.find(p=>p.id===projectId),client=clients.find(c=>c.id===(project?.clientId||clientId));
 const totals=financialTotals(entries.filter(e=>e.projectId===projectId));
 const open=(section:string,id?:string|null,extra:Record<string,string>={})=>{const values:Record<string,string>={...(id?{projectId:id}:{}),...extra};if(embedded){embedded.onNavigate(section,values);return;}if(!openWebsiteAdminSection(section,values))router.push({pathname:`/admin/${section==='documents'?'content':section}`,params:values} as Href);};
 const selectProject=(id:string|null)=>{setProjectId(id);setPage(0);if(!embedded)router.setParams({projectId:id??undefined});};
 const results=useMemo(()=>{
  const rows:Result[]=[];
  if(mode==='search'||mode==='profile'){
   for(const c of clients)rows.push({id:'client:'+c.id,label:c.name,detail:`Cliente • ${c.email??''} • ${c.status}`,section:'clients',clientId:c.id});
   for(const p of projects)rows.push({id:'project:'+p.id,label:p.name,detail:p.clientName+' • '+p.contractNumber+' • '+p.status,section:'workspace',projectId:p.id});
   if(mode==='search'){
    for(const f of files)rows.push({id:f.kind+':'+f.id,label:f.title,detail:`Arquivo • ${f.clientName} • ${f.category}`,section:'documents',projectId:f.projectId});
    for(const e of entries)rows.push({id:e.id,label:e.description,detail:`Financeiro • ${e.clientName} • ${formatCurrency(e.amount)} • ${e.status}`,section:'financial',projectId:e.projectId});
   }
  }
  if(mode!=='profile'){
   for(const r of requests)if(mode==='search'||!['concluida','concluido','cancelada','cancelado','fechada','fechado'].includes(text(r.status)))rows.push({id:'request:'+r.id,label:r.title,detail:`Solicitação • ${r.clientName} • ${r.status}`,section:'requests',projectId:r.projectId});
   for(const a of approvals)if(mode==='search'||['aguardando','pendente','aguardando_cliente','em_analise'].includes(text(a.status)))rows.push({id:'approval:'+a.id,label:a.title,detail:`Aprovação • ${a.status} • Prazo ${formatDate(a.dueAt)}`,section:'approvals',projectId:a.projectId});
   if(mode==='pending'||mode==='summary'){
    for(const e of entries)if(financialStatus(e.status)==='pendente'&&e.dueDate&&e.dueDate<financialToday())rows.push({id:e.id,label:e.description,detail:`Financeiro em atraso • ${e.clientName} • ${formatCurrency(e.amount)}`,section:'financial',projectId:e.projectId});
    for(const j of emailJobs)if(['failed','pending','processing'].includes(j.status))rows.push({id:'email:'+j.id,label:'E-mail: '+(clients.find(c=>c.id===j.client_id)?.name??'Cliente'),detail:j.status+' • '+(j.last_error??'Envio automático em andamento'),section:'clients',clientId:j.client_id});
   }
  }
  return rows.filter(r=>(!projectId||r.projectId===projectId||r.id==='client:'+project?.clientId||(r.id.startsWith('email:')&&r.clientId===project?.clientId))&&text(r.label+' '+r.detail).includes(text(query)));
 },[clients,projects,files,entries,approvals,requests,emailJobs,mode,projectId,project,query]);
 return <Screen><AdminPageHeader title="Visão geral" description="Indicadores, busca, pendências e ficha do cliente ou projeto." />
 {error?<Notice tone="warning">{error} O resumo pode estar incompleto; atualize antes de tomar decisões.</Notice>:null}
 {!embedded?<SelectionChips label="Consultar" value={mode} onChange={value=>{setMode(value);setPage(0);}} items={[{value:'summary',label:'Resumo'},{value:'search',label:'Pesquisar'},{value:'pending',label:'Pendências'},{value:'profile',label:'Ficha do cliente / projeto'}]} />:null}
 {mode==='summary'?<View style={styles.metrics}>{([
  ['Clientes ativos',counts.activeClients,'clients'],['Projetos ativos',counts.activeProjects,'projects'],['Solicitações abertas',counts.openRequests,'requests'],['Aprovações pendentes',counts.pendingApprovals,'approvals'],
 ] as const).map(([label,value,section])=><Card key={label} style={styles.metric}><Text style={styles.meta}>{label}</Text><Text style={styles.number}>{value===null?'Indisponível':value}</Text><Button title={'Consultar '+label.toLowerCase()} variant="ghost" onPress={()=>open(section)} /></Card>)}</View>:null}
 <Card><Field label="Buscar cliente, contrato, arquivo ou lançamento" value={query} onChangeText={value=>{setQuery(value);setPage(0);}} />
 {!embedded?<><AdminProjectPicker projects={projects} value={projectId} onChange={selectProject} />{projectId?<Button debounceMs={0} title="Todos os projetos" variant="ghost" onPress={()=>selectProject(null)} />:null}</>:null}</Card>
 {client&&(mode==='profile'||project)?<Card><Text style={styles.title}>{client.name}</Text><Text style={styles.meta}>{client.email??'E-mail não informado'} • {client.phone??'Telefone não informado'} • {client.status}</Text><View style={styles.actions}><Button title="Cadastro e acessos do cliente" variant="secondary" onPress={()=>open('clients',null,{clientId:client.id})} /><Button title="Orçamentos e contratos deste cliente" variant="secondary" onPress={()=>open('commercial-documents',null,{clientId:client.id})} /></View>
 <Text style={styles.title}>Contratos</Text>{contracts.filter(item=>item.clientId===client.id).map(item=><Text key={item.id} style={styles.meta}>{item.contractNumber} • {item.serviceType??'Serviço não informado'} • {item.status}</Text>)}
 <Text style={styles.title}>Projetos</Text>{projects.filter(item=>item.clientId===client.id).map(item=><Button key={item.id} title={item.name} variant="ghost" onPress={()=>selectProject(item.id)} />)}</Card>:null}
 {project?<Card><Text style={styles.title}>{project.name}</Text><Text style={styles.meta}>{project.contractId?project.contractNumber:'Vínculo contratual pendente'} • {project.status} • {project.progress===null?'Progresso não informado':project.progress+'%'}</Text><Text style={styles.meta}>Valor contratual {formatCurrency(project.contract?.contractValue??null)} • Recebido {error?'Indisponível':formatCurrency(totals.received)} • A receber {error?'Indisponível':formatCurrency(totals.receivable)} • Pago {error?'Indisponível':formatCurrency(totals.paid)}</Text>
 <View style={styles.actions}>{([['documents','Acervo'],['financial','Financeiro e recibos'],['document-center','Emissões e aprovações'],['construction-schedule','Gestão da obra'],['requests','Relacionamento'],['portal-control','Acessos ao portal']] as const).map(([key,label])=><Button key={key} title={label} variant="secondary" onPress={()=>open(key,project.id)} />)}</View></Card>:null}
 <Text style={styles.title}>{mode==='summary'||mode==='pending'?'Pendências':mode==='profile'?'Localizar cliente ou projeto':'Resultados'} • {error?'Consulta incompleta':results.length}</Text>
 {!loading&&!error&&!results.length?<StateView icon="search-outline" title="Nenhum resultado" description="Ajuste a pesquisa ou o projeto selecionado." />:null}
 {results.slice(page*50,page*50+50).map(row=><Card key={row.id}><Text style={styles.title}>{row.label}</Text><Text style={styles.meta}>{row.detail}</Text><Button title={row.clientId?'Ver ficha do cliente':row.section==='workspace'?'Ver ficha do projeto':'Abrir origem'} variant="secondary" onPress={()=>{if(row.clientId){setClientId(row.clientId);setMode('profile');router.setParams({clientId:row.clientId});selectProject(null);}else if(row.section==='workspace'){setMode('profile');selectProject(row.projectId??null);}else open(row.section,row.projectId);}} /></Card>)}
 {results.length>50?<View style={styles.actions}><Button title="Página anterior" disabled={page===0} variant="ghost" onPress={()=>setPage(p=>p-1)} /><Text style={styles.meta}>Página {page+1}</Text><Button title="Próxima página" disabled={(page+1)*50>=results.length} variant="ghost" onPress={()=>setPage(p=>p+1)} /></View>:null}
 <Button debounceMs={0} title="Atualizar visão geral" loading={loading} variant="secondary" onPress={()=>void load()} /></Screen>;
}
const style=(colors:ThemeColors)=>({title:{color:colors.ink,fontFamily:typography.family,fontSize:16,fontWeight:'700'},number:{color:colors.ink,fontFamily:typography.family,fontSize:26,fontWeight:'700'},meta:{color:colors.muted,fontFamily:typography.family,fontSize:13,lineHeight:20},actions:{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm},metrics:{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm},metric:{flexGrow:1,flexBasis:220,minWidth:0}});
