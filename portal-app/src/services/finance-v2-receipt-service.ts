import {supabase} from '@/lib/supabase';
import {financeV2HomologationEnabled} from '@/services/finance-v2-service';
import {readAllRows} from '@/lib/paginated-query';

export type FinanceV2ReceiptRecord={
 id:string;paymentId:string;referenceNumber:string;issuedAt:string;
 amount:number;paidOn:string;clientName:string;
};
export type FinanceV2ReceiptResult<T>={data:T|null;error:string|null};
const denied='Comprovante V2 disponível somente na homologação. Nenhum recibo de produção foi alterado.';
function fail<T>(error:string):FinanceV2ReceiptResult<T>{return {data:null,error};}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function listFinanceV2ReceiptRecords():Promise<FinanceV2ReceiptResult<FinanceV2ReceiptRecord[]>>{
 if(!financeV2HomologationEnabled)return fail(denied);
 const result=await readAllRows(supabase.from('fin_v2_receipt_records')
  .select('id,payment_id,reference_number,issued_at,immutable_snapshot'));
 if(result.error)return fail('Não foi possível verificar todos os comprovantes V2. Emissão bloqueada até atualizar.');
 const data:FinanceV2ReceiptRecord[]=[];
 for(const row of result.data){
  const snap=row.immutable_snapshot;
  const amount=Number(snap?.payment_amount);
  if(!row.id||!row.payment_id||!row.reference_number||!row.issued_at||
    snap?.payment_id!==row.payment_id||snap?.document_is_final!==false||
    !Number.isFinite(amount)||amount<=0||!snap?.paid_on||!snap?.client_name)
   return fail('Comprovante de homologação inválido: emissão bloqueada para evitar duplicidade.');
  data.push({id:row.id,paymentId:row.payment_id,referenceNumber:String(row.reference_number),
   issuedAt:row.issued_at,amount,paidOn:snap.paid_on,clientName:snap.client_name});
 }
 return {data,error:null};
}
export async function issueFinanceV2ReceiptReference(paymentId:string,requestId:string):Promise<FinanceV2ReceiptResult<string>>{
 if(!financeV2HomologationEnabled)return fail(denied);
 if(!uuid.test(paymentId)||!uuid.test(requestId))return fail('Identificador do pagamento ou da solicitação inválido.');
 const result=await supabase.rpc('admin_fin_v2_issue_receipt_reference',{
  p_payment_id:paymentId,p_request_id:requestId,
 });
 if(result.error||typeof result.data!=='string')return fail(result.error?.message??'Não foi possível confirmar o registro. Reenvie com a mesma solicitação.');
 return {data:result.data,error:null};
}
