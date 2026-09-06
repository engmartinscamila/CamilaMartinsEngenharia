import { createClient } from 'npm:@supabase/supabase-js@2';

import { environment } from '../_shared/admin.ts';
import { cleanText, corsHeaders, json } from '../_shared/http.ts';

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
  try {
    const body = await request.json();
    const token = cleanText(body.token, 48).toLowerCase();
    const documentId = cleanText(body.documentId, 36);
    if (!/^[a-f0-9]{48}$/.test(token)) return json({ error: 'Acesso inválido ou expirado.' }, 404);

    const { url, serviceKey } = environment();
    const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const tokenHash = await sha256(token);
    const { data: link, error: linkError } = await service
      .from('prospect_access_links')
      .select('id,commercial_record_id,expires_at,max_uses,use_count,revoked_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();
    if (linkError || !link || link.revoked_at || new Date(link.expires_at).getTime() <= Date.now() || link.use_count >= link.max_uses) {
      return json({ error: 'Acesso inválido ou expirado.' }, 404);
    }

    const [{ data: record, error: recordError }, { data: linkedDocuments, error: linksError }] = await Promise.all([
      service.from('commercial_records')
        .select('prospect_name,quote_number,contract_number')
        .eq('id', link.commercial_record_id)
        .maybeSingle(),
      service.from('prospect_access_documents')
        .select('document_id')
        .eq('link_id', link.id),
    ]);
    if (recordError || !record) throw new Error('Não foi possível consultar os dados deste acesso.');
    if (linksError) throw new Error('Não foi possível consultar os documentos liberados.');
    const documentIds = (linkedDocuments ?? []).map((row) => row.document_id);
    const { data: documents, error: documentsError } = documentIds.length
      ? await service.from('documentos')
        .select('id,nome,categoria,versao,storage_bucket,arquivo,permitir_download')
        .in('id', documentIds)
      : { data: [], error: null };
    if (documentsError) throw new Error('Não foi possível consultar os documentos liberados.');

    if (!documentId) {
      return json({
        prospectName: record?.prospect_name ?? 'Prospect',
        quoteNumber: record?.quote_number ?? null,
        contractNumber: record?.contract_number ?? null,
        expiresAt: link.expires_at,
        remainingUses: Math.max(0, link.max_uses - link.use_count),
        documents: (documents ?? []).map((document: any) => ({
          id: document.id, title: document.nome, category: document.categoria,
          version: document.versao, downloadAllowed: document.permitir_download !== false,
        })),
      });
    }

    if (!/^[0-9a-f-]{36}$/i.test(documentId)) return json({ error: 'Documento inválido.' }, 400);
    const document = (documents ?? []).find((item: any) => item.id === documentId);
    if (!document?.storage_bucket || !document?.arquivo) return json({ error: 'Documento não disponível.' }, 404);
    const consumed = await service.from('prospect_access_links')
      .update({ use_count: link.use_count + 1 })
      .eq('id', link.id).eq('use_count', link.use_count).lt('use_count', link.max_uses)
      .select('id').maybeSingle();
    if (consumed.error || !consumed.data) return json({ error: 'O limite deste acesso foi atingido.' }, 409);
    const signed = await service.storage.from(document.storage_bucket).createSignedUrl(document.arquivo, 600, {
      download: document.permitir_download !== false ? document.nome ?? true : false,
    });
    if (signed.error || !signed.data?.signedUrl) throw new Error('Não foi possível emitir o acesso temporário.');
    return json({ url: signed.data.signedUrl, expiresInSeconds: 600 });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Falha no acesso temporário.' }, 500);
  }
});
