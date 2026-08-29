import { decode } from 'base64-arraybuffer';
import type { DocumentPickerAsset } from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { randomUUID } from 'expo-crypto';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { isMissingRelationError, toUserMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { dispatchPendingPushNotifications } from '@/services/push-service';
import type {
  AdminClientSummary,
  AdminContractSummary,
  AdminContentKind,
  AdminContentSummary,
  AdminNotificationSummary,
  AdminProjectSummary,
  AdminRequestSummary,
  AgendaSummary,
  ApprovalSummary,
  AuditEntrySummary,
  ClientDeletionPreview,
  FinancialArchiveSummary,
  FinancialEntrySummary,
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

function safePathSegment(value: string) {
  const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-');
  return normalized.replace(/-{2,}/g, '-').replace(/^-|-$/g, '').slice(0, 60).toLowerCase() || 'geral';
}

const blockedExtensions = new Set(['apk', 'app', 'bat', 'bin', 'cmd', 'com', 'dll', 'dmg', 'exe', 'hta', 'jar', 'js', 'jse', 'msi', 'ps1', 'scr', 'sh', 'vbs', 'wsf']);
const imageExtensions = new Set(['avif', 'heic', 'heif', 'jpeg', 'jpg', 'png', 'webp']);

function assetExtension(asset: DocumentPickerAsset) {
  const match = asset.name.toLowerCase().match(/\.([a-z0-9]{1,10})$/);
  return match?.[1] ?? '';
}

function validateAdminAsset(kind: AdminContentKind, asset: DocumentPickerAsset) {
  if (asset.size && asset.size > 20 * 1024 * 1024) return 'O arquivo excede o limite de 20 MB do aplicativo.';
  const extension = assetExtension(asset);
  const mime = asset.mimeType?.toLowerCase() ?? '';
  if (!extension || blockedExtensions.has(extension) || mime.includes('executable') || mime.includes('x-msdownload')) {
    return 'Este tipo de arquivo não é permitido por segurança.';
  }
  if (kind === 'photo' && !mime.startsWith('image/') && !imageExtensions.has(extension)) {
    return 'Selecione uma imagem válida para o registro fotográfico.';
  }
  return null;
}

function contentTable(kind: AdminContentKind) {
  return kind === 'document' ? 'documentos' : kind === 'photo' ? 'fotos' : 'biblioteca';
}

function contentBucket(kind: AdminContentKind, protectionMode?: string) {
  if (protectionMode === 'authored_pdf' || protectionMode === 'authored_photo') return 'materiais-protegidos';
  return kind === 'document' ? 'documentos' : kind === 'photo' ? 'fotos' : 'materiais-protegidos';
}

export async function listAdminClients(search = ''): Promise<ServiceResult<AdminClientSummary[]>> {
  let query = supabase.from('clientes').select('id, nome, email, telefone, status, auth_id, created_at').order('nome');
  if (search.trim()) query = query.or(`nome.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%`);
  const result = await query.limit(200);
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

export async function inviteAdminClient(input: { name: string; email: string; phone?: string }) {
  const result = await supabase.functions.invoke('admin-invite-client', { body: input });
  return result.error ? 'O convite seguro não está disponível neste ambiente. Verifique a função administrativa de convite.' : null;
}

export async function updateAdminClientStatus(clientId: string, status: 'ativo' | 'arquivado' | 'acesso_revogado') {
  const result = await supabase.rpc('admin_set_client_status', { p_cliente_id: clientId, p_status: status });
  return result.error || result.data !== true ? 'A atualização segura não está disponível neste ambiente. Verifique as funções administrativas do banco.' : null;
}

export async function updateAdminClientProfile(clientId: string, input: { name: string; phone?: string }) {
  const result = await supabase.from('clientes').update({ nome: input.name.trim(), telefone: input.phone?.trim() || null }).eq('id', clientId).select('id').maybeSingle();
  return result.error || !result.data ? 'Não foi possível atualizar o cadastro do cliente.' : null;
}

export async function resendAdminClientInvite(email: string) {
  const result = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: Linking.createURL('/reset-password') },
  });
  return result.error ? 'O convite só pode ser reenviado enquanto o primeiro acesso estiver pendente.' : null;
}

