import { supabase } from '@/lib/supabase';

export type ClientDocumentDecision = 'accepted' | 'accepted_with_notes' | 'rejected';

export interface ClientDocumentGovernanceItem {
  documentId: string;
  documentKind: string;
  documentName: string;
  version: string;
  lifecycleStatus: string;
  acceptanceRequired: boolean;
  acceptanceDecision: ClientDocumentDecision | null;
  acceptedAt: string | null;
  validUntil: string | null;
  isCurrent: boolean;
}

export interface AdminDocumentMapItem {
  documentKind: string;
  label: string;
  requiredNow: boolean;
  documentId: string | null;
  documentName: string | null;
  version: string | null;
  lifecycleStatus: string;
  acceptanceRequired: boolean;
  acceptanceDecision: ClientDocumentDecision | null;
  validUntil: string | null;
  isCurrent: boolean;
}

export interface AdminDocumentAlertItem {
  id: string;
  projectId: string;
  projectName: string;
  alertCode: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  dueAt: string;
  isDue: boolean;
  sourceDocumentId: string | null;
}

export async function listClientDocumentGovernance(projectId: string) {
  const { data, error } = await supabase.rpc('client_document_map', { p_project_id: projectId });
  return {
    data: (data ?? []).map((row: any): ClientDocumentGovernanceItem => ({
      documentId: row.document_id,
      documentKind: row.document_kind,
      documentName: row.document_name,
      version: row.version ?? '1.0',
      lifecycleStatus: row.lifecycle_status,
      acceptanceRequired: row.acceptance_required === true,
      acceptanceDecision: row.acceptance_decision ?? null,
      acceptedAt: row.accepted_at ?? null,
      validUntil: row.valid_until ?? null,
      isCurrent: row.is_current !== false,
    })),
    error: error ? error.message || 'Não foi possível carregar os aceites documentais.' : null,
  };
}

export async function acceptClientDocument(documentId: string, decision: ClientDocumentDecision, note: string) {
  const { error } = await supabase.rpc('client_accept_document', {
    p_document_id: documentId,
    p_decision: decision,
    p_note: note.trim() || null,
    p_source: 'app',
    p_client_context: { platform: 'mobile-app' },
  });
  return error ? error.message || 'Não foi possível registrar sua manifestação.' : null;
}

export async function listAdminDocumentMap(projectId: string) {
  const { data, error } = await supabase.rpc('admin_project_document_map', { p_project_id: projectId });
  return {
    data: (data ?? []).map((row: any): AdminDocumentMapItem => ({
      documentKind: row.document_kind,
      label: row.label,
      requiredNow: row.required_now === true,
      documentId: row.document_id ?? null,
      documentName: row.document_name ?? null,
      version: row.version ?? null,
      lifecycleStatus: row.lifecycle_status,
      acceptanceRequired: row.acceptance_required === true,
      acceptanceDecision: row.acceptance_decision ?? null,
      validUntil: row.valid_until ?? null,
      isCurrent: row.is_current === true,
    })),
    error: error ? error.message || 'Não foi possível carregar o mapa documental.' : null,
  };
}

export async function listAdminDocumentAlerts(projectId?: string | null) {
  const { data, error } = await supabase.rpc('admin_document_pending_alerts', { p_project_id: projectId ?? null });
  return {
    data: (data ?? []).map((row: any): AdminDocumentAlertItem => ({
      id: row.id,
      projectId: row.project_id,
      projectName: row.project_name,
      alertCode: row.alert_code,
      title: row.title,
      message: row.message,
      severity: row.severity,
      dueAt: row.due_at,
      isDue: row.is_due === true,
      sourceDocumentId: row.source_document_id ?? null,
    })),
    error: error ? error.message || 'Não foi possível carregar as pendências documentais.' : null,
  };
}

export async function releaseDocumentForClient(documentId: string, acceptanceRequired = true, validUntil?: string | null) {
  const { error } = await supabase.rpc('admin_release_document_for_client', {
    p_document_id: documentId,
    p_acceptance_required: acceptanceRequired,
    p_valid_from: null,
    p_valid_until: validUntil || null,
  });
  return error ? error.message || 'Não foi possível liberar o documento ao cliente.' : null;
}

export async function setDocumentValidity(documentId: string, validFrom: string | null, validUntil: string | null) {
  const { error } = await supabase.rpc('admin_set_document_validity', {
    p_document_id: documentId,
    p_valid_from: validFrom || null,
    p_valid_until: validUntil || null,
  });
  return error ? error.message || 'Não foi possível atualizar a validade.' : null;
}

export async function supersedeDocument(oldDocumentId: string, newDocumentId: string, reason: string) {
  const { error } = await supabase.rpc('admin_supersede_document', {
    p_old_document_id: oldDocumentId,
    p_new_document_id: newDocumentId,
    p_reason: reason,
  });
  return error ? error.message || 'Não foi possível registrar a substituição.' : null;
}
