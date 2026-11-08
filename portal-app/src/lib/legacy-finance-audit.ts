import {financialStatus} from '@/lib/financial-model';
import type {LegacyOriginReview} from '@/services/financial-origin-review-service';
import type {AdminContractSummary,AdminProjectSummary,FinancialEntrySummary} from '@/types/domain';

/** Relatório somente de leitura para classificar a origem de cada obrigação antes do cutover. */
export type LegacyReceiptReference={
 id:string;financialEntryId:string|null;clientId:string;projectId:string|null;
 amount:number;paidOn:string;
};
export type LegacyReceiptIssue={
 code:'missing_entry'|'missing_payment_link'|'duplicate_receipt'|'not_paid'|'amount_mismatch'|'date_mismatch'|'client_mismatch'|'project_mismatch';
 receiptId:string;financialEntryId:string|null;message:string;
};
export type LegacyUnclassifiedEntry={
 id:string;clientName:string;contractNumber:string;amount:number;status:string;projectName:string;
};
export type LegacyAuditReport={
 countEntries:number;countReceipts:number;confirmedReceiptLinks:number;confirmedStandaloneEntries:number;
 paidWithoutReceipt:number;contractsMissingValue:Pick<AdminContractSummary,'id'|'clientId'|'clientName'|'contractNumber'>[];
 unclassifiedEntries:LegacyUnclassifiedEntry[];receiptIssues:LegacyReceiptIssue[];
 migrationReady:boolean;reasons:string[];
};
const cents=(value:number)=>Number.isFinite(value)?Math.round(value*100):NaN;
const moneyEqual=(left:number,right:number)=>Number.isFinite(left)&&Number.isFinite(right)&&cents(left)===cents(right);
export function auditLegacyReceivables(
 contracts:AdminContractSummary[],projects:AdminProjectSummary[],
 entries:FinancialEntrySummary[],receipts:LegacyReceiptReference[],reviews:LegacyOriginReview[]=[]
):LegacyAuditReport {
 const projectsById=new Map(projects.map(item=>[item.id,item]));
 const contractsById=new Map(contracts.map(item=>[item.id,item]));
 const entriesById=new Map(entries.map(item=>[item.id,item]));
 const contractsMissingValue=contracts.filter(c=>!['cancelado','arquivado','cancelled','archived'].includes((c.status??'').toLowerCase())&&
   (c.contractValue===null||!Number.isFinite(c.contractValue)||c.contractValue<0))
  .map(({id,clientId,clientName,contractNumber})=>({id,clientId,clientName,contractNumber}));
 const unclassifiedEntries:LegacyUnclassifiedEntry[]=[];
 const reviewByEntry=new Map<string,LegacyOriginReview>();
 for(const review of reviews){
  const current=reviewByEntry.get(review.financialEntryId);
  if(!current||review.id>current.id)reviewByEntry.set(review.financialEntryId,review);
 }
 let confirmedStandaloneEntries=0;
 for(const entry of entries){
  if(financialStatus(entry.status)==='cancelado')continue;
  const project=entry.projectId?projectsById.get(entry.projectId):null;
  const contractId=entry.contractId||project?.contractId||null;
  if(!contractId||!contractsById.has(contractId)){
   const review=reviewByEntry.get(entry.id);
   const sameSnapshot=review?.classification==='servico_avulso'&&
    !entry.projectId&&!entry.contractId&&Boolean(entry.clientId)&&
    review.snapshot.clientId===entry.clientId&&
    !review.snapshot.projectId&&!review.snapshot.contractId&&
    review.snapshot.status===entry.status&&review.snapshot.type===entry.type&&
    moneyEqual(review.snapshot.amount,entry.amount);
   if(sameSnapshot){confirmedStandaloneEntries+=1;continue;}
   unclassifiedEntries.push({id:entry.id,clientName:entry.clientName,contractNumber:entry.contractNumber,projectName:entry.projectName,amount:entry.amount,status:entry.status});
  }
 }
 const receiptIssues:LegacyReceiptIssue[]=[];
 const uniqueReceiptIds=new Set<string>();
 const linkedToEntry=new Map<string,number>();
 let confirmedReceiptLinks=0;
 for(const receipt of receipts){
  if(uniqueReceiptIds.has(receipt.id)){
   receiptIssues.push({code:'duplicate_receipt',receiptId:receipt.id,financialEntryId:receipt.financialEntryId,message:'Identificador de recibo repetido na listagem.'});
   continue;
  }
  uniqueReceiptIds.add(receipt.id);
  if(!receipt.financialEntryId){
   receiptIssues.push({code:'missing_payment_link',receiptId:receipt.id,financialEntryId:null,message:'Recibo sem pagamento identificado.'});
   continue;
  }
  const entry=entriesById.get(receipt.financialEntryId);
  if(!entry){
   receiptIssues.push({code:'missing_entry',receiptId:receipt.id,financialEntryId:receipt.financialEntryId,message:'Recibo ligado a lançamento não encontrado. Confira o histórico arquivado.'});
   continue;
  }
  linkedToEntry.set(entry.id,(linkedToEntry.get(entry.id)||0)+1);
  if((linkedToEntry.get(entry.id)??0)>1){
   receiptIssues.push({code:'duplicate_receipt',receiptId:receipt.id,financialEntryId:entry.id,message:'Um recebimento tem mais de um recibo vinculado.'});
   continue;
  }
  let invalid=false;
  const push=(code:LegacyReceiptIssue['code'],message:string)=>{
   invalid=true;receiptIssues.push({code,receiptId:receipt.id,financialEntryId:entry.id,message});
  };
  if(entry.type!=='entrada'||financialStatus(entry.status)!=='pago')push('not_paid','Recibo ligado a um lançamento não recebido.');
  if(!moneyEqual(entry.amount,receipt.amount))push('amount_mismatch','Valor do recibo diferente do pagamento.');
  if((entry.paidAt||entry.date)!==receipt.paidOn)push('date_mismatch','Data do recibo diferente da quitação.');
  const project=entry.projectId?projectsById.get(entry.projectId):null;
  const resolvedClient=entry.clientId||project?.clientId||null;
  if(!resolvedClient||resolvedClient!==receipt.clientId)push('client_mismatch','Cliente do recibo difere do lançamento.');
  if((entry.projectId??null)!==(receipt.projectId??null))push('project_mismatch','Projeto do recibo difere do lançamento.');
  if(!invalid)confirmedReceiptLinks+=1;
 }
 const paidWithoutReceipt=entries.filter(e=>e.type==='entrada'&&financialStatus(e.status)==='pago'&&!linkedToEntry.has(e.id)).length;
 const reasons:string[]=[];
 if(contractsMissingValue.length)reasons.push('Contratos sem valor definido exigem conferência individual.');
 if(unclassifiedEntries.length)reasons.push('Existem lançamentos sem contrato classificado: confirme se são serviços avulsos.');
 if(receiptIssues.length)reasons.push('Há divergências em recibos que devem ser resolvidas antes do corte.');
 return {countEntries:entries.length,countReceipts:receipts.length,confirmedReceiptLinks,confirmedStandaloneEntries,
  paidWithoutReceipt,contractsMissingValue,unclassifiedEntries,receiptIssues,
  migrationReady:reasons.length===0,reasons};
}
