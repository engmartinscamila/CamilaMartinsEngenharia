import type { AdminClientSummary, AdminContractSummary, AdminProjectSummary, FinancialEntrySummary } from '@/types/domain';

export const financialCategories = ([
  ['honorarios','Honorários'],['parcelas','Parcelas'],['projetos','Projetos'],
  ['vistorias_laudos','Vistorias e laudos'],['acompanhamento','Acompanhamento de obra'],
  ['cronogramas','Cronogramas'],['servicos_adicionais','Serviços adicionais'],['materiais','Materiais'],
  ['fornecedores','Fornecedores'],['deslocamento','Deslocamento'],['software','Software e ferramentas'],
  ['taxas','Taxas e tributos'],['administrativo','Administrativo'],['marketing','Marketing'],['outros','Outros'],
] as const).map(([value,label])=>({value,label}));
const normalized=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/[ _-]+/g,' ');
export function financialCategory(value:string) {
  const text=normalized(value);
  const aliases:Record<string,string>={deslocamentos:'deslocamento',softwares:'software',impostos:'taxas'};
  return aliases[text] || financialCategories.find(item=>normalized(item.value)===text || normalized(item.label)===text)?.value || value.trim() || 'outros';
}
export const categoryLabel=(value:string)=>financialCategories.find(item=>item.value===financialCategory(value))?.label || value;
export function financialStatus(value:string):'pago'|'pendente'|'cancelado' {
  const text=normalized(value);
  if (['pago','recebido','quitado'].includes(text)) return 'pago';
  if (['cancelado','cancelada'].includes(text)) return 'cancelado';
  return 'pendente';
}
export const financialToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const entryDate=(entry:FinancialEntrySummary)=>financialStatus(entry.status)==='pago' ? entry.paidAt || entry.date : entry.dueDate || entry.date;
export function effectiveStatus(entry:FinancialEntrySummary,today=financialToday()) {
  const status=financialStatus(entry.status);
  return status==='pendente' && entry.dueDate && entry.dueDate<today ? 'atrasado' : status;
}
export type FinancialFilters={query:string;projectId:string;status:string;month:string;type?:string};
export function filterFinancialEntries(entries:FinancialEntrySummary[],filters:FinancialFilters,today=financialToday()) {
  const query=normalized(filters.query);
  return entries.filter(entry=>(!filters.projectId || entry.projectId===filters.projectId)
    && (!filters.type || entry.type===filters.type)
    && (!filters.status || (filters.status==='aberto'?financialStatus(entry.status)==='pendente':effectiveStatus(entry,today)===filters.status))
    && (!filters.month || entryDate(entry)?.startsWith(filters.month))
    && (!query || normalized([entry.description,entry.clientName,entry.contractNumber,entry.projectName,categoryLabel(entry.category),entry.notes].join(' ')).includes(query)));
}
/** A missing contract price is unknown, never a fictional R$ 0,00. */
export function financialAmountOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function financialTotals(entries:FinancialEntrySummary[]) {
  const result={received:0,paid:0,receivable:0,payable:0,balance:0,forecast:0};
  for (const entry of entries) {
    const status=financialStatus(entry.status);
    if(status==='cancelado')continue;
    const amount=Math.round(entry.amount*100);
    const key=entry.type==='entrada' ? status==='pago'?'received':'receivable' : status==='pago'?'paid':'payable';
    result[key]+=amount;
  }
  result.balance=result.received-result.paid;result.forecast=result.balance+result.receivable-result.payable;
  for(const key of Object.keys(result) as (keyof typeof result)[])result[key]/=100;
  return result;
}
export type BankTransaction={id:string;accountId:string;date:string;amount:number;description:string;matchedFinancialId:string|null};
export function accountBalance(account:{id:string;openingBalance:number;openingBalanceDate?:string|null},entries:FinancialEntrySummary[],transactions:BankTransaction[],today=financialToday()) {
  if(!account.openingBalanceDate)return null;
  const after=(date:string|null)=>Boolean(date && date>account.openingBalanceDate! && date<=today);
  const bank=transactions.filter(item=>item.accountId===account.id);
  const matched=new Set(bank.map(item=>item.matchedFinancialId).filter(Boolean));
  const totalBank=bank.filter(item=>after(item.date)).reduce((sum,item)=>sum+Math.round(item.amount*100),0);
  const manual=entries.filter(item=>item.accountId===account.id && financialStatus(item.status)==='pago'
    && after(item.paidAt || item.date) && !item.bankTransactionId && !matched.has(item.id))
    .reduce((sum,item)=>sum+Math.round(item.amount*100)*(item.type==='saida'?-1:1),0);
  return (Math.round(account.openingBalance*100)+totalBank+manual)/100;
}
export function csvCell(value:unknown) {
  let text=String(value??'');
  if(/^[\s]*[=+@-]/.test(text))text="'"+text;
  return '"'+text.replaceAll('"','""')+'"';
}


