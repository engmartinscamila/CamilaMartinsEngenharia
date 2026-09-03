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
