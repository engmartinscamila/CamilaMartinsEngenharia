import { downloadBase64File } from '@/lib/download-generated-file';
import type { WorkCalendar } from '@/lib/construction-schedule-engine';
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
export interface AdditionalScheduleAuthorization {
  documentId: string;
  projectId: string;
  contractId: string | null;
  documentVersion: string;
  acceptedAt: string;
  serviceCode: string;
  serviceName: string;
  serviceLevel: string | null;
}
export interface ScheduleCommercialOptions {
  projects: ConstructionProjectOption[];
  quotes: CommercialScheduleDocument[];
  contracts: CommercialScheduleDocument[];
  links: CommercialScheduleLink[];
  additionalAuthorizations: AdditionalScheduleAuthorization[];
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
export interface CurrentScheduleState {
  id: string;
  activationStatus: 'legacy' | 'draft' | 'approved';
  revisionNumber: number;
  isCurrent: boolean;
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

// PostgREST devolve no máximo o limite por consulta; um .limit(500) silencioso
// fazia orçamentos/contratos ou vínculos existentes desaparecerem da seleção.
// Ordenação estável e páginas inclusivas permitem recuperar tudo sem duplicar
// registros; o teto defensivo produz erro explícito, nunca lista incompleta.
const PAGE_SIZE = 200;
const MAX_ROWS = 20000;
export async function loadScheduleCommercialOptions(): Promise<{ data: ScheduleCommercialOptions | null; error: string | null }> {
  const projects = await listConstructionScheduleProjects();
  if (projects.error) return { data: null, error: projects.error };

  const documents: CommercialScheduleDocument[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    if (offset >= MAX_ROWS) return { data: null, error: 'Há muitos documentos comerciais para esta consulta. Refine a seleção de cliente/projeto antes de continuar.' };
    const page = await supabase.from('commercial_records')
      .select('id,record_kind,quote_number,contract_number,status,linked_project_id,linked_client_id,linked_contract_id,services,total_value')
      .in('record_kind', ['orcamento', 'contrato'])
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (page.error) return { data: null, error: page.error.message ?? 'Não foi possível carregar todos os documentos comerciais.' };
    const rows = page.data ?? [];
    documents.push(...rows.map((row) => toDocument(row as Record<string, unknown>)));
    if (rows.length < PAGE_SIZE) break;
  }

  const links: CommercialScheduleLink[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    if (offset >= MAX_ROWS) return { data: null, error: 'Há muitos vínculos de orçamento/contrato para esta consulta. Refine a seleção antes de continuar.' };
    const page = await supabase.from('commercial_contract_quote_links')
      .select('quote_record_id,contract_record_id')
      .order('quote_record_id', { ascending: true })
      .order('contract_record_id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (page.error) return { data: null, error: page.error.message ?? 'Não foi possível carregar os vínculos comerciais.' };
    const rows = page.data ?? [];
    links.push(...rows.map((row) => ({ quoteRecordId: String(row.quote_record_id), contractRecordId: String(row.contract_record_id) })));
    if (rows.length < PAGE_SIZE) break;
  }

  const authorizations = await supabase.rpc('admin_list_full_schedule_additional_authorizations');
  const authorizationMessage = authorizations.error?.message ?? '';
  const authorizationRpcUnavailable = authorizations.error && (
    authorizations.error.code === 'PGRST202' ||
    authorizations.error.code === '42883' ||
    /admin_list_full_schedule_additional_authorizations/i.test(authorizationMessage) && /not found|could not find|does not exist/i.test(authorizationMessage)
  );
  if (authorizations.error && !authorizationRpcUnavailable) {
    return { data: null, error: authorizationMessage || 'Não foi possível carregar os Serviços Adicionais aceitos para cronograma.' };
  }
  const additionalAuthorizations: AdditionalScheduleAuthorization[] = (Array.isArray(authorizations.data) && !authorizationRpcUnavailable ? authorizations.data : []).map((row) => ({
    documentId: String(row.document_id),
    projectId: String(row.project_id),
    contractId: row.contract_id ? String(row.contract_id) : null,
    documentVersion: String(row.document_version ?? '1.0'),
    acceptedAt: String(row.accepted_at ?? ''),
    serviceCode: String(row.service_code ?? ''),
    serviceName: String(row.service_name ?? 'Cronograma completo de acompanhamento de obra'),
    serviceLevel: row.service_level ? String(row.service_level) : null,
  }));

  return { data: {
    projects: projects.data,
    quotes: documents.filter((doc) => doc.recordKind === 'orcamento'),
    contracts: documents.filter((doc) => doc.recordKind === 'contrato'),
    links,
    additionalAuthorizations,
  }, error: null };
}

export async function loadCurrentScheduleState(projectId: string): Promise<{ data: CurrentScheduleState | null; error: string | null }> {
  const result = await supabase
    .from('construction_schedules')
    .select('id,activation_status,revision_number,is_current')
    .eq('project_id', projectId)
    .eq('is_current', true)
    .maybeSingle();
  if (result.error) return { data: null, error: result.error.message ?? 'Não foi possível conferir a revisão vigente.' };
  if (!result.data) return { data: null, error: null };
  const status = String(result.data.activation_status ?? 'legacy');
  if (!['legacy', 'draft', 'approved'].includes(status)) return { data: null, error: 'Estado inválido do cronograma vigente.' };
  return { data: {
    id: String(result.data.id),
    activationStatus: status as CurrentScheduleState['activationStatus'],
    revisionNumber: Number(result.data.revision_number ?? 1),
    isCurrent: result.data.is_current === true,
  }, error: null };
}

export async function previewScheduleTemplate(projectId: string, quoteId: string, contractId: string, templateCode: string): Promise<{ data: ScheduleTemplatePreview | null; error: string | null }> {
  const result = await supabase.rpc('admin_preview_full_schedule_template', {
    p_project_id: projectId, p_quote_record_id: quoteId, p_contract_record_id: contractId, p_template_code: templateCode,
  });
  if (result.error || !result.data) return { data: null, error: result.error?.message ?? 'O escopo não pôde ser verificado.' };
  const preview = result.data as ScheduleTemplatePreview;
  if (!preview.requires_scope_confirmation || !Array.isArray(preview.items)) return { data: null, error: 'Modelo inválido: falta revisão individual das atividades.' };
  return { data: preview, error: null };
}
export async function previewScheduleTemplateFromAdditionalService(projectId: string, documentId: string, templateCode: string): Promise<{ data: ScheduleTemplatePreview | null; error: string | null }> {
  const result = await supabase.rpc('admin_preview_full_schedule_template_from_additional_service', {
    p_project_id: projectId,
    p_document_id: documentId,
    p_template_code: templateCode,
  });
  if (result.error || !result.data) return { data: null, error: result.error?.message ?? 'O Serviço Adicional aceito não pôde ser validado para o cronograma.' };
  const preview = result.data as ScheduleTemplatePreview;
  if (!preview.requires_scope_confirmation || !Array.isArray(preview.items)) return { data: null, error: 'Modelo inválido: falta revisão individual das atividades.' };
  return { data: preview, error: null };
}

export async function saveVerifiedScheduleFromAdditionalService(
  projectId: string,
  documentId: string,
  plan: Record<string, unknown>,
): Promise<{ scheduleId: string | null; error: string | null }> {
  const result = await supabase.rpc('admin_initialize_and_save_full_schedule_from_additional_service', {
    p_project_id: projectId,
    p_document_id: documentId,
    p_plan: plan,
  });
  if (result.error || !result.data) return { scheduleId: null, error: result.error?.message ?? 'Cronograma não foi criado: confira o Serviço Adicional aceito e o planejamento.' };
  return { scheduleId: String(result.data), error: null };
}

export async function saveVerifiedSchedule(
  projectId: string,
  quoteId: string,
  contractId: string,
  plan: Record<string, unknown>,
  revision?: { previousScheduleId: string; reason: string } | null,
): Promise<{ scheduleId: string | null; error: string | null }> {
  const result = revision
    ? await supabase.rpc('admin_begin_and_save_full_schedule_revision', {
        p_previous_schedule_id: revision.previousScheduleId,
        p_quote_record_id: quoteId,
        p_contract_record_id: contractId,
        p_reason: revision.reason,
        p_plan: plan,
      })
    : await supabase.rpc('admin_initialize_and_save_full_schedule', {
        p_project_id: projectId, p_quote_record_id: quoteId, p_contract_record_id: contractId, p_plan: plan,
      });
  if (result.error || !result.data) return { scheduleId: null, error: result.error?.message ?? 'Cronograma não foi criado: verifique escopo e planejamento.' };
  return { scheduleId: String(result.data), error: null };
}
export async function approveVerifiedSchedule(scheduleId: string): Promise<string | null> {
  const result = await supabase.from('construction_schedules').update({ activation_status: 'approved' }).eq('id', scheduleId).select('id').single();
  return result.error?.message ?? null;
}

export async function exportApprovedScheduleXlsx(scheduleId: string): Promise<string | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(scheduleId)) {
    return 'Identificador do cronograma inválido.';
  }
  const result = await supabase.functions.invoke('generate-verified-construction-schedule-xlsx', { body: { scheduleId } });
  if (result.error || result.data?.generated !== true || typeof result.data?.contentBase64 !== 'string') {
    return typeof result.data?.error === 'string' ? result.data.error : result.error?.message ?? 'Não foi possível extrair o Excel do cronograma aprovado.';
  }
  try {
    await downloadBase64File(result.data.contentBase64, String(result.data.fileName ?? 'Cronograma-Aprovado.xlsx'));
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Excel gerado, mas não foi possível abrir o download.';
  }
}


export interface TestScheduleExportItem {
  code: string;
  activity: string;
  predecessorCode: string | null;
  plannedStart: string;
  plannedFinish: string;
  durationDays: number;
  plannedCost: number;
  weightPercent: number;
  quantity: number | null;
  unit: string | null;
  unitCost: number | null;
  actualProgress: number;
}

export async function exportTestScheduleXlsx(input: {
  revision: number;
  startDate: string;
  finishDate: string;
  calendar: WorkCalendar;
  notes?: string;
  items: TestScheduleExportItem[];
}): Promise<string | null> {
  if (!input.items.length || input.items.length > 200) return 'O teste precisa ter entre 1 e 200 atividades.';
  const result = await supabase.functions.invoke('generate-construction-schedule-test-xlsx', {
    body: { testMode: true, ...input },
  });
  if (result.error || result.data?.generated !== true || typeof result.data?.contentBase64 !== 'string') {
    return typeof result.data?.error === 'string'
      ? result.data.error
      : result.error?.message ?? 'Não foi possível gerar o Excel do cronograma de teste.';
  }
  try {
    await downloadBase64File(result.data.contentBase64, String(result.data.fileName ?? 'Cronograma-TESTE-NAO-CONTRATUAL.xlsx'));
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Excel de teste gerado, mas o download não pôde ser aberto.';
  }
}
