import { useNotificationProject } from '@/hooks/use-notification-project';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { AdminPageHeader } from '@/components/admin-ui';
import { Button, Card, Field, Notice, Screen, StateView, StatusPill } from '@/components/ui';
import { openWebsiteAdminSection } from '@/lib/admin-navigation';
import { suggestCommercialServices } from '@/lib/commercial-service-match';
import { listAdminProjects } from '@/services/admin-service';
import {
  getCommercialServiceLevelScope,
  listCommercialServiceCatalog,
  type CommercialCatalogService,
  type CommercialServiceLevelCode,
} from '@/services/commercial-service';
import {
  CONTRACT_DOCUMENT_OPTIONS,
  checkAnnexIPrerequisite,
  listProjectApprovals,
  prepareContractDocument,
  previewContractDocument,
  type ContractDocumentKind,
  type ContractDocumentPreview,
  type ProjectApprovalItem,
} from '@/services/document-workflow-service';
import { useThemeStyles } from '@/providers/theme-provider';
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';
import type { AdminProjectSummary } from '@/types/domain';

type PrepareKind = Exclude<ContractDocumentKind,'notificacao_formal'>;
type ChoiceMap = Record<string,string|string[]>;
type TextMap = Record<string,string>;
type Group = {key:string;label:string;mode:'single'|'multi';items:[string,string][]};
const SERVICE_LEVELS:{code:CommercialServiceLevelCode;label:string}[]=[
  {code:'bronze',label:'Bronze'},
  {code:'prata',label:'Prata'},
  {code:'ouro',label:'Ouro'},
];

const documentOptions:{kind:PrepareKind;title:string;description:string}[]=[
  ...CONTRACT_DOCUMENT_OPTIONS,
  {kind:'termo_aceite',title:'Termo de Aceite',description:'Manifestação ligada a uma etapa/aprovação específica.'},
];

const optionGroups:Partial<Record<PrepareKind,Group[]>>={
  autorizacao_imagem:[
    {key:'materials',label:'Materiais',mode:'multi',items:[['facade','Fachada'],['interiors','Interiores'],['renders','Renders 3D'],['plans','Plantas/pranchas'],['videos','Vídeos/tour 360°'],['work_records','Registros de obra']]},
    {key:'channels',label:'Canais',mode:'multi',items:[['portfolio','Portfólio/site'],['social','Redes sociais'],['commercial','Apresentações comerciais'],['technical','Publicações técnicas'],['print','Material impresso']]},
    {key:'privacy',label:'Restrições',mode:'multi',items:[['hide_address','Ocultar endereço exato'],['hide_client','Ocultar nome do cliente'],['no_people','Não usar pessoas identificáveis']]},
  ],
  servico_adicional:[
    {key:'reasons',label:'Origem',mode:'multi',items:[['extra_revisions','Revisão extra'],['scope_change','Alteração de escopo'],['level_upgrade','Mudança de nível'],['survey','Vistoria não incluída'],['editable_file','Arquivo/formato não previsto'],['other','Outro']]},
    {key:'pricing',label:'Critério comercial',mode:'single',items:[['hour','Hora técnica'],['percentage','Percentual'],['fixed','Valor fechado']]},
    {key:'payment_method',label:'Forma de pagamento',mode:'single',items:[['pix','Pix'],['bank_transfer','Transferência bancária'],['card_cash','Cartão à vista'],['card_installments','Cartão parcelado'],['cash','Dinheiro'],['other','Outro']]},
  ],
  quitacao_encerramento:[
    {key:'closing_reason',label:'Motivo do encerramento',mode:'single',items:[['completed','Conclusão integral'],['client_termination','Rescisão pelo contratante'],['contractor_termination','Rescisão pelo contratado'],['mutual','Mútuo acordo'],['other','Outro']]},
    {key:'financial',label:'Situação financeira',mode:'single',items:[['paid','Quitação integral'],['balance','Existe saldo pendente']]},
  ],
  levantamento_tecnico:[
    {key:'observed',label:'Elementos a registrar',mode:'multi',items:[
      ['electrical','Elétrica'],['hydraulic','Hidráulica'],['sanitary','Sanitário'],['structure','Estrutura'],
      ['masonry','Alvenaria'],['frames','Esquadrias'],['finishes','Revestimentos'],['roof','Cobertura'],
      ['waterproofing','Impermeabilização'],['drainage','Drenagem'],['facade','Fachadas'],
      ['stairs','Escadas / guarda-corpos'],['accessibility','Acessibilidade'],['fire_safety','Segurança contra incêndio'],
      ['dimensions','Dimensões / níveis / pé-direito'],['equipment','Equipamentos / instalações'],['access','Acessos / circulação'],['other','Outros']
    ]},
    {key:'conditions',label:'Condições/divergências',mode:'multi',items:[
      ['cracks','Fissuras / trincas'],['moisture','Umidade / infiltração'],['levels','Deformações / desníveis'],
      ['corrosion','Corrosão'],['detachment','Desplacamentos'],['leaks','Vazamentos'],['wear','Desgaste / deterioração'],
      ['document_mismatch','Divergência documental'],['restricted_access','Acesso restrito'],
      ['safety_risk','Condição aparente que exige avaliação de segurança'],['no_anomaly','Ausência de anomalia aparente']
    ]},
  ],
};

