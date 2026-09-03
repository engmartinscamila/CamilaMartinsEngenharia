import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AdminPageHeader } from '@/components/admin-ui';
import { Button, Card, Field, Notice, Screen, StatusPill } from '@/components/ui';
import { listAdminProjects } from '@/services/admin-service';
import {
  CONTRACT_DOCUMENT_OPTIONS,
  prepareContractDocument,
  previewContractDocument,
  type ContractDocumentKind,
  type ContractDocumentPreview,
} from '@/services/document-workflow-service';
import { useThemeStyles } from '@/providers/theme-provider';
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';
import type { AdminProjectSummary } from '@/types/domain';

type PrepareKind = Exclude<ContractDocumentKind,'notificacao_formal'|'termo_aceite'>;
type ChoiceMap = Record<string,string|string[]>;

const optionGroups: Partial<Record<PrepareKind,{key:string;label:string;mode:'single'|'multi';items:[string,string][]}[]>>={
  autorizacao_imagem:[
    {key:'materials',label:'Materiais',mode:'multi',items:[['facade','Fachada'],['interiors','Interiores'],['renders','Renders 3D'],['plans','Plantas/pranchas'],['videos','Vídeos/tour 360°'],['work_records','Registros de obra']]},
    {key:'channels',label:'Canais',mode:'multi',items:[['portfolio','Portfólio/site'],['social','Redes sociais'],['commercial','Apresentações comerciais'],['technical','Publicações técnicas'],['print','Material impresso']]},
    {key:'privacy',label:'Restrições',mode:'multi',items:[['hide_address','Ocultar endereço exato'],['hide_client','Ocultar nome do cliente'],['no_people','Não usar pessoas identificáveis']]},
  ],
  servico_adicional:[
    {key:'reasons',label:'Origem',mode:'multi',items:[['extra_revisions','Revisão extra'],['scope_change','Alteração de escopo'],['level_upgrade','Mudança de nível'],['survey','Vistoria não incluída'],['editable_file','Arquivo/formato não previsto'],['other','Outro']]},
    {key:'pricing',label:'Critério comercial',mode:'single',items:[['hour','Hora técnica'],['percentage','Percentual'],['fixed','Valor fechado']]},
    {key:'approval',label:'Aprovação',mode:'multi',items:[['approved','Aprovo o início do serviço adicional']]},
  ],
  quitacao_encerramento:[
    {key:'closing_reason',label:'Motivo do encerramento',mode:'single',items:[['completed','Conclusão integral'],['client_termination','Rescisão pelo contratante'],['contractor_termination','Rescisão pelo contratado'],['mutual','Mútuo acordo'],['other','Outro']]},
    {key:'financial',label:'Situação financeira',mode:'single',items:[['paid','Quitação integral'],['balance','Existe saldo pendente']]},
  ],
  levantamento_tecnico:[
    {key:'observed',label:'Elementos a registrar',mode:'multi',items:[['electrical','Elétrica'],['hydraulic','Hidráulica'],['structure','Estrutura'],['frames','Esquadrias'],['finishes','Revestimentos'],['roof','Cobertura'],['drainage','Drenagem'],['access','Acessos'],['other','Outros']]},
    {key:'conditions',label:'Condições/divergências',mode:'multi',items:[['cracks','Fissuras/trincas'],['moisture','Umidade/infiltração'],['levels','Desníveis'],['corrosion','Corrosão'],['document_mismatch','Divergência documental'],['restricted_access','Acesso restrito']]},
  ],
};

function money(value:number|null){return value===null?'Não informado':value.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}

