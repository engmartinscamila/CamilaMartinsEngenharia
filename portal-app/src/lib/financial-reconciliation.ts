import type {AdminClientSummary,AdminContractSummary,AdminProjectSummary,FinancialEntrySummary} from '@/types/domain';
import type {BankTransaction} from '@/lib/financial-model';
import {financialStatus} from '@/lib/financial-model';

export type FinancialIntegrityIssue={
  code:'invalid_amount'|'missing_client'|'contract_client_mismatch'|'project_client_mismatch'|'project_contract_mismatch'|'paid_without_date'|'paid_without_account'|'bank_link_conflict'|'bank_reference_missing';
  entryId?:string;severity:'warning'|'info';message:string;
};
/**
 * Verificação diagnóstica somente de leitura. Não implica exclusão de lançamentos,
 * nem substitui conciliação bancária ou comprovação documental.
 */
export function analyzeFinancialIntegrity(
 entries:FinancialEntrySummary[],contracts:AdminContractSummary[],projects:AdminProjectSummary[],
 clients:AdminClientSummary[],bank:BankTransaction[],
):FinancialIntegrityIssue[]{
  const contractMap=new Map(contracts.map(row=>[row.id,row]));
  const projectMap=new Map(projects.map(row=>[row.id,row]));
  const clientIds=new Set(clients.map(row=>row.id));
  const entryIds=new Set(entries.map(row=>row.id));
  const result:FinancialIntegrityIssue[]=[];
  const bankById=new Map<string,BankTransaction>();
  const bankForFinancial=new Map<string,string>();
  for(const tx of bank){
    bankById.set(tx.id,tx);
    if(tx.matchedFinancialId){
      const prior=bankForFinancial.get(tx.matchedFinancialId);
      if(prior&&prior!==tx.id)result.push({code:'bank_link_conflict',severity:'warning',
        entryId:tx.matchedFinancialId,message:'Um lançamento foi conciliado com mais de uma transação bancária. Confira a conciliação.'});
      bankForFinancial.set(tx.matchedFinancialId,tx.id);
      if(!entryIds.has(tx.matchedFinancialId))result.push({code:'bank_reference_missing',severity:'warning',
        entryId:tx.matchedFinancialId,message:'Uma transação bancária está associada a um lançamento não localizado entre os registros ativos; confira o histórico.'});
    }
  }
  for(const row of entries){
    const project=row.projectId?projectMap.get(row.projectId):null;
    const contractId=row.contractId||project?.contractId||null;
    const contract=contractId?contractMap.get(contractId):null;
    const clientId=row.clientId||project?.clientId||contract?.clientId||null;
    const ref='Lançamento '+row.id.slice(0,8);
    if(!Number.isFinite(row.amount)||row.amount<=0)
      result.push({code:'invalid_amount',entryId:row.id,severity:'warning',message:ref+': valor financeiro inválido; verifique antes de considerar o saldo.'});
    if(!clientId||!clientIds.has(clientId))
      result.push({code:'missing_client',entryId:row.id,severity:'warning',message:ref+': não foi possível confirmar o cliente de origem.'});
    if(contract&&clientId&&contract.clientId!==clientId)
      result.push({code:'contract_client_mismatch',entryId:row.id,severity:'warning',message:ref+': contrato vinculado a outro cliente.'});
    if(project&&clientId&&project.clientId!==clientId)
      result.push({code:'project_client_mismatch',entryId:row.id,severity:'warning',message:ref+': projeto vinculado a outro cliente.'});
    if(project&&row.contractId&&project.contractId&&row.contractId!==project.contractId)
      result.push({code:'project_contract_mismatch',entryId:row.id,severity:'warning',message:ref+': contrato do lançamento diverge do contrato do projeto.'});
    if(financialStatus(row.status)==='pago'){
      if(!row.paidAt)
        result.push({code:'paid_without_date',entryId:row.id,severity:'info',message:ref+': pago sem data de quitação específica; confirme a data real.'});
      if(!row.accountId)
        result.push({code:'paid_without_account',entryId:row.id,severity:'info',message:ref+': não há conta financeira informada para esse pagamento; a conciliação bancária pode estar incompleta.'});
    }
    if(row.bankTransactionId&&bankById.has(row.bankTransactionId)){
      const tx=bankById.get(row.bankTransactionId)!;
      if(tx.matchedFinancialId&&tx.matchedFinancialId!==row.id)
        result.push({code:'bank_link_conflict',entryId:row.id,severity:'warning',message:ref+': o identificador bancário aponta para outro lançamento.'});
    }
  }
  return result;
}