const textFields:Partial<Record<PrepareKind,{key:string;label:string;placeholder?:string;multiline?:boolean}[]>>={
  autorizacao_imagem:[
    {key:'wait_months',label:'Aguardar quantos meses após a conclusão?',placeholder:'Ex.: 3'},
    {key:'other_restrictions',label:'Outras restrições',multiline:true},
  ],
  servico_adicional:[
    {key:'additional_service_description',label:'Descrição do serviço adicional *',multiline:true},
    {key:'additional_value',label:'Valor adicional aprovado *',placeholder:'Ex.: R$ 1.500,00'},
    {key:'payment_terms',label:'Condição de pagamento',placeholder:'Ex.: 50% na aprovação e 50% na entrega',multiline:true},
    {key:'new_contract_total',label:'Novo total contratual, quando aplicável',placeholder:'Ex.: R$ 8.500,00'},
    {key:'schedule_impact',label:'Impacto no cronograma',multiline:true},
    {key:'other_reason',label:'Outro motivo',multiline:true},
  ],
  quitacao_encerramento:[
    {key:'closing_other',label:'Outro motivo de encerramento'},
    {key:'delivered_files',label:'Arquivos/documentos finais entregues',multiline:true},
    {key:'open_items',label:'Pendências técnicas ou administrativas',multiline:true},
    {key:'public_processes',label:'Processos em órgãos públicos em andamento',multiline:true},
    {key:'balance_value',label:'Saldo pendente',placeholder:'Ex.: R$ 800,00'},
    {key:'balance_due',label:'Vencimento do saldo',placeholder:'DD/MM/AAAA'},
  ],
  levantamento_tecnico:[
    {key:'inspection_datetime',label:'Data e horário da vistoria',placeholder:'DD/MM/AAAA HH:mm'},
    {key:'site_contact',label:'Responsável pelo acompanhamento no local'},
    {key:'technical_responsible',label:'Responsável técnico'},
    {key:'measurements',label:'Medidas / níveis / pé-direito',multiline:true},
    {key:'conditions_description',label:'Descrição detalhada das condições/divergências',multiline:true},
    {key:'records',label:'Registros / referências / identificação de fotos',multiline:true},
    {key:'notes',label:'Observações',multiline:true},
  ],
};

function money(value:number|null){return value===null?'Não informado':value.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}

