import { createClient } from 'supabase';
import JSZip from 'jszip';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

type Service = ReturnType<typeof createClient>;
type Filters = { clientName?: string; projectName?: string; kind?: string; fromDate?: string; toDate?: string };
type DocRow = {
  id: string;
  nome: string;
  arquivo: string | null;
  storage_bucket: string | null;
  categoria: string | null;
  document_kind: string | null;
  workflow_status: string;
  versao: string | null;
  created_at: string;
  generated_at: string | null;
  cliente_id: string | null;
  projeto_id: string | null;
  contract_id: string | null;
  arquivo_hash: string | null;
  retain_online?: boolean;
  purged_at?: string | null;
  archived_original_path?: string | null;
};
type StoredObject = { bucket: string; path: string };

const selectFields = 'id,nome,arquivo,storage_bucket,categoria,document_kind,workflow_status,versao,created_at,generated_at,cliente_id,projeto_id,contract_id,arquivo_hash,retain_online,purged_at,archived_original_path';
const cutoffIso = (days: number) => new Date(Date.now() - Math.max(30, Math.min(days, 3650)) * 86_400_000).toISOString();

async function requireAdmin(req: Request) {
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) throw new Error('Sessão administrativa ausente.');
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) throw new Error('Configuração segura ausente.');
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) throw new Error('Sessão administrativa inválida.');
  const { data: isAdmin, error: adminError } = await caller.rpc('is_portal_admin');
  if (adminError || isAdmin !== true) throw new Error('Acesso administrativo necessário.');
  return {
    caller,
    service: createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }),
    user: userData.user,
  };
}

async function resolveFilterIds(service: Service, filters: Filters) {
  let clientIds: string[] | null = null;
  let projectIds: string[] | null = null;
  if (filters.clientName?.trim()) {
    const result = await service.from('clientes').select('id').ilike('nome', `%${filters.clientName.trim()}%`).limit(100);
    if (result.error) throw result.error;
    clientIds = (result.data ?? []).map((row) => row.id);
  }
  if (filters.projectName?.trim()) {
    const result = await service.from('projetos').select('id').ilike('nome', `%${filters.projectName.trim()}%`).limit(100);
    if (result.error) throw result.error;
    projectIds = (result.data ?? []).map((row) => row.id);
  }
  return { clientIds, projectIds };
}

function applyFilters(query: any, filters: Filters, ids: { clientIds: string[] | null; projectIds: string[] | null }) {
  let q = query;
  if (ids.clientIds) q = ids.clientIds.length ? q.in('cliente_id', ids.clientIds) : q.eq('cliente_id', '00000000-0000-0000-0000-000000000000');
  if (ids.projectIds) q = ids.projectIds.length ? q.in('projeto_id', ids.projectIds) : q.eq('projeto_id', '00000000-0000-0000-0000-000000000000');
  if (filters.kind?.trim()) q = q.eq('document_kind', filters.kind.trim());
  if (filters.fromDate) q = q.gte('generated_at', `${filters.fromDate}T00:00:00-03:00`);
  if (filters.toDate) q = q.lte('generated_at', `${filters.toDate}T23:59:59-03:00`);
  return q;
}

async function eligibleDocuments(service: Service, days: number, filters: Filters, includeRetained = false) {
  const cutoff = cutoffIso(days);
  const ids = await resolveFilterIds(service, filters);
  let terminalQuery = service.from('documentos').select(selectFields)
    .not('arquivo', 'is', null)
    .is('purged_at', null)
    .is('export_batch_id', null)
    .lte('generated_at', cutoff)
    .in('workflow_status', ['assinado', 'aceito', 'cancelado'])
    .order('generated_at', { ascending: true })
    .limit(250);
  if (!includeRetained) terminalQuery = terminalQuery.eq('retain_online', false);
  terminalQuery = applyFilters(terminalQuery, filters, ids);
  const terminal = await terminalQuery;
  if (terminal.error) throw terminal.error;

  const commercial = await service.from('commercial_records')
    .select('quote_document_id,contract_document_id,status,updated_at')
    .in('status', ['convertido', 'cancelado'])
    .lte('updated_at', cutoff)
    .limit(250);
  if (commercial.error) throw commercial.error;
  const commercialIds = new Set<string>();
  for (const row of commercial.data ?? []) {
    if (row.quote_document_id) commercialIds.add(row.quote_document_id);
    if (row.contract_document_id) commercialIds.add(row.contract_document_id);
  }
  let commercialDocs: DocRow[] = [];
  if (commercialIds.size) {
    let q = service.from('documentos').select(selectFields)
      .in('id', [...commercialIds])
      .not('arquivo', 'is', null)
      .is('purged_at', null)
      .is('export_batch_id', null)
      .limit(250);
    if (!includeRetained) q = q.eq('retain_online', false);
    q = applyFilters(q, filters, ids);
    const result = await q;
    if (result.error) throw result.error;
    commercialDocs = (result.data ?? []) as DocRow[];
  }
  const map = new Map<string, DocRow>();
  for (const row of [...((terminal.data ?? []) as DocRow[]), ...commercialDocs]) map.set(row.id, row);
  return { cutoff, docs: [...map.values()].slice(0, 250) };
}

