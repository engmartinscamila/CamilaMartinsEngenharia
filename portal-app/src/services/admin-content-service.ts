import { decode } from 'base64-arraybuffer';
import type { DocumentPickerAsset } from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { randomUUID } from 'expo-crypto';
import { Platform } from 'react-native';

import { readAllRows } from '@/lib/paginated-query';
import { toUserMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { dispatchPendingPushNotifications } from '@/services/push-service';
import type { AdminContentKind, AdminContentSummary, ServiceResult } from '@/types/domain';

// Administração de documentos, fotografias e biblioteca: operações do Storage num único módulo.
function safePathSegment(value: string) {
  const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-');
  return normalized.replace(/-{2,}/g, '-').replace(/^-|-$/g, '').slice(0, 60).toLowerCase() || 'geral';
}

const blockedExtensions = new Set(['apk', 'app', 'bat', 'bin', 'cmd', 'com', 'dll', 'dmg', 'exe', 'hta', 'jar', 'js', 'jse', 'msi', 'ps1', 'scr', 'sh', 'vbs', 'wsf']);
const imageExtensions = new Set(['avif', 'heic', 'heif', 'jpeg', 'jpg', 'png', 'webp']);

function assetExtension(asset: DocumentPickerAsset) {
  const match = asset.name.toLowerCase().match(/\.([a-z0-9]{1,10})$/);
  return match?.[1] ?? '';
}

function validateAdminAsset(kind: AdminContentKind, asset: DocumentPickerAsset) {
  if (asset.size && asset.size > 20 * 1024 * 1024) return 'O arquivo excede o limite de 20 MB do aplicativo.';
  const extension = assetExtension(asset);
  const mime = asset.mimeType?.toLowerCase() ?? '';
  if (!extension || blockedExtensions.has(extension) || mime.includes('executable') || mime.includes('x-msdownload')) {
    return 'Este tipo de arquivo não é permitido por segurança.';
  }
  if (kind === 'photo' && !mime.startsWith('image/') && !imageExtensions.has(extension)) {
    return 'Selecione uma imagem válida para o registro fotográfico.';
  }
  return null;
}

function contentTable(kind: AdminContentKind) {
  return kind === 'document' ? 'documentos' : kind === 'photo' ? 'fotos' : 'biblioteca';
}

function contentBucket(kind: AdminContentKind, protectionMode?: string) {
  if (protectionMode === 'authored_pdf' || protectionMode === 'authored_photo') return 'materiais-protegidos';
  return kind === 'document' ? 'documentos' : kind === 'photo' ? 'fotos' : 'materiais-protegidos';
}

export async function listAdminContent(): Promise<ServiceResult<AdminContentSummary[]>> {
  const allContent = (table: string, columns: string) =>
    readAllRows(supabase.from(table).select(columns).order('created_at', { ascending: false }));
  const [documents, photos, library] = await Promise.all([
    allContent('documentos','id, cliente_id, projeto_id, nome, tipo, categoria, versao, created_at, storage_bucket, arquivo, permitir_download, protection_mode, autoral, clientes(nome), projetos(nome)'),
    allContent('fotos','id, cliente_id, projeto_id, nome, categoria, created_at, storage_bucket, arquivo, protection_mode, clientes(nome), projetos(nome)'),
    allContent('biblioteca','id, cliente_id, projeto_id, nome, categoria, created_at, storage_bucket, arquivo, autoral, clientes(nome), projetos(nome)'),
  ]);
  const failed = [documents, photos, library].filter((result) => result.error);
  const rows: AdminContentSummary[] = [];
  const append = (kind: AdminContentKind, data: any[] | null, fallbackBucket: string) => {
    for (const row of data ?? []) {
      const client = Array.isArray(row.clientes) ? row.clientes[0] : row.clientes;
      const project = Array.isArray(row.projetos) ? row.projetos[0] : row.projetos;
      rows.push({
        id: String(row.id),
        kind,
        title: row.nome ?? 'Arquivo',
        category: row.categoria ?? row.tipo ?? (kind === 'photo' ? 'Foto' : kind === 'library' ? 'Biblioteca' : 'Documento'),
        version: row.versao ?? null,
        clientId: row.cliente_id,
        clientName: client?.nome ?? 'Geral',
        projectId: row.projeto_id,
        projectName: project?.nome ?? 'Sem projeto',
        createdAt: row.created_at,
        storageBucket: row.storage_bucket ?? fallbackBucket,
        storagePath: row.arquivo,
        allowDownload: kind === 'document' ? row.permitir_download !== false : kind === 'library',
        protectionMode: kind === 'document'
          ? (row.protection_mode === 'authored_pdf' || row.autoral === true ? 'authored_pdf' : 'administrative')
          : kind === 'photo'
            ? (row.protection_mode === 'administrative' ? 'administrative' : 'authored_photo')
            : 'administrative',
      });
    }
  };
  append('document', documents.data as any[] | null, 'documentos');
  append('photo', photos.data as any[] | null, 'fotos');
  append('library', library.data as any[] | null, 'biblioteca');
  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { data: rows, error: failed.length ? 'Alguns tipos de arquivo estão indisponíveis.' : null };
}

async function assetBody(asset: DocumentPickerAsset) {
  if (Platform.OS === 'web' && asset.file) return asset.file;
  const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
  return decode(base64);
}

export async function uploadAdminContent(input: {
  kind: AdminContentKind;
  clientId: string;
  projectId: string;
  title: string;
  category: string;
  version?: string;
  protectionMode: 'administrative' | 'authored_pdf' | 'authored_photo';
  asset: DocumentPickerAsset;
}) {
  const validationError = validateAdminAsset(input.kind, input.asset);
  if (validationError) return validationError;
  if (input.protectionMode === 'authored_pdf' && assetExtension(input.asset) !== 'pdf') {
    return 'Material técnico autoral deve ser enviado em PDF para receber identificação em todas as páginas.';
  }
  const bucket = contentBucket(input.kind, input.protectionMode);
  const extension = assetExtension(input.asset);
  const path = `${input.projectId}/${safePathSegment(input.category)}/${randomUUID()}.${extension}`;
  try {
    const upload = await supabase.storage.from(bucket).upload(path, await assetBody(input.asset), {
      contentType: input.asset.mimeType ?? 'application/octet-stream',
      upsert: false,
    });
    if (upload.error) return 'Não foi possível enviar o arquivo ao Storage.';

    const common = { cliente_id: input.clientId, projeto_id: input.projectId, nome: input.title.trim(), arquivo: path, storage_bucket: bucket };
    const payload = input.kind === 'document'
      ? { ...common, categoria: input.category.trim() || 'Documento', tipo: input.asset.mimeType ?? 'Arquivo', versao: input.version?.trim() || '1.0', autoral: input.protectionMode !== 'administrative', protection_mode: input.protectionMode, permitir_download: input.protectionMode === 'administrative' }
      : input.kind === 'photo'
        ? { ...common, categoria: input.category.trim() || 'Registro da obra', protection_mode: input.protectionMode }
        : { ...common, categoria: input.category.trim() || 'Material', tipo: input.asset.mimeType ?? 'Arquivo', tamanho: input.asset.size == null ? null : String(input.asset.size), autoral: false };
    const insert = await supabase.from(contentTable(input.kind)).insert(payload as any).select('id').single();
    if (insert.error || !insert.data) {
      const check=await supabase.from(contentTable(input.kind)).select('id').eq('arquivo',path).eq('storage_bucket',bucket).maybeSingle();
      if(check.error)return 'Não foi possível confirmar o cadastro. O arquivo físico foi preservado; confira o catálogo antes de repetir.';
      if(!check.data){await supabase.storage.from(bucket).remove([path]);return 'O arquivo foi revertido porque os metadados não puderam ser registrados.';}
    }
    void dispatchPendingPushNotifications();
    return null;
  } catch (error) {
    return toUserMessage(error, 'Não foi possível preparar o arquivo para envio.');
  }
}

export async function createAdminContentSignedUrl(item: AdminContentSummary) {
  if (!item.storagePath) return { url: null, error: 'Este registro não possui arquivo no Storage.' };
  if (item.kind === 'document' || item.kind === 'photo') {
    const issued = await supabase.functions.invoke('issue-protected-asset', {
      body: { assetId: item.id, kind: item.kind, action: 'view', adminOriginal: true },
    });
    return { url: issued.data?.url ?? null, error: issued.error || !issued.data?.url ? 'Não foi possível registrar e abrir o original administrativo.' : null };
  }
  const result = await supabase.storage.from(item.storageBucket).createSignedUrl(item.storagePath, 300);
  return { url: result.data?.signedUrl ?? null, error: result.error ? 'Não foi possível abrir o arquivo.' : null };
}

export async function deleteAdminContent(item: AdminContentSummary) {
  const metadata = await supabase.from(contentTable(item.kind)).delete().eq('id', item.id).select('id').maybeSingle();
  if (metadata.error || !metadata.data) return 'A exclusão foi interrompida porque o registro não pôde ser removido com segurança.';
  if (item.storagePath) {
    for (const table of ['documentos', 'fotos', 'biblioteca']) {
      const references = await supabase.from(table).select('storage_bucket').eq('arquivo', item.storagePath);
      if (references.error) return 'Cadastro removido. A limpeza física ficou pendente porque os vínculos do arquivo não puderam ser conferidos.';
      if ((references.data ?? []).some((row) => (row.storage_bucket || table) === item.storageBucket)) return null;
    }
    const storage = await supabase.storage.from(item.storageBucket).remove([item.storagePath]);
    if (storage.error) return 'O registro foi excluído, mas o arquivo físico ficou pendente para a limpeza de órfãos do Storage.';
  }
  return null;
}
