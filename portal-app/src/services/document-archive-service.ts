import { supabase } from '@/lib/supabase';
import type { ServiceResult } from '@/types/domain';

export interface DocumentArchivePreview {
  count: number;
  cutoff: string;
  limited: boolean;
}

export interface DocumentArchiveBatch {
  id: string;
  cutoffAt: string;
  documentCount: number;
  status: string;
  createdAt: string;
  exportedAt: string | null;
  purgedAt: string | null;
}

export async function previewDocumentArchive(olderThanDays: number): Promise<ServiceResult<DocumentArchivePreview | null>> {
  const result = await supabase.functions.invoke('archive-generated-documents', { body: { action: 'preview', olderThanDays } });
  if (result.error || !result.data) return { data: null, error: result.error?.message ?? 'Não foi possível calcular os documentos elegíveis.' };
  if (result.data.error) return { data: null, error: result.data.error as string };
  return { data: { count: Number(result.data.count ?? 0), cutoff: String(result.data.cutoff ?? ''), limited: Boolean(result.data.limited) }, error: null };
}

export async function exportDocumentArchive(olderThanDays: number): Promise<ServiceResult<{ batchId: string; downloadUrl: string; count: number } | null>> {
  const result = await supabase.functions.invoke('archive-generated-documents', { body: { action: 'export', olderThanDays } });
  if (result.error || !result.data) return { data: null, error: result.error?.message ?? 'Não foi possível exportar os documentos.' };
  if (result.data.error) return { data: null, error: result.data.error as string };
  return { data: { batchId: String(result.data.batchId), downloadUrl: String(result.data.downloadUrl), count: Number(result.data.count ?? 0) }, error: null };
}

export async function purgeDocumentArchive(batchId: string, confirmation: string) {
  const result = await supabase.functions.invoke('archive-generated-documents', { body: { action: 'purge', batchId, confirmation } });
  if (result.error || result.data?.error) return result.data?.error ?? result.error?.message ?? 'Não foi possível limpar os arquivos exportados.';
  return null;
}

export async function listDocumentArchiveBatches(): Promise<ServiceResult<DocumentArchiveBatch[]>> {
  const result = await supabase.from('document_archive_batches').select('id,cutoff_at,document_count,status,created_at,exported_at,purged_at').order('created_at', { ascending: false }).limit(30);
  if (result.error) return { data: [], error: 'Não foi possível carregar o histórico de exportações.' };
  return { data: (result.data ?? []).map((row) => ({ id: row.id, cutoffAt: row.cutoff_at, documentCount: row.document_count, status: row.status, createdAt: row.created_at, exportedAt: row.exported_at, purgedAt: row.purged_at })), error: null };
}