async function estimateBytes(service: Service, docs: DocRow[]) {
  const sizes = await Promise.all(docs.map(async (doc) => {
    if (!doc.arquivo) return 0;
    const parts = doc.arquivo.split('/');
    const name = parts.pop() ?? '';
    const listed = await service.storage.from(doc.storage_bucket || 'documentos').list(parts.join('/'), { limit: 5, search: name });
    if (listed.error) return 0;
    const exact = (listed.data ?? []).find((item) => item.name === name);
    const size = exact?.metadata && typeof exact.metadata === 'object' ? Number((exact.metadata as Record<string, unknown>).size ?? 0) : 0;
    return Number.isFinite(size) ? size : 0;
  }));
  return sizes.reduce((sum, size) => sum + size, 0);
}

function csvCell(value: unknown) {
  const text = value == null ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}
function manifestCsv(docs: DocRow[]) {
  const rows: unknown[][] = [['id','nome','tipo','categoria','status','versao','criado_em','gerado_em','cliente_id','projeto_id','contrato_id','hash']];
  for (const d of docs) rows.push([d.id,d.nome,d.document_kind ?? '',d.categoria ?? '',d.workflow_status,d.versao ?? '',d.created_at,d.generated_at ?? '',d.cliente_id ?? '',d.projeto_id ?? '',d.contract_id ?? '',d.arquivo_hash ?? '']);
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}
function decodeBase64(value: string) {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}
function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|\r\n]/g, '-').replace(/\.{2,}/g, '.').slice(0, 140) || 'documento.docx';
}

async function markBatchFailed(service: Service, batchId: string, path: string | null, ids: string[]) {
  if (ids.length) {
    await service.from('documentos').update({ exported_at: null, export_batch_id: null }).eq('export_batch_id', batchId);
  }
  if (path) await service.storage.from('documentos').remove([path]);
  await service.from('document_archive_batches').update({ status: 'falhou', archive_path: null }).eq('id', batchId);
}

