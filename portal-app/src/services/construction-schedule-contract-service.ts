import { supabase } from '@/lib/supabase';
import { listConstructionScheduleProjects, type ConstructionProjectOption } from '@/services/construction-schedule-service';

export interface CommercialScheduleDocument {
  id: string;
  recordKind: string;
  number: string;
  status: string;
  linkedProjectId: string | null;
  linkedClientId: string | null;
  linkedContractId: string | null;
  services: Array<{ code: string; name?: string; included: boolean; value?: number | null; level?: { code?: string } }>;
  totalValue: number | null;
}
export interface CommercialScheduleLink { quoteRecordId: string; contractRecordId: string }
export interface ScheduleCommercialOptions {
  projects: ConstructionProjectOption[];
  quotes: CommercialScheduleDocument[];
  contracts: CommercialScheduleDocument[];
  links: CommercialScheduleLink[];
}
export interface ScheduleTemplateItem {
  code: string;
  category: string;
  activity: string;
  display_order: number;
  reference_weight_percent: number | null;
  reference_duration_days: number | null;
  predecessor_code: string | null;
  requires_scope_confirmation: boolean;
}
export interface ScheduleTemplatePreview {
  template_code: string;
  template_version: number;
  reference_only: boolean;
  requires_scope_confirmation: boolean;
  items: ScheduleTemplateItem[];
}
const toDocument = (row: Record<string, unknown>): CommercialScheduleDocument => ({
  id: String(row.id),
  recordKind: String(row.record_kind),
  number: String(row.record_kind === 'orcamento' ? row.quote_number ?? '' : row.contract_number ?? ''),
  status: String(row.status ?? ''),
  linkedProjectId: row.linked_project_id ? String(row.linked_project_id) : null,
  linkedClientId: row.linked_client_id ? String(row.linked_client_id) : null,
  linkedContractId: row.linked_contract_id ? String(row.linked_contract_id) : null,
  services: Array.isArray(row.services) ? row.services as CommercialScheduleDocument['services'] : [],
  totalValue: row.total_value === null || row.total_value === undefined ? null : Number(row.total_value),
});
export async function loadScheduleCommercialOptions(): Promise<{ data: ScheduleCommercialOptions | null; error: string | null }> {
  const [projects,records,links] = await Promise.all([
    listConstructionScheduleProjects(),
    supabase.from('commercial_records').select('id,record_kind,quote_number,contract_number,status,linked_project_id,linked_client_id,linked_contract_id,services,total_value').in('record_kind',['orcamento','contrato']).limit(500),
    supabase.from('commercial_contract_quote_links').select('quote_record_id,contract_record_id').limit(1000),
  ]);
  if (projects.error || records.error || links.error) return {data:null,error:projects.error ?? records.error?.message ?? links.error?.message ?? 'Não foi possível conferir os documentos comerciais.'};
  const documents = (records.data ?? []).map(row=>toDocument(row as Record<string,unknown>));
  return {data:{
    projects:projects.data,
    quotes:documents.filter(doc=>doc.recordKind==='orcamento'),
    contracts:documents.filter(doc=>doc.recordKind==='contrato'),
    links:(links.data ?? []).map(row=>({quoteRecordId:String(row.quote_record_id),contractRecordId:String(row.contract_record_id)})),
  },error:null};
}
export async function previewScheduleTemplate(projectId:string,quoteId:string,contractId:string,templateCode:string):Promise<{data:ScheduleTemplatePreview|null;error:string|null}> {
  const result=await supabase.rpc('admin_preview_full_schedule_template',{
    p_project_id:projectId,p_quote_record_id:quoteId,p_contract_record_id:contractId,p_template_code:templateCode,
  });
  if (result.error || !result.data) return {data:null,error:result.error?.message??'O escopo não pôde ser verificado.'};
  const preview=result.data as ScheduleTemplatePreview;
  if (!preview.requires_scope_confirmation || !Array.isArray(preview.items)) return {data:null,error:'Modelo inválido: falta revisão individual das atividades.'};
  return {data:preview,error:null};
}
export async function saveVerifiedSchedule(projectId:string,quoteId:string,contractId:string,plan:Record<string,unknown>):Promise<{scheduleId:string|null;error:string|null}> {
  const init=await supabase.rpc('admin_initialize_construction_schedule',{
    p_project_id:projectId,p_quote_record_id:quoteId,p_contract_record_id:contractId,
  });
  if (init.error || !init.data) return {scheduleId:null,error:init.error?.message??'Vínculo não autorizado: nenhum cronograma foi criado.'};
  const scheduleId=String(init.data);
  const saved=await supabase.rpc('admin_save_full_schedule_plan',{p_schedule_id:scheduleId,p_plan:plan});
  if (saved.error || !saved.data) return {scheduleId,error:saved.error?.message??'Cronograma iniciado em rascunho, mas o plano não foi salvo.'};
  return {scheduleId,error:null};
}
export async function approveVerifiedSchedule(scheduleId:string):Promise<string|null> {
  const result=await supabase.from('construction_schedules').update({activation_status:'approved'}).eq('id',scheduleId).select('id').single();
  return result.error?.message??null;
}
