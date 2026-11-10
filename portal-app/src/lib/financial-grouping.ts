import type { FinancialEntrySummary } from '@/types/domain';
import type { ReceivableStatement } from '@/lib/financial-model';

const compare=(a:{name:string},b:{name:string})=>a.name.localeCompare(b.name,'pt-BR',{numeric:true,sensitivity:'base'});
// UUIDs keep different clients/projects with the same name separate.
export function groupFinancialClients(entries:FinancialEntrySummary[]){
  const groups=new Map<string,{id:string;name:string;entries:FinancialEntrySummary[]}>();
  for(const entry of entries){
    const id=entry.clientId||`unidentified:${entry.id}`;
    if(!groups.has(id))groups.set(id,{id,name:entry.clientName,entries:[]});
    groups.get(id)!.entries.push(entry);
  }
  return [...groups.values()].sort(compare);
}
export function groupFinancialProjects(entries:FinancialEntrySummary[]){
  const groups=new Map<string,{id:string;name:string;entries:FinancialEntrySummary[]}>();
  for(const entry of entries){
    const id=entry.projectId||'without-project';
    if(!groups.has(id))groups.set(id,{id,name:entry.projectId?entry.projectName:'Serviços sem projeto',entries:[]});
    groups.get(id)!.entries.push(entry);
  }
  return [...groups.values()].sort(compare).map(group=>({...group,entries:[...group.entries].sort((a,b)=>
    a.contractNumber.localeCompare(b.contractNumber,'pt-BR',{numeric:true})||
    a.description.localeCompare(b.description,'pt-BR',{numeric:true})||a.id.localeCompare(b.id))}));
}
export function groupStatementClients(rows:ReceivableStatement[]){
  const groups=new Map<string,{id:string;name:string;rows:ReceivableStatement[]}>();
  for(const row of rows){
    const id=row.clientId||`unidentified:${row.id}`;
    if(!groups.has(id))groups.set(id,{id,name:row.clientName,rows:[]});
    groups.get(id)!.rows.push(row);
  }
  return [...groups.values()].sort(compare);
}
