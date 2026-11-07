import { readAllRows } from '@/lib/paginated-query';
import { numberOrNull } from '@/lib/format';
import { isMissingRelationError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { dispatchPendingPushNotifications } from '@/services/push-service';
import type {
  AdminClientSummary,
  AdminContractSummary,
  AdminProjectSummary,
  ClientDeletionPreview,
  ServiceResult,
} from '@/types/domain';

// Clientes, propostas contratuais e projetos sem vínculo circular obrigatório.
function compatibilityError(error: { code?: string; message?: string } | null) {
  return Boolean(error && (isMissingRelationError(error) || ['42703', '42883', 'PGRST200', 'PGRST202', 'PGRST204'].includes(error.code ?? '')));
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
