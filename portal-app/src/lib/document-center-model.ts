import type { ApprovalSummary } from '@/types/domain';
import type { ContractDocumentSummary } from '@/services/document-workflow-service';
import type { AdminDocumentMapItem, DocumentDecision } from '@/services/document-governance-service';

export const documentFilters = [
  {value:'all',label:'Todos'}, {value:'waiting',label:'Aguardando cliente'},
  {value:'overdue',label:'Prazo vencido'}, {value:'accepted',label:'Aprovados'},
  {value:'rejected',label:'Recusados'}, {value:'superseded',label:'Substituídos'},
] as const;
export type DocumentFilter = typeof documentFilters[number]['value'];
export const normalizeDocumentSearch = (value:string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function isDocumentDecision(item:ApprovalSummary) {
  return ['documento','aceite','termo_aceite'].includes(normalizeDocumentSearch(item.type));
}
export function documentState(document:ContractDocumentSummary, map:AdminDocumentMapItem[], decisions:DocumentDecision[]) {
  const current=map.find(item=>item.documentId===document.id);
  const decision=decisions.find(item=>item.documentId===document.id)?.decision;
  if(document.supersededAt || current?.lifecycleStatus==='substituido')return 'substituido';
  if(current?.lifecycleStatus==='expirado')return 'expirado';
  if(decision)return ({accepted:'aceito',accepted_with_notes:'aceito_com_ressalvas',rejected:'recusado'})[decision];
  if(current)return current.lifecycleStatus;
  if(document.releasedAt&&document.acceptanceRequired)return 'aguardando_aceite';
  return document.releasedAt?'liberado_cliente':document.status;
}
export function matchesDocumentFilter(status:string, overdue:boolean, filter:string) {
  if(filter==='waiting')return ['aguardando','pendente','aguardando_aceite'].includes(status);
  if(filter==='overdue')return overdue;
  if(filter==='accepted')return ['aceito','aceito_com_ressalvas','aprovado','aprovado_com_ressalvas'].includes(status);
  if(filter==='rejected')return ['recusado','rejeitado'].includes(status);
  if(filter==='superseded')return status==='substituido';
  return true;
}
export function documentFamily(document:ContractDocumentSummary, documents:ContractDocumentSummary[]) {
  const root=(item:ContractDocumentSummary)=>{
    const visited=new Set<string>();
    while(item.revisionOf&&!visited.has(item.id)){
      visited.add(item.id);const parent=documents.find(row=>row.id===item.revisionOf);
      if(!parent)return item.revisionOf;
      item=parent;
    }
    return item.id;
  };
  const key=root(document);
  return documents.filter(item=>root(item)===key);
}
export const documentStateLabels:Record<string,string>={
 rascunho:'Rascunho',preparado:'Preparado',gerado:'Gerado',emitido:'Emitido',enviado:'Enviado',
 liberado_cliente:'Liberado ao cliente',aguardando_aceite:'Aguardando aceite',aguardando:'Aguardando cliente',
 pendente:'Pendente',aceito:'Aceito',aprovado:'Aprovado',aceito_com_ressalvas:'Aceito com ressalvas',
 aprovado_com_ressalvas:'Aprovado com ressalvas',recusado:'Recusado',rejeitado:'Recusado',
 substituido:'Substituído',expirado:'Expirado',nao_gerado:'Não gerado',
};
export function documentStateTone(status:string):'success'|'warning'|'danger'|'neutral'{
 if(['aceito','aprovado','aceito_com_ressalvas','aprovado_com_ressalvas'].includes(status))return 'success';
 if(['recusado','rejeitado','expirado'].includes(status))return 'danger';
 if(['aguardando','aguardando_aceite','pendente'].includes(status))return 'warning';
 return 'neutral';
}
