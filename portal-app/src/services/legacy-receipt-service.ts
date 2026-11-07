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
