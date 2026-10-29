import type { FinancialEntrySummary } from '@/types/domain';

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
export type FinancialFilters={query:string;projectId:string;status:string;month:string};
export function filterFinancialEntries(entries:FinancialEntrySummary[],filters:FinancialFilters,today=financialToday()) {
  const query=normalized(filters.query);
  return entries.filter(entry=>(!filters.projectId || entry.projectId===filters.projectId)
    && (!filters.status || effectiveStatus(entry,today)===filters.status)
    && (!filters.month || entryDate(entry)?.startsWith(filters.month))
    && (!query || normalized([entry.description,entry.clientName,entry.contractNumber,entry.projectName,categoryLabel(entry.category),entry.notes].join(' ')).includes(query)));
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
