import { readAllRows } from '@/lib/paginated-query';
import { supabase } from '@/lib/supabase';
import { dispatchPendingPushNotifications } from '@/services/push-service';
import type { AdminNotificationSummary, AdminProjectSummary, AdminRequestSummary, ApprovalSummary, ServiceResult } from '@/types/domain';

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
