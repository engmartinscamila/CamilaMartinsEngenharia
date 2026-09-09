import { isValidIsoDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { DocumentPickerAsset } from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import type {
  AutomationRunSummary,
  FinancialAccountSummary,
  FiscalDocumentSummary,
  ProjectFinancialSummary,
  ProjectPortalSettings,
  ProjectTaskSummary,
  PurchaseQuoteSummary,
  ServiceResult,
  SupplierSummary,
  TaskPriority,
  TaskStatus,
  TaskTemplateSummary,
  TimesheetSummary,
  WorkDiarySummary,
} from '@/types/domain';

function failure<T>(data: T, message: string): ServiceResult<T> {
  return { data, error: message };
}

export async function updateCrmRecord(input: {
  id: string;
  stage: string;
  priority?: string;
  nextActionAt?: string | null;
  lostReason?: string | null;
}) {
  if (!['novo', 'qualificacao', 'proposta', 'negociacao', 'ganho', 'perdido'].includes(input.stage)) return 'Selecione uma etapa comercial válida.';
  if (input.nextActionAt && !Number.isFinite(Date.parse(input.nextActionAt))) return 'Informe uma data válida para a próxima ação.';
  if (input.stage === 'perdido' && !input.lostReason?.trim()) return 'Informe o motivo da perda.';
  const result = await supabase.from('commercial_records').update({
    crm_stage: input.stage,
    crm_priority: input.priority ?? 'normal',
    next_action_at: input.nextActionAt || null,
    lost_reason: input.stage === 'perdido' ? input.lostReason?.trim() || null : null,
  }).eq('id', input.id).select('id').maybeSingle();
  return result.error || !result.data ? 'Não foi possível atualizar a etapa comercial. Atualize a lista e confira seu acesso.' : null;
}

export async function listProjectTasks(projectId: string): Promise<ServiceResult<ProjectTaskSummary[]>> {
  const [tasks, dependencies] = await Promise.all([
    supabase.from('project_tasks').select('*').eq('project_id', projectId).order('position').order('due_date'),
    supabase.from('project_task_dependencies').select('task_id,depends_on_task_id'),
  ]);
  if (tasks.error) return failure([], 'Não foi possível carregar as tarefas do projeto.');
  const dependencyMap = new Map<string, string[]>();
  for (const row of dependencies.data ?? []) {
    dependencyMap.set(row.task_id, [...(dependencyMap.get(row.task_id) ?? []), row.depends_on_task_id]);
  }
  return {
    data: (tasks.data ?? []).map((row) => ({
      id: row.id,
      projectId: row.project_id,
      parentTaskId: row.parent_task_id,
      title: row.title,
      description: row.description,
      status: row.status as TaskStatus,
      priority: row.priority as TaskPriority,
      startDate: row.start_date,
      dueDate: row.due_date,
      completedAt: row.completed_at,
      estimatedHours: row.estimated_hours === null ? null : Number(row.estimated_hours),
      weight: Number(row.weight ?? 1),
      clientVisible: row.client_visible === true,
      position: Number(row.position ?? 0),
      dependencyIds: dependencyMap.get(row.id) ?? [],
    })),
    error: dependencies.error ? 'As dependências não puderam ser carregadas.' : null,
  };
}

export async function createProjectTask(input: {
  projectId: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  startDate?: string;
  dueDate?: string;
  estimatedHours?: number | null;
  weight?: number;
  clientVisible: boolean;
  parentTaskId?: string | null;
  dependencyId?: string | null;
}) {
  const inserted = await supabase.from('project_tasks').insert({
    project_id: input.projectId,
    parent_task_id: input.parentTaskId || null,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    priority: input.priority,
    start_date: input.startDate || null,
    due_date: input.dueDate || null,
    estimated_hours: input.estimatedHours ?? null,
    weight: input.weight ?? 1,
    client_visible: input.clientVisible,
  }).select('id').single();
  if (inserted.error || !inserted.data) return 'Não foi possível criar a tarefa.';
  if (input.dependencyId) {
    const dependency = await supabase.from('project_task_dependencies').insert({
      task_id: inserted.data.id,
      depends_on_task_id: input.dependencyId,
    });
    if (dependency.error) {
      await supabase.from('project_tasks').delete().eq('id', inserted.data.id);
      return 'A tarefa foi revertida porque a dependência não pôde ser registrada.';
    }
  }
  return null;
}

export async function updateProjectTask(input: {
  id: string;
  status?: TaskStatus;
  clientVisible?: boolean;
  position?: number;
}) {
  const payload: Record<string, unknown> = {};
  if (input.status) {
    payload.status = input.status;
    payload.completed_at = input.status === 'done' ? new Date().toISOString() : null;
  }
  if (typeof input.clientVisible === 'boolean') payload.client_visible = input.clientVisible;
  if (typeof input.position === 'number') payload.position = input.position;
  const result = await supabase.from('project_tasks').update(payload).eq('id', input.id).select('id').maybeSingle();
  return result.error || !result.data ? 'Não foi possível atualizar a tarefa. Atualize a lista e confira seu acesso.' : null;
}

export async function listTaskTemplates(): Promise<ServiceResult<TaskTemplateSummary[]>> {
  const result = await supabase.from('task_templates').select('id,name,description,task_template_items(count)').eq('active', true).order('name');
  if (result.error) return failure([], 'Não foi possível carregar os modelos de tarefas.');
  return {
    data: (result.data ?? []).map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      itemCount: Number((Array.isArray(row.task_template_items) ? row.task_template_items[0] : row.task_template_items)?.count ?? 0),
    })),
    error: null,
  };
}

