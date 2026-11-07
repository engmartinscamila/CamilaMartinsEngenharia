import { readAllRows } from '@/lib/paginated-query';
import { supabase } from '@/lib/supabase';
import type { AuditEntrySummary, ServiceResult } from '@/types/domain';

export async function listAdminAudit(): Promise<ServiceResult<AuditEntrySummary[]>> {
  const result = await readAllRows(supabase.from('audit_log').select('id, action, entity_type, entity_id, user_id, details, created_at').order('created_at', { ascending: false }));
  if (result.error) return { data: [], error: 'Não foi possível carregar a auditoria.' };
  return { data: (result.data ?? []).map((row) => ({ id: row.id, action: row.action, entityType: row.entity_type, entityId: row.entity_id, userId: row.user_id, details: row.details as Record<string, unknown> | null, createdAt: row.created_at })), error: null };
}
