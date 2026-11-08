import {supabase} from '@/lib/supabase';
import {readAllRows} from '@/lib/paginated-query';

export type LegacyOriginClassification='servico_avulso'|'vinculo_pendente';
export type LegacyOriginReview={
 id:number;financialEntryId:string;classification:LegacyOriginClassification;reason:string;
 snapshot:{clientId:string|null;projectId:string|null;contractId:string|null;amount:number;type:string;status:string};
};
export type OriginReviewResult<T>={data:T|null;error:string|null};

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function listFinancialOriginReviews():Promise<OriginReviewResult<LegacyOriginReview[]>>{
 const result=await readAllRows(supabase.from('financial_origin_review_events')
  .select('id,financial_entry_id,classification,reason,entry_snapshot'));
 if(result.error)return {data:null,error:'Falha na leitura do histórico completo de classificação. A migração não pode ser liberada.'};
 const data:LegacyOriginReview[]=[];
 for(const row of result.data){
  const snapshot=row.entry_snapshot;
  const amount=Number(snapshot?.amount);
  if(!Number.isSafeInteger(Number(row.id))||Number(row.id)<=0||!row.financial_entry_id||
    !['servico_avulso','vinculo_pendente'].includes(row.classification)||!row.reason||
    !snapshot||!Number.isFinite(amount)||amount<=0||!snapshot.type||!snapshot.status)
   return {data:null,error:'Histórico de origem incompleto: revisão administrativa bloqueada.'};
  data.push({id:Number(row.id),financialEntryId:row.financial_entry_id,
   classification:row.classification,reason:row.reason,
   snapshot:{clientId:snapshot.client_id??null,projectId:snapshot.project_id??null,
    contractId:snapshot.contract_id??null,amount,type:snapshot.type,status:snapshot.status}});
 }
 return {data,error:null};
}
export async function recordFinancialOriginReview(
 input:{financialEntryId:string;classification:LegacyOriginClassification;reason:string;requestId:string}
):Promise<OriginReviewResult<number>>{
 const reason=input.reason.trim();
 if(!uuid.test(input.financialEntryId)||!uuid.test(input.requestId)||
  !['servico_avulso','vinculo_pendente'].includes(input.classification)||
  reason.length<8||reason.length>400)
  return {data:null,error:'Informe classificação, justificativa de 8 a 400 caracteres e registro válido.'};
 const result=await supabase.rpc('admin_review_financial_origin',{
  p_financial_entry_id:input.financialEntryId,p_classification:input.classification,
  p_reason:reason,p_request_id:input.requestId
 });
 if(result.error||!Number.isSafeInteger(Number(result.data))||Number(result.data)<=0)
  return {data:null,error:result.error?.message??'A confirmação não foi concluída. Reenvie sem alterar a justificativa.'};
 return {data:Number(result.data),error:null};
}
