import { createClient } from 'supabase';
import JSZip from 'jszip';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
});

async function requireAdmin(req: Request) {
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) throw new Error('Sessão administrativa ausente.');
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) throw new Error('Configuração segura ausente.');
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) throw new Error('Sessão administrativa inválida.');
  const { data: isAdmin, error: adminError } = await caller.rpc('is_portal_admin');
  if (adminError || isAdmin !== true) throw new Error('Acesso administrativo necessário.');
  return { caller, service: createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }), user: userData.user };
}

type DocRow = {
  id: string; nome: string; arquivo: string | null; storage_bucket: string | null; categoria: string | null;
  document_kind: string | null; workflow_status: string; versao: string | null; created_at: string; generated_at: string | null;
  cliente_id: string | null; projeto_id: string | null; contract_id: string | null; arquivo_hash: string | null;
};

function cutoffIso(days: number) {
  const safe = Math.max(30, Math.min(days, 3650));
  return new Date(Date.now() - safe * 86_400_000).toISOString();
}

async function eligibleDocuments(service: ReturnType<typeof createClient>, days: number) {
  const cutoff = cutoffIso(days);
  const terminal = await service.from('documentos')
    .select('id,nome,arquivo,storage_bucket,categoria,document_kind,workflow_status,versao,created_at,generated_at,cliente_id,projeto_id,contract_id,arquivo_hash')
    .not('arquivo', 'is', null).is('purged_at', null).lte('generated_at', cutoff)
    .in('workflow_status', ['assinado', 'aceito', 'cancelado'])
    .order('generated_at', { ascending: true }).limit(250);
  if (terminal.error) throw terminal.error;

  const commercial = await service.from('commercial_records')
    .select('quote_document_id,contract_document_id,status,updated_at')
    .in('status', ['convertido', 'cancelado']).lte('updated_at', cutoff).limit(250);
  if (commercial.error) throw commercial.error;
  const commercialIds = new Set<string>();
  for (const row of commercial.data ?? []) {
    if (row.quote_document_id) commercialIds.add(row.quote_document_id);
    if (row.contract_document_id) commercialIds.add(row.contract_document_id);
  }
  let commercialDocs: DocRow[] = [];
  if (commercialIds.size) {
    const result = await service.from('documentos')
      .select('id,nome,arquivo,storage_bucket,categoria,document_kind,workflow_status,versao,created_at,generated_at,cliente_id,projeto_id,contract_id,arquivo_hash')
      .in('id', [...commercialIds]).not('arquivo', 'is', null).is('purged_at', null).limit(250);
    if (result.error) throw result.error;
    commercialDocs = (result.data ?? []) as DocRow[];
  }
  const map = new Map<string, DocRow>();
  for (const row of [...((terminal.data ?? []) as DocRow[]), ...commercialDocs]) map.set(row.id, row);
  return { cutoff, docs: [...map.values()].slice(0, 250) };
}

