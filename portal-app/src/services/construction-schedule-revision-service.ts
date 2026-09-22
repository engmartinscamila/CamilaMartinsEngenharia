import { supabase } from '@/lib/supabase';

export interface CurrentApprovedSchedule {
  id: string;
  projectId: string;
  clientId: string;
  contractId: string | null;
  title: string;
  revisionNumber: number;
  baselineVersion: number;
  approvedAt: string | null;
}

export async function listCurrentApprovedSchedules(): Promise<{data: CurrentApprovedSchedule[]; error: string | null}> {
  const result = await supabase
    .from('construction_schedules')
    .select('id,project_id,client_id,contract_id,title,revision_number,baseline_version,approved_at')
    .eq('activation_status','approved')
    .eq('is_current',true)
    .order('approved_at',{ascending:false})
    .limit(100);
  if(result.error) return {data:[],error:result.error.message??'Não foi possível listar as revisões vigentes.'};
  return {data:(result.data??[]).map(row=>({
    id:String(row.id),projectId:String(row.project_id),clientId:String(row.client_id),
    contractId:row.contract_id?String(row.contract_id):null,title:String(row.title??'Cronograma'),
    revisionNumber:Number(row.revision_number??1),baselineVersion:Number(row.baseline_version??1),
    approvedAt:row.approved_at,
  })),error:null};
}

export async function prepareScheduleRevision(
  previousScheduleId:string,
  quoteRecordId:string,
  contractRecordId:string,
  reason:string,
):Promise<{requestId:string|null;error:string|null}> {
  if(reason.trim().length<10) return {requestId:null,error:'Informe uma justificativa com pelo menos 10 caracteres.'};
  const result=await supabase.rpc('admin_prepare_full_schedule_revision',{
    p_previous_schedule_id:previousScheduleId,
    p_quote_record_id:quoteRecordId,
    p_contract_record_id:contractRecordId,
    p_reason:reason.trim(),
  });
  return result.error||!result.data
    ? {requestId:null,error:result.error?.message??'Não foi possível preparar a reprogramação.'}
    : {requestId:String(result.data),error:null};
}