export async function saveTaskTemplate(name: string, description: string, tasks: ProjectTaskSummary[]) {
  const template = await supabase.from('task_templates').insert({
    name: name.trim(),
    description: description.trim() || null,
  }).select('id').single();
  if (template.error || !template.data) return 'Não foi possível criar o modelo.';
  const items = tasks.filter((task) => task.status !== 'cancelled').map((task, index) => ({
    template_id: template.data.id,
    title: task.title,
    description: task.description,
    offset_days: 0,
    duration_days: task.startDate && task.dueDate
      ? Math.max(1, Math.ceil((new Date(task.dueDate).getTime() - new Date(task.startDate).getTime()) / 86_400_000) + 1)
      : 1,
    priority: task.priority,
    weight: task.weight,
    client_visible: task.clientVisible,
    position: index,
  }));
  const insert = items.length ? await supabase.from('task_template_items').insert(items) : null;
  if (insert?.error) {
    await supabase.from('task_templates').delete().eq('id', template.data.id);
    return 'O modelo foi revertido porque os itens não puderam ser salvos.';
  }
  return null;
}

export async function applyTaskTemplate(templateId: string, projectId: string, startDate: string) {
  const result = await supabase.rpc('admin_apply_task_template', {
    p_template_id: templateId,
    p_project_id: projectId,
    p_start_date: startDate,
  });
  return result.error ? 'Não foi possível aplicar o modelo ao projeto.' : null;
}

export async function listWorkDiary(projectId: string): Promise<ServiceResult<WorkDiarySummary[]>> {
  const result = await supabase.from('work_diary_entries').select('*').eq('project_id', projectId).order('entry_date', { ascending: false });
  if (result.error) return failure([], 'Não foi possível carregar o diário de obra.');
  return {
    data: (result.data ?? []).map((row) => ({
      id: row.id,
      projectId: row.project_id,
      entryDate: row.entry_date,
      weather: row.weather,
      teamCount: row.team_count,
      activities: row.activities,
      occurrences: row.occurrences,
      materials: row.materials,
      nextSteps: row.next_steps,
      voiceTranscript: row.voice_transcript,
      clientVisible: row.client_visible === true,
      createdAt: row.created_at,
    })),
    error: null,
  };
}

export async function createWorkDiaryEntry(input: {
  projectId: string;
  entryDate: string;
  weather?: string;
  teamCount?: number | null;
  activities: string;
  occurrences?: string;
  materials?: string;
  nextSteps?: string;
  voiceTranscript?: string;
  clientVisible: boolean;
}) {
  const result = await supabase.from('work_diary_entries').upsert({
    project_id: input.projectId,
    entry_date: input.entryDate,
    weather: input.weather?.trim() || null,
    team_count: input.teamCount ?? null,
    activities: input.activities.trim(),
    occurrences: input.occurrences?.trim() || null,
    materials: input.materials?.trim() || null,
    next_steps: input.nextSteps?.trim() || null,
    voice_transcript: input.voiceTranscript?.trim() || null,
    client_visible: input.clientVisible,
  }, { onConflict: 'project_id,entry_date,created_by' });
  return result.error ? 'Não foi possível salvar o diário de obra.' : null;
}

export async function listSuppliers(): Promise<ServiceResult<SupplierSummary[]>> {
  const result = await supabase.from('suppliers').select('*').order('name');
  if (result.error) return failure([], 'Não foi possível carregar os fornecedores.');
  return {
    data: (result.data ?? []).map((row) => ({
      id: row.id, name: row.name, cpfCnpj: row.cpf_cnpj, email: row.email,
      phone: row.phone, category: row.category, active: row.active,
    })),
    error: null,
  };
}

