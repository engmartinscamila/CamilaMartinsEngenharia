import {supabase} from '@/lib/supabase';

export type ScheduleBaselineArchive = {
  id: string;
  scheduleId: string;
  version: number;
  archivedAt: string;
  approvedAt: string | null;
  contractNumber: string | null;
  holidays: string[];
  activities: Array<{code: string; activity: string; start: string | null; finish: string | null}>;
};

/** Somente administrador: a RLS e os GRANTs nunca expõem snapshots internos aos clientes. */
export async function listConstructionScheduleBaselines(page: number): Promise<{
  data: ScheduleBaselineArchive[];
  total: number;
  error: string | null;
}> {
  if (!Number.isSafeInteger(page) || page < 0) return {data: [], total: 0, error: 'Página inválida.'};
  const pageSize = 50;
  const response = await supabase.from('construction_schedule_baseline_versions')
    .select('id,schedule_id,baseline_version,baseline_snapshot,holiday_dates,approved_at,archived_at', {count: 'exact'})
    .order('archived_at', {ascending: false}).order('id', {ascending: false})
    .range(page * pageSize, page * pageSize + pageSize - 1);
  if (response.error) return {data: [], total: 0, error: 'Não foi possível consultar o histórico das linhas de base. Confira a implantação e as permissões.'};
  const items: ScheduleBaselineArchive[] = [];
  for (const row of response.data ?? []) {
    const snapshot = row.baseline_snapshot as {scope?: {contract_number?: string}; activities?: Array<Record<string, unknown>>} | null;
    if (!snapshot || !Array.isArray(snapshot.activities) || !snapshot.activities.length || !Array.isArray(row.holiday_dates)) {
      return {data: [], total: 0, error: 'Uma versão arquivada está incompleta; interrompida a visualização para revisão.'};
    }
    items.push({
      id: String(row.id), scheduleId: String(row.schedule_id), version: Number(row.baseline_version),
      archivedAt: String(row.archived_at), approvedAt: row.approved_at ? String(row.approved_at) : null,
      contractNumber: snapshot.scope?.contract_number ?? null,
      holidays: row.holiday_dates.map((value) => String(value)),
      activities: snapshot.activities.map((activity) => ({
        code: String(activity.code ?? ''), activity: String(activity.activity ?? ''),
        start: activity.planned_start ? String(activity.planned_start).slice(0, 10) : null,
        finish: activity.planned_finish ? String(activity.planned_finish).slice(0, 10) : null,
      })),
    });
  }
  return {data: items, total: response.count ?? items.length, error: null};
}