export default function AdminDocumentPreparationScreen(){
  const styles=useThemeStyles(styleDefinitions);
  const [projects,setProjects]=useState<AdminProjectSummary[]>([]);
  const [projectId,setProjectId]=useState<string|null>(null);
  const [kind,setKind]=useState<PrepareKind>('anexo_i');
  const [choices,setChoices]=useState<ChoiceMap>({});
  const [versionBump,setVersionBump]=useState<'minor'|'major'>('minor');
  const [versionReason,setVersionReason]=useState('');
  const [extraText,setExtraText]=useState('');
  const [preview,setPreview]=useState<ContractDocumentPreview|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [success,setSuccess]=useState<string|null>(null);

  const selectedProject=useMemo(()=>projects.find(item=>item.id===projectId)??null,[projects,projectId]);
  const groups=optionGroups[kind]??[];

  const load=useCallback(async()=>{const result=await listAdminProjects();setProjects(result.data);setProjectId(current=>current??result.data[0]?.id??null);setError(result.error);},[]);
  useEffect(()=>{const task=setTimeout(()=>void load(),0);return()=>clearTimeout(task);},[load]);
  useEffect(()=>{setChoices({});setPreview(null);setVersionReason('');setVersionBump('minor');setExtraText('');},[kind,projectId]);

  const toggle=(group:{key:string;mode:'single'|'multi'},value:string)=>{
    setChoices(current=>{
      if(group.mode==='single')return {...current,[group.key]:value};
      const values=Array.isArray(current[group.key])?current[group.key] as string[]:[];
      return {...current,[group.key]:values.includes(value)?values.filter(item=>item!==value):[...values,value]};
    });
    setPreview(null);
  };

  const extraData=()=>{
    const options={...choices};
    if(extraText.trim())options.notes=extraText.trim();
    return {document_options:options,version_bump:versionBump,version_reason:versionReason.trim(),...options};
  };

  const validateOptions=()=>{
    if(kind==='autorizacao_imagem'){
      if(!Array.isArray(choices.materials)||choices.materials.length===0)return'Selecione ao menos um material autorizado.';
      if(!Array.isArray(choices.channels)||choices.channels.length===0)return'Selecione ao menos um canal autorizado.';
    }
    if(kind==='servico_adicional'){
      if(!Array.isArray(choices.reasons)||choices.reasons.length===0)return'Selecione a origem do serviço adicional.';
      if(!choices.pricing)return'Selecione o critério comercial.';
    }
    if(kind==='quitacao_encerramento'&&(!choices.closing_reason||!choices.financial))return'Selecione motivo do encerramento e situação financeira.';
    return null;
  };

  const review=async()=>{
    if(!selectedProject)return;
    const validation=validateOptions(); if(validation){setError(validation);return;}
    setLoading(true);setError(null);setSuccess(null);
    const result=await previewContractDocument({projectId:selectedProject.id,kind,extraData:extraData()});
    setLoading(false);
    if(result.error||!result.data){setError(result.error??'Prévia indisponível.');return;}
    setPreview(result.data);
  };

  const prepare=async()=>{
    if(!selectedProject||!preview)return;
    if(preview.revisionOf&&!versionReason.trim()){setError('Informe o motivo da nova versão antes de preparar.');return;}
    setLoading(true);setError(null);setSuccess(null);
    const result=await prepareContractDocument({projectId:selectedProject.id,kind,extraData:extraData()});
    setLoading(false);
    if(result.error){setError(result.error);return;}
    setSuccess(`Documento preparado como versão v${preview.nextVersion}. Abra “Documentos contratuais” para baixar, arquivar ou enviar ao cliente.`);
    setPreview(null);
  };

  return <Screen>
    <AdminPageHeader title="Preparação documental" description="Pré-visualize dados, defina opções e controle a versão antes de gerar o Word no mobile." />
    {error?<Notice tone="danger">{error}</Notice>:null}{success?<Notice tone="success">{success}</Notice>:null}
    <Card><Text style={styles.sectionTitle}>Projeto</Text><View style={styles.chips}>{projects.map(project=><Pressable key={project.id} onPress={()=>setProjectId(project.id)} style={[styles.chip,project.id===projectId&&styles.selected]}><Text style={[styles.chipText,project.id===projectId&&styles.selectedText]}>{project.contractNumber} • {project.name}</Text></Pressable>)}</View></Card>
    <Card><Text style={styles.sectionTitle}>Tipo de documento</Text><View style={styles.chips}>{CONTRACT_DOCUMENT_OPTIONS.map(option=><Pressable key={option.kind} onPress={()=>setKind(option.kind)} style={[styles.chip,option.kind===kind&&styles.selected]}><Text style={[styles.chipText,option.kind===kind&&styles.selectedText]}>{option.title}</Text></Pressable>)}</View></Card>
    {groups.length?<Card><Text style={styles.sectionTitle}>Opções que sairão no Word</Text>{groups.map(group=><View key={group.key} style={styles.group}><Text style={styles.label}>{group.label}{group.mode==='single'?' • escolha uma opção':''}</Text><View style={styles.chips}>{group.items.map(([value,label])=>{const current=choices[group.key];const selected=group.mode==='single'?current===value:Array.isArray(current)&&current.includes(value);return <Pressable key={value} onPress={()=>toggle(group,value)} style={[styles.option,selected&&styles.optionSelected]}><Text style={styles.optionMark}>{selected?'☒':'☐'}</Text><Text style={styles.optionText}>{label}</Text></Pressable>;})}</View></View>)}<Field label="Observações complementares" multiline onChangeText={value=>{setExtraText(value);setPreview(null);}} value={extraText}/></Card>:null}
    <Card><Text style={styles.sectionTitle}>Versionamento</Text><View style={styles.chips}><Pressable onPress={()=>{setVersionBump('minor');setPreview(null);}} style={[styles.chip,versionBump==='minor'&&styles.selected]}><Text style={[styles.chipText,versionBump==='minor'&&styles.selectedText]}>Revisão menor</Text></Pressable><Pressable onPress={()=>{setVersionBump('major');setPreview(null);}} style={[styles.chip,versionBump==='major'&&styles.selected]}><Text style={[styles.chipText,versionBump==='major'&&styles.selectedText]}>Nova versão principal</Text></Pressable></View><Field label="Motivo da revisão" onChangeText={value=>{setVersionReason(value);setPreview(null);}} placeholder="Obrigatório quando já existe versão emitida" value={versionReason}/><Button loading={loading} onPress={()=>void review()} title="Revisar dados antes de preparar" variant="secondary" /></Card>
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
  previewHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:spacing.sm},meta:{color:colors.slate,fontSize:12,lineHeight:18,fontFamily:typography.family},strong:{color:colors.ink,fontSize:13,lineHeight:19,fontWeight:'700',fontFamily:typography.family},
});
