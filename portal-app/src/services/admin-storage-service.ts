import { supabase } from '@/lib/supabase';
import type { ServiceResult, StorageOverview, StorageOrphanDetails } from '@/types/domain';

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