export default function AdminDocumentPreparationScreen(){
  const router=useRouter();
  useEffect(()=>{
    if(Platform.OS==='web') openWebsiteAdminSection('commercial-documents');
  },[]);
  const styles=useThemeStyles(styleDefinitions);
  const [projects,setProjects]=useState<AdminProjectSummary[]>([]);
  const [projectId,setProjectId]=useState<string|null>(null);
  const [kind,setKind]=useState<PrepareKind>('anexo_i');
  const [choices,setChoices]=useState<ChoiceMap>({});
  const [texts,setTexts]=useState<TextMap>({});
  const [approvals,setApprovals]=useState<ProjectApprovalItem[]>([]);
  const [approvalId,setApprovalId]=useState<string|null>(null);
  const [versionBump,setVersionBump]=useState<'minor'|'major'>('minor');
  const [versionReason,setVersionReason]=useState('');
  const [preview,setPreview]=useState<ContractDocumentPreview|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [success,setSuccess]=useState<string|null>(null);
  const [catalogServices,setCatalogServices]=useState<CommercialCatalogService[]>([]);
  const [serviceQuery,setServiceQuery]=useState('');
  const [additionalServiceCode,setAdditionalServiceCode]=useState<string|null>(null);
  const [additionalLevel,setAdditionalLevel]=useState<CommercialServiceLevelCode|null>(null);

  useNotificationProject(projects, setProjectId);

  const selectedProject=useMemo(()=>projects.find(item=>item.id===projectId)??null,[projects,projectId]);
  const groups=optionGroups[kind]??[];
  const fields=textFields[kind]??[];
  const additionalService=useMemo(()=>catalogServices.find(item=>item.code===additionalServiceCode)??null,[catalogServices,additionalServiceCode]);
  const additionalSuggestions=useMemo(()=>suggestCommercialServices(
    serviceQuery,
    catalogServices.map(({code,name,aliases,synonyms,keywords})=>({code,name,aliases,synonyms,keywords})),
    5,
  ),[catalogServices,serviceQuery]);

  const load=useCallback(async()=>{
    const [projectsResult,catalogResult]=await Promise.all([listAdminProjects(),listCommercialServiceCatalog()]);
    setProjects(projectsResult.data);
    setCatalogServices(catalogResult.data);
    setProjectId(current=>current??projectsResult.data[0]?.id??null);
    setError(projectsResult.error??catalogResult.error);
  },[]);
  useEffect(()=>{const task=setTimeout(()=>void load(),0);return()=>clearTimeout(task);},[load]);
  useEffect(()=>{setChoices({});setTexts({});setPreview(null);setVersionReason('');setVersionBump('minor');setApprovalId(null);setServiceQuery('');setAdditionalServiceCode(null);setAdditionalLevel(null);},[kind,projectId]);
  useEffect(()=>{
    if(kind!=='termo_aceite'||!projectId){setApprovals([]);return;}
    const task=setTimeout(()=>void (async()=>{const result=await listProjectApprovals(projectId);setApprovals(result.data);setApprovalId(current=>current??result.data[0]?.id??null);if(result.error)setError(result.error);})(),0);
    return()=>clearTimeout(task);
  },[kind,projectId]);

  const toggle=(group:Group,value:string)=>{
    setChoices(current=>{
      if(group.mode==='single')return {...current,[group.key]:value};
      const values=Array.isArray(current[group.key])?current[group.key] as string[]:[];
      return {...current,[group.key]:values.includes(value)?values.filter(item=>item!==value):[...values,value]};
    });
    setPreview(null);
  };
  const setText=(key:string,value:string)=>{setTexts(current=>({...current,[key]:value}));setPreview(null);};

  const chooseAdditionalService=(code:string)=>{
    const service=catalogServices.find(item=>item.code===code);
    if(!service)return;
    setAdditionalServiceCode(service.code);
    setAdditionalLevel(null);
    setServiceQuery('');
    setTexts(current=>({...current,additional_service_description:service.description||service.name}));
    setPreview(null);
  };
  const chooseAdditionalLevel=async(level:CommercialServiceLevelCode)=>{
    if(!additionalService)return;
    setAdditionalLevel(level);
    setPreview(null);
    const result=await getCommercialServiceLevelScope(additionalService.code,level);
    if(result.error||!result.data){setError(result.error??'Texto aprovado indisponível.');return;}
    setTexts(current=>({...current,additional_service_description:result.data?.contractScope||current.additional_service_description||additionalService.description}));
    setError(null);
  };

  const extraData=()=>{
    const structuredAdditional=kind==='servico_adicional'&&additionalService?{
      additional_service_code:additionalService.code,
      additional_service_name:additionalService.name,
      additional_service_level:additionalLevel??'',
      additional_level:additionalLevel??'',
      additional_service_level_label:additionalLevel?SERVICE_LEVELS.find(item=>item.code===additionalLevel)?.label??additionalLevel:'',
    }:{};
    const options={...choices,...structuredAdditional,...Object.fromEntries(Object.entries(texts).filter(([,v])=>v.trim()).map(([k,v])=>[k,v.trim()]))};
    return {document_options:options,version_bump:versionBump,version_reason:versionReason.trim(),...options};
  };

  const validateOptions=()=>{
    if(kind==='termo_aceite'){
      if(!approvalId)return'Selecione a etapa/aprovação correspondente.';
    }
    if(kind==='autorizacao_imagem'){
      if(!Array.isArray(choices.materials)||choices.materials.length===0)return'Selecione ao menos um material autorizado.';
      if(!Array.isArray(choices.channels)||choices.channels.length===0)return'Selecione ao menos um canal autorizado.';
      if(texts.wait_months?.trim()&&(!Number.isInteger(Number(texts.wait_months))||Number(texts.wait_months)<=0))return'Informe um prazo em meses maior que zero.';
    }
    if(kind==='servico_adicional'){
      if(!additionalService)return'Selecione a atividade adicional no catálogo central.';
      if(additionalService.levelApplicable&&!additionalLevel)return'Selecione Bronze, Prata ou Ouro para a atividade adicional.';
      if(!Array.isArray(choices.reasons)||choices.reasons.length===0)return'Selecione a origem do serviço adicional.';
      if(choices.reasons.includes('other')&&!texts.other_reason?.trim())return'Descreva o motivo em “Outro”.';
      if(!choices.pricing)return'Selecione o critério comercial.';
      if(!choices.payment_method)return'Selecione a forma de pagamento.';
      if(!texts.additional_service_description?.trim())return'Descreva o serviço adicional.';
      if(!texts.additional_value?.trim())return'Informe o valor adicional aprovado.';
    }
    if(kind==='quitacao_encerramento'){
      if(!choices.closing_reason||!choices.financial)return'Selecione motivo do encerramento e situação financeira.';
      if(choices.closing_reason==='other'&&!texts.closing_other?.trim())return'Descreva o outro motivo do encerramento.';
      if(choices.financial==='balance'&&(!texts.balance_value?.trim()||!texts.balance_due?.trim()))return'Informe o valor e o vencimento do saldo pendente.';
    }
    return null;
  };

  const review=async()=>{
    if(!selectedProject){setError('Selecione um projeto para preparar o documento.');return;}
    const validation=validateOptions();if(validation){setError(validation);return;}
    setLoading(true);setError(null);setSuccess(null);
    if(kind==='anexo_i'){
      const prerequisite=await checkAnnexIPrerequisite(selectedProject.id);
      if(prerequisite.error||!prerequisite.data.ready){
        setLoading(false);
        setError(prerequisite.error??prerequisite.data.reason??'O Anexo I ainda não pode ser preparado para este contrato.');
        return;
      }
    }
    const result=await previewContractDocument({projectId:selectedProject.id,kind,approvalId:kind==='termo_aceite'?approvalId:null,extraData:extraData()});
    setLoading(false);
    if(result.error||!result.data){setError(result.error??'Prévia indisponível.');return;}
    setPreview(result.data);
  };

  const prepare=async()=>{
    if(!selectedProject||!preview)return;
    if(preview.revisionOf&&!versionReason.trim()){setError('Informe o motivo da nova versão antes de preparar.');return;}
    setLoading(true);setError(null);setSuccess(null);
    const result=await prepareContractDocument({projectId:selectedProject.id,kind,approvalId:kind==='termo_aceite'?approvalId:null,extraData:extraData()});
    setLoading(false);
    if(result.error){setError(result.error);return;}
    setSuccess(`Documento preparado como versão v${preview.nextVersion}. Abra “Documentos gerados e aceites” para baixar, arquivar ou enviar ao cliente.`);
    setPreview(null);
  };

  return <Screen>
    <AdminPageHeader title="Preparar documento do projeto" description="Fluxo auxiliar do app nativo. No portal web, a criação é centralizada em Contratos Gerais." />
    {error?<Notice tone="danger">{error}</Notice>:null}{success?<><Notice tone="success">{success}</Notice><Button onPress={()=>router.push('/admin/contract-documents')} title="Ver documentos gerados" variant="secondary" /></>:null}
    <Card><Text style={styles.sectionTitle}>Projeto</Text><View style={styles.chips}>{projects.map(project=><Pressable key={project.id} onPress={()=>setProjectId(project.id)} style={[styles.chip,project.id===projectId&&styles.selected]}><Text style={[styles.chipText,project.id===projectId&&styles.selectedText]}>{project.contractNumber} • {project.name}</Text></Pressable>)}</View></Card>
    <Card><Text style={styles.sectionTitle}>Tipo de documento</Text><View style={styles.chips}>{documentOptions.map(option=><Pressable key={option.kind} onPress={()=>setKind(option.kind)} style={[styles.chip,option.kind===kind&&styles.selected]}><Text style={[styles.chipText,option.kind===kind&&styles.selectedText]}>{option.title}</Text></Pressable>)}</View></Card>
    {kind==='anexo_i'?<Notice tone="info">O Anexo I registra o escopo que acompanha o contrato original. Para acrescentar um serviço depois da contratação, use “Serviço Adicional”. O Anexo I só pode ser preparado depois que o contrato Word oficial correspondente estiver emitido e registrado no sistema.</Notice>:null}
    {kind==='servico_adicional'?<Notice tone="info">Use “Serviço Adicional” para novo serviço, revisão extra, mudança de escopo ou outra contratação feita depois do contrato original. Isso preserva o contrato já emitido e cria o registro complementar correto.</Notice>:null}
    {kind==='servico_adicional'?<Notice tone="info">A administradora define escopo, nível, valor e pagamento; a manifestação final é do cliente. O documento será preparado sem aceite pré-marcado.</Notice>:null}
    {kind==='servico_adicional'?<Card><Text style={styles.sectionTitle}>Atividade adicional</Text><Text style={styles.meta}>Use o mesmo catálogo central do orçamento. O texto aprovado para a atividade e o nível será carregado como padrão e poderá ser ajustado somente para as particularidades deste adicional.</Text><Field label="Pesquisar atividade" value={serviceQuery} onChangeText={value=>{setServiceQuery(value);setPreview(null);}} placeholder="Digite nome ou código do serviço" />{additionalSuggestions.map(item=><View key={item.code} style={styles.suggestionRow}><View style={{flex:1}}><Text style={styles.strong}>({item.code}) {item.name}</Text><Text style={styles.meta}>{item.exact?'Correspondência exata':'Sugestão aproximada — confirme antes de selecionar'}</Text></View><Button title="Selecionar" variant="secondary" onPress={()=>chooseAdditionalService(item.code)} /></View>)}{additionalService?<><Notice tone="success">Atividade selecionada: ({additionalService.code}) {additionalService.name}</Notice>{additionalService.levelApplicable?<><Text style={styles.label}>Nível da atividade adicional</Text><View style={styles.chips}>{SERVICE_LEVELS.map(level=><Pressable key={level.code} accessibilityRole="radio" accessibilityState={{selected:additionalLevel===level.code}} onPress={()=>void chooseAdditionalLevel(level.code)} style={[styles.chip,additionalLevel===level.code&&styles.selected]}><Text style={[styles.chipText,additionalLevel===level.code&&styles.selectedText]}>{level.label}</Text></Pressable>)}</View></>:<Notice tone="info">Esta atividade não exige nível Bronze, Prata ou Ouro.</Notice>}</>:null}</Card>:null}
    {kind==='termo_aceite'?<Card><Text style={styles.sectionTitle}>Etapa / aprovação</Text><Notice tone="info">O admin apenas prepara o Termo. A decisão será registrada pelo cliente como aceitar, aceitar com ressalvas ou recusar; nenhuma opção é pré-marcada aqui.</Notice>{approvals.length===0?<StateView title="Nenhuma etapa disponível" description="Crie ou entregue uma aprovação de etapa antes de preparar o Termo de Aceite." icon="checkmark-done-outline"/>:<View style={styles.chips}>{approvals.map(item=><Pressable key={item.id} onPress={()=>{setApprovalId(item.id);setPreview(null);}} style={[styles.chip,item.id===approvalId&&styles.selected]}><Text style={[styles.chipText,item.id===approvalId&&styles.selectedText]}>{item.title} • {item.status}</Text></Pressable>)}</View>}</Card>:null}
    {(groups.length||fields.length)?<Card><Text style={styles.sectionTitle}>Opções que sairão no Word</Text>{groups.map(group=><View key={group.key} style={styles.group}><Text style={styles.label}>{group.label}{group.mode==='single'?' • escolha uma opção':''}</Text><View style={styles.chips}>{group.items.map(([optionValue,label])=>{const current=choices[group.key];const selected=group.mode==='single'?current===optionValue:Array.isArray(current)&&current.includes(optionValue);return <Pressable key={optionValue} onPress={()=>toggle(group,optionValue)} style={[styles.option,selected&&styles.optionSelected]}><Text style={styles.optionMark}>{selected?'☒':'☐'}</Text><Text style={styles.optionText}>{label}</Text></Pressable>;})}</View></View>)}{kind==='levantamento_tecnico'?<Button title="Usar agora" variant="secondary" onPress={()=>{const now=new Date();setText('inspection_datetime',new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(now));}} />:null}{fields.map(field=><Field key={field.key} label={field.label} multiline={field.multiline} onChangeText={value=>setText(field.key,value)} placeholder={field.placeholder} value={texts[field.key]??''}/>)}</Card>:null}
    <Card><Text style={styles.sectionTitle}>Revisão do documento</Text><Notice tone="info">Na primeira emissão, mantenha “Ajuste simples”. Se já existir um documento emitido, escolha o tipo de revisão e informe o motivo; a versão anterior será preservada.</Notice><View style={styles.chips}><Pressable onPress={()=>{setVersionBump('minor');setPreview(null);}} style={[styles.chip,versionBump==='minor'&&styles.selected]}><Text style={[styles.chipText,versionBump==='minor'&&styles.selectedText]}>Ajuste simples</Text></Pressable><Pressable onPress={()=>{setVersionBump('major');setPreview(null);}} style={[styles.chip,versionBump==='major'&&styles.selected]}><Text style={[styles.chipText,versionBump==='major'&&styles.selectedText]}>Mudança relevante / nova versão</Text></Pressable></View><Field label="Motivo da revisão" onChangeText={value=>{setVersionReason(value);setPreview(null);}} placeholder="Obrigatório somente quando já existe versão emitida" value={versionReason}/><Button loading={loading} onPress={()=>void review()} title="Conferir dados antes de preparar" variant="secondary" /></Card>
    {preview?<Card><View style={styles.previewHead}><Text style={styles.sectionTitle}>Prévia confirmável</Text><StatusPill label={`v${preview.nextVersion}`} tone="warning" /></View><Text style={styles.meta}>Contrato: {preview.contractNumber??'—'}</Text><Text style={styles.meta}>Cliente: {preview.clientName??'—'}</Text><Text style={styles.meta}>Projeto: {preview.projectName??'—'}</Text><Text style={styles.strong}>Endereço da obra: {preview.propertyAddress??'Não informado'}</Text><Text style={styles.meta}>Endereço cadastral: {preview.clientAddress??'Não informado'}</Text><Text style={styles.meta}>Valor contratual: {money(preview.contractValue)}</Text><Text style={styles.meta}>Escopo: {preview.scopeItems.length?preview.scopeItems.map(item=>`(${item.code}) ${item.name}`).join(' • '):'Nenhum item localizado'}</Text>{preview.revisionOf&&!versionReason.trim()?<Notice tone="warning">Já existe emissão anterior. Informe o motivo da revisão e gere a prévia novamente.</Notice>:null}<Button disabled={Boolean(preview.revisionOf&&!versionReason.trim())} loading={loading} onPress={()=>void prepare()} title="Confirmar e preparar documento" /></Card>:null}
  </Screen>;
}

