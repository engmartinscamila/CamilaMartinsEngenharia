import type { ReceivableStatement } from '@/lib/financial-model';

// Uma única leitura dos valores do extrato. Parcelas pendentes já compõem
// o saldo contratual e não devem ser somadas novamente.
const cents=(value:number|null|undefined)=>Number.isFinite(value)?Math.round((value??0)*100):0;
const openCents=(row:ReceivableStatement)=>cents(row.remaining??row.pending);
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();

export type ReceivableFocus='all'|'overdue'|'unplanned'|'credit'|'inactive';
export function receivableOverview(rows:ReceivableStatement[]){
  const active=rows.filter(row=>!row.inactive);
  return {
    total:active.reduce((sum,row)=>sum+openCents(row),0)/100,
    overdue:active.reduce((sum,row)=>sum+cents(row.overdue),0)/100,
    unplanned:active.reduce((sum,row)=>sum+cents(row.unscheduled),0)/100,
    credit:active.reduce((sum,row)=>sum+cents(row.credit),0)/100,
    overdueCount:active.filter(row=>cents(row.overdue)>0).length,
    unplannedCount:active.filter(row=>cents(row.unscheduled)>0).length,
  };
}
export function prioritizeReceivables(rows:ReceivableStatement[],focus:ReceivableFocus='all',query=''){
  const term=normalize(query);
  return rows.filter(row=>{
    if(term&&!normalize(row.clientName+' '+row.contractNumber).includes(term))return false;
    if(focus==='inactive')return row.inactive;
    if(row.inactive)return focus==='all';
    if(focus==='overdue')return cents(row.overdue)>0;
    if(focus==='unplanned')return cents(row.unscheduled)>0;
    if(focus==='credit')return cents(row.credit)>0;
    return true;
  }).sort((a,b)=>{
    if(a.inactive!==b.inactive)return a.inactive?1:-1;
    const overdue=cents(b.overdue)-cents(a.overdue);
    if(overdue)return overdue;
    const unplanned=cents(b.unscheduled)-cents(a.unscheduled);
    if(unplanned)return unplanned;
    const open=openCents(b)-openCents(a);
    if(open)return open;
    return (a.clientName+' '+a.contractNumber).localeCompare(b.clientName+' '+b.contractNumber,'pt-BR');
  });
}