function csvCell(value: unknown) {
  const text = value == null ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function manifestCsv(docs: DocRow[]) {
  const rows = [['id','nome','tipo','categoria','status','versao','criado_em','gerado_em','cliente_id','projeto_id','contrato_id','hash']];
  for (const d of docs) rows.push([d.id,d.nome,d.document_kind ?? '',d.categoria ?? '',d.workflow_status,d.versao ?? '',d.created_at,d.generated_at ?? '',d.cliente_id ?? '',d.projeto_id ?? '',d.contract_id ?? '',d.arquivo_hash ?? '']);
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
  try {
    const { caller, service, user } = await requireAdmin(req);
    const body = await req.json() as { action?: string; olderThanDays?: number; batchId?: string; confirmation?: string };
    const action = body.action ?? 'preview';
    const { error: rateError } = await caller.rpc('consume_admin_rate_limit', { p_action: `document-archive-${action}` });
    if (rateError) return json({ error: 'Muitas operações em sequência. Aguarde e tente novamente.' }, 429);

    if (action === 'preview') {
      const { cutoff, docs } = await eligibleDocuments(service, Number(body.olderThanDays ?? 180));
      return json({ count: docs.length, cutoff, limited: docs.length >= 250, documents: docs.map((d) => ({ id: d.id, name: d.nome, kind: d.document_kind ?? d.categoria, status: d.workflow_status, generatedAt: d.generated_at })) });
    }

    if (action === 'export') {
      const { cutoff, docs } = await eligibleDocuments(service, Number(body.olderThanDays ?? 180));
      if (!docs.length) return json({ error: 'Nenhum documento elegível para exportação.' }, 400);
      const batchInsert = await service.from('document_archive_batches').insert({ cutoff_at: cutoff, document_count: docs.length, status: 'preparado', created_by: user.id, manifest: { document_ids: docs.map((d) => d.id) } }).select('id').single();
      if (batchInsert.error) throw batchInsert.error;
      const batchId = batchInsert.data.id as string;
      const zip = new JSZip();
      zip.file('manifest.json', JSON.stringify({ batchId, exportedAt: new Date().toISOString(), cutoff, documents: docs }, null, 2));
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
        const safeName = `${d.document_kind ?? d.categoria ?? 'documento'}-${d.id}-${d.nome}`.replace(/[\\/:*?"<>|]/g, '-').slice(0, 180);
        zip.file(`documentos/${safeName}.docx`, bytes);
      }
      if (failures.length) throw new Error(`Não foi possível baixar ${failures.length} arquivo(s). Nenhuma limpeza foi liberada.`);
      const zipped = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      const path = `_admin_exports/${batchId}/documentos-${new Date().toISOString().slice(0,10)}.zip`;
      const uploaded = await service.storage.from('documentos').upload(path, zipped, { contentType: 'application/zip', upsert: false });
      if (uploaded.error) throw uploaded.error;
      const signed = await service.storage.from('documentos').createSignedUrl(path, 3600);
      if (signed.error) throw signed.error;
      const now = new Date().toISOString();
      const ids = docs.map((d) => d.id);
      const docUpdate = await service.from('documentos').update({ exported_at: now, export_batch_id: batchId }).in('id', ids);
      if (docUpdate.error) throw docUpdate.error;
      const batchUpdate = await service.from('document_archive_batches').update({ status: 'exportado', archive_path: path, exported_at: now, manifest: { document_ids: ids, total_bytes: totalBytes } }).eq('id', batchId);
      if (batchUpdate.error) throw batchUpdate.error;
      await service.from('audit_log').insert({ user_id: user.id, action: 'export_generated_documents', entity_type: 'document_archive_batches', entity_id: batchId, details: { count: docs.length, total_bytes: totalBytes, cutoff } });
      return json({ exported: true, batchId, count: docs.length, totalBytes, downloadUrl: signed.data.signedUrl, expiresIn: 3600 });
    }

    if (action === 'purge') {
      if (!body.batchId || body.confirmation !== 'LIMPAR DOCUMENTOS') return json({ error: 'Confirmação de limpeza inválida.' }, 400);
      const batch = await service.from('document_archive_batches').select('id,status,archive_path').eq('id', body.batchId).maybeSingle();
      if (batch.error) throw batch.error;
      if (!batch.data || batch.data.status !== 'exportado') return json({ error: 'Somente lotes exportados podem ser limpos.' }, 409);
      const rows = await service.from('documentos').select('id,arquivo,storage_bucket').eq('export_batch_id', body.batchId).is('purged_at', null);
      if (rows.error) throw rows.error;
      for (const d of rows.data ?? []) {
        if (d.arquivo) {
          const removed = await service.storage.from(d.storage_bucket || 'documentos').remove([d.arquivo]);
          if (removed.error) throw removed.error;
        }
      }
      const now = new Date().toISOString();
      const ids = (rows.data ?? []).map((d) => d.id);
      if (ids.length) {
        const cleaned = await service.from('documentos').update({ arquivo: null, purged_at: now, generated_data: { archived: true, export_batch_id: body.batchId } }).in('id', ids);
        if (cleaned.error) throw cleaned.error;
      }
      if (batch.data.archive_path) await service.storage.from('documentos').remove([batch.data.archive_path]);
      const batchUpdate = await service.from('document_archive_batches').update({ status: 'limpo', purged_at: now }).eq('id', body.batchId);
      if (batchUpdate.error) throw batchUpdate.error;
      await service.from('audit_log').insert({ user_id: user.id, action: 'purge_exported_documents', entity_type: 'document_archive_batches', entity_id: body.batchId, details: { count: ids.length } });
      return json({ purged: true, count: ids.length });
    }

    return json({ error: 'Ação inválida.' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha na operação de arquivo documental.';
    return json({ error: message }, message.includes('Acesso') ? 403 : message.includes('Sessão') ? 401 : 500);
  }
});