export interface ReceivableStatement {
  id: string; clientName: string; contractNumber: string; contractValue: number | null;
  received: number; pending: number; remaining: number | null; unscheduled: number | null;
  overdue: number; credit: number; entries: FinancialEntrySummary[]; inactive: boolean;
}
// Each entry belongs to one contract (explicit UUID first, project UUID fallback).
// Pending installments explain the remaining balance; they are never added to it.
export function receivableStatements(contracts:AdminContractSummary[], projects:AdminProjectSummary[], entries:FinancialEntrySummary[], clients:AdminClientSummary[], projectId=''):ReceivableStatement[] {
  const projectMap=new Map(projects.map(project=>[project.id,project]));
  const contractIds=new Set(contracts.map(contract=>contract.id));
  const contractOf=(entry:FinancialEntrySummary)=>entry.contractId || (entry.projectId?projectMap.get(entry.projectId)?.contractId:null);
  const rows:ReceivableStatement[]=contracts.filter(contract=>!projectId || projectMap.get(projectId)?.contractId===contract.id).map(contract=>{
    const linked=entries.filter(entry=>entry.type==='entrada'&&contractOf(entry)===contract.id&&financialStatus(entry.status)!=='cancelado');
    const totals=financialTotals(linked), value=contract.contractValue;
    const balance=value===null?null:(Math.round(value*100)-Math.round(totals.received*100))/100;
    const inactive=['cancelled','archived','cancelado','arquivado'].includes(contract.status);
    return {id:contract.id,clientName:contract.clientName,contractNumber:contract.contractNumber,contractValue:value,
      received:totals.received,pending:totals.receivable,remaining:balance===null?null:Math.max(0,balance),
      unscheduled:balance===null?null:Math.max(0,(Math.round(balance*100)-Math.round(totals.receivable*100))/100),
      overdue:financialTotals(linked.filter(entry=>effectiveStatus(entry)==='atrasado')).receivable,
      credit:balance===null?0:Math.max(0,-balance),entries:linked,inactive};
  });
  const standalone=new Map<string,FinancialEntrySummary[]>();
  for(const entry of entries){
    if(entry.type!=='entrada'||financialStatus(entry.status)==='cancelado'||(projectId&&entry.projectId!==projectId))continue;
    const contract=contractOf(entry);if(contract&&contractIds.has(contract))continue;
    // Preserve entries whose contract is no longer in the current list as a separate group.
    const key=contract?`unavailable:${contract}`:entry.clientId|| (entry.projectId?projectMap.get(entry.projectId)?.clientId:null)||`entry:${entry.id}`;
    standalone.set(key,[...(standalone.get(key)||[]),entry]);
  }
  for(const [id,linked] of standalone){
    const totals=financialTotals(linked),first=linked[0]!;
    rows.push({id,clientName:clients.find(client=>client.id===id)?.name||first.clientName,
      contractNumber:id.startsWith('unavailable:')?'Contrato fora da listagem':'Serviços sem contrato',contractValue:null,
      received:totals.received,pending:totals.receivable,remaining:null,unscheduled:null,
      overdue:financialTotals(linked.filter(entry=>effectiveStatus(entry)==='atrasado')).receivable,credit:0,entries:linked,inactive:false});
  }
  return rows;
}


export type FinancialLinkIssueCode =
  | 'project_missing'
  | 'project_client_mismatch'
  | 'project_contract_mismatch'
  | 'contract_client_mismatch';
export interface FinancialLinkIssue {
  code: FinancialLinkIssueCode;
  referenceId: string;
  message: string;
}

/** Read-only integrity checks. Never correct or remove historical financial entries implicitly. */
export function financialLinkIssues(
  contracts: AdminContractSummary[],
  projects: AdminProjectSummary[],
  entries: FinancialEntrySummary[],
): FinancialLinkIssue[] {
  const contractsById = new Map(contracts.map(contract => [contract.id, contract]));
  const projectsById = new Map(projects.map(project => [project.id, project]));
  const issues: FinancialLinkIssue[] = [];
  for (const project of projects) {
    if (!project.contractId) continue; // Projects legitimately exist before contracts.
    const contract = contractsById.get(project.contractId);
    if (contract && project.clientId && contract.clientId && project.clientId !== contract.clientId) {
      issues.push({ code: 'project_contract_mismatch', referenceId: project.id,
        message: `O projeto "${project.name}" está associado a um contrato de outro cliente.` });
    }
  }
  for (const entry of entries) {
    const project = entry.projectId ? projectsById.get(entry.projectId) : null;
    if (entry.projectId && !project) {
      issues.push({ code: 'project_missing', referenceId: entry.id,
        message: `O lançamento "${entry.description}" referencia um projeto indisponível na listagem.` });
    }
    if (project && entry.clientId && project.clientId && entry.clientId !== project.clientId) {
      issues.push({ code: 'project_client_mismatch', referenceId: entry.id,
        message: `O lançamento "${entry.description}" pertence a um cliente diferente do projeto.` });
    }
    if (project && entry.contractId && project.contractId && entry.contractId !== project.contractId) {
      issues.push({ code: 'project_contract_mismatch', referenceId: entry.id,
        message: `O lançamento "${entry.description}" aponta para um contrato diferente do projeto.` });
    }
    const linkedContractId = entry.contractId || project?.contractId;
    const contract = linkedContractId ? contractsById.get(linkedContractId) : null;
    if (contract && entry.clientId && contract.clientId && entry.clientId !== contract.clientId) {
      issues.push({ code: 'contract_client_mismatch', referenceId: entry.id,
        message: `O lançamento "${entry.description}" está vinculado ao contrato de outro cliente.` });
    }
  }
  return issues;
}