export async function createSupplier(input: { name: string; cpfCnpj?: string; email?: string; phone?: string; category?: string }) {
  const result = await supabase.from('suppliers').insert({
    name: input.name.trim(), cpf_cnpj: input.cpfCnpj?.trim() || null,
    email: input.email?.trim().toLowerCase() || null, phone: input.phone?.trim() || null,
    category: input.category?.trim() || null,
  });
  return result.error ? 'Não foi possível cadastrar o fornecedor.' : null;
}

export async function listPurchaseQuotes(projectId?: string): Promise<ServiceResult<PurchaseQuoteSummary[]>> {
  let query = supabase.from('purchase_quotes').select('*,purchase_quote_items(count),supplier_bids(id,quote_id,supplier_id,total_amount,lead_time_days,payment_terms,notes,suppliers(name))').order('created_at', { ascending: false });
  if (projectId) query = query.eq('project_id', projectId);
  const result = await query;
  if (result.error) return failure([], 'Não foi possível carregar as cotações.');
  return {
    data: (result.data ?? []).map((row: any) => ({
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      description: row.description,
      status: row.status,
      dueDate: row.due_date,
      selectedSupplierId: row.selected_supplier_id,
      clientVisible: row.client_visible === true,
      itemCount: Number((Array.isArray(row.purchase_quote_items) ? row.purchase_quote_items[0] : row.purchase_quote_items)?.count ?? 0),
      bids: (row.supplier_bids ?? []).map((bid: any) => ({
        id: bid.id, quoteId: bid.quote_id, supplierId: bid.supplier_id,
        supplierName: (Array.isArray(bid.suppliers) ? bid.suppliers[0] : bid.suppliers)?.name ?? 'Fornecedor',
        totalAmount: Number(bid.total_amount), leadTimeDays: bid.lead_time_days,
        paymentTerms: bid.payment_terms, notes: bid.notes,
      })).sort((a: { totalAmount: number }, b: { totalAmount: number }) => a.totalAmount - b.totalAmount),
    })),
    error: null,
  };
}

export async function createPurchaseQuote(input: {
  projectId: string;
  title: string;
  description?: string;
  dueDate?: string;
  itemDescription: string;
  quantity: number;
  unit: string;
}) {
  const quote = await supabase.from('purchase_quotes').insert({
    project_id: input.projectId, title: input.title.trim(), description: input.description?.trim() || null,
    due_date: input.dueDate || null, status: 'collecting',
  }).select('id').single();
  if (quote.error || !quote.data) return 'Não foi possível abrir a cotação.';
  const item = await supabase.from('purchase_quote_items').insert({
    quote_id: quote.data.id, description: input.itemDescription.trim(),
    quantity: input.quantity, unit: input.unit.trim() || 'un',
  });
  if (item.error) {
    await supabase.from('purchase_quotes').delete().eq('id', quote.data.id);
    return 'A cotação foi revertida porque o item não pôde ser salvo.';
  }
  return null;
}

export async function addSupplierBid(input: {
  quoteId: string;
  supplierId: string;
  totalAmount: number;
  leadTimeDays?: number | null;
  paymentTerms?: string;
  notes?: string;
}) {
  const result = await supabase.from('supplier_bids').upsert({
    quote_id: input.quoteId, supplier_id: input.supplierId, total_amount: input.totalAmount,
    lead_time_days: input.leadTimeDays ?? null, payment_terms: input.paymentTerms?.trim() || null,
    notes: input.notes?.trim() || null,
  }, { onConflict: 'quote_id,supplier_id' });
  return result.error ? 'Não foi possível registrar a proposta do fornecedor.' : null;
}

export async function selectSupplierBid(quoteId: string, supplierId: string) {
  const result = await supabase.from('purchase_quotes').update({
    selected_supplier_id: supplierId, status: 'approved',
  }).eq('id', quoteId).select('id').maybeSingle();
  return result.error || !result.data ? 'Não foi possível aprovar a proposta. Atualize a lista e confira seu acesso.' : null;
}