const styleDefinitions=(colors:ThemeColors)=>({
  sectionTitle:{color:colors.ink,fontSize:typography.size.bodyLarge,fontWeight:'700',fontFamily:typography.family},
  chips:{flexDirection:'row',flexWrap:'wrap',gap:spacing.xs},
  chip:{borderWidth:1,borderColor:colors.line,borderRadius:radius.pill,paddingHorizontal:spacing.sm,paddingVertical:8,backgroundColor:colors.surface},
  selected:{borderColor:colors.gold500,backgroundColor:colors.warningSoft},
  chipText:{color:colors.slate,fontSize:12,fontFamily:typography.family},selectedText:{color:colors.gold600,fontWeight:'700'},
  group:{gap:spacing.xs,marginTop:spacing.sm},label:{color:colors.ink,fontSize:13,fontWeight:'700',fontFamily:typography.family},
  option:{minWidth:145,flexGrow:1,flexBasis:0,flexDirection:'row',alignItems:'center',gap:spacing.xs,borderWidth:1,borderColor:colors.line,borderRadius:radius.md,padding:spacing.sm},
  optionSelected:{borderColor:colors.gold500,backgroundColor:colors.warningSoft},optionMark:{color:colors.gold600,fontSize:16},optionText:{flex:1,color:colors.slate,fontSize:12,fontFamily:typography.family},
  previewHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:spacing.sm},meta:{color:colors.slate,fontSize:12,lineHeight:18,fontFamily:typography.family},strong:{color:colors.ink,fontSize:13,lineHeight:19,fontWeight:'700',fontFamily:typography.family},suggestionRow:{flexDirection:'row',alignItems:'center',gap:spacing.sm,borderWidth:1,borderColor:colors.line,borderRadius:radius.md,padding:spacing.sm},
});
