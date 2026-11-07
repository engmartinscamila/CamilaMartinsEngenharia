import { readAllRows } from '@/lib/paginated-query';

import { normalizeStatus } from '@/lib/format';


import { isMissingRelationError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { dispatchPendingPushNotifications } from '@/services/push-service';
import type {
  AdminClientSummary,
  AdminContractSummary,
  AdminNotificationSummary,
  AdminProjectSummary,
  AdminRequestSummary,
  AgendaSummary,
  ApprovalSummary,
  AuditEntrySummary,
  ClientDeletionPreview,
  ScheduleStageSummary,
  ServiceResult,
  StorageOverview,
  StorageOrphanDetails,
} from '@/types/domain';

function compatibilityError(error: { code?: string; message?: string } | null) {
  return Boolean(error && (isMissingRelationError(error) || ['42703', '42883', 'PGRST200', 'PGRST202', 'PGRST204'].includes(error.code ?? '')));
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : null;
}

export async function listAdminClients(search = ''): Promise<ServiceResult<AdminClientSummary[]>> {
  let query = supabase.from('clientes').select('id, nome, email, telefone, status, auth_id, created_at').order('nome');
  const term=search.trim().replace(/[(),.%_]/g,' ');
  if (term) query = query.or(`nome.ilike.%${term}%,email.ilike.%${term}%`);
  const result = await readAllRows(query);
  if (result.error) return { data: [], error: 'Não foi possível carregar os clientes.' };
  return {
    data: (result.data ?? []).map((row) => ({
      id: row.id,
      name: row.nome,
      email: row.email,
      phone: row.telefone,
      status: row.status,
      authId: row.auth_id,
      createdAt: row.created_at,
    })),
    error: null,
  };
}

async function sendClientAccess(input: { clientId?: string; name?: string; email?: string; phone?: string }) {
  const { data, error } = await supabase.functions.invoke('admin-invite-client', { body: input });
  if (error) {
    try {
      const details = await error.context?.json();
      if (details?.error) return String(details.error);
    } catch { /* No structured response available. */ }
    return 'Não foi possível enviar o e-mail de acesso. Tente novamente.';
  }
  return data?.invitationSent === true ? null : String(data?.error || data?.message || 'O envio não foi confirmado.');
}

export async function inviteAdminClient(input: { name: string; email: string; phone?: string }) {
  return sendClientAccess(input);
}

export async function updateAdminClientStatus(clientId: string, status: 'ativo' | 'arquivado' | 'acesso_revogado') {
  const result = await supabase.rpc('admin_set_client_status', { p_cliente_id: clientId, p_status: status });
  return result.error || result.data !== true ? 'A atualização segura não está disponível neste ambiente. Verifique as funções administrativas do banco.' : null;
}

export async function updateAdminClientProfile(clientId: string, input: { name: string; phone?: string }) {
  const result = await supabase.from('clientes').update({ nome: input.name.trim(), telefone: input.phone?.trim() || null }).eq('id', clientId).select('id').maybeSingle();
  return result.error || !result.data ? 'Não foi possível atualizar o cadastro do cliente.' : null;
}

export async function resendAdminClientInvite(clientId: string) {
  return sendClientAccess({ clientId });
}

export async function sendAdminClientRecovery(clientId: string) {
  return sendClientAccess({ clientId });
}

export async function previewPermanentClientDeletion(clientId: string): Promise<ServiceResult<ClientDeletionPreview | null>> {
  const result = await supabase.functions.invoke('admin-delete-client', { body: { clientId, action: 'preview' } });
  if (result.error || !result.data?.preview) return { data: null, error: 'A prévia segura de exclusão não está disponível. Verifique a função administrativa de exclusão.' };
  const raw = result.data.preview;
  return { data: {
    id: raw.id,
    name: raw.name,
    email: raw.email ?? null,
    status: raw.status,
    contracts: Number(raw.contracts ?? 0),
    projects: Number(raw.projects ?? 0),
    documents: Number(raw.documents ?? 0),
    photos: Number(raw.photos ?? 0),
    libraryItems: Number(raw.libraryItems ?? 0),
    financialEntries: Number(raw.financialEntries ?? 0),
    ledgerEntries: Number(raw.ledgerEntries ?? 0),
    contractedValue: Number(raw.contractedValue ?? 0),
    alreadyArchived: Number(raw.alreadyArchived ?? 0),
    storageObjects: Number(raw.storageObjects ?? 0),
  }, error: null };
}

export async function requestPermanentClientDeletion(clientId: string, confirmation: string) {
  const result = await supabase.functions.invoke('admin-delete-client', { body: { clientId, confirmation, action: 'delete' } });
  return result.error || !result.data?.deleted ? 'Não foi possível concluir a exclusão segura. Nenhuma exclusão deve ser repetida antes de conferir a auditoria.' : null;
}

export async function listAdminProjects(): Promise<ServiceResult<AdminProjectSummary[]>> {
  const modern = await readAllRows(supabase
    .from('projetos')
    .select('id, cliente_id, contract_id, nome, tipo, status, progress_percent, cidade_obra, estado_obra, clientes(nome), contratos!contract_id(id, contract_number, cliente_id, service_type, status, contract_value, currency)')
    .order('created_at', { ascending: false })
    );

  if (!modern.error) {
    return {
      data: (modern.data ?? []).map((row: any) => {
        const client = Array.isArray(row.clientes) ? row.clientes[0] : row.clientes;
        const contract = Array.isArray(row.contratos) ? row.contratos[0] : row.contratos;
        return {
          id: row.id,
          clientId: row.cliente_id,
          clientName: client?.nome ?? 'Cliente não informado',
          contractId: row.contract_id,
          contractNumber: contract?.contract_number ?? 'Contrato não informado',
          name: row.nome,
          serviceType: row.tipo ?? contract?.service_type ?? null,
          status: row.status,
          progress: numberOrNull(row.progress_percent),
          city: row.cidade_obra,
          state: row.estado_obra,
          contract: contract
            ? { id: contract.id, contractNumber: contract.contract_number, clientId: contract.cliente_id, serviceType: contract.service_type, status: contract.status, contractValue: Number.isFinite(Number(contract.contract_value)) ? Number(contract.contract_value) : null, currency: contract.currency ?? 'BRL' }
            : null,
        } satisfies AdminProjectSummary;
      }),
      error: null,
    };
  }

  if (!compatibilityError(modern.error)) return { data: [], error: 'Não foi possível carregar os projetos.' };
  const legacy = await readAllRows(supabase
    .from('projetos')
    .select('id, cliente_id, nome, tipo, status, cidade_obra, estado_obra, numero_contrato, clientes(nome)')
    .order('created_at', { ascending: false })
    );
  if (legacy.error) return { data: [], error: 'Não foi possível carregar os projetos.' };
  return {
    data: (legacy.data ?? []).map((row: any) => ({
      id: row.id,
      clientId: row.cliente_id,
      clientName: (Array.isArray(row.clientes) ? row.clientes[0] : row.clientes)?.nome ?? 'Cliente não informado',
      contractId: null,
      contractNumber: row.numero_contrato || 'Contrato a revisar',
      name: row.nome,
      serviceType: row.tipo,
      status: row.status,
      progress: null,
      city: row.cidade_obra,
      state: row.estado_obra,
      contract: null,
    })),
    error: null,
  };
}

export async function listAdminContracts(): Promise<ServiceResult<AdminContractSummary[]>> {
  const result = await readAllRows(supabase
    .from('contratos')
    .select('id, cliente_id, contract_number, service_type, status, contract_value, currency, clientes(nome)')
    .order('contract_number')
    );
  if (result.error) return { data: [], error: 'Não foi possível carregar os contratos.' };
  return {
    data: (result.data ?? []).map((row: any) => ({
      id: row.id,
      clientId: row.cliente_id,
      clientName: (Array.isArray(row.clientes) ? row.clientes[0] : row.clientes)?.nome ?? 'Cliente não informado',
      contractNumber: row.contract_number,
      serviceType: row.service_type,
      status: row.status,
      contractValue: row.contract_value === null ? null : Number(row.contract_value),
      currency: row.currency ?? 'BRL',
    })),
    error: null,
  };
}

export async function createAdminProjectDraft(input: {
  clientId: string; projectName: string; serviceType?: string; address: string;
  number?: string; neighborhood?: string; quoteNumber?: string; city?: string; state?: string;
}) {
  const result = await supabase.rpc('admin_create_project_draft', {
    p_client_id: input.clientId,
    p_project: { name: input.projectName.trim(), service_type: input.serviceType?.trim() || null,
      address: input.address.trim(), number: input.number?.trim() || null,
      neighborhood: input.neighborhood?.trim() || null, quote_number: input.quoteNumber?.trim() || null,
      city: input.city?.trim() || null, state: input.state?.trim().toUpperCase() || null },
  });
  return result.error ? 'Não foi possível cadastrar o projeto. Confira o cliente ativo, nome e endereço da obra.' : null;
}

export async function createAdminContractProject(input: {
  clientId: string;
  contractNumber: string;
  projectName: string;
  serviceType: string;
  contractValue: number;
  city?: string;
  state?: string;
}) {
  const result = await supabase.rpc('admin_create_contract_project_v2', {
    p_cliente_id: input.clientId,
    p_contract_number: input.contractNumber.trim(),
    p_project_name: input.projectName.trim(),
    p_service_type: input.serviceType.trim(),
    p_contract_value: input.contractValue,
    p_city: input.city?.trim() || null,
    p_state: input.state?.trim().toUpperCase() || null,
  });
  return result.error ? 'Não foi possível criar o contrato e o projeto com segurança neste ambiente.' : null;
}

export async function createAdminProjectForContract(input: { contractId: string; projectName: string; city?: string; state?: string }) {
  const result = await supabase.rpc('admin_create_project_for_contract', {
    p_contract_id: input.contractId,
    p_project_name: input.projectName.trim(),
    p_city: input.city?.trim() || null,
    p_state: input.state?.trim().toUpperCase() || null,
  });
  return result.error ? 'Não foi possível criar o projeto dentro deste contrato.' : null;
}

export async function updateAdminProject(input: { projectId: string; status: string; progress: number | null }) {
  const modern = await supabase.from('projetos').update({ status: input.status, progress_percent: input.progress }).eq('id', input.projectId).select('id').maybeSingle();
  if (!modern.error && modern.data) {
    void dispatchPendingPushNotifications();
    return null;
  }
  if (!compatibilityError(modern.error)) return 'Não foi possível atualizar o projeto.';
  const legacy = await supabase.from('projetos').update({ status: input.status }).eq('id', input.projectId).select('id').maybeSingle();
  return legacy.error || !legacy.data ? 'Não foi possível atualizar o projeto.' : null;
}

// API pública mantida para todos os consumidores existentes.
export {
  listAdminContent,
  uploadAdminContent,
  createAdminContentSignedUrl,
  deleteAdminContent,
} from './admin-content-service';

export async function listAdminAgenda(): Promise<ServiceResult<AgendaSummary[]>> {
  const result = await readAllRows(supabase.from('agenda').select('id, projeto_id, titulo, descricao, data, horario, horario_fim, tipo, status_convite, google_meet_url, cancelado').order('data', { ascending: true }));
  if (result.error) return { data: [], error: 'Não foi possível carregar a agenda.' };
  return { data: (result.data ?? []).map((row) => ({ id: row.id, projectId: row.projeto_id, title: row.titulo, description: row.descricao, date: row.data, startTime: row.horario, endTime: row.horario_fim, eventType: row.tipo, invitationStatus: row.status_convite ?? 'needsAction', meetingUrl: row.google_meet_url, cancelled: row.cancelado === true })), error: null };
}

export async function createAdminAgenda(input: { project: AdminProjectSummary; title: string; date: string; time?: string; description?: string }) {
  const result = await supabase.from('agenda').insert({ cliente_id: input.project.clientId, projeto_id: input.project.id, titulo: input.title.trim(), descricao: input.description?.trim() || null, data: input.date, horario: input.time || null, criado_por_admin: true, cancelado: false });
  if (result.error) return 'Não foi possível criar o compromisso.';
  void dispatchPendingPushNotifications();
  return null;
}

export async function cancelAdminAgenda(id: string) {
  const result = await supabase.from('agenda').update({ cancelado: true, status_convite: 'cancelled' }).eq('id', id).select('id').maybeSingle();
  if (result.error || !result.data) return 'O compromisso não foi cancelado. Atualize a lista e tente novamente.';
  void dispatchPendingPushNotifications();
  return null;
}

export async function listAdminSchedule(projectId?: string): Promise<ServiceResult<ScheduleStageSummary[]>> {
  let query = supabase.from('cronograma').select('id, projeto_id, nome, descricao, data_inicio, data_fim, status, peso_percentual, percentual_conclusao, ordem').order('ordem');
  if (projectId) query = query.eq('projeto_id', projectId);
  const result = await readAllRows(query);
  if (result.error) return { data: [], error: 'Não foi possível carregar o cronograma.' };
  return { data: (result.data ?? []).map((row) => ({ id: row.id, projectId: row.projeto_id, title: row.nome, description: row.descricao, startDate: row.data_inicio, endDate: row.data_fim, status: normalizeStatus(row.status) || 'pendente', progress: numberOrNull(row.percentual_conclusao), weight: numberOrNull(row.peso_percentual), order: Number(row.ordem ?? 0) })), error: null };
}

export async function createAdminScheduleStage(input: { project: AdminProjectSummary; title: string; startDate?: string; endDate?: string; order: number }) {
  const result = await supabase.from('cronograma').insert({ cliente_id: input.project.clientId, projeto_id: input.project.id, nome: input.title.trim(), data_inicio: input.startDate || null, data_fim: input.endDate || null, status: 'pendente', percentual_conclusao: 0, ordem: input.order });
  if (result.error) return 'Não foi possível criar a etapa.';
  void dispatchPendingPushNotifications();
  return null;
}

export async function updateAdminScheduleStage(id: string, status: string, progress: number) {
  const normalized = normalizeStatus(status);
  if (!['pendente', 'em_andamento', 'concluido', 'pausado', 'cancelado'].includes(normalized) || !Number.isFinite(progress) || progress < 0 || progress > 100) return 'Revise o andamento e o progresso da etapa.';
  const result = await supabase.from('cronograma').update({ status: normalized, percentual_conclusao: normalized === 'concluido' ? 100 : progress }).eq('id', id).select('id').maybeSingle();
  if (result.error || !result.data) return 'A etapa não foi atualizada. Atualize a lista e tente novamente.';
  void dispatchPendingPushNotifications();
  return null;
}

export async function listAdminApprovals(projectId?:string): Promise<ServiceResult<ApprovalSummary[]>> {
  let query=supabase.from('aprovacoes')
    .select('id, projeto_id, tipo, titulo, descricao, approval_object, related_document_id, approval_due_at, status, comentario, created_at, respondido_at')
    .order('created_at', { ascending: false });
  if(projectId)query=query.eq('projeto_id',projectId);
  const result=await readAllRows(query);
  if (result.error) return { data: [], error: 'Não foi possível carregar as aprovações.' };
  return {
    data: (result.data ?? []).map((row) => ({
      id: row.id,
      projectId: row.projeto_id,
      type: row.tipo,
      title: row.titulo,
      description: row.descricao,
      approvalObject: row.approval_object,
      relatedDocumentId: row.related_document_id,
      dueAt: row.approval_due_at,
      status: row.status ?? 'aguardando',
      comment: row.comentario,
      createdAt: row.created_at,
      respondedAt: row.respondido_at,
    })),
    error: null,
  };
}

export async function createAdminApproval(input: {
  project: AdminProjectSummary;
  type: string;
  approvalObject: string;
  description?: string;
  relatedDocumentId?: string | null;
  dueDate?: string | null;
}) {
  const approvalObject = input.approvalObject.trim();
  if (approvalObject.length < 3) return 'Informe o objeto específico que o cliente deverá avaliar.';
  if (input.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) return 'Informe um prazo de manifestação válido.';
  const result = await supabase.from('aprovacoes').insert({
    cliente_id: input.project.clientId,
    projeto_id: input.project.id,
    tipo: input.type.trim(),
    titulo: approvalObject,
    approval_object: approvalObject,
    descricao: input.description?.trim() || null,
    related_document_id: input.relatedDocumentId || null,
    delivered_at: new Date().toISOString(),
    approval_due_at: input.dueDate ? `${input.dueDate}T23:59:59-03:00` : null,
    status: 'aguardando',
  });
  if (result.error) return 'Não foi possível criar a aprovação.';
  void dispatchPendingPushNotifications();
  return null;
}

export async function listAdminRequests(): Promise<ServiceResult<AdminRequestSummary[]>> {
  const modern = await readAllRows(supabase.from('solicitacoes').select('id, projeto_id, categoria, titulo, mensagem, status, origem, created_at, updated_at, clientes(nome), projetos(nome)').order('updated_at', { ascending: false }));
  const result = modern.error?.code === '42703' || modern.error?.code === 'PGRST204'
    ? await readAllRows(supabase.from('solicitacoes').select('id, projeto_id, titulo, mensagem, status, created_at, updated_at, clientes(nome), projetos(nome)').order('updated_at', { ascending: false }))
    : modern;
  if (result.error) return { data: [], error: 'Não foi possível carregar as solicitações.' };
  return { data: (result.data ?? []).map((row: any) => ({ id: row.id, projectId: row.projeto_id, category: row.categoria ?? 'outros', title: row.titulo, message: row.mensagem, status: row.status, origin: row.origem ?? 'cliente', createdAt: row.created_at, updatedAt: row.updated_at, clientName: (Array.isArray(row.clientes) ? row.clientes[0] : row.clientes)?.nome ?? 'Cliente', projectName: (Array.isArray(row.projetos) ? row.projetos[0] : row.projetos)?.nome ?? 'Projeto' })), error: null };
}

export async function createAdminRequest(input: { project: AdminProjectSummary; category: string; title: string; message: string }) {
  const result = await supabase.rpc('admin_create_request', {
    p_cliente_id: input.project.clientId,
    p_projeto_id: input.project.id,
    p_categoria: input.category,
    p_titulo: input.title.trim(),
    p_mensagem: input.message.trim(),
  });
  if (result.error || !result.data) return 'Não foi possível enviar a solicitação ao cliente.';
  void dispatchPendingPushNotifications();
  return null;
}

export async function updateAdminRequest(id: string, status: string, reply?: string) {
  if (reply?.trim()) {
    const rpc = await supabase.rpc('admin_reply_request', { p_solicitacao_id: id, p_mensagem: reply.trim(), p_status: status });
    if (rpc.error) return 'Não foi possível registrar a resposta com segurança.';
    void dispatchPendingPushNotifications();
    return null;
  }
  const result = await supabase.rpc('admin_update_request_status', {
    p_solicitacao_id: id,
    p_status: status,
  });
  if (result.error || result.data !== true) return 'Não foi possível atualizar a solicitação.';
  void dispatchPendingPushNotifications();
  return null;
}

export async function listAdminNotifications(): Promise<ServiceResult<AdminNotificationSummary[]>> {
  const result = await readAllRows(supabase
    .from('notificacoes')
    .select('id, titulo, mensagem, tipo, lida, created_at, projeto_id, link_path, clientes(nome), projetos(nome)')
    .eq('destinatario', 'cliente')
    .order('created_at', { ascending: false })
    );
  if (result.error) return { data: [], error: 'Não foi possível carregar as notificações.' };
  return {
    data: (result.data ?? []).map((row: any) => ({
      id: row.id,
      title: row.titulo,
      message: row.mensagem,
      type: row.tipo,
      read: row.lida,
      createdAt: row.created_at,
      linkPath: row.link_path,
      projectId: row.projeto_id,
      clientName: (Array.isArray(row.clientes) ? row.clientes[0] : row.clientes)?.nome ?? 'Cliente',
      projectName: (Array.isArray(row.projetos) ? row.projetos[0] : row.projetos)?.nome ?? 'Projeto',
    })),
    error: null,
  };
}

export async function listAdminActivityNotifications(): Promise<ServiceResult<AdminNotificationSummary[]>> {
  const result = await readAllRows(supabase
    .from('notificacoes')
    .select('id, titulo, mensagem, tipo, lida, created_at, projeto_id, link_path, clientes(nome), projetos(nome)')
    .eq('destinatario', 'admin')
    .order('created_at', { ascending: false })
    );
  if (result.error) return { data: [], error: 'Não foi possível carregar as novidades administrativas.' };
  return {
    data: (result.data ?? []).map((row: any) => ({
      id: row.id,
      title: row.titulo,
      message: row.mensagem,
      type: row.tipo,
      read: row.lida,
      createdAt: row.created_at,
      linkPath: row.link_path,
      projectId: row.projeto_id,
      clientName: (Array.isArray(row.clientes) ? row.clientes[0] : row.clientes)?.nome ?? 'Cliente',
      projectName: (Array.isArray(row.projetos) ? row.projetos[0] : row.projetos)?.nome ?? 'Projeto',
    })),
    error: null,
  };
}

export async function getAdminUnreadNotificationCount() {
  const result = await supabase
    .from('notificacoes')
    .select('id', { count: 'exact', head: true })
    .eq('destinatario', 'admin')
    .eq('lida', false);
  return result.error ? null : (result.count ?? 0);
}

export async function markAdminNotificationRead(notificationId: string) {
  const result = await supabase.rpc('mark_admin_notification_read', {
    p_notificacao_id: notificationId,
  });
  return result.error || result.data !== true ? 'Não foi possível atualizar a notificação.' : null;
}

export async function createAdminNotification(input: { project: AdminProjectSummary; title: string; message: string; type?: string }) {
  const result = await supabase.from('notificacoes').insert({
    cliente_id: input.project.clientId,
    projeto_id: input.project.id,
    titulo: input.title.trim(),
    mensagem: input.message.trim(),
    tipo: input.type?.trim() || 'atualizacao',
    lida: false,
    link_path: '/(client)/notifications',
    destinatario: 'cliente',
  });
  if (result.error) return 'Não foi possível criar a notificação interna.';
  void dispatchPendingPushNotifications();
  return null;
}

export async function getAdminStorageOverview(): Promise<ServiceResult<StorageOverview>> {
  const result = await supabase.rpc('admin_storage_overview');
  if (result.error || !result.data) return { data: { buckets: [], projects: [], totalObjects: 0, totalBytes: 0, orphanMetadata: 0, orphanObjects: 0 }, error: 'As métricas reais do Storage não estão disponíveis neste ambiente.' };
  const raw = result.data as any;
  return { data: { buckets: raw.buckets ?? [], projects: raw.projects ?? [], totalObjects: Number(raw.totalObjects ?? 0), totalBytes: Number(raw.totalBytes ?? 0), orphanMetadata: Number(raw.orphanMetadata ?? 0), orphanObjects: Number(raw.orphanObjects ?? 0) }, error: null };
}

export async function getAdminStorageOrphanDetails(): Promise<ServiceResult<StorageOrphanDetails>> {
  const result = await supabase.rpc('admin_storage_orphan_details');
  if (result.error || !result.data) return { data: { orphanMetadata: [], orphanObjects: [] }, error: 'Os detalhes das inconsistências do Storage não estão disponíveis neste ambiente.' };
  const raw = result.data as any;
  return {
    data: {
      orphanMetadata: (raw.orphanMetadata ?? []).map((row: any) => ({ kind: row.kind, id: row.id, name: row.name, bucket: row.bucket, path: row.path, projectId: row.projectId ?? null })),
      orphanObjects: (raw.orphanObjects ?? []).map((row: any) => ({ bucket: row.bucket, path: row.path, size: Number(row.size ?? 0), createdAt: row.createdAt ?? null })),
    },
    error: null,
  };
}

export {
  listAdminFinancialEntries,
  listFinancialArchive,
  createAdminFinancialEntry,
  financialEntryPayload,
  updateAdminFinancialEntry,
  deleteAdminFinancialEntry,
  updateAdminContractValue,
} from './admin-financial-service';
export type { FinancialEntryInput } from './admin-financial-service';

export async function listAdminAudit(): Promise<ServiceResult<AuditEntrySummary[]>> {
  const result = await readAllRows(supabase.from('audit_log').select('id, action, entity_type, entity_id, user_id, details, created_at').order('created_at', { ascending: false }));
  if (result.error) return { data: [], error: 'Não foi possível carregar a auditoria.' };
  return { data: (result.data ?? []).map((row) => ({ id: row.id, action: row.action, entityType: row.entity_type, entityId: row.entity_id, userId: row.user_id, details: row.details as Record<string, unknown> | null, createdAt: row.created_at })), error: null };
}
