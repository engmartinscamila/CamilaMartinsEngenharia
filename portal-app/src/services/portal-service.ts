import { isMissingRelationError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { dispatchPendingPushNotifications } from '@/services/push-service';
import type {
  AgendaSummary,
  ApprovalSummary,
  DashboardCounts,
  DocumentSummary,
  LibraryItemSummary,
  NotificationSummary,
  PhotoSummary,
  ProjectContext,
  ProjectHighlights,
  RequestSummary,
  RequestReplySummary,
  ScheduleStageSummary,
  ServiceResult,
} from '@/types/domain';

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : null;
}

function isCompatibilityError(error: { code?: string; message?: string } | null) {
  return Boolean(
    error &&
      (isMissingRelationError(error) ||
        ['42703', '42883', 'PGRST200', 'PGRST202', 'PGRST204'].includes(error.code ?? '')),
  );
}

function localIsoDate() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export async function listProjectContexts(clientId?: string): Promise<ServiceResult<ProjectContext[]>> {
  let modernQuery = supabase
    .from('projetos')
    .select(
      'id, cliente_id, contract_id, nome, tipo, status, progress_percent, cidade_obra, estado_obra, contratos!contract_id(id, contract_number, cliente_id, service_type, status, contract_value, currency)',
    )
    .order('created_at', { ascending: false });
  if (clientId) modernQuery = modernQuery.eq('cliente_id', clientId);

  const modern = await modernQuery;
  if (!modern.error) {
    const items = (modern.data ?? []).map((row: any) => {
      const rawContract = Array.isArray(row.contratos) ? row.contratos[0] : row.contratos;
      return {
        id: row.id,
        clientId: row.cliente_id,
        contractId: row.contract_id,
        contractNumber: rawContract?.contract_number ?? 'Contrato não informado',
        name: row.nome,
        serviceType: row.tipo ?? rawContract?.service_type ?? null,
        status: row.status,
        progress: numberOrNull(row.progress_percent),
        city: row.cidade_obra,
        state: row.estado_obra,
        contract: rawContract
          ? {
              id: rawContract.id,
              contractNumber: rawContract.contract_number,
              clientId: rawContract.cliente_id,
              serviceType: rawContract.service_type,
              status: rawContract.status,
              contractValue: rawContract.contract_value === null ? null : Number(rawContract.contract_value),
              currency: rawContract.currency ?? 'BRL',
            }
          : null,
      } satisfies ProjectContext;
    });
    return { data: items, error: null };
  }

  if (!isMissingRelationError(modern.error) && modern.error.code !== '42703' && modern.error.code !== 'PGRST200') {
    return { data: [], error: 'Não foi possível carregar seus projetos.' };
  }

  let legacyQuery = supabase
    .from('projetos')
    .select('id, cliente_id, nome, tipo, status, cidade_obra, estado_obra, numero_contrato')
    .order('created_at', { ascending: false });
  if (clientId) legacyQuery = legacyQuery.eq('cliente_id', clientId);
  const legacy = await legacyQuery;

  if (legacy.error) return { data: [], error: 'Não foi possível carregar seus projetos.' };
  return {
    data: (legacy.data ?? []).map((row) => ({
      id: row.id,
      clientId: row.cliente_id,
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

export async function listDocuments(projectId: string): Promise<ServiceResult<DocumentSummary[]>> {
  const modern = await supabase
    .from('documentos')
    .select('id, projeto_id, nome, categoria, versao, created_at, storage_bucket, arquivo, permitir_download, protection_mode')
    .eq('projeto_id', projectId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (!modern.error) {
    return {
      data: (modern.data ?? []).map((row: any) => ({
        id: row.id,
        projectId: row.projeto_id,
        title: row.nome ?? 'Documento',
        category: row.categoria ?? 'Outros',
        version: row.versao,
        createdAt: row.created_at,
        storageBucket: row.storage_bucket,
        storagePath: row.arquivo,
        allowDownload: row.permitir_download !== false,
        protectionMode: row.protection_mode === 'authored_pdf' ? 'authored_pdf' : 'administrative',
      })),
      error: null,
    };
  }

  if (modern.error.code !== '42703' && modern.error.code !== 'PGRST204') {
    return { data: [], error: 'Não foi possível carregar os documentos.' };
  }

  const legacy = await supabase
    .from('documentos')
    .select('id, projeto_id, nome, tipo, created_at, arquivo')
    .eq('projeto_id', projectId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (legacy.error) return { data: [], error: 'Não foi possível carregar os documentos.' };
  return {
    data: (legacy.data ?? []).map((row) => ({
      id: row.id,
      projectId: row.projeto_id,
      title: row.nome ?? 'Documento',
      category: row.tipo ?? 'Outros',
      version: null,
      createdAt: row.created_at,
      storageBucket: 'documentos',
      storagePath: row.arquivo,
      allowDownload: true,
      protectionMode: 'administrative',
    })),
    error: null,
  };
}

export async function createDocumentSignedUrl(document: DocumentSummary) {
  const result = await supabase.functions.invoke('issue-protected-asset', {
    body: { assetId: document.id, kind: 'document', action: document.allowDownload ? 'download' : 'view' },
  });
  return {
    url: result.data?.url ?? null,
    error: result.error || !result.data?.url ? 'Não foi possível emitir a cópia segura deste documento.' : null,
  };
}

export async function createPhotoSignedUrl(photo: PhotoSummary) {
  const result = await supabase.functions.invoke('issue-protected-asset', {
    body: { assetId: photo.id, kind: 'photo', action: 'view' },
  });
  return {
    url: result.data?.url ?? null,
    error: result.error || !result.data?.url ? 'Não foi possível emitir a imagem protegida.' : null,
  };
}

export async function createStorageSignedUrl(storageBucket: string, storagePath: string) {
  const { data, error } = await supabase.storage.from(storageBucket).createSignedUrl(storagePath, 300, { download: false });
  return { url: data?.signedUrl ?? null, error: error ? 'Não foi possível abrir este arquivo.' : null };
}

export async function listPhotos(projectId: string): Promise<ServiceResult<PhotoSummary[]>> {
  const modern = await supabase
    .from('fotos')
    .select('id, projeto_id, nome, descricao, categoria, created_at, storage_bucket, arquivo, protection_mode')
    .eq('projeto_id', projectId)
    .order('created_at', { ascending: false })
    .limit(48);

  if (!modern.error) {
    return {
      data: (modern.data ?? []).map((row: any) => ({
        id: row.id,
        projectId: row.projeto_id,
        title: row.nome ?? 'Registro da obra',
        description: row.descricao,
        category: row.categoria,
        createdAt: row.created_at,
        storageBucket: row.storage_bucket ?? 'fotos',
        storagePath: row.arquivo,
        protectionMode: row.protection_mode === 'administrative' ? 'administrative' : 'authored_photo',
      })),
      error: null,
    };
  }

  if (!isCompatibilityError(modern.error)) return { data: [], error: 'Não foi possível carregar as fotos.' };
  const legacy = await supabase
    .from('fotos')
    .select('id, projeto_id, nome, descricao, created_at, arquivo')
    .eq('projeto_id', projectId)
    .order('created_at', { ascending: false })
    .limit(48);

  if (legacy.error) return { data: [], error: 'Não foi possível carregar as fotos.' };
  return {
    data: (legacy.data ?? []).map((row) => ({
      id: row.id,
      projectId: row.projeto_id,
      title: row.nome ?? 'Registro da obra',
      description: row.descricao,
      category: null,
      createdAt: row.created_at,
      storageBucket: 'fotos',
      storagePath: row.arquivo,
      protectionMode: 'authored_photo',
    })),
    error: null,
  };
}

export async function listLibraryItems(projectId: string, clientId: string): Promise<ServiceResult<LibraryItemSummary[]>> {
  const scope = `projeto_id.eq.${projectId},and(projeto_id.is.null,cliente_id.eq.${clientId}),and(projeto_id.is.null,cliente_id.is.null)`;
  const modern = await supabase
    .from('biblioteca')
    .select('id, projeto_id, nome, descricao, categoria, tipo, tamanho, created_at, storage_bucket, arquivo')
    .or(scope)
    .order('created_at', { ascending: false })
    .limit(60);

  if (!modern.error) {
    return {
      data: (modern.data ?? []).map((row: any) => ({
        id: row.id,
        projectId: row.projeto_id,
        title: row.nome ?? 'Material',
        description: row.descricao,
        category: row.categoria,
        fileType: row.tipo,
        sizeBytes: row.tamanho === null ? null : Number(row.tamanho),
        createdAt: row.created_at,
        storageBucket: row.storage_bucket ?? 'materiais-protegidos',
        storagePath: row.arquivo,
      })),
      error: null,
    };
  }

  if (!isCompatibilityError(modern.error)) return { data: [], error: 'Não foi possível carregar a biblioteca.' };
  const legacy = await supabase
    .from('biblioteca')
    .select('id, projeto_id, nome, descricao, categoria, tipo, tamanho, created_at, arquivo')
    .or(scope)
    .order('created_at', { ascending: false })
    .limit(60);

  if (legacy.error) return { data: [], error: 'Não foi possível carregar a biblioteca.' };
  return {
    data: (legacy.data ?? []).map((row) => ({
      id: row.id,
      projectId: row.projeto_id,
      title: row.nome ?? 'Material',
      description: row.descricao,
      category: row.categoria,
      fileType: row.tipo,
      sizeBytes: row.tamanho === null ? null : Number(row.tamanho),
      createdAt: row.created_at,
      storageBucket: 'materiais-protegidos',
      storagePath: row.arquivo,
    })),
    error: null,
  };
}

export async function listAgenda(projectId: string, clientId: string): Promise<ServiceResult<AgendaSummary[]>> {
  const result = await supabase
    .from('agenda')
    .select('id, projeto_id, titulo, descricao, data, horario, horario_fim, tipo, status_convite, google_meet_url, cancelado')
    .or(`projeto_id.eq.${projectId},and(projeto_id.is.null,cliente_id.eq.${clientId})`)
    .eq('cancelado', false)
    .gte('data', localIsoDate())
    .order('data', { ascending: true })
    .order('horario', { ascending: true })
    .limit(50);

  if (result.error) return { data: [], error: 'Não foi possível carregar a agenda.' };
  return {
    data: (result.data ?? []).map((row) => ({
      id: row.id,
      projectId: row.projeto_id,
      title: row.titulo,
      description: row.descricao,
      date: row.data,
      startTime: row.horario,
      endTime: row.horario_fim,
      eventType: row.tipo,
      invitationStatus: row.status_convite ?? 'needsAction',
      meetingUrl: row.google_meet_url,
      cancelled: row.cancelado === true,
    })),
    error: null,
  };
}

export async function respondToAgenda(agendaId: string, status: 'accepted' | 'declined') {
  const result = await supabase.rpc('respond_to_own_agenda', {
    p_agenda_id: agendaId,
    p_status: status,
  });
  if (result.error || result.data !== true) return 'Não foi possível registrar sua resposta para este compromisso.';
  void dispatchPendingPushNotifications();
  return null;
}

export async function listSchedule(projectId: string): Promise<ServiceResult<ScheduleStageSummary[]>> {
  const result = await supabase
    .from('cronograma')
    .select('id, projeto_id, nome, descricao, data_inicio, data_fim, status, peso_percentual, percentual_conclusao, ordem')
    .eq('projeto_id', projectId)
    .order('ordem', { ascending: true })
    .order('data_inicio', { ascending: true })
    .limit(100);

  if (result.error) return { data: [], error: 'Não foi possível carregar o cronograma.' };
  return {
    data: (result.data ?? []).map((row) => ({
      id: row.id,
      projectId: row.projeto_id,
      title: row.nome,
      description: row.descricao,
      startDate: row.data_inicio,
      endDate: row.data_fim,
      status: row.status ?? 'pendente',
      progress: numberOrNull(row.percentual_conclusao),
      weight: numberOrNull(row.peso_percentual),
      order: Number(row.ordem ?? 0),
    })),
    error: null,
  };
}

export async function listApprovals(projectId: string): Promise<ServiceResult<ApprovalSummary[]>> {
  const result = await supabase
    .from('aprovacoes')
    .select('id, projeto_id, tipo, titulo, descricao, status, comentario, created_at, respondido_at')
    .eq('projeto_id', projectId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (result.error) return { data: [], error: 'Não foi possível carregar as aprovações.' };
  return {
    data: (result.data ?? []).map((row) => ({
      id: row.id,
      projectId: row.projeto_id,
      type: row.tipo,
      title: row.titulo,
      description: row.descricao,
      status: row.status ?? 'aguardando',
      comment: row.comentario,
      createdAt: row.created_at,
      respondedAt: row.respondido_at,
    })),
    error: null,
  };
}

export async function respondToApproval(approvalId: string, status: 'aprovado' | 'rejeitado', comment: string) {
  const rpc = await supabase.rpc('respond_to_own_approval', {
    p_aprovacao_id: approvalId,
    p_status: status,
    p_comentario: comment.trim() || null,
  });
  if (!rpc.error) {
    if (rpc.data !== true) return 'Esta aprovação já foi respondida ou não está disponível.';
    void dispatchPendingPushNotifications();
    return null;
  }
  if (!isCompatibilityError(rpc.error)) return 'Não foi possível registrar sua resposta.';

  const fallback = await supabase
    .from('aprovacoes')
    .update({ status, comentario: comment.trim() || null, respondido_at: new Date().toISOString() })
    .eq('id', approvalId)
    .eq('status', 'aguardando')
    .select('id')
    .maybeSingle();
  if (fallback.error || !fallback.data) return 'Não foi possível registrar sua resposta.';
  void dispatchPendingPushNotifications();
  return null;
}

export async function getProjectHighlights(projectId: string, clientId: string): Promise<ServiceResult<ProjectHighlights>> {
  const [schedule, agenda, approvals, documents, requests] = await Promise.all([
    listSchedule(projectId),
    listAgenda(projectId, clientId),
    supabase.from('aprovacoes').select('id', { count: 'exact', head: true }).eq('projeto_id', projectId).eq('status', 'aguardando'),
    supabase.from('documentos').select('id', { count: 'exact', head: true }).eq('projeto_id', projectId),
    supabase.from('solicitacoes').select('id', { count: 'exact', head: true }).eq('projeto_id', projectId).not('status', 'in', '(concluida,cancelada)'),
  ]);

  const nextStage = schedule.data.find((stage) => !['concluido', 'concluida', 'cancelado', 'cancelada'].includes(stage.status)) ?? null;
  const hasError = Boolean(schedule.error || agenda.error || approvals.error || documents.error || requests.error);
  return {
    data: {
      nextStage,
      nextEvent: agenda.data[0] ?? null,
      pendingApprovals: approvals.error ? null : approvals.count,
      recentDocuments: documents.error ? null : documents.count,
      openRequests: requests.error ? null : requests.count,
    },
    error: hasError ? 'Alguns resumos estão temporariamente indisponíveis.' : null,
  };
}

export async function listRequests(projectId: string): Promise<ServiceResult<RequestSummary[]>> {
  const modern = await supabase
    .from('solicitacoes')
    .select('id, projeto_id, categoria, titulo, mensagem, status, origem, created_at, updated_at')
    .eq('projeto_id', projectId)
    .order('updated_at', { ascending: false })
    .limit(50);

  const result = modern.error?.code === '42703' || modern.error?.code === 'PGRST204'
    ? await supabase.from('solicitacoes').select('id, projeto_id, titulo, mensagem, status, created_at, updated_at').eq('projeto_id', projectId).order('updated_at', { ascending: false }).limit(50)
    : modern;
  if (result.error) return { data: [], error: 'Não foi possível carregar as solicitações.' };
  return {
    data: (result.data ?? []).map((row: any) => ({
      id: row.id,
      projectId: row.projeto_id,
      category: row.categoria ?? 'outros',
      title: row.titulo,
      message: row.mensagem,
      status: row.status,
      origin: row.origem ?? 'cliente',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    error: null,
  };
}

export async function createRequest(input: {
  clientId: string;
  projectId: string;
  category: string;
  title: string;
  message: string;
}) {
  const { error } = await supabase.from('solicitacoes').insert({
    cliente_id: input.clientId,
    projeto_id: input.projectId,
    categoria: input.category,
    titulo: input.title.trim(),
    mensagem: input.message.trim(),
    status: 'nova',
    origem: 'cliente',
  });
  if (error) return 'Não foi possível enviar a solicitação. Tente novamente.';
  void dispatchPendingPushNotifications();
  return null;
}

export async function listRequestReplies(requestIds: string[]): Promise<ServiceResult<RequestReplySummary[]>> {
  if (requestIds.length === 0) return { data: [], error: null };
  const result = await supabase
    .from('solicitacao_respostas')
    .select('id, solicitacao_id, autor, mensagem, created_at')
    .in('solicitacao_id', requestIds)
    .order('created_at', { ascending: true })
    .limit(300);
  if (result.error) return { data: [], error: 'Não foi possível carregar o histórico das solicitações.' };
  return {
    data: (result.data ?? []).map((row) => ({ id: row.id, requestId: row.solicitacao_id, author: row.autor, message: row.mensagem, createdAt: row.created_at })),
    error: null,
  };
}

export async function replyToOwnRequest(requestId: string, message: string) {
  const result = await supabase.rpc('reply_to_own_request', { p_solicitacao_id: requestId, p_mensagem: message.trim() });
  if (result.error) return 'Esta solicitação não está aguardando uma resposta sua.';
  void dispatchPendingPushNotifications();
  return null;
}

export async function listNotifications(clientId: string, projectId?: string): Promise<ServiceResult<NotificationSummary[]>> {
  let query = supabase
    .from('notificacoes')
    .select('id, titulo, mensagem, tipo, lida, created_at, link_path')
    .eq('cliente_id', clientId)
    .eq('destinatario', 'cliente');
  if (projectId) query = query.or(`projeto_id.eq.${projectId},projeto_id.is.null`);
  const result = await query
    .order('created_at', { ascending: false })
    .limit(50);

  if (result.error) return { data: [], error: 'Não foi possível carregar as notificações.' };
  return {
    data: (result.data ?? []).map((row) => ({
      id: row.id,
      title: row.titulo,
      message: row.mensagem,
      type: row.tipo,
      read: row.lida,
      createdAt: row.created_at,
      linkPath: row.link_path,
    })),
    error: null,
  };
}

export async function getClientUnreadNotificationCount(clientId: string) {
  const result = await supabase
    .from('notificacoes')
    .select('id', { count: 'exact', head: true })
    .eq('cliente_id', clientId)
    .eq('destinatario', 'cliente')
    .eq('lida', false);
  return result.error ? null : (result.count ?? 0);
}

export async function markNotificationRead(notificationId: string) {
  const { data, error } = await supabase.rpc('mark_own_notification_read', {
    p_notificacao_id: notificationId,
  });
  return error || data !== true ? 'Não foi possível atualizar a notificação.' : null;
}

export async function getAdminDashboard(): Promise<ServiceResult<DashboardCounts>> {
  const [clients, projects, requests, approvals] = await Promise.all([
    supabase.from('clientes').select('id', { count: 'exact', head: true }).eq('status', 'ativo'),
    supabase.from('projetos').select('id', { count: 'exact', head: true }).eq('status', 'ativo'),
    supabase.from('solicitacoes').select('id', { count: 'exact', head: true }).not('status', 'in', '(concluida,cancelada)'),
    supabase.from('aprovacoes').select('id', { count: 'exact', head: true }).eq('status', 'aguardando'),
  ]);

  const hasError = [clients, projects, requests, approvals].some((result) => result.error);
  return {
    data: {
      activeClients: clients.error ? null : clients.count,
      activeProjects: projects.error ? null : projects.count,
      openRequests: requests.error ? null : requests.count,
      pendingApprovals: approvals.error ? null : approvals.count,
    },
    error: hasError ? 'Alguns indicadores estão indisponíveis.' : null,
  };
}