export async function listProjectFinancialSummaries(): Promise<ServiceResult<ProjectFinancialSummary[]>> {
  const result = await supabase.from('project_financial_summary').select('*').order('project_name');
  if (result.error) return failure([], 'Não foi possível montar a visão financeira por projeto.');
  return {
    data: (result.data ?? []).map((row) => ({
      projectId: row.project_id, projectName: row.project_name, contractNumber: row.contract_number,
      contractValue: row.contract_value === null ? null : Number(row.contract_value),
      received: Number(row.received ?? 0), receivable: Number(row.receivable ?? 0),
      paidCosts: Number(row.paid_costs ?? 0), payable: Number(row.payable ?? 0),
      hours: Number(row.hours ?? 0), laborCost: Number(row.labor_cost ?? 0),
    })),
    error: null,
  };
}

export async function listFinancialAccounts(): Promise<ServiceResult<FinancialAccountSummary[]>> {
  const result = await supabase.from('financial_accounts').select('*').eq('active', true).order('name');
  if (result.error) return failure([], 'Não foi possível carregar as contas financeiras.');
  return { data: (result.data ?? []).map((row) => ({
    id: row.id, name: row.name, accountType: row.account_type,
    openingBalance: Number(row.opening_balance ?? 0), active: row.active,
  })), error: null };
}

export async function createFinancialAccount(name: string, accountType: 'bank' | 'cash' | 'credit', openingBalance: number) {
  const result = await supabase.from('financial_accounts').insert({
    name: name.trim(), account_type: accountType, opening_balance: openingBalance,
  });
  return result.error ? 'Não foi possível cadastrar a conta financeira.' : null;
}

function ofxField(block: string, name: string) {
  return block.match(new RegExp(`<${name}>([^<\\r\\n]+)`, 'i'))?.[1]?.trim() ?? '';
}

async function readTextAsset(asset: DocumentPickerAsset) {
  if (Platform.OS === 'web' && asset.file) return asset.file.text();
  return FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
}

export async function importOfxTransactions(accountId: string, asset: DocumentPickerAsset) {
  try {
    if (asset.size && asset.size > 5 * 1024 * 1024) return { imported: 0, reconciled: 0, error: 'O arquivo OFX excede 5 MB.' };
    const text = await readTextAsset(asset);
    const blocks = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi)
      ?? text.split(/<STMTTRN>/i).slice(1).map((part) => `<STMTTRN>${part.split(/<\/BANKTRANLIST>/i)[0]}`);
    const transactions = blocks.map((block, index) => {
      const rawAmount = Number(ofxField(block, 'TRNAMT').replace(',', '.'));
      const rawDate = ofxField(block, 'DTPOSTED').slice(0, 8);
      const type = ofxField(block, 'TRNTYPE').toUpperCase();
      const external = ofxField(block, 'FITID') || `${rawDate}-${rawAmount}-${index}`;
      const description = ofxField(block, 'MEMO') || ofxField(block, 'NAME') || 'Transação importada';
      return {
        account_id: accountId,
        external_id: external,
        transaction_date: `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`,
        description,
        amount: rawAmount,
        transaction_type: type === 'XFER' ? 'transfer' : rawAmount >= 0 ? 'credit' : 'debit',
      };
    }).filter((row) => Number.isFinite(row.amount) && isValidIsoDate(row.transaction_date));
    if (!transactions.length) return { imported: 0, reconciled: 0, error: 'Nenhuma transação válida foi encontrada no OFX.' };
    const uniqueTransactions = [...new Map(transactions.map((row) => [row.external_id, row])).values()];
    if (uniqueTransactions.length > 2000) return { imported: 0, reconciled: 0, error: 'Importe até 2000 transações por arquivo.' };
    const before = await supabase.from('bank_transactions').select('external_id').eq('account_id', accountId).in('external_id', transactions.map((row) => row.external_id));
    if (before.error) return { imported: 0, reconciled: 0, error: 'Não foi possível conferir as transações existentes.' };
    const known = new Set((before.data ?? []).map((row) => row.external_id));
    const insert = await supabase.from('bank_transactions').upsert(uniqueTransactions, { onConflict: 'account_id,external_id', ignoreDuplicates: true });
    if (insert.error) return { imported: 0, reconciled: 0, error: 'Não foi possível importar o arquivo OFX.' };

    const imported = uniqueTransactions.filter((row) => !known.has(row.external_id)).length;
    const result = await supabase.rpc('reconcile_imported_ofx', {
      p_account_id: accountId, p_external_ids: uniqueTransactions.map((row) => row.external_id),
    });
    if (result.error || typeof result.data !== 'number') return { imported, reconciled: 0, error: `${imported} nova(s) transação(ões) importada(s). A conciliação não foi concluída; tente importar novamente sem duplicar registros.` };
    return { imported, reconciled: result.data, error: null };
  } catch {
    return { imported: 0, reconciled: 0, error: 'O arquivo OFX não pôde ser lido.' };
  }
}

