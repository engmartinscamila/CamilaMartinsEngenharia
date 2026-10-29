import {useLocalSearchParams,useRouter} from 'expo-router';
import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ActivityIndicator,Alert,Linking,Platform,Pressable,Text,View} from 'react-native';
import {AdminPageHeader,SelectionChips} from '@/components/admin-ui';
import {AdminProjectPicker} from '@/components/admin-project-picker';
import {AdminDetailPanel} from '@/components/admin-detail-panel';
import {DocumentCenterDetails,type DocumentAction} from '@/components/document-center-details';
import {Button,Card,Field,Notice,Screen,StateView,StatusPill} from '@/components/ui';
import {useSync} from '@/providers/sync-provider';
import {useAppTheme,useThemeStyles} from '@/providers/theme-provider';
import {listAdminApprovals,listAdminProjects} from '@/services/admin-service';
import {listAdminDocumentAlerts,listAdminDocumentMap,listProjectDocumentDecisions,releaseDocumentForClient,type AdminDocumentAlertItem,type AdminDocumentMapItem,type DocumentDecision} from '@/services/document-governance-service';
import {generateContractDocument,listProjectContractDocuments,sendContractDocument,type ContractDocumentSummary} from '@/services/document-workflow-service';
import {createDocumentSignedUrl} from '@/services/portal-service';
import {openWebsiteAdminSection} from '@/lib/admin-navigation';
import {documentFilters,documentState,documentStateLabels,documentStateTone,isDocumentDecision,matchesDocumentFilter,normalizeDocumentSearch} from '@/lib/document-center-model';
import {formatDate} from '@/lib/format';
import {spacing,ThemeColors,typography,radius} from '@/theme/tokens';
import type {AdminProjectSummary,ApprovalSummary} from '@/types/domain';
import {AdminApprovalsScreen, type ApprovalDraft} from './approvals';

