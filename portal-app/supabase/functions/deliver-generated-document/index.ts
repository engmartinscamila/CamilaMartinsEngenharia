import { createClient } from 'supabase';
import { encodeBase64 } from 'jsr:@std/encoding@1/base64';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } });

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

const safeFileName = (value: string) => value.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 160) || 'documento.docx';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  try {
    const { caller, service, user } = await requireAdmin(req);
    const body = await req.json() as { documentId?: string; archive?: boolean };
    const documentId = typeof body.documentId === 'string' ? body.documentId : '';
    const archive = body.archive === true;
    if (!/^[0-9a-f-]{36}$/i.test(documentId)) return json({ error: 'Documento inválido.' }, 400);

    const { error: rateError } = await caller.rpc('consume_admin_rate_limit', { p_action: archive ? 'document-delivery-archive' : 'document-delivery-download' });
    if (rateError) return json({ error: 'Muitas operações em sequência. Aguarde e tente novamente.' }, 429);

    const rowResult = await service.from('documentos')
      .select('id,nome,arquivo,storage_bucket,categoria,document_kind,workflow_status,versao,cliente_id,projeto_id,contract_id,generated_data')
      .eq('id', documentId).maybeSingle();
    if (rowResult.error) throw rowResult.error;
    if (!rowResult.data) return json({ error: 'Documento não encontrado.' }, 404);
    const row = rowResult.data;
    if (!row.arquivo) return json({ error: 'O Word ainda não foi gerado para entrega.' }, 409);

    const bucket = row.storage_bucket || 'documentos';
    const downloaded = await service.storage.from(bucket).download(row.arquivo);
    if (downloaded.error || !downloaded.data) throw downloaded.error ?? new Error('Não foi possível obter o Word gerado.');
    const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
    if (bytes.byteLength > 20 * 1024 * 1024) return json({ error: 'O Word gerado ultrapassa o limite de 20 MB para entrega direta.' }, 413);

    const generatedData = row.generated_data && typeof row.generated_data === 'object' ? row.generated_data as Record<string, unknown> : {};
    let partyName = typeof generatedData.prospect_name === 'string' ? generatedData.prospect_name : typeof generatedData.client_name === 'string' ? generatedData.client_name : null;
    if (!partyName && row.cliente_id) {
      const client = await service.from('clientes').select('nome').eq('id', row.cliente_id).maybeSingle();
      if (!client.error && client.data?.nome) partyName = client.data.nome;
    }
    const commercialRecordId = typeof generatedData.commercial_record_id === 'string' && /^[0-9a-f-]{36}$/i.test(generatedData.commercial_record_id) ? generatedData.commercial_record_id : null;
    const documentNumber = typeof generatedData.contract_number === 'string' && generatedData.contract_number ? generatedData.contract_number : typeof generatedData.quote_number === 'string' ? generatedData.quote_number : null;
    const fileName = safeFileName(`${row.nome}.docx`);
    const now = new Date().toISOString();

    const historyInsert = await service.from('document_generation_history').insert({
      document_id: row.id,
      document_kind: row.document_kind ?? row.categoria,
      document_name: row.nome,
      document_number: documentNumber,
      version: row.versao,
      workflow_status: row.workflow_status,
      client_id: row.cliente_id,
      project_id: row.projeto_id,
      contract_id: row.contract_id,
      commercial_record_id: commercialRecordId,
      party_name: partyName,
      storage_mode: archive ? 'archived' : 'download_only',
      file_size_bytes: bytes.byteLength,
      generated_by: user.id,
      generated_at: now,
    }).select('id').single();
    if (historyInsert.error) throw historyInsert.error;
    const historyId = historyInsert.data.id as string;

    let archivePath: string | null = null;
    if (archive) {
      const originalName = row.arquivo.split('/').pop() || fileName;
      archivePath = `_generated_archive/${row.id}/${historyId}-${safeFileName(originalName)}`;
      const uploaded = await service.storage.from(bucket).upload(archivePath, bytes, { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', upsert: false });
      if (uploaded.error) throw uploaded.error;
      if (archivePath !== row.arquivo) {
        const removed = await service.storage.from(bucket).remove([row.arquivo]);
        if (removed.error) throw removed.error;
      }
      const updated = await service.from('documentos').update({
        arquivo: archivePath,
        storage_bucket: bucket,
        archived_explicitly: true,
        last_downloaded_at: now,
        archived_storage_size: bytes.byteLength,
        purged_at: null,
      }).eq('id', row.id);
      if (updated.error) throw updated.error;
      const historyUpdated = await service.from('document_generation_history').update({ archive_path: archivePath }).eq('id', historyId);
      if (historyUpdated.error) throw historyUpdated.error;
    } else {
      const removed = await service.storage.from(bucket).remove([row.arquivo]);
      if (removed.error) throw removed.error;
      const updated = await service.from('documentos').update({
        arquivo: null,
        archived_explicitly: false,
        last_downloaded_at: now,
        archived_storage_size: null,
      }).eq('id', row.id);
      if (updated.error) throw updated.error;
    }

    await service.from('audit_log').insert({
      user_id: user.id,
      action: archive ? 'download_and_archive_generated_document' : 'download_generated_document_without_archive',
      entity_type: 'documentos',
      entity_id: row.id,
      details: { history_id: historyId, file_size_bytes: bytes.byteLength, archive_path: archivePath },
    });

    return json({ delivered: true, documentId: row.id, historyId, fileName, contentBase64: encodeBase64(bytes), archived: archive, archivePath, fileSizeBytes: bytes.byteLength });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível entregar o Word gerado.';
    return json({ error: message }, message.includes('Acesso') ? 403 : message.includes('Sessão') ? 401 : 500);
  }
});
