import { downloadBase64File } from '@/lib/download-generated-file';
import { toUserMessage } from '@/lib/errors';
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

export type ContractDocumentKind =
  | 'anexo_i'
  | 'termo_aceite'
  | 'estudo_preliminar'
  | 'levantamento_tecnico'
  | 'servico_adicional'
  | 'autorizacao_imagem'
  | 'quitacao_encerramento'
  | 'notificacao_formal';

export interface ContractDocumentSummary {
  id: string;
  projectId: string;
  kind: ContractDocumentKind;
  title: string;
  status: string;
  optional: boolean;
  archived: boolean;
  createdAt: string;
  generatedAt: string | null;
}

export interface ProjectApprovalItem {
  id: string;
  title: string;
  type: string;
  status: string;
  description: string | null;
  deliveredAt: string | null;
  dueAt: string | null;
}

export const CONTRACT_SCOPE_PRESETS = [
  ['a', 'Estudo Preliminar'], ['b', 'Anteprojeto'], ['c', 'Projeto Legal'], ['d', 'Projeto Executivo / detalhamento'],
  ['e', 'Projeto Estrutural'], ['f', 'Projeto Elétrico'], ['g', 'Projeto Hidrossanitário'], ['h', 'Projeto de Interiores'],
  ['i', 'Paisagismo'], ['j', 'Render 3D / Maquete eletrônica'], ['k', 'Legalização / Aprovação junto à Prefeitura'],
  ['l', 'Obtenção de Alvará de Construção'], ['m', 'Obtenção de Habite-se'], ['n', 'Acompanhamento técnico de obra'],
  ['o', 'Laudo técnico / avaliação / vistoria'], ['p', 'Outro'],
] as const;

export const CONTRACT_DOCUMENT_OPTIONS: { kind: Exclude<ContractDocumentKind, 'notificacao_formal' | 'termo_aceite'>; title: string; description: string }[] = [
  { kind: 'anexo_i', title: 'Anexo I', description: 'Escopo, proposta comercial, valores e cronograma somente dos serviços contratados.' },
  { kind: 'estudo_preliminar', title: 'Estudo Preliminar', description: 'Documento auxiliar opcional. Se não estiver contratado no item (a), sua geração não altera o escopo do Anexo I.' },
  { kind: 'levantamento_tecnico', title: 'Ficha de Levantamento / Vistoria', description: 'Documento opcional para registrar medidas e condições verificadas no local.' },
  { kind: 'servico_adicional', title: 'Serviço Adicional', description: 'Orçamento e aprovação prévia para trabalho fora do escopo original.' },
  { kind: 'autorizacao_imagem', title: 'Autorização de Uso de Imagem', description: 'Permissões e restrições para divulgação do projeto.' },
  { kind: 'quitacao_encerramento', title: 'Quitação e Encerramento', description: 'Formalização do encerramento e situação financeira do contrato.' },
];

export async function listContractScope(contractId: string): Promise<ServiceResult<ContractScopeItem[]>> {
  const result = await supabase.from('contract_scope_items').select('id, contract_id, service_code, service_name, included, acceptance_required, display_order, notes').eq('contract_id', contractId).order('display_order');
  if (result.error) return { data: [], error: 'Não foi possível carregar o escopo contratual.' };
  return { data: (result.data ?? []).map((row) => ({ id: row.id, contractId: row.contract_id, serviceCode: row.service_code, serviceName: row.service_name, included: row.included, acceptanceRequired: row.acceptance_required, displayOrder: Number(row.display_order ?? 0), notes: row.notes })), error: null };
}

export async function setContractScopeItem(input: { contractId: string; serviceCode: string; serviceName: string; included: boolean; displayOrder: number; acceptanceRequired?: boolean }) {
  const result = await supabase.from('contract_scope_items').upsert({ contract_id: input.contractId, service_code: input.serviceCode, service_name: input.serviceName, included: input.included, acceptance_required: input.acceptanceRequired ?? true, display_order: input.displayOrder, updated_at: new Date().toISOString() }, { onConflict: 'contract_id,service_code' });
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
  return { data: rows.map((row) => ({ approvalId: row.approval_id, projectId: row.project_id, clientId: row.client_id, contractId: row.contract_id, contractNumber: row.contract_number, clientName: row.client_name ?? 'Cliente', projectName: row.project_name, approvalType: row.approval_type, approvalTitle: row.approval_title, deliveredAt: row.delivered_at, dueAt: row.due_at, daysRemaining: Number(row.days_remaining ?? 0), attentionLevel: row.attention_level, formalNoticeRecommended: row.formal_notice_recommended === true, formalNoticeDocumentId: row.formal_notice_document_id, formalNoticeStatus: row.formal_notice_document_id ? statusById.get(row.formal_notice_document_id) ?? null : null })), error: null };
}

