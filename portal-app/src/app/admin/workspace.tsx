import React,{useCallback,useMemo,useState} from 'react';
import {Text,View} from 'react-native';
import {useLocalSearchParams,useRouter,type Href} from 'expo-router';
import {AdminPageHeader,SelectionChips} from '@/components/admin-ui';
import {Button,Card,Field,Notice,Screen,StateView} from '@/components/ui';
import {useLiveRefresh} from '@/hooks/use-live-refresh';
import {openWebsiteAdminSection} from '@/lib/admin-navigation';
import {financialStatus,financialToday,financialTotals} from '@/lib/financial-model';
import {formatCurrency,formatDate} from '@/lib/format';
import {useThemeStyles} from '@/providers/theme-provider';
import {listAdminClients,listAdminProjects,listAdminContent,listAdminFinancialEntries,listAdminApprovals,listAdminRequests} from '@/services/admin-service';
import {listPendingEmailJobs} from '@/services/admin-email-history';
import {spacing,type ThemeColors,typography} from '@/theme/tokens';
import type {AdminClientSummary,AdminProjectSummary,AdminContentSummary,FinancialEntrySummary,ApprovalSummary,AdminRequestSummary} from '@/types/domain';
type Result={id:string;label:string;detail:string;section:string;projectId?:string|null};
const text=(value:unknown)=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
export default function AdminWorkspace(){
 const router=useRouter(),params=useLocalSearchParams<{projectId?:string}>();
 const [clients,setClients]=useState<AdminClientSummary[]>([]),[projects,setProjects]=useState<AdminProjectSummary[]>([]),[files,setFiles]=useState<AdminContentSummary[]>([]),[entries,setEntries]=useState<FinancialEntrySummary[]>([]),[approvals,setApprovals]=useState<ApprovalSummary[]>([]),[requests,setRequests]=useState<AdminRequestSummary[]>([]);
 const [emailJobs,setEmailJobs]=useState<{id:string;client_id:string;kind:string;status:string;last_error:string|null}[]>([]);
 const [query,setQuery]=useState(''),[projectId,setProjectId]=useState(params.projectId??''),[mode,setMode]=useState('search'),[page,setPage]=useState(0),[error,setError]=useState<string|null>(null),[loading,setLoading]=useState(false);
 const styles=useThemeStyles(style);
 const load=useCallback(async()=>{setLoading(true);try{
  const [c,p,f,e,a,r,m]=await Promise.all([listAdminClients(),listAdminProjects(),listAdminContent(),listAdminFinancialEntries(),listAdminApprovals(),listAdminRequests(),listPendingEmailJobs()]);
  setClients(c.data);setProjects(p.data);setFiles(f.data);setEntries(e.data);setApprovals(a.data);setRequests(r.data);setEmailJobs(m.data??[]);
  setError(c.error??p.error??f.error??e.error??a.error??r.error??m.error);
 }catch{setError('Não foi possível atualizar a central. Confira a conexão e tente novamente.');}finally{setLoading(false);}},[]);
 useLiveRefresh(load);
 const project=projects.find(p=>p.id===projectId),client=clients.find(c=>c.id===project?.clientId);
 const totals=financialTotals(entries.filter(e=>e.projectId===projectId));
 const open=(section:string,id?:string|null)=>{const values:Record<string,string>=id?{projectId:id}:{};if(!openWebsiteAdminSection(section,values))router.push({pathname:`/admin/${section==='documents'?'content':section}`,params:values} as Href);};
 const results=useMemo(()=>{
  const rows:Result[]=[];
  if(mode==='search'){
   for(const c of clients)rows.push({id:'client:'+c.id,label:c.name,detail:`Cliente • ${c.email??''} • ${c.status}`,section:'clients'});
   for(const p of projects)rows.push({id:'project:'+p.id,label:p.contractNumber+' • '+p.name,detail:p.clientName+' • '+p.status,section:'workspace',projectId:p.id});
   for(const f of files)rows.push({id:f.kind+':'+f.id,label:f.title,detail:`Arquivo • ${f.clientName} • ${f.category}`,section:'documents',projectId:f.projectId});
   for(const e of entries)rows.push({id:e.id,label:e.description,detail:`Financeiro • ${e.clientName} • ${formatCurrency(e.amount)} • ${e.status}`,section:'financial',projectId:e.projectId});
  }
  for(const r of requests)if(mode==='search'||!['concluida','concluido','cancelada','cancelado','fechada','fechado'].includes(text(r.status)))rows.push({id:'request:'+r.id,label:r.title,detail:`Solicitação • ${r.clientName} • ${r.status}`,section:'requests',projectId:r.projectId});
  for(const a of approvals)if(mode==='search'||['aguardando','pendente','aguardando_cliente','em_analise'].includes(text(a.status)))rows.push({id:'approval:'+a.id,label:a.title,detail:`Aprovação • ${a.status} • Prazo ${formatDate(a.dueAt)}`,section:'approvals',projectId:a.projectId});
  if(mode==='pending'){
   for(const e of entries)if(financialStatus(e.status)==='pendente'&&e.dueDate&&e.dueDate<financialToday())rows.push({id:e.id,label:e.description,detail:`Financeiro em atraso • ${e.clientName} • ${formatCurrency(e.amount)}`,section:'financial',projectId:e.projectId});
   for(const j of emailJobs)if(['failed','pending','processing'].includes(j.status))rows.push({id:'email:'+j.id,label:'E-mail: '+(clients.find(c=>c.id===j.client_id)?.name??'Cliente'),detail:j.status+' • '+(j.last_error??'Envio automático em andamento'),section:'clients'});
  }
  return rows.filter(r=>(!projectId||r.projectId===projectId||r.id==='client:'+project?.clientId||(r.id.startsWith('email:')&&emailJobs.some(j=>'email:'+j.id===r.id&&j.client_id===project?.clientId)))&&text(r.label+' '+r.detail).includes(text(query)));
 },[clients,projects,files,entries,approvals,requests,emailJobs,mode,projectId,project,query]);
 return <Screen><AdminPageHeader title="Central de gestão" description="Busca geral, ficha por contrato e pendências com acesso ao cadastro de origem." />
 {error?<Notice tone="warning">{error} O resumo pode estar incompleto; atualize antes de tomar decisões.</Notice>:null}
 <Card><SelectionChips label="Consultar" value={mode} onChange={v=>{setMode(v);setPage(0);}} items={[{value:'search',label:'Busca e ficha'},{value:'pending',label:'Pendências'}]} /><Field label="Buscar cliente, contrato, arquivo ou lançamento" value={query} onChangeText={v=>{setQuery(v);setPage(0);}} /><SelectionChips label="Contrato / projeto" value={projectId} onChange={v=>{setProjectId(v);setPage(0);}} items={[{value:'',label:'Todos'},...projects.map(p=>({value:p.id,label:p.contractNumber+' • '+p.clientName+' • '+p.name}))]} /></Card>
 {project?<Card><Text style={styles.title}>{project.contractNumber} • {project.name}</Text><Text style={styles.meta}>{client?.name??project.clientName} • {client?.email??''} • {client?.phone??''}</Text><Text style={styles.meta}>{project.status} • {project.progress===null?'Progresso não informado':project.progress+'%'} • Valor contratual {formatCurrency(project.contract?.contractValue??null)}</Text><Text style={styles.meta}>Recebido: {error?'Indisponível':formatCurrency(totals.received)} • A receber: {error?'Indisponível':formatCurrency(totals.receivable)} • Pago: {error?'Indisponível':formatCurrency(totals.paid)}</Text><View style={styles.actions}>{([['documents','Arquivos'],['financial','Financeiro'],['contract-documents','Emissões e aceites'],['document-governance','Versões e pendências'],['document-archive','Arquivo e restauração'],['portal-control','Prévia do cliente'],['security','Histórico e auditoria']] as const).map(([key,label])=><Button key={key} title={label} variant="secondary" onPress={()=>open(key,project.id)} />)}</View></Card>:null}
 <Text style={styles.title}>{mode==='pending'?'Pendências':'Resultados'} • {results.length}</Text>
 {!loading&&!results.length?<StateView icon="search-outline" title="Nenhum resultado" description="Ajuste a pesquisa ou o projeto selecionado." />:null}
 {results.slice(page*50,page*50+50).map(row=><Card key={row.id}><Text style={styles.title}>{row.label}</Text><Text style={styles.meta}>{row.detail}</Text><Button title="Abrir origem" variant="secondary" onPress={()=>row.section==='workspace'?setProjectId(row.projectId??''):open(row.section,row.projectId)} /></Card>)}
 <View style={styles.actions}><Button title="Página anterior" disabled={page===0} variant="ghost" onPress={()=>setPage(p=>p-1)} /><Text style={styles.meta}>Página {page+1}</Text><Button title="Próxima página" disabled={(page+1)*50>=results.length} variant="ghost" onPress={()=>setPage(p=>p+1)} /></View>
 <Button title="Atualizar central" loading={loading} variant="secondary" onPress={()=>void load()} /></Screen>;
}
const style=(colors:ThemeColors)=>({title:{color:colors.ink,fontFamily:typography.family,fontSize:16,fontWeight:'700'},meta:{color:colors.muted,fontFamily:typography.family,fontSize:13,lineHeight:20},actions:{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm}});
