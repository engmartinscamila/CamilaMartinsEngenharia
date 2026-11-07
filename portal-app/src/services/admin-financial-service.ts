import { financialCategory, financialStatus, financialToday } from '@/lib/financial-model';
import { isValidIsoDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { FinancialArchiveSummary, FinancialEntrySummary, ServiceResult } from '@/types/domain';

// Cadastros financeiros e histórico; preserva validações, limites e idempotência existentes.
export async function listAdminFinancialEntries(): Promise<ServiceResult<FinancialEntrySummary[]>> {
  const rows: any[] = [];
  for (let offset=0; ; offset+=500) {
    const result=await supabase.from('financeiro')
      .select('*, projetos(id,cliente_id,nome,numero_contrato,contract_id,clientes(nome),contratos!contract_id(contract_number)),receipt_client:clientes!financeiro_cliente_id_fkey(nome),receipt_contract:contratos!financeiro_contract_id_fkey(contract_number)')
      .order('data',{ascending:false}).order('id').range(offset,offset+499);
    if(result.error)return {data:[],error:'Não foi possível carregar todos os lançamentos financeiros atuais.'};
    rows.push(...(result.data??[]));
    if((result.data??[]).length<500)break;
    if(rows.length>=100000)return {data:[],error:'Há mais de 100 mil lançamentos; refine a consulta administrativa antes de calcular totais.'};
  }
  const result={data:rows};
  return {
    data: (result.data ?? []).map((row: any) => {
      const project = Array.isArray(row.projetos) ? row.projetos[0] : row.projetos;
      const client = Array.isArray(project?.clientes) ? project.clientes[0] : project?.clientes;
      const contract = Array.isArray(project?.contratos) ? project.contratos[0] : project?.contratos;
      return {
        id: row.id,
        projectId: row.projeto_id ?? null,
        clientId: row.cliente_id ?? project?.cliente_id ?? null,
        contractId: row.contract_id ?? project?.contract_id ?? null,
        projectName: project?.nome ?? (row.cliente_id?'Serviço sem projeto':'Projeto não identificado'),
        clientName: client?.nome ?? (Array.isArray(row.receipt_client)?row.receipt_client[0]?.nome:row.receipt_client?.nome) ?? 'Cliente não identificado',
        contractNumber: contract?.contract_number ?? project?.numero_contrato ?? (Array.isArray(row.receipt_contract)?row.receipt_contract[0]?.contract_number:row.receipt_contract?.contract_number) ?? 'Sem contrato',
        type: row.tipo ?? 'entrada',
        description: row.descricao ?? 'Lançamento financeiro',
        amount: Number(row.valor ?? 0),
        date: row.data ?? null,
        notes: row.observacoes ?? null,
        category: financialCategory(row.categoria ?? 'outros'),
        status: financialStatus(row.status ?? 'pendente'),
        dueDate: row.data_vencimento ?? null,
        paidAt: row.data_pagamento ?? null,
        accountId: row.account_id ?? null,
        bankTransactionId: row.bank_transaction_id ?? null,
        paymentMethod: row.forma_pagamento ?? null,
      } satisfies FinancialEntrySummary;
    }),
    error: null,
  };
}

export async function listFinancialArchive(): Promise<ServiceResult<FinancialArchiveSummary[]>> {
  const rows:any[]=[];
  for(let offset=0;;offset+=500){
    const page=await supabase.from('client_financial_archive').select('id, source_table, client_name_snapshot, contract_number_snapshot, service_type_snapshot, contract_value_snapshot, transaction_type, description, amount, occurred_on, archived_at, archived_reason')
      .order('archived_at',{ascending:false}).order('id').range(offset,offset+499);
    if(page.error)return {data:[],error:'Não foi possível carregar todo o histórico financeiro preservado.'};
    rows.push(...(page.data??[]));if((page.data??[]).length<500)break;
    if(rows.length>=100000)return {data:[],error:'O histórico excede 100 mil registros. Use a exportação administrativa para consulta completa.'};
  }
  const result={data:rows};
  return {
    data: (result.data ?? []).map((row: any) => ({
      id: row.id,
      sourceTable: row.source_table,
      clientName: row.client_name_snapshot,
      contractNumber: row.contract_number_snapshot ?? 'Sem contrato',
      serviceType: row.service_type_snapshot ?? null,
      contractValue: row.contract_value_snapshot === null ? null : Number(row.contract_value_snapshot),
      type: row.transaction_type ?? null,
      description: row.description ?? null,
      amount: row.amount === null ? null : Number(row.amount),
      date: row.occurred_on ?? null,
      archivedAt: row.archived_at,
      reason: row.archived_reason,
    })),
    error: null,
  };
}

export type FinancialEntryInput={projectId:string|null;clientId?:string|null;contractId?:string|null;description:string;type:'entrada'|'saida';amount:number;date:string;notes?:string;category?:string;status?:string;dueDate?:string;accountId?:string|null;paidAt?:string;paymentMethod?:string;requestId?:string};
export async function createAdminFinancialEntry(input: FinancialEntryInput) {
  const payload=financialEntryPayload(input);
  if(typeof payload==='string')return payload;
  const result=await supabase.from('financeiro').insert({...payload,...(input.requestId?{client_request_id:input.requestId}:{})}).select('id').single();
  if(result.error?.code==='23505' && input.requestId){
    const prior=await supabase.from('financeiro').select('*').eq('client_request_id',input.requestId).maybeSingle();
    if(!prior.error && prior.data && Object.entries(payload).every(([key,value])=>key==='valor'?Number(prior.data[key])===value:(prior.data[key]??null)===(value??null)))return null;
    return 'Esta tentativa já foi registrada com outros dados. Atualize o extrato antes de tentar novamente.';
  }
  return result.error || !result.data ? 'Não foi possível confirmar o lançamento. Tente novamente sem alterar os dados.' : null;
}
export function financialEntryPayload(input:FinancialEntryInput) {
  if((!input.projectId&&!input.clientId) || input.description.trim().length<2 || !Number.isFinite(input.amount) || input.amount<=0)return 'Informe cliente ou projeto, descrição e um valor maior que zero.';
  if(!['entrada','saida'].includes(input.type) || !isValidIsoDate(input.date) || (input.dueDate && !isValidIsoDate(input.dueDate)) || (input.paidAt && !isValidIsoDate(input.paidAt)))return 'Informe datas e natureza válidas.';
  const status=financialStatus(input.status??'pendente');
  const paid=status==='pago' ? input.paidAt || input.date : null;
  if(paid && paid>financialToday())return 'A data de recebimento/pagamento não pode estar no futuro.';
  return {projeto_id:input.projectId??null,cliente_id:input.clientId??null,contract_id:input.contractId??null,descricao:input.description.trim(),tipo:input.type,valor:input.amount,data:input.date,
    observacoes:input.notes?.trim()||null,categoria:financialCategory(input.category??'outros'),status,
    data_vencimento:input.dueDate||input.date||null,data_pagamento:paid,account_id:input.accountId??null,forma_pagamento:input.paymentMethod?.trim()||null};
}
export async function updateAdminFinancialEntry(id:string,input:FinancialEntryInput) {
  const payload=financialEntryPayload(input);if(typeof payload==='string')return payload;
  const linked=await supabase.from('bank_transactions').select('id').eq('matched_financial_id',id).limit(1);
  if(linked.error)return 'Não foi possível verificar a conciliação do lançamento.';
  if(linked.data?.length)return 'Este lançamento está conciliado. Preserve o vínculo bancário; registre um ajuste separado.';
  const result=await supabase.from('financeiro').update(payload).eq('id',id).is('bank_transaction_id',null).select('id').maybeSingle();
  return result.error || !result.data ? 'Não foi possível atualizar. O lançamento pode ter sido conciliado ou removido.' : null;
}
export async function deleteAdminFinancialEntry(id:string) {
  const linked=await supabase.from('bank_transactions').select('id').eq('matched_financial_id',id).limit(1);
  if(linked.error || linked.data?.length)return 'A exclusão foi bloqueada: conciliação existente ou não confirmada.';
  const result=await supabase.from('financeiro').delete().eq('id',id).is('bank_transaction_id',null).select('id').maybeSingle();
  return result.error || !result.data ? 'Não foi possível excluir com segurança. O histórico foi preservado.' : null;
}

export async function updateAdminContractValue(contractId: string, value: number) {
  const result = await supabase.rpc('admin_update_contract_value', { p_contract_id: contractId, p_value: value });
  return result.error || result.data !== true ? 'Não foi possível atualizar o valor contratado.' : null;
}