async function deleteObjects(service: Service, objects: StoredObject[]) {
  const byBucket = new Map<string, string[]>();
  for (const object of objects) {
    if (!object?.bucket || !object?.path) continue;
    const paths = byBucket.get(object.bucket) ?? [];
    paths.push(object.path);
    byBucket.set(object.bucket, paths);
  }
  const failures: Array<{ bucket: string; count: number }> = [];
  let deleted = 0;
  for (const [bucket, rawPaths] of byBucket) {
    const paths = [...new Set(rawPaths)];
    for (let index = 0; index < paths.length; index += 100) {
      const batch = paths.slice(index, index + 100);
      const result = await service.storage.from(bucket).remove(batch);
      if (result.error) failures.push({ bucket, count: batch.length });
      else deleted += batch.length;
    }
  }
  return { deleted, failures };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
  try {
    const { caller, service, user } = await requireAdmin(req);
    const body = await req.json() as { action?: string; olderThanDays?: number; batchId?: string; confirmation?: string; filters?: Filters; documentId?: string; retain?: boolean; fileName?: string; contentBase64?: string };
    const action = body.action ?? 'preview';
    const { error: rateError } = await caller.rpc('consume_admin_rate_limit', { p_action: `document-archive-${action}` });
    if (rateError) return json({ error: 'Muitas operações em sequência. Aguarde e tente novamente.' }, 429);

    if (action === 'preview') {
      const filters = body.filters ?? {};
      const { cutoff, docs } = await eligibleDocuments(service, Number(body.olderThanDays ?? 180), filters);
      const retained = await eligibleDocuments(service, Number(body.olderThanDays ?? 180), filters, true);
      const protectedDocs = retained.docs.filter((d) => d.retain_online);
      return json({
        count: docs.length,
        cutoff,
        limited: docs.length >= 250,
        estimatedBytes: await estimateBytes(service, docs),
        documents: docs.map((d) => ({ id: d.id, name: d.nome, kind: d.document_kind ?? d.categoria, status: d.workflow_status, generatedAt: d.generated_at })),
        protectedDocuments: protectedDocs.map((d) => ({ id: d.id, name: d.nome, kind: d.document_kind ?? d.categoria })),
      });
    }

    if (action === 'retain') {
      if (!body.documentId) return json({ error: 'Documento inválido.' }, 400);
      const updated = await service.from('documentos').update({ retain_online: body.retain === true }).eq('id', body.documentId).select('id').maybeSingle();
      if (updated.error || !updated.data) throw updated.error ?? new Error('Documento não encontrado.');
      await service.from('audit_log').insert({ user_id: user.id, action: body.retain ? 'retain_document_online' : 'release_document_archive', entity_type: 'documentos', entity_id: body.documentId });
      return json({ updated: true });
    }

    if (action === 'export') {
      const { cutoff, docs } = await eligibleDocuments(service, Number(body.olderThanDays ?? 180), body.filters ?? {});
      if (!docs.length) return json({ error: 'Nenhum documento elegível para exportação.' }, 400);
      const batchInsert = await service.from('document_archive_batches').insert({
        cutoff_at: cutoff,
        document_count: docs.length,
        status: 'preparado',
        created_by: user.id,
        manifest: { document_ids: docs.map((d) => d.id), filters: body.filters ?? {} },
      }).select('id').single();
      if (batchInsert.error) throw batchInsert.error;
      const batchId = batchInsert.data.id as string;
      const ids = docs.map((d) => d.id);
      let path: string | null = null;
      try {
        const zip = new JSZip();
        zip.file('manifest.json', JSON.stringify({ batchId, exportedAt: new Date().toISOString(), cutoff, filters: body.filters ?? {}, documents: docs }, null, 2));
        zip.file('manifest.csv', manifestCsv(docs));
        let totalBytes = 0;
        const failures: string[] = [];
        for (const d of docs) {
          if (!d.arquivo) continue;
          const bucket = d.storage_bucket || 'documentos';
          const downloaded = await service.storage.from(bucket).download(d.arquivo);
          if (downloaded.error || !downloaded.data) { failures.push(d.id); continue; }
          const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
          totalBytes += bytes.byteLength;
          if (totalBytes > 100 * 1024 * 1024) throw new Error('O lote ultrapassou 100 MB. Reduza o período e exporte em mais de um lote.');
          const extension = d.arquivo.match(/\.[a-z0-9]{1,10}$/i)?.[0] ?? '.docx';
          const baseName = `${d.document_kind ?? d.categoria ?? 'documento'}-${d.id}-${d.nome}`.replace(/[\\/:*?"<>|]/g, '-').slice(0, 170);
          zip.file(`documentos/${baseName}${baseName.toLowerCase().endsWith(extension.toLowerCase()) ? '' : extension}`, bytes);
        }
        if (failures.length) throw new Error(`Não foi possível baixar ${failures.length} arquivo(s). Nenhuma limpeza foi liberada.`);
        const zipped = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
        path = `_admin_exports/${batchId}/documentos-${new Date().toISOString().slice(0,10)}.zip`;
        const uploaded = await service.storage.from('documentos').upload(path, zipped, { contentType: 'application/zip', upsert: false });
        if (uploaded.error) throw uploaded.error;
        const signed = await service.storage.from('documentos').createSignedUrl(path, 3600);
        if (signed.error || !signed.data?.signedUrl) throw signed.error ?? new Error('Não foi possível emitir o link de exportação.');
        const now = new Date().toISOString();
        const docUpdate = await service.from('documentos').update({ exported_at: now, export_batch_id: batchId }).in('id', ids).is('export_batch_id', null);
        if (docUpdate.error) throw docUpdate.error;
        const batchUpdate = await service.from('document_archive_batches').update({
          status: 'exportado', archive_path: path, exported_at: now,
          manifest: { document_ids: ids, total_bytes: totalBytes, filters: body.filters ?? {} },
        }).eq('id', batchId).eq('status', 'preparado');
        if (batchUpdate.error) throw batchUpdate.error;
        await service.from('audit_log').insert({ user_id: user.id, action: 'export_generated_documents', entity_type: 'document_archive_batches', entity_id: batchId, details: { count: docs.length, total_bytes: totalBytes, cutoff, filters: body.filters ?? {} } });
        return json({ exported: true, batchId, count: docs.length, totalBytes, downloadUrl: signed.data.signedUrl, expiresIn: 3600 });
      } catch (error) {
        await markBatchFailed(service, batchId, path, ids);
        throw error;
      }
    }

    if (action === 'purge') {
      if (!body.batchId || body.confirmation !== 'LIMPAR DOCUMENTOS') return json({ error: 'Confirmação de limpeza inválida.' }, 400);
      const marked = await caller.rpc('admin_mark_exported_documents_purged', { p_batch_id: body.batchId });
      if (marked.error || !marked.data) throw marked.error ?? new Error('Não foi possível registrar a limpeza segura.');
      const objects = Array.isArray(marked.data.objects) ? marked.data.objects as StoredObject[] : [];
      const cleanup = await deleteObjects(service, objects);
      let archiveDeleted = false;
      if (!cleanup.failures.length && marked.data.archivePath) {
        const archiveRemoval = await service.storage.from('documentos').remove([String(marked.data.archivePath)]);
        archiveDeleted = !archiveRemoval.error;
      }
      const warning = cleanup.failures.length
        ? 'Os documentos foram retirados do portal, mas alguns objetos físicos ficaram pendentes para a limpeza de órfãos. O ZIP de segurança foi preservado.'
        : marked.data.archivePath && !archiveDeleted
          ? 'Os documentos foram limpos, mas o ZIP temporário de exportação ficou pendente para limpeza.'
          : null;
      await service.from('audit_log').insert({
        user_id: user.id,
        action: warning ? 'purge_exported_documents_partial_storage_cleanup' : 'purge_exported_documents',
        entity_type: 'document_archive_batches',
        entity_id: body.batchId,
        details: { count: Number(marked.data.count ?? 0), retained: Number(marked.data.retained ?? 0), deleted_objects: cleanup.deleted, failed_batches: cleanup.failures, archive_deleted: archiveDeleted, warning },
      });
      return json({ purged: true, count: Number(marked.data.count ?? 0), warning, storageCleanupComplete: !warning });
    }

    if (action === 'restore') {
      if (!body.documentId || !body.contentBase64) return json({ error: 'Selecione o documento histórico e o arquivo Word correspondente.' }, 400);
      const doc = await service.from('documentos').select('id,arquivo,storage_bucket,purged_at,archived_original_path').eq('id', body.documentId).maybeSingle();
      if (doc.error) throw doc.error;
      if (!doc.data || !doc.data.purged_at || doc.data.arquivo) return json({ error: 'Este documento não está marcado como limpo.' }, 409);
      let bytes: Uint8Array;
      try { bytes = decodeBase64(body.contentBase64); } catch { return json({ error: 'O arquivo de restauração é inválido.' }, 400); }
      if (bytes.byteLength < 4 || bytes.byteLength > 20 * 1024 * 1024 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
        return json({ error: 'Envie um arquivo Word (.docx) válido com no máximo 20 MB.' }, 400);
      }
      const fallback = `restaurados/${doc.data.id}/${safeFileName(body.fileName || 'documento.docx')}`;
      const original = String(doc.data.archived_original_path || fallback);
      if (original.startsWith('/') || original.includes('..') || original.includes('\\')) return json({ error: 'O caminho histórico deste documento é inválido.' }, 409);
      const bucket = doc.data.storage_bucket || 'documentos';
      const uploaded = await service.storage.from(bucket).upload(original, bytes, { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', upsert: false });
      if (uploaded.error) throw uploaded.error;
      const restored = await service.from('documentos').update({
        arquivo: original,
        purged_at: null,
        restored_at: new Date().toISOString(),
        retain_online: true,
        export_batch_id: null,
        exported_at: null,
      }).eq('id', body.documentId).is('arquivo', null).not('purged_at', 'is', null).select('id').maybeSingle();
      if (restored.error || !restored.data) {
        await service.storage.from(bucket).remove([original]);
        throw restored.error ?? new Error('A restauração foi cancelada porque o registro mudou durante a operação.');
      }
      await service.from('audit_log').insert({ user_id: user.id, action: 'restore_archived_document', entity_type: 'documentos', entity_id: body.documentId, details: { path: original, size: bytes.byteLength } });
      return json({ restored: true });
    }

    return json({ error: 'Ação inválida.' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha na operação de arquivo documental.';
    return json({ error: message }, message.includes('Acesso') ? 403 : message.includes('Sessão') ? 401 : 500);
  }
});
