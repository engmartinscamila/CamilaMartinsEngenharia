import React from 'react';
import {Text,View} from 'react-native';
import {AdminDetailPanel} from '@/components/admin-detail-panel';
import {Button,Card,Notice,StatusPill} from '@/components/ui';
import {formatDate} from '@/lib/format';
import {documentFamily,documentState,documentStateLabels,documentStateTone} from '@/lib/document-center-model';
import {useThemeStyles} from '@/providers/theme-provider';
import type {ContractDocumentSummary} from '@/services/document-workflow-service';
import type {AdminDocumentAlertItem,AdminDocumentMapItem,DocumentDecision} from '@/services/document-governance-service';
import type {ApprovalSummary} from '@/types/domain';
import {spacing,ThemeColors,typography} from '@/theme/tokens';
export type DocumentAction='download'|'archive'|'send'|'release-required'|'release-view'|'open'|'manage';
export function DocumentCenterDetails({document,documents,map,decisions,approvals,alerts,busy,error,success,onClose,onSelect,onAction}:{
 document:ContractDocumentSummary|null;documents:ContractDocumentSummary[];map:AdminDocumentMapItem[];decisions:DocumentDecision[];
 approvals:ApprovalSummary[];alerts:AdminDocumentAlertItem[];busy:boolean;error:string|null;success:string|null;
 onClose:()=>void;onSelect:(id:string)=>void;onAction:(item:ContractDocumentSummary,action:DocumentAction)=>void;
}){
 const styles=useThemeStyles(styleDefinitions);
 const status=document?documentState(document,map,decisions):'';
 const commercial=!!document&&['orcamento','contrato'].includes(String(document.kind));
 const frozen=!!document&&(['enviado','liberado_cliente','aguardando_aceite','aceito','aceito_com_ressalvas','recusado','substituido','expirado'].includes(status)||!!document.releasedAt||!!document.supersededAt);
 const current=map.find(item=>item.documentId===document?.id);
 return <AdminDetailPanel visible={!!document} title="Detalhes do documento" onClose={onClose}>{document?<>
  <Text style={styles.title}>{document.title}</Text><StatusPill label={documentStateLabels[status]??status} tone={documentStateTone(status)} />
  {error?<Notice tone="danger">{error}</Notice>:null}{success?<Notice tone="success">{success}</Notice>:null}
  <Card><Text style={styles.section}>Arquivo e disponibilização</Text>
   {current?.isCurrent?<StatusPill label="Versão vigente" tone="neutral" />:null}
   <Text style={styles.text}>Versão {document.version??'não informada'} • criado em {formatDate(document.createdAt)}</Text>
   <Text style={styles.text}>{document.archived?'Arquivo Word preservado no sistema':'Sem arquivo persistido no sistema'}</Text>
   {document.generatedAt?<Text style={styles.text}>Gerado em {formatDate(document.generatedAt)}</Text>:null}
   {document.releasedAt?<Text style={styles.text}>Liberado em {formatDate(document.releasedAt)}</Text>:null}
   {document.validUntil?<Text style={styles.text}>Validade: {formatDate(document.validUntil)}</Text>:null}
   <View style={styles.actions}>
    {commercial&&!frozen?<Button title="Gerenciar emissão em Contratos Gerais" disabled={busy} onPress={()=>onAction(document,'manage')} variant="secondary" />:null}
    {document.archived?<Button title="Abrir arquivo preservado" disabled={busy} onPress={()=>onAction(document,'open')} variant="secondary" />:null}
    {!frozen&&!commercial?<><Button title="Baixar Word" disabled={busy} onPress={()=>onAction(document,'download')} variant="secondary" /><Button title="Baixar + arquivar" disabled={busy} onPress={()=>onAction(document,'archive')} variant="ghost" /></>:null}
    {!frozen&&!commercial&&document.archived&&document.status==='gerado'&&!current?<Button title="Disponibilizar ao cliente" disabled={busy} onPress={()=>onAction(document,'send')} />:null}
    {current&&current.isCurrent&&['emitido','liberado_cliente'].includes(status)&&document.archived?<>
      <Button title="Liberar e solicitar aceite" disabled={busy} onPress={()=>onAction(document,'release-required')} />
      <Button title="Liberar para consulta" disabled={busy} onPress={()=>onAction(document,'release-view')} variant="secondary" />
    </>:null}
   </View>
  </Card>
  <Card><Text style={styles.section}>Versões e histórico</Text>
   {documentFamily(document,documents).map(item=><View key={item.id} style={styles.row}>
    <Text style={styles.text}>Versão {item.version??'não informada'} • {formatDate(item.createdAt)}</Text>
    <StatusPill label={documentStateLabels[documentState(item,map,decisions)]??item.status} tone={documentStateTone(documentState(item,map,decisions))} />
    {item.id!==document.id?<Button title={`Ver versão ${item.version??formatDate(item.createdAt)}`} disabled={busy} onPress={()=>onSelect(item.id)} variant="ghost" />:null}
   </View>)}
  </Card>
  <Card><Text style={styles.section}>Aceites e manifestações</Text>
   {decisions.filter(item=>item.documentId===document.id).map(item=><View key={item.id} style={styles.row}>
    <Text style={styles.text}>{({accepted:'Aceito',accepted_with_notes:'Aceito com ressalvas',rejected:'Recusado'})[item.decision]} • versão {item.version??document.version??'não informada'}</Text>
    <Text style={styles.text}>{formatDate(item.acceptedAt)}</Text>{item.note?<Text style={styles.text}>{item.note}</Text>:null}
   </View>)}
   {approvals.filter(item=>item.relatedDocumentId===document.id).map(item=><View key={item.id} style={styles.row}>
    <Text style={styles.text}>{item.approvalObject||item.title}</Text><StatusPill label={documentStateLabels[item.status]??item.status} tone={documentStateTone(item.status)} />
    {item.dueAt?<Text style={styles.text}>Prazo: {formatDate(item.dueAt)}</Text>:null}
    {item.respondedAt?<Text style={styles.text}>Respondido em {formatDate(item.respondedAt)}</Text>:null}
    {item.comment?<Text style={styles.text}>{item.comment}</Text>:null}
   </View>)}
   {!decisions.some(item=>item.documentId===document.id)&&!approvals.some(item=>item.relatedDocumentId===document.id)?<Text style={styles.text}>{status==='aguardando_aceite'?'Aguardando manifestação do cliente.':'Nenhuma manifestação registrada para esta versão.'}</Text>:null}
  </Card>
  {alerts.filter(item=>item.sourceDocumentId===document.id).map(item=><Notice key={item.id} tone={item.isDue?'warning':'info'}>{item.title}: {item.message}</Notice>)}
 </>:null}</AdminDetailPanel>;
}
const styleDefinitions=(colors:ThemeColors)=>({
 title:{color:colors.ink,fontFamily:typography.family,fontSize:18,fontWeight:'700' as const},
 section:{color:colors.ink,fontFamily:typography.family,fontSize:15,fontWeight:'700' as const},
 text:{color:colors.slate,fontFamily:typography.family,fontSize:13,lineHeight:20},
 row:{gap:spacing.xs,borderTopWidth:1,borderTopColor:colors.line,paddingTop:spacing.sm},
 actions:{flexDirection:'row' as const,flexWrap:'wrap' as const,gap:spacing.sm},
});
