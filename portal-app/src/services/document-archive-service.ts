import { encode } from 'base64-arraybuffer';
import { supabase } from '@/lib/supabase';
import type { ServiceResult } from '@/types/domain';

export interface DocumentArchiveFilters {
  clientName?: string;
  projectName?: string;
  kind?: string;
  fromDate?: string;
  toDate?: string;
}

export interface DocumentArchiveItem {
  id: string;
  name: string;
  kind: string | null;
  status?: string;
  generatedAt?: string | null;
}

export interface DocumentArchivePreview {
  count: number;
  cutoff: string;
  limited: boolean;
  estimatedBytes: number;
  documents: DocumentArchiveItem[];
  protectedDocuments: DocumentArchiveItem[];
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

export interface PurgedDocument {
  id: string;
  name: string;
  kind: string | null;
  purgedAt: string;
}

export async function previewDocumentArchive(olderThanDays: number, filters: DocumentArchiveFilters = {}): Promise<ServiceResult<DocumentArchivePreview | null>> {
  const result = await supabase.functions.invoke('archive-generated-documents', { body: { action: 'preview', olderThanDays, filters } });
  if (result.error || !result.data) return { data: null, error: result.error?.message ?? 'Não foi possível calcular os documentos elegíveis.' };
  if (result.data.error) return { data: null, error: result.data.error as string };
  return { data: {
    count: Number(result.data.count ?? 0), cutoff: String(result.data.cutoff ?? ''), limited: Boolean(result.data.limited), estimatedBytes: Number(result.data.estimatedBytes ?? 0),
    documents: Array.isArray(result.data.documents) ? result.data.documents : [], protectedDocuments: Array.isArray(result.data.protectedDocuments) ? result.data.protectedDocuments : [],
  }, error: null };
}

export async function exportDocumentArchive(olderThanDays: number, filters: DocumentArchiveFilters = {}): Promise<ServiceResult<{ batchId: string; downloadUrl: string; count: number; totalBytes: number } | null>> {
  const result = await supabase.functions.invoke('archive-generated-documents', { body: { action: 'export', olderThanDays, filters } });
  if (result.error || !result.data) return { data: null, error: result.error?.message ?? 'Não foi possível exportar os documentos.' };
  if (result.data.error) return { data: null, error: result.data.error as string };
  return { data: { batchId: String(result.data.batchId), downloadUrl: String(result.data.downloadUrl), count: Number(result.data.count ?? 0), totalBytes: Number(result.data.totalBytes ?? 0) }, error: null };
}

export async function purgeDocumentArchive(batchId: string, confirmation: string) {
  const result = await supabase.functions.invoke('archive-generated-documents', { body: { action: 'purge', batchId, confirmation } });
  if (result.error || result.data?.error) return result.data?.error ?? result.error?.message ?? 'Não foi possível limpar os arquivos exportados.';
  return null;
}

export async function setDocumentRetainOnline(documentId: string, retain: boolean) {
  const result = await supabase.functions.invoke('archive-generated-documents', { body: { action: 'retain', documentId, retain } });
  if (result.error || result.data?.error) return result.data?.error ?? result.error?.message ?? 'Não foi possível alterar a retenção do documento.';
  return null;
}

export async function restorePurgedDocument(documentId: string, fileName: string, buffer: ArrayBuffer) {
  const result = await supabase.functions.invoke('archive-generated-documents', { body: { action: 'restore', documentId, fileName, contentBase64: encode(buffer) } });
  if (result.error || result.data?.error) return result.data?.error ?? result.error?.message ?? 'Não foi possível restaurar o documento.';
  return null;
}

export async function listPurgedDocuments(): Promise<ServiceResult<PurgedDocument[]>> {
  const result = await supabase.from('documentos').select('id,nome,document_kind,categoria,purged_at').not('purged_at', 'is', null).order('purged_at', { ascending: false }).limit(100);
  if (result.error) return { data: [], error: 'Não foi possível carregar os documentos limpos.' };
  return { data: (result.data ?? []).map((row) => ({ id: row.id, name: row.nome, kind: row.document_kind ?? row.categoria, purgedAt: row.purged_at })), error: null };
}

export async function getDocumentArchiveReminder(days = 180): Promise<ServiceResult<number>> {
  const result = await supabase.rpc('admin_document_archive_reminder', { p_days: days });
  if (result.error) return { data: 0, error: 'Não foi possível verificar a manutenção documental.' };
  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  return { data: Number(row?.eligible_count ?? 0), error: null };
}

export async function listDocumentArchiveBatches(): Promise<ServiceResult<DocumentArchiveBatch[]>> {
  const result = await supabase.from('document_archive_batches').select('id,cutoff_at,document_count,status,created_at,exported_at,purged_at').order('created_at', { ascending: false }).limit(30);
  if (result.error) return { data: [], error: 'Não foi possível carregar o histórico de exportações.' };
  return { data: (result.data ?? []).map((row) => ({ id: row.id, cutoffAt: row.cutoff_at, documentCount: row.document_count, status: row.status, createdAt: row.created_at, exportedAt: row.exported_at, purgedAt: row.purged_at })), error: null };
}