export async function sendAdminClientRecovery(email: string) {
  const result = await supabase.auth.resetPasswordForEmail(email, { redirectTo: Linking.createURL('/reset-password') });
  return result.error ? 'Não foi possível enviar a recuperação de senha.' : null;
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
  const modern = await supabase
    .from('projetos')
    .select('id, cliente_id, contract_id, nome, tipo, status, progress_percent, cidade_obra, estado_obra, clientes(nome), contratos!contract_id(id, contract_number, cliente_id, service_type, status, contract_value, currency)')
    .order('created_at', { ascending: false })
    .limit(200);

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
  const legacy = await supabase
    .from('projetos')
    .select('id, cliente_id, nome, tipo, status, cidade_obra, estado_obra, numero_contrato, clientes(nome)')
    .order('created_at', { ascending: false })
    .limit(200);
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
  const result = await supabase
    .from('contratos')
    .select('id, cliente_id, contract_number, service_type, status, contract_value, currency, clientes(nome)')
    .order('contract_number')
    .limit(300);
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

export async function listAdminContent(): Promise<ServiceResult<AdminContentSummary[]>> {
  const [documents, photos, library] = await Promise.all([
    supabase.from('documentos').select('id, cliente_id, projeto_id, nome, tipo, categoria, versao, created_at, storage_bucket, arquivo, permitir_download, protection_mode, clientes(nome), projetos(nome)').order('created_at', { ascending: false }).limit(150),
    supabase.from('fotos').select('id, cliente_id, projeto_id, nome, categoria, created_at, storage_bucket, arquivo, protection_mode, clientes(nome), projetos(nome)').order('created_at', { ascending: false }).limit(150),
    supabase.from('biblioteca').select('id, cliente_id, projeto_id, nome, categoria, created_at, storage_bucket, arquivo, clientes(nome), projetos(nome)').order('created_at', { ascending: false }).limit(150),
  ]);
  const failed = [documents, photos, library].filter((result) => result.error && !compatibilityError(result.error));
  const rows: AdminContentSummary[] = [];
  const append = (kind: AdminContentKind, data: any[] | null, fallbackBucket: string) => {
    for (const row of data ?? []) {
      const client = Array.isArray(row.clientes) ? row.clientes[0] : row.clientes;
      const project = Array.isArray(row.projetos) ? row.projetos[0] : row.projetos;
      rows.push({
        id: row.id,
        kind,
        title: row.nome ?? 'Arquivo',
        category: row.categoria ?? row.tipo ?? (kind === 'photo' ? 'Foto' : kind === 'library' ? 'Biblioteca' : 'Documento'),
        version: row.versao ?? null,
        clientId: row.cliente_id,
        clientName: client?.nome ?? 'Geral',
        projectId: row.projeto_id,
        projectName: project?.nome ?? 'Sem projeto',
        createdAt: row.created_at,
        storageBucket: row.storage_bucket ?? fallbackBucket,
        storagePath: row.arquivo,
        allowDownload: kind === 'document' ? row.permitir_download !== false : kind === 'library',
        protectionMode: kind === 'document'
          ? (row.protection_mode === 'authored_pdf' ? 'authored_pdf' : 'administrative')
          : kind === 'photo'
            ? (row.protection_mode === 'administrative' ? 'administrative' : 'authored_photo')
            : 'administrative',
      });
    }
  };
  append('document', documents.data as any[] | null, 'documentos');
  append('photo', photos.data as any[] | null, 'fotos');
  append('library', library.data as any[] | null, 'materiais-protegidos');
  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { data: rows, error: failed.length ? 'Alguns tipos de arquivo estão indisponíveis.' : null };
}

async function assetBody(asset: DocumentPickerAsset) {
  if (Platform.OS === 'web' && asset.file) return asset.file;
  const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
  return decode(base64);
}

export async function uploadAdminContent(input: {
  kind: AdminContentKind;
  clientId: string;
  projectId: string;
  title: string;
  category: string;
  version?: string;
  protectionMode: 'administrative' | 'authored_pdf' | 'authored_photo';
  asset: DocumentPickerAsset;
}) {
  const validationError = validateAdminAsset(input.kind, input.asset);
  if (validationError) return validationError;
  if (input.protectionMode === 'authored_pdf' && assetExtension(input.asset) !== 'pdf') {
    return 'Material técnico autoral deve ser enviado em PDF para receber identificação em todas as páginas.';
  }
  const bucket = contentBucket(input.kind, input.protectionMode);
  const extension = assetExtension(input.asset);
  const path = `${input.projectId}/${safePathSegment(input.category)}/${randomUUID()}.${extension}`;
  try {
    const upload = await supabase.storage.from(bucket).upload(path, await assetBody(input.asset), {
      contentType: input.asset.mimeType ?? 'application/octet-stream',
      upsert: false,
    });
    if (upload.error) return 'Não foi possível enviar o arquivo ao Storage.';

    const common = { cliente_id: input.clientId, projeto_id: input.projectId, nome: input.title.trim(), arquivo: path, storage_bucket: bucket };
    const payload = input.kind === 'document'
      ? { ...common, categoria: input.category.trim() || 'Documento', tipo: input.asset.mimeType ?? 'Arquivo', versao: input.version?.trim() || '1.0', protection_mode: input.protectionMode, permitir_download: input.protectionMode === 'administrative' }
      : input.kind === 'photo'
        ? { ...common, categoria: input.category.trim() || 'Registro da obra', protection_mode: input.protectionMode }
        : { ...common, categoria: input.category.trim() || 'Material', tipo: input.asset.mimeType ?? 'Arquivo', tamanho: input.asset.size ?? null };
    const insert = await supabase.from(contentTable(input.kind)).insert(payload as any);
    if (insert.error) {
      await supabase.storage.from(bucket).remove([path]);
      return 'O arquivo foi revertido porque os metadados não puderam ser registrados.';
    }
    void dispatchPendingPushNotifications();
    return null;
  } catch (error) {
    return toUserMessage(error, 'Não foi possível preparar o arquivo para envio.');
  }
}

export async function createAdminContentSignedUrl(item: AdminContentSummary) {
  if (!item.storagePath) return { url: null, error: 'Este registro não possui arquivo no Storage.' };
  if (item.kind === 'document' || item.kind === 'photo') {
    const issued = await supabase.functions.invoke('issue-protected-asset', {
      body: { assetId: item.id, kind: item.kind, action: 'view', adminOriginal: true },
    });
    return { url: issued.data?.url ?? null, error: issued.error || !issued.data?.url ? 'Não foi possível registrar e abrir o original administrativo.' : null };
  }
  const result = await supabase.storage.from(item.storageBucket).createSignedUrl(item.storagePath, 300);
  return { url: result.data?.signedUrl ?? null, error: result.error ? 'Não foi possível abrir o arquivo.' : null };
}

export async function deleteAdminContent(item: AdminContentSummary) {
  if (item.storagePath) {
    const storage = await supabase.storage.from(item.storageBucket).remove([item.storagePath]);
    if (storage.error) return 'A exclusão foi interrompida porque o arquivo não pôde ser removido do Storage.';
  }
  const metadata = await supabase.from(contentTable(item.kind)).delete().eq('id', item.id);
  return metadata.error ? 'O arquivo saiu do Storage, mas o registro precisa ser revisado.' : null;
}

export async function listAdminAgenda(): Promise<ServiceResult<AgendaSummary[]>> {
  const result = await supabase.from('agenda').select('id, projeto_id, titulo, descricao, data, horario, horario_fim, tipo, status_convite, google_meet_url, cancelado').order('data', { ascending: true }).limit(200);
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
  const result = await supabase.from('agenda').update({ cancelado: true, status_convite: 'cancelled' }).eq('id', id);
  if (result.error) return 'Não foi possível cancelar o compromisso.';
  void dispatchPendingPushNotifications();
  return null;
}

export async function listAdminSchedule(projectId?: string): Promise<ServiceResult<ScheduleStageSummary[]>> {
  let query = supabase.from('cronograma').select('id, projeto_id, nome, descricao, data_inicio, data_fim, status, peso_percentual, percentual_conclusao, ordem').order('ordem');
  if (projectId) query = query.eq('projeto_id', projectId);
  const result = await query.limit(300);
  if (result.error) return { data: [], error: 'Não foi possível carregar o cronograma.' };
  return { data: (result.data ?? []).map((row) => ({ id: row.id, projectId: row.projeto_id, title: row.nome, description: row.descricao, startDate: row.data_inicio, endDate: row.data_fim, status: row.status ?? 'pendente', progress: numberOrNull(row.percentual_conclusao), weight: numberOrNull(row.peso_percentual), order: Number(row.ordem ?? 0) })), error: null };
}

export async function createAdminScheduleStage(input: { project: AdminProjectSummary; title: string; startDate?: string; endDate?: string; order: number }) {
  const result = await supabase.from('cronograma').insert({ cliente_id: input.project.clientId, projeto_id: input.project.id, nome: input.title.trim(), data_inicio: input.startDate || null, data_fim: input.endDate || null, status: 'pendente', percentual_conclusao: 0, ordem: input.order });
  if (result.error) return 'Não foi possível criar a etapa.';
  void dispatchPendingPushNotifications();
  return null;
}

export async function updateAdminScheduleStage(id: string, status: string, progress: number) {
  const result = await supabase.from('cronograma').update({ status, percentual_conclusao: progress }).eq('id', id);
  if (result.error) return 'Não foi possível atualizar a etapa.';
  void dispatchPendingPushNotifications();
  return null;
}

export async function listAdminApprovals(): Promise<ServiceResult<ApprovalSummary[]>> {
  const result = await supabase.from('aprovacoes').select('id, projeto_id, tipo, titulo, descricao, status, comentario, created_at, respondido_at').order('created_at', { ascending: false }).limit(200);
  if (result.error) return { data: [], error: 'Não foi possível carregar as aprovações.' };
  return { data: (result.data ?? []).map((row) => ({ id: row.id, projectId: row.projeto_id, type: row.tipo, title: row.titulo, description: row.descricao, status: row.status ?? 'aguardando', comment: row.comentario, createdAt: row.created_at, respondedAt: row.respondido_at })), error: null };
}

export async function createAdminApproval(input: { project: AdminProjectSummary; type: string; title: string; description?: string }) {
  const result = await supabase.from('aprovacoes').insert({ cliente_id: input.project.clientId, projeto_id: input.project.id, tipo: input.type.trim(), titulo: input.title.trim(), descricao: input.description?.trim() || null, status: 'aguardando' });
  if (result.error) return 'Não foi possível criar a aprovação.';
  void dispatchPendingPushNotifications();
  return null;
}

export async function listAdminRequests(): Promise<ServiceResult<AdminRequestSummary[]>> {
  const modern = await supabase.from('solicitacoes').select('id, projeto_id, categoria, titulo, mensagem, status, origem, created_at, updated_at, clientes(nome), projetos(nome)').order('updated_at', { ascending: false }).limit(200);
  const result = modern.error?.code === '42703' || modern.error?.code === 'PGRST204'
    ? await supabase.from('solicitacoes').select('id, projeto_id, titulo, mensagem, status, created_at, updated_at, clientes(nome), projetos(nome)').order('updated_at', { ascending: false }).limit(200)
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
  const result = await supabase
    .from('notificacoes')
    .select('id, titulo, mensagem, tipo, lida, created_at, link_path, clientes(nome), projetos(nome)')
    .eq('destinatario', 'cliente')
    .order('created_at', { ascending: false })
    .limit(200);
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
      clientName: (Array.isArray(row.clientes) ? row.clientes[0] : row.clientes)?.nome ?? 'Cliente',
      projectName: (Array.isArray(row.projetos) ? row.projetos[0] : row.projetos)?.nome ?? 'Projeto',
    })),
    error: null,
  };
}