export async function listTimesheets(projectId?: string): Promise<ServiceResult<TimesheetSummary[]>> {
  let query = supabase.from('timesheets').select('*').order('work_date', { ascending: false });
  if (projectId) query = query.eq('project_id', projectId);
  const result = await query.limit(300);
  if (result.error) return failure([], 'Não foi possível carregar as horas.');
  return { data: (result.data ?? []).map((row) => ({
    id: row.id, projectId: row.project_id, workDate: row.work_date,
    hours: Number(row.hours), hourlyCost: Number(row.hourly_cost),
    description: row.description, billable: row.billable,
  })), error: null };
}

export async function createTimesheet(input: {
  projectId: string; workDate: string; hours: number; hourlyCost: number; description: string;
}) {
  const result = await supabase.from('timesheets').insert({
    project_id: input.projectId, work_date: input.workDate, hours: input.hours,
    hourly_cost: input.hourlyCost, description: input.description.trim(),
  });
  return result.error ? 'Não foi possível registrar as horas.' : null;
}

export async function listFiscalDocuments(): Promise<ServiceResult<FiscalDocumentSummary[]>> {
  const result = await supabase.from('fiscal_documents').select('*').order('created_at', { ascending: false });
  if (result.error) return failure([], 'Não foi possível carregar os documentos fiscais.');
  return { data: (result.data ?? []).map((row) => ({
    id: row.id, projectId: row.project_id, status: row.status, provider: row.provider,
    externalId: row.external_id, description: row.description, amount: Number(row.amount),
    issuedAt: row.issued_at, errorMessage: row.error_message,
  })), error: null };
}

export async function createFiscalDocument(input: { projectId: string; description: string; amount: number; serviceCode?: string }) {
  const result = await supabase.from('fiscal_documents').insert({
    project_id: input.projectId, description: input.description.trim(), amount: input.amount,
    service_code: input.serviceCode?.trim() || null, status: 'ready',
  });
  return result.error ? 'Não foi possível preparar o documento fiscal.' : null;
}

const defaultPortalSettings = (projectId: string): ProjectPortalSettings => ({
  projectId,
  showDocuments: true, showPhotos: true, showLibrary: true, showAgenda: true,
  showSchedule: true, showApprovals: true, showRequests: true, showTasks: true, showWorkDiary: true,
});

export async function getProjectPortalSettings(projectId: string): Promise<ServiceResult<ProjectPortalSettings>> {
  const result = await supabase.from('project_portal_settings').select('*').eq('project_id', projectId).maybeSingle();
  if (result.error || !result.data) return failure(defaultPortalSettings(projectId), 'A configuração personalizada do portal não pôde ser carregada.');
  const row = result.data;
  return { data: {
    projectId: row.project_id,
    showDocuments: row.show_documents, showPhotos: row.show_photos, showLibrary: row.show_library,
    showAgenda: row.show_agenda, showSchedule: row.show_schedule, showApprovals: row.show_approvals,
    showRequests: row.show_requests, showTasks: row.show_tasks, showWorkDiary: row.show_work_diary,
  }, error: null };
}

export async function updateProjectPortalSettings(settings: ProjectPortalSettings) {
  const result = await supabase.from('project_portal_settings').upsert({
    project_id: settings.projectId,
    show_documents: settings.showDocuments, show_photos: settings.showPhotos,
    show_library: settings.showLibrary, show_agenda: settings.showAgenda,
    show_schedule: settings.showSchedule, show_approvals: settings.showApprovals,
    show_requests: settings.showRequests, show_tasks: settings.showTasks,
    show_work_diary: settings.showWorkDiary, updated_at: new Date().toISOString(),
  });
  return result.error ? 'Não foi possível atualizar o que o cliente enxerga.' : null;
}

export async function listAutomationRuns(): Promise<ServiceResult<AutomationRunSummary[]>> {
  const result = await supabase.from('system_automation_runs').select('*').order('started_at', { ascending: false }).limit(30);
  if (result.error) return failure([], 'Não foi possível carregar o histórico das automações.');
  return { data: (result.data ?? []).map((row) => ({
    id: row.id, jobName: row.job_name, status: row.status,
    metrics: row.metrics as Record<string, number>, errorMessage: row.error_message,
    startedAt: row.started_at, finishedAt: row.finished_at,
  })), error: null };
}

export async function runOperationalReminders() {
  const result = await supabase.rpc('admin_run_operational_reminders');
  return result.error ? 'Não foi possível executar a automação agora.' : null;
}