function confirmAction(message:string):Promise<boolean>{
 if(Platform.OS==='web')return Promise.resolve(window.confirm(message));
 return new Promise(resolve=>Alert.alert('Confirmar disponibilização',message,[{text:'Cancelar',style:'cancel',onPress:()=>resolve(false)},{text:'Confirmar',onPress:()=>resolve(true)}],{cancelable:true,onDismiss:()=>resolve(false)}));
}
const single=(value:unknown)=>typeof value==='string'?value:'';
export default function DocumentCenter(){
 const router=useRouter(),params=useLocalSearchParams<{view?:string;projectId?:string;filter?:string;q?:string}>();
 const {colors}=useAppTheme(),styles=useThemeStyles(styleDefinitions);
 const {lastSyncedAt,status:syncStatus,syncNow,revision}=useSync();
 const projectId=single(params.projectId)||null;
 const view=params.view==='approvals'?'approvals':'emissions';
 const filter=documentFilters.some(item=>item.value===params.filter)?single(params.filter):'all';
 const query=single(params.q).slice(0,200);
 const [projects,setProjects]=useState<AdminProjectSummary[]>([]),[documents,setDocuments]=useState<ContractDocumentSummary[]>([]);
 const [map,setMap]=useState<AdminDocumentMapItem[]>([]),[decisions,setDecisions]=useState<DocumentDecision[]>([]);
 const [approvals,setApprovals]=useState<ApprovalSummary[]>([]),[alerts,setAlerts]=useState<AdminDocumentAlertItem[]>([]);
 const [loading,setLoading]=useState(false),[loadingProjects,setLoadingProjects]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState<string|null>(null),[success,setSuccess]=useState<string|null>(null);
 const [selectedId,setSelectedId]=useState<string|null>(null),[help,setHelp]=useState(false),[compose,setCompose]=useState(false);
 const [drafts,setDrafts]=useState<Record<string,ApprovalDraft>>({});
 const [approvalSaving,setApprovalSaving]=useState(false);
 const request=useRef(0),actionLock=useRef(false),projectRef=useRef(projectId);
 useEffect(()=>{projectRef.current=projectId;},[projectId]);
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(timer);},[]);
 const selectedProject=useMemo(()=>projects.find(item=>item.id===projectId)??null,[projects,projectId]);
 useEffect(()=>{let active=true;void listAdminProjects().then(result=>{if(!active)return;setProjects(result.data);if(result.error)setError(result.error);setLoadingProjects(false);}).catch(()=>{if(active){setError('Não foi possível carregar os projetos.');setLoadingProjects(false);}});return()=>{active=false;};},[revision]);
 const load=useCallback(async()=>{
  const ticket=++request.current;
  if(!projectId){setDocuments([]);setMap([]);setDecisions([]);setApprovals([]);setAlerts([]);setLoading(false);return;}
  setLoading(true);setError(null);
  try{
   const [docs,governance,responses,items,pending]=await Promise.all([listProjectContractDocuments(projectId),listAdminDocumentMap(projectId),listProjectDocumentDecisions(projectId),listAdminApprovals(projectId),listAdminDocumentAlerts(projectId)]);
   if(ticket!==request.current)return;
   setDocuments(docs.data);setMap(governance.data);setDecisions(responses.data);setApprovals(items.data.filter(item=>item.projectId===projectId));setAlerts(pending.data);
   setError([docs.error,governance.error,responses.error,items.error,pending.error].filter(Boolean).join(' ')||null);
  }catch{if(ticket===request.current)setError('Não foi possível atualizar esta área. Tente novamente.');}
  finally{if(ticket===request.current)setLoading(false);}
 },[projectId]);
 useEffect(()=>{const requests=request;const timer=setTimeout(()=>void load(),0);return()=>{clearTimeout(timer);requests.current++;};},[load,revision]);
 const chooseProject=(id:string)=>{if(actionLock.current)return;request.current++;setSelectedId(null);setCompose(false);setSuccess(null);setDocuments([]);setMap([]);setDecisions([]);setApprovals([]);setAlerts([]);router.setParams({projectId:id});};
 const storeDraft=useCallback((draft:ApprovalDraft)=>{if(projectId)setDrafts(current=>({...current,[projectId]:draft}));},[projectId,setDrafts]);
 const selected=documents.find(item=>item.id===selectedId)??null;
 const create=()=>{if(!selectedProject?.contractId)return;if(!openWebsiteAdminSection('commercial-documents',{projectId:selectedProject.id}))router.push('/admin/commercial-documents');};
 const execute=async(item:ContractDocumentSummary,action:DocumentAction)=>{
  if(actionLock.current||item.projectId!==projectId)return;
  if(action==='manage'){create();return;}
  actionLock.current=true;setBusy(true);setError(null);setSuccess(null);const origin=projectId;
  try{
   if(['send','release-required','release-view'].includes(action)){
    const purpose=action==='release-required'?'liberar esta versão e solicitar o aceite do cliente':action==='release-view'?'liberar esta versão apenas para consulta':'disponibilizar esta versão ao cliente';
    if(!await confirmAction(`Confirma ${purpose}?\n\n${selectedProject?.clientName} • ${selectedProject?.name}\n${item.title} • versão ${item.version??'não informada'}`))return;
   }
   if(origin!==projectRef.current)return;
   let failure:string|null=null;
   if(action==='open'){
    const result=await createDocumentSignedUrl({id:item.id,allowDownload:true});failure=result.error;
    if(result.url)await Linking.openURL(result.url);
   }else if(action==='download'||action==='archive')failure=await generateContractDocument(item.id,item.kind,action==='archive');
   else if(action==='send')failure=await sendContractDocument(item.id,item.kind);
   else failure=await releaseDocumentForClient(item.id,action==='release-required');
   if(origin!==projectRef.current)return;
   if(failure)setError(failure);else{setSuccess(action==='open'?'Arquivo preservado aberto.':action==='download'?'Word gerado para download.':action==='archive'?'Word gerado e arquivado.':action==='release-required'?'Versão liberada com aceite obrigatório.':'Documento disponibilizado ao cliente.');await load();}
  }catch{if(origin===projectRef.current)setError('Não foi possível concluir a ação. Tente novamente.');}
  finally{actionLock.current=false;setBusy(false);}
 };
 const hasOverdue=(id:string)=>map.some(item=>item.documentId===id&&item.lifecycleStatus==='expirado')||alerts.some(item=>item.sourceDocumentId===id&&item.isDue)||approvals.some(item=>item.relatedDocumentId===id&&['aguardando','pendente'].includes(item.status)&&!!item.dueAt&&new Date(item.dueAt).getTime()<now);
 const searched=documents.filter(item=>normalizeDocumentSearch(`${item.title} ${item.version??''} ${selectedProject?.name??''} ${selectedProject?.clientName??''}`).includes(normalizeDocumentSearch(query)));
 const business=approvals.filter(item=>!isDocumentDecision(item));
 const searchedBusiness=business.filter(item=>normalizeDocumentSearch(`${item.approvalObject??item.title} ${item.type} ${item.description??''}`).includes(normalizeDocumentSearch(query)));
 const approvalOverdue=(item:ApprovalSummary)=>['aguardando','pendente'].includes(item.status)&&!!item.dueAt&&new Date(item.dueAt).getTime()<now;
 const count=(value:string)=>view==='approvals'?searchedBusiness.filter(item=>matchesDocumentFilter(item.status,approvalOverdue(item),value)).length:searched.filter(item=>matchesDocumentFilter(documentState(item,map,decisions),hasOverdue(item.id),value)).length;
 const visible=searched.filter(item=>matchesDocumentFilter(documentState(item,map,decisions),hasOverdue(item.id),filter));
 const visibleBusiness=searchedBusiness.filter(item=>matchesDocumentFilter(item.status,approvalOverdue(item),filter));
 const unlinked=approvals.filter(item=>isDocumentDecision(item)&&!documents.some(doc=>doc.id===item.relatedDocumentId));
 const time=lastSyncedAt?new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'}).format(new Date(lastSyncedAt)):null;
 return <Screen>
  <AdminPageHeader title="Emissões e aprovações" description="Documentos, aceites e decisões por projeto." />
  <View style={styles.toolbar}>
   <Pressable accessibilityRole="button" accessibilityLabel="Atualizar dados" disabled={syncStatus==='syncing'} onPress={()=>void syncNow()} style={styles.sync}>
    <Text style={styles.meta}>{syncStatus==='syncing'?'Atualizando…':time?`Atualizado às ${time}`:'Atualizar dados'}</Text>
   </Pressable><Button debounceMs={0} title={help?'Fechar ajuda':'Como funciona'} onPress={()=>setHelp(current=>!current)} variant="ghost" />
  </View>
  {help?<Notice tone="info">Selecione o projeto e consulte seus documentos. Abra os detalhes para ver versões, liberações e aceites. Decisões de layout, material ou etapa ficam em Decisões do projeto. Criar documento abre o fluxo existente de Contratos Gerais.</Notice>:null}
  {error?<Notice tone="danger">{error}</Notice>:null}{success?<Notice tone="success">{success}</Notice>:null}
  {loadingProjects?<ActivityIndicator color={colors.gold600} />:null}
  <Card><AdminProjectPicker projects={projects} value={projectId} onChange={chooseProject} disabled={busy||approvalSaving} /></Card>
  <View style={styles.toolbar}>
   <SelectionChips label="Consultar" value={view} onChange={next=>router.setParams({view:next})} items={[{value:'emissions',label:'Documentos'},{value:'approvals',label:'Decisões do projeto'}]} />
   <View style={styles.actions}><Button title="Criar documento" icon="add-outline" disabled={!selectedProject?.contractId||busy} onPress={create} />
   {view==='approvals'?<Button debounceMs={0} title="Nova aprovação" disabled={!selectedProject||busy} onPress={()=>setCompose(true)} variant="secondary" />:null}</View>
  </View>
  {selectedProject?<>
   <Field label="Pesquisar nesta lista" placeholder="Pesquisar documento ou decisão" value={query} onChangeText={q=>router.setParams({q:q.slice(0,200)})} />
   <SelectionChips label="Situação" value={filter} onChange={next=>router.setParams({filter:next})} items={documentFilters.filter(item=>view!=='approvals'||item.value!=='superseded').map(item=>({value:item.value,label:`${item.label} (${error||loading?'—':count(item.value)})`}))} />
   {loading?<ActivityIndicator color={colors.gold600} />:null}
   {view==='emissions'?<Card>
    <View style={styles.toolbar}><Text accessibilityRole="header" style={styles.section}>Documentos do projeto</Text><Text style={styles.meta}>{error?'Consulta incompleta':loading?'Carregando…':`${visible.length} resultado(s)`}</Text></View>
    {visible.length===0&&!loading&&!error?<StateView icon="documents-outline" title="Nenhum documento nesta seleção" description="Ajuste a pesquisa ou os filtros. Novas emissões são criadas em Contratos Gerais." />:null}
    {visible.map(item=>{const state=documentState(item,map,decisions);return <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Ver detalhes de ${item.title}`} onPress={()=>{setSelectedId(item.id);setError(null);setSuccess(null);}} style={styles.row}>
     <View style={styles.grow}><Text style={styles.title}>{item.title}</Text><Text style={styles.meta}>v{item.version??'—'} • {selectedProject.clientName} • {selectedProject.name}</Text><Text style={styles.meta}>Último registro: {formatDate(decisions.find(decision=>decision.documentId===item.id)?.acceptedAt??item.releasedAt??item.generatedAt??item.createdAt)}</Text></View>
     <View style={styles.badges}><StatusPill label={documentStateLabels[state]??state} tone={documentStateTone(state)} />{hasOverdue(item.id)?<StatusPill label="Prazo vencido" tone="danger" />:null}<Text style={styles.link}>Ver detalhes →</Text></View>
    </Pressable>;})}
   </Card>:<Card><Text accessibilityRole="header" style={styles.section}>Decisões do projeto</Text>
    {visibleBusiness.length===0&&!loading&&!error?<StateView icon="checkmark-circle-outline" title="Nenhuma decisão nesta seleção" description="Crie uma aprovação apenas quando o cliente precisar decidir sobre uma entrega, etapa ou material." />:null}
    {visibleBusiness.map(item=><View key={item.id} style={styles.row}><View style={styles.grow}><Text style={styles.title}>{item.approvalObject||item.title}</Text><Text style={styles.meta}>{item.type} • {selectedProject.name}{item.dueAt?` • prazo ${formatDate(item.dueAt)}`:''}</Text>{item.description?<Text style={styles.text}>{item.description}</Text>:null}{item.comment?<Text style={styles.text}>Resposta: {item.comment}</Text>:null}{item.respondedAt?<Text style={styles.meta}>Respondido em {formatDate(item.respondedAt)}</Text>:null}{item.relatedDocumentId&&documents.some(doc=>doc.id===item.relatedDocumentId)?<Button title="Ver documento relacionado" onPress={()=>setSelectedId(item.relatedDocumentId!)} variant="ghost" />:null}</View><View style={styles.badges}><StatusPill label={documentStateLabels[item.status]??item.status} tone={documentStateTone(item.status)} />{approvalOverdue(item)?<StatusPill label="Prazo vencido" tone="danger" />:null}</View></View>)}
   </Card>}
   {unlinked.length>0?<Card><Text style={styles.section}>Outros aceites documentais</Text><Text style={styles.meta}>Registros sem emissão vinculada nesta lista. Consulte os arquivos do projeto para localizar documentos enviados por upload.</Text>{unlinked.map(item=><View key={item.id} style={styles.row}><Text style={styles.text}>{item.approvalObject||item.title}</Text><StatusPill label={documentStateLabels[item.status]??item.status} tone={documentStateTone(item.status)} />{item.comment?<Text style={styles.text}>{item.comment}</Text>:null}</View>)}</Card>:null}
   {alerts.filter(item=>!item.sourceDocumentId).length>0?<Card><Text style={styles.section}>Pendências do projeto</Text>{alerts.filter(item=>!item.sourceDocumentId).map(item=><Notice key={item.id} tone={item.isDue?'warning':'info'}>{item.title}: {item.message}</Notice>)}</Card>:null}
   <Button debounceMs={0} title="Atualizar lista" loading={loading} onPress={()=>void load()} variant="ghost" />
  </>:<StateView icon="search-outline" title="Escolha um projeto para começar" description="Pesquise pelo cliente, nome do projeto ou número do contrato." />}
  <DocumentCenterDetails document={selected} documents={documents} map={map} decisions={decisions} approvals={approvals} alerts={alerts} busy={busy||!!error||loading} error={error} success={success} onClose={()=>{if(!busy)setSelectedId(null);}} onSelect={setSelectedId} onAction={(item,action)=>void execute(item,action)} />
  <AdminDetailPanel visible={compose&&!!selectedProject} title="Nova aprovação" onClose={()=>{if(!approvalSaving)setCompose(false);}}>
   {selectedProject?<AdminApprovalsScreen embedded contextProject={selectedProject} initialDraft={drafts[selectedProject.id]} onDraftChange={storeDraft} onSavingChange={setApprovalSaving} confirmBeforeSubmit={()=>confirmAction(`Enviar esta aprovação ao cliente ${selectedProject.clientName}, do projeto ${selectedProject.name}?`)} onCreated={()=>{setDrafts(current=>{const next={...current};delete next[selectedProject.id];return next;});setCompose(false);void load();}} />:null}
  </AdminDetailPanel>
 </Screen>;
}
const styleDefinitions=(colors:ThemeColors)=>({
 toolbar:{flexDirection:'row' as const,flexWrap:'wrap' as const,alignItems:'center' as const,justifyContent:'space-between' as const,gap:spacing.sm},
 actions:{flexDirection:'row' as const,flexWrap:'wrap' as const,gap:spacing.sm},grow:{flexGrow:1,flexBasis:300,minWidth:0,gap:4},
 row:{flexDirection:'row' as const,flexWrap:'wrap' as const,gap:spacing.sm,paddingVertical:spacing.md,borderTopWidth:1,borderTopColor:colors.line},
 badges:{alignItems:'flex-start' as const,gap:spacing.xs},title:{color:colors.ink,fontFamily:typography.family,fontSize:14,fontWeight:'700' as const},
 section:{color:colors.ink,fontFamily:typography.family,fontSize:16,fontWeight:'700' as const},meta:{color:colors.muted,fontFamily:typography.family,fontSize:12,lineHeight:18},
 text:{color:colors.slate,fontFamily:typography.family,fontSize:13,lineHeight:20},link:{color:colors.gold600,fontFamily:typography.family,fontSize:12},
 sync:{paddingVertical:spacing.xs,paddingHorizontal:spacing.sm,borderRadius:radius.sm,minHeight:44,justifyContent:'center' as const},
});