export async function listProjectApprovals(projectId: string): Promise<ServiceResult<ProjectApprovalItem[]>> {
  const result = await supabase.from('aprovacoes').select('id, titulo, tipo, status, descricao, delivered_at, approval_due_at').eq('projeto_id', projectId).order('created_at', { ascending: false }).limit(50);
  if (result.error) return { data: [], error: 'Não foi possível carregar as etapas disponíveis para Termo de Aceite.' };
  return { data: (result.data ?? []).map((row) => ({ id: row.id, title: row.titulo, type: row.tipo, status: row.status ?? 'aguardando', description: row.descricao, deliveredAt: row.delivered_at, dueAt: row.approval_due_at })), error: null };
}

export async function listProjectContractDocuments(projectId: string): Promise<ServiceResult<ContractDocumentSummary[]>> {
  const result = await supabase.from('documentos').select('id, projeto_id, nome, arquivo, document_kind, workflow_status, optional_document, created_at, generated_at').eq('projeto_id', projectId).not('document_kind', 'is', null).order('created_at', { ascending: false }).limit(100);
  if (result.error) return { data: [], error: 'Não foi possível carregar os documentos contratuais.' };
  return { data: (result.data ?? []).map((row) => ({ id: row.id, projectId: row.projeto_id, kind: row.document_kind as ContractDocumentKind, title: row.nome, status: row.workflow_status, optional: row.optional_document === true, archived: Boolean(row.arquivo), createdAt: row.created_at, generatedAt: row.generated_at })), error: null };
}

export async function prepareContractDocument(input: { projectId: string; kind: Exclude<ContractDocumentKind, 'notificacao_formal'>; approvalId?: string | null; extraData?: Record<string, unknown> }) {
  const result = await supabase.rpc('admin_prepare_contract_document', { p_project_id: input.projectId, p_document_kind: input.kind, p_approval_id: input.approvalId ?? null, p_extra_data: input.extraData ?? {} });
  return result.error || !result.data ? { documentId: null, error: toUserMessage(result.error, 'Não foi possível preparar o documento. Tente novamente.') } : { documentId: result.data as string, error: null };
}

export async function generateContractDocument(documentId: string, archive = false) {
  const generated = await supabase.functions.invoke('generate-contract-document', { body: { documentId, action: 'generate' } });
  if (generated.error || !generated.data?.generated) return toUserMessage(generated.data?.error ?? generated.error, 'Não foi possível gerar o Word editável. Tente novamente.');

  const delivered = await supabase.functions.invoke('deliver-generated-document', { body: { documentId, archive } });
  if (delivered.error || !delivered.data?.delivered || !delivered.data?.contentBase64) return toUserMessage(delivered.data?.error ?? delivered.error, 'O Word foi gerado, mas não foi possível preparar o download.');
  try {
    await downloadBase64File(String(delivered.data.contentBase64), String(delivered.data.fileName ?? 'documento.docx'));
  } catch (error) {
    return error instanceof Error ? error.message : 'O Word foi gerado, mas não foi possível abrir o download.';
  }
  return null;
}

export async function sendContractDocument(documentId: string) {
  const result = await supabase.functions.invoke('generate-contract-document', { body: { documentId, action: 'send' } });
  if (result.error || !result.data?.sent) return toUserMessage(result.data?.error ?? result.error, 'Não foi possível disponibilizar o documento ao cliente.');
  void dispatchPendingPushNotifications();
  return null;
}

export async function prepareFormalNotice(approvalId: string) {
  const result = await supabase.rpc('admin_prepare_formal_notice', { p_approval_id: approvalId });
  return result.error || !result.data ? { documentId: null, error: toUserMessage(result.error, 'Não foi possível preparar a Notificação Formal.') } : { documentId: result.data as string, error: null };
}

export const generateFormalNotice = generateContractDocument;
export const sendFormalNotice = sendContractDocument;