export async function listAdminActivityNotifications(): Promise<ServiceResult<AdminNotificationSummary[]>> {
  const result = await supabase
    .from('notificacoes')
    .select('id, titulo, mensagem, tipo, lida, created_at, link_path, clientes(nome), projetos(nome)')
    .eq('destinatario', 'admin')
    .order('created_at', { ascending: false })
    .limit(100);
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

export async function listAdminFinancialEntries(): Promise<ServiceResult<FinancialEntrySummary[]>> {
  const result = await supabase
    .from('financeiro')
    .select('*, projetos(id,nome,numero_contrato,contract_id,clientes(nome),contratos!contract_id(contract_number))')
    .order('data', { ascending: false })
    .limit(500);
  if (result.error) return { data: [], error: 'Não foi possível carregar os lançamentos financeiros atuais.' };
  return {
    data: (result.data ?? []).map((row: any) => {
      const project = Array.isArray(row.projetos) ? row.projetos[0] : row.projetos;
      const client = Array.isArray(project?.clientes) ? project.clientes[0] : project?.clientes;
      const contract = Array.isArray(project?.contratos) ? project.contratos[0] : project?.contratos;
      return {
        id: row.id,
        projectId: row.projeto_id ?? null,
        projectName: project?.nome ?? 'Projeto não identificado',
        clientName: client?.nome ?? 'Cliente não identificado',
        contractNumber: contract?.contract_number ?? project?.numero_contrato ?? 'Sem contrato',
        type: row.tipo ?? 'entrada',
        description: row.descricao ?? 'Lançamento financeiro',
        amount: Number(row.valor ?? 0),
        date: row.data ?? null,
        notes: row.observacoes ?? null,
      } satisfies FinancialEntrySummary;
    }),
    error: null,
  };
}

export async function listFinancialArchive(): Promise<ServiceResult<FinancialArchiveSummary[]>> {
  const result = await supabase
    .from('client_financial_archive')
    .select('id, source_table, client_name_snapshot, contract_number_snapshot, service_type_snapshot, contract_value_snapshot, transaction_type, description, amount, occurred_on, archived_at, archived_reason')
    .order('archived_at', { ascending: false })
    .limit(500);
  if (result.error) return { data: [], error: 'O histórico financeiro preservado não está disponível neste ambiente.' };
  return {
    data: (result.data ?? []).map((row: any) => ({
      id: row.id,
      sourceTable: row.source_table,
      clientName: row.client_name_snapshot,
      contractNumber: row.contract_number_snapshot ?? 'Sem contrato',
      serviceType: row.service_type_snapshot ?? null,
      contractValue: row.contract_value_snapshot === null ? null : Number(row.contract_value_snapshot),
      type: row.transaction_type ?? null,
      description: row.description ?? null,
      amount: row.amount === null ? null : Number(row.amount),
      date: row.occurred_on ?? null,
      archivedAt: row.archived_at,
      reason: row.archived_reason,
    })),
    error: null,
  };
}

export async function createAdminFinancialEntry(input: { projectId: string; description: string; type: 'entrada' | 'saida'; amount: number; date: string; notes?: string }) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) return 'Informe um valor maior que zero.';
  const result = await supabase.from('financeiro').insert({
    projeto_id: input.projectId,
    descricao: input.description.trim(),
    tipo: input.type,
    valor: input.amount,
    data: input.date || null,
    observacoes: input.notes?.trim() || null,
  });
  return result.error ? 'Não foi possível registrar o lançamento.' : null;
}

export async function updateAdminContractValue(contractId: string, value: number) {
  const result = await supabase.rpc('admin_update_contract_value', { p_contract_id: contractId, p_value: value });
  return result.error || result.data !== true ? 'Não foi possível atualizar o valor contratado.' : null;
}

export async function listAdminAudit(): Promise<ServiceResult<AuditEntrySummary[]>> {
  const result = await supabase.from('audit_log').select('id, action, entity_type, entity_id, details, created_at').order('created_at', { ascending: false }).limit(200);
  if (result.error) return { data: [], error: 'Não foi possível carregar a auditoria.' };
  return { data: (result.data ?? []).map((row) => ({ id: row.id, action: row.action, entityType: row.entity_type, entityId: row.entity_id, details: row.details as Record<string, unknown> | null, createdAt: row.created_at })), error: null };
}
