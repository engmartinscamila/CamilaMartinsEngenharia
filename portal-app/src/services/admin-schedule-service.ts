import { readAllRows } from '@/lib/paginated-query';
import { normalizeStatus, numberOrNull } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { dispatchPendingPushNotifications } from '@/services/push-service';
import type { AdminProjectSummary, AgendaSummary, ScheduleStageSummary, ServiceResult } from '@/types/domain';

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
