import { supabase } from '@/lib/supabase';
import { dispatchPendingPushNotifications } from '@/services/push-service';
import type { ServiceResult } from '@/types/domain';

export interface ContractScopeItem {
  id: string;
  contractId: string;
  serviceCode: string;
  serviceName: string;
  included: boolean;
  acceptanceRequired: boolean;
  displayOrder: number;
  notes: string | null;
}

export interface DocumentAttentionItem {
  approvalId: string;
  projectId: string;
  clientId: string;
  contractId: string;
  contractNumber: string;
  clientName: string;
  projectName: string;
  approvalType: string;
  approvalTitle: string;
  deliveredAt: string;
  dueAt: string;
  daysRemaining: number;
  attentionLevel: 'normal' | 'warning' | 'overdue';
  formalNoticeRecommended: boolean;
  formalNoticeDocumentId: string | null;
  formalNoticeStatus: string | null;
}

export const CONTRACT_SCOPE_PRESETS = [
  ['a', 'Estudo Preliminar'],
  ['b', 'Anteprojeto'],
  ['c', 'Projeto Legal'],
  ['d', 'Projeto Executivo / detalhamento'],
  ['e', 'Projeto Estrutural'],
  ['f', 'Projeto Elétrico'],
  ['g', 'Projeto Hidrossanitário'],
  ['h', 'Projeto de Interiores'],
  ['i', 'Paisagismo'],
  ['j', 'Render 3D / Maquete eletrônica'],
  ['k', 'Legalização / Aprovação junto à Prefeitura'],
  ['l', 'Obtenção de Alvará de Construção'],
  ['m', 'Obtenção de Habite-se'],
  ['n', 'Acompanhamento técnico de obra'],
  ['o', 'Laudo técnico / avaliação / vistoria'],
  ['p', 'Outro'],
] as const;

export async function listContractScope(contractId: string): Promise<ServiceResult<ContractScopeItem[]>> {
  const result = await supabase
    .from('contract_scope_items')
    .select('id, contract_id, service_code, service_name, included, acceptance_required, display_order, notes')
    .eq('contract_id', contractId)
    .order('display_order');
  if (result.error) return { data: [], error: 'Não foi possível carregar o escopo contratual.' };
  return {
    data: (result.data ?? []).map((row) => ({
      id: row.id,
      contractId: row.contract_id,
      serviceCode: row.service_code,
      serviceName: row.service_name,
      included: row.included,
      acceptanceRequired: row.acceptance_required,
      displayOrder: Number(row.display_order ?? 0),
      notes: row.notes,
    })),
    error: null,
  };
}

export async function setContractScopeItem(input: {
  contractId: string;
  serviceCode: string;
  serviceName: string;
  included: boolean;
  displayOrder: number;
  acceptanceRequired?: boolean;
}) {
  const result = await supabase.from('contract_scope_items').upsert({
    contract_id: input.contractId,
    service_code: input.serviceCode,
    service_name: input.serviceName,
    included: input.included,
    acceptance_required: input.acceptanceRequired ?? true,
    display_order: input.displayOrder,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'contract_id,service_code' });
  return result.error ? 'Não foi possível atualizar o escopo contratado.' : null;
}

export async function listAdminDocumentAttention(): Promise<ServiceResult<DocumentAttentionItem[]>> {
  const result = await supabase.rpc('admin_document_attention');
  if (result.error) return { data: [], error: 'Não foi possível carregar os alertas contratuais.' };
  const rows = (result.data ?? []) as any[];
  const documentIds = rows.map((row) => row.formal_notice_document_id).filter(Boolean) as string[];
  const statusById = new Map<string, string>();
  if (documentIds.length) {
    const documents = await supabase.from('documentos').select('id, workflow_status').in('id', documentIds);
    for (const row of documents.data ?? []) statusById.set(row.id, row.workflow_status);
  }
  return {
    data: rows.map((row) => ({
      approvalId: row.approval_id,
      projectId: row.project_id,
      clientId: row.client_id,
      contractId: row.contract_id,
      contractNumber: row.contract_number,
      clientName: row.client_name ?? 'Cliente',
      projectName: row.project_name,
      approvalType: row.approval_type,
      approvalTitle: row.approval_title,
      deliveredAt: row.delivered_at,
      dueAt: row.due_at,
      daysRemaining: Number(row.days_remaining ?? 0),
      attentionLevel: row.attention_level,
      formalNoticeRecommended: row.formal_notice_recommended === true,
      formalNoticeDocumentId: row.formal_notice_document_id,
      formalNoticeStatus: row.formal_notice_document_id ? statusById.get(row.formal_notice_document_id) ?? null : null,
    })),
    error: null,
  };
}

export async function prepareFormalNotice(approvalId: string) {
  const result = await supabase.rpc('admin_prepare_formal_notice', { p_approval_id: approvalId });
  return result.error || !result.data ? { documentId: null, error: 'Não foi possível preparar a Notificação Formal.' } : { documentId: result.data as string, error: null };
}

export async function generateFormalNotice(documentId: string) {
  const result = await supabase.functions.invoke('generate-contract-document', { body: { documentId, action: 'generate' } });
  return result.error || !result.data?.generated ? 'Não foi possível gerar o Word da Notificação Formal.' : null;
}

export async function sendFormalNotice(documentId: string) {
  const result = await supabase.functions.invoke('generate-contract-document', { body: { documentId, action: 'send' } });
  if (result.error || !result.data?.sent) return 'Não foi possível disponibilizar a Notificação Formal ao cliente.';
  void dispatchPendingPushNotifications();
  return null;
}
