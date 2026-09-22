import {supabase} from '@/lib/supabase';

export interface ClientConstructionStage {
  code: string;
  activity: string;
  planned_start: string | null;
  planned_finish: string | null;
  actual_progress: number | null;
  measurement_date: string | null;
}
export interface ClientConstructionSchedulePublication {
  id: string;
  projectId: string;
  version: number;
  publishedAt: string;
  title: string;
  plannedStart: string | null;
  plannedFinish: string | null;
  activities: ClientConstructionStage[];
}

/** Consulta de dados sanitizados: não lê tabelas administrativas, contratos ou custos. */
export async function loadClientConstructionSchedulePublication(projectId: string): Promise<{data: ClientConstructionSchedulePublication | null; error: string | null}> {
  const result = await supabase.from('construction_schedule_publications')
    .select('id,project_id,baseline_version,published_snapshot,published_at')
    .eq('project_id',projectId).is('revoked_at',null).maybeSingle();
  if (result.error) return {data:null,error:'Não foi possível conferir a publicação deste cronograma.'};
  if (!result.data) return {data:null,error:null};
  const snapshot = result.data.published_snapshot as Record<string,unknown> | null;
  if (!snapshot || !Array.isArray(snapshot.activities)) return {data:null,error:'A versão publicada contém dados incompletos.'};
  const activities: ClientConstructionStage[] = snapshot.activities.map((item: Record<string, unknown>) => ({
    code:String(item.code??''), activity:String(item.activity??''),
    planned_start:typeof item.planned_start==='string'?item.planned_start:null,
    planned_finish:typeof item.planned_finish==='string'?item.planned_finish:null,
    actual_progress:typeof item.actual_progress==='number'?item.actual_progress:null,
    measurement_date:typeof item.measurement_date==='string'?item.measurement_date:null,
  }));
  if (activities.some((item)=>!item.code || !item.activity)) return {data:null,error:'Atividade publicada inválida.'};
  return {data:{id:String(result.data.id),projectId:String(result.data.project_id),
    version:Number(result.data.baseline_version),publishedAt:String(result.data.published_at),
    title:String(snapshot.title??'Cronograma de obra'),
    plannedStart:typeof snapshot.planned_start==='string'?snapshot.planned_start:null,
    plannedFinish:typeof snapshot.planned_finish==='string'?snapshot.planned_finish:null,
    activities},error:null};
}

export async function adminPublishConstructionSchedule(scheduleId: string):Promise<string|null> {
  const result=await supabase.rpc('admin_publish_full_schedule_to_client',{p_schedule_id:scheduleId});
  return result.error?.message??(!result.data?'Não foi possível publicar a visão do cliente.':null);
}
export async function adminGetCurrentConstructionPublication(projectId: string):Promise<{id:string|null;error:string|null}> {
  const result=await supabase.from('construction_schedule_publications').select('id')
    .eq('project_id',projectId).is('revoked_at',null).maybeSingle();
  return {id:result.data?.id??null,error:result.error?.message??null};
}
export async function adminRevokeConstructionSchedule(publicationId:string,reason:string):Promise<string|null> {
  if (reason.trim().length<10) return 'Informe motivo auditável com pelo menos dez caracteres.';
  const result=await supabase.rpc('admin_revoke_full_schedule_publication',{
    p_publication_id:publicationId,p_reason:reason.trim(),
  });
  return result.error?.message??(result.data===true?null:'A publicação já foi retirada ou não foi encontrada.');
}
