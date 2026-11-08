import {supabase} from '@/lib/supabase';
import {readAllRows} from '@/lib/paginated-query';
import type {LegacyReceiptReference} from '@/lib/legacy-finance-audit';
export type LegacyReceiptRead={data:LegacyReceiptReference[];error:string|null};
/** Histórico administrativo: somente IDs e campos necessários à conferência. */
export async function listAdminReceiptReferences():Promise<LegacyReceiptRead>{
 const result=await readAllRows(supabase.from('payment_receipts')
  .select('id,financial_entry_id,client_id,project_id,amount,paid_on'));
 if(result.error)return {data:[],error:'Falha ao carregar o histórico completo de recibos. A reconciliação foi bloqueada.'};
 const rows:LegacyReceiptReference[]=[];
 for(const r of result.data){
  const value=Number(r.amount);
  if(!Number.isFinite(value)||value<=0||!r.id||!r.client_id||!r.paid_on)
   return {data:[],error:'Histórico de recibos incompleto. Confira os dados antes da migração.'};
  rows.push({id:r.id,financialEntryId:r.financial_entry_id??null,clientId:r.client_id,
   projectId:r.project_id??null,amount:value,paidOn:r.paid_on});
 }
 return {data:rows,error:null};
}

/** A02: recibos que travam o recebimento de origem (com situação de estorno). */
export type ReceiptLock={receiptNumber:number;reversedAt:string|null;reversalReason:string|null};
export async function listReceiptLocks():Promise<{data:Record<string,ReceiptLock>;error:string|null}>{
 let result=await readAllRows(supabase.from('payment_receipts').select('id,financial_entry_id,receipt_number,reversed_at,reversal_reason'));
 // Compatível com bancos ainda sem as colunas de estorno.
 if(result.error)result=await readAllRows(supabase.from('payment_receipts').select('id,financial_entry_id,receipt_number'));
 if(result.error)return {data:{},error:'Não foi possível conferir os recibos emitidos. Edições de recebimentos ficam bloqueadas até atualizar.'};
 const data:Record<string,ReceiptLock>={};
 for(const r of result.data as any[]){
  if(!r.financial_entry_id)continue;
  data[r.financial_entry_id]={receiptNumber:Number(r.receipt_number),reversedAt:r.reversed_at??null,reversalReason:r.reversal_reason??null};
 }
 return {data,error:null};
}

/** A02: estorno rastreável de recebimento com recibo (idempotente no servidor). */
export async function reverseReceiptedPayment(financialId:string,reason:string):Promise<string|null>{
 const text=reason.trim();
 if(text.length<5)return 'Descreva o motivo do estorno (mínimo de 5 caracteres).';
 const result=await supabase.rpc('admin_reverse_receipted_payment',{p_financial_id:financialId,p_reason:text});
 if(result.error)return result.error.message||'Não foi possível registrar o estorno.';
 return null;
}

export const receiptLabel=(n:number)=>`REC-${String(n).padStart(6,'0')}`;
