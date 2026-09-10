import { corsHeaders, cleanText, json } from '../_shared/http.ts';
import { requireAdmin } from '../_shared/admin.ts';

type StoredObject = { bucket: string; path: string };
type StorageCleanup = { deleted: number; failed: Array<{ bucket: string; count: number }> };
type IssuedCopies = {
  objects: StoredObject[];
  protectedAssetIssueIds: string[];
  protectedPdfIssueIds: string[];
};

function uniqueObjects(objects: StoredObject[]) {
  return [...new Map(objects.map((item) => [`${item.bucket}/${item.path}`, item])).values()];
}

function validStoragePath(value: unknown) {
  const path = String(value ?? '').trim();
  return Boolean(path && path.length <= 1000 && !path.startsWith('/') && !path.includes('..') && !path.includes('\\'));
}

function validBucket(value: unknown) {
  return /^[a-z0-9][a-z0-9._-]{0,62}$/i.test(String(value ?? '').trim());
}

async function deleteStorageObjects(service: any, objects: StoredObject[]): Promise<StorageCleanup> {
  const byBucket = new Map<string, string[]>();
  for (const item of uniqueObjects(objects)) {
    const paths = byBucket.get(item.bucket) ?? [];
    paths.push(item.path);
    byBucket.set(item.bucket, paths);
  }
  let deleted = 0;
  const failed: StorageCleanup['failed'] = [];
  for (const [bucket, paths] of byBucket) {
    for (let index = 0; index < paths.length; index += 100) {
      const batch = paths.slice(index, index + 100);
      const { error } = await service.storage.from(bucket).remove(batch);
      if (error) failed.push({ bucket, count: batch.length });
      else deleted += batch.length;
    }
  }
  return { deleted, failed };
}

async function collectSupplierAttachments(service: any, projectIds: string[]): Promise<StoredObject[]> {
  if (!projectIds.length) return [];
  const quotes = await service.from('purchase_quotes').select('id').in('project_id', projectIds);
  if (quotes.error) throw quotes.error;
  const quoteIds = (quotes.data ?? []).map((row: { id: string }) => row.id);
  if (!quoteIds.length) return [];

  const bids = await service
    .from('supplier_bids')
    .select('attachment_bucket,attachment_path')
    .in('quote_id', quoteIds)
    .not('attachment_path', 'is', null);
  if (bids.error) throw bids.error;

  const objects: StoredObject[] = [];
  for (const row of bids.data ?? []) {
    const path = String(row.attachment_path ?? '').trim();
    if (!path) continue;
    const bucket = String(row.attachment_bucket ?? '').trim();
    if (!validBucket(bucket) || !validStoragePath(path)) {
      throw new Error('Existe anexo de fornecedor com referência de Storage inválida. A exclusão foi bloqueada para evitar perda ou resíduo de arquivo.');
    }
    objects.push({ bucket, path });
  }
  return objects;
}

async function collectIssuedCopies(service: any, clientId: string, projectIds: string[], authId: string | null): Promise<IssuedCopies> {
  const assetFilters = [`client_id.eq.${clientId}`];
  if (projectIds.length) assetFilters.push(`project_id.in.(${projectIds.join(',')})`);
  if (authId) assetFilters.push(`user_id.eq.${authId}`);

  const pdfFilters = [`client_id.eq.${clientId}`];
  if (authId) pdfFilters.push(`user_id.eq.${authId}`);

  const [assetIssues, pdfIssues] = await Promise.all([
    service.from('protected_asset_issues').select('id,issued_storage_path').or(assetFilters.join(',')).is('cleaned_at', null),
    service.from('protected_pdf_issues').select('id,issued_storage_path').or(pdfFilters.join(',')).eq('status', 'generated').not('issued_storage_path', 'is', null),
  ]);
  if (assetIssues.error) throw assetIssues.error;
  if (pdfIssues.error) throw pdfIssues.error;

  const protectedAssetIssueIds: string[] = [];
  const protectedPdfIssueIds: string[] = [];
  const objects: StoredObject[] = [];

  for (const row of assetIssues.data ?? []) {
    const path = String(row.issued_storage_path ?? '').trim();
    if (!path.startsWith('issued/') || !validStoragePath(path)) continue;
    protectedAssetIssueIds.push(row.id);
    objects.push({ bucket: 'materiais-protegidos', path });
  }

  for (const row of pdfIssues.data ?? []) {
    const path = String(row.issued_storage_path ?? '').trim();
    if (!path.startsWith('emitidos/') || !validStoragePath(path)) continue;
    protectedPdfIssueIds.push(row.id);
    objects.push({ bucket: 'materiais-protegidos', path });
  }

  return { objects, protectedAssetIssueIds, protectedPdfIssueIds };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  try {
    const { caller, service, user } = await requireAdmin(request);
    const body = await request.json();
    const clientId = cleanText(body.clientId, 36);
    const action = body.action === 'delete' ? 'delete' : 'preview';
    if (!/^[0-9a-f-]{36}$/i.test(clientId)) return json({ error: 'Cliente inválido.' }, 400);

    const { error: rateError } = await caller.rpc('consume_admin_rate_limit', { p_action: `admin-delete-client-${action}` });
    if (rateError) throw new Error('Muitas tentativas de exclusão. Aguarde antes de tentar novamente.');

    const { data: client, error: clientError } = await service
      .from('clientes')
      .select('id, auth_id, nome')
      .eq('id', clientId)
      .maybeSingle();
    if (clientError) throw clientError;
    if (!client) return json({ error: 'Cliente não encontrado.' }, 404);

    const { data: projects, error: projectsError } = await service.from('projetos').select('id').eq('cliente_id', clientId);
    if (projectsError) throw projectsError;
    const projectIds = (projects ?? []).map((project: { id: string }) => project.id);

    const collect = async (table: string, fallbackBucket: string) => {
      let query = service.from(table).select('storage_bucket, arquivo');
      query = projectIds.length
        ? query.or(`cliente_id.eq.${clientId},projeto_id.in.(${projectIds.join(',')})`)
        : query.eq('cliente_id', clientId);
      const { data, error } = await query;
      if (error) throw error;
      const objects: StoredObject[] = [];
      for (const row of data ?? []) {
        const path = String(row.arquivo ?? '').trim();
        if (!path) continue;
        const bucket = String(row.storage_bucket ?? fallbackBucket).trim();
        if (!validBucket(bucket) || !validStoragePath(path)) {
          throw new Error(`Existe referência inválida de Storage em ${table}. A exclusão foi bloqueada para evitar perda de arquivo.`);
        }
        objects.push({ bucket, path });
      }
      return objects;
    };

    const [documents, photos, library, supplierAttachments, issuedCopies] = await Promise.all([
      collect('documentos', 'documentos'),
      collect('fotos', 'fotos'),
      collect('biblioteca', 'materiais-protegidos'),
      collectSupplierAttachments(service, projectIds),
      collectIssuedCopies(service, clientId, projectIds, client.auth_id ?? null),
    ]);
    const objects = uniqueObjects([...documents, ...photos, ...library, ...supplierAttachments, ...issuedCopies.objects]);

    const { data: databasePreview, error: previewError } = await caller.rpc('admin_client_deletion_preview', { p_cliente_id: clientId });
    if (previewError || !databasePreview) throw new Error('A prévia segura da exclusão não pôde ser calculada.');
    const preview = {
      ...databasePreview,
      storageObjects: objects.length,
      supplierAttachments: supplierAttachments.length,
      temporaryIssuedCopies: uniqueObjects(issuedCopies.objects).length,
    };
    if (action === 'preview') return json({ preview });

    if (preview.canDelete !== true) {
      return json({
        error: 'A exclusão definitiva foi bloqueada porque existem registros documentais ou fiscais que devem ser preservados. Use Arquivar ou Revogar acesso.',
        preview,
      }, 409);
    }

    const confirmation = cleanText(body.confirmation, 180);
    if (confirmation !== client.nome.trim()) return json({ error: 'A confirmação não corresponde ao nome completo do cliente.' }, 400);

    const { data: authId, error: purgeError } = await caller.rpc('admin_purge_client_database', { p_cliente_id: clientId });
    if (purgeError) throw new Error(`A exclusão foi interrompida e revertida pelo banco: ${purgeError.message}`);

    const metadataWarnings: string[] = [];
    const cleanedAt = new Date().toISOString();
    if (issuedCopies.protectedAssetIssueIds.length) {
      const updated = await service.from('protected_asset_issues').update({ cleaned_at: cleanedAt }).in('id', issuedCopies.protectedAssetIssueIds);
      if (updated.error) metadataWarnings.push('o registro de limpeza de algumas emissões protegidas ficou pendente');
    }
    if (issuedCopies.protectedPdfIssueIds.length) {
      const updated = await service.from('protected_pdf_issues').update({ status: 'purged' }).in('id', issuedCopies.protectedPdfIssueIds);
      if (updated.error) metadataWarnings.push('o registro de limpeza de alguns PDFs protegidos ficou pendente');
    }

    const storageCleanup = await deleteStorageObjects(service, objects);
    let authDeleted = true;
    if (authId) {
      const { error: authError } = await service.auth.admin.deleteUser(authId);
      authDeleted = !authError;
    }

    const warningParts = [...metadataWarnings];
    if (storageCleanup.failed.length) warningParts.push('alguns arquivos privados ficaram pendentes para a limpeza de órfãos');
    if (!authDeleted) warningParts.push('o usuário do Auth ficou pendente para remoção, mas perdeu o vínculo com o portal');
    const warning = warningParts.length ? `Exclusão de dados concluída; ${warningParts.join(' e ')}.` : null;

    await service.from('audit_log').insert({
      user_id: user.id,
      action: warning ? 'purge_client_partial_cleanup' : 'purge_client_complete',
      entity_type: 'clientes',
      entity_id: clientId,
      details: {
        deleted_objects: storageCleanup.deleted,
        failed_storage_batches: storageCleanup.failed,
        deleted_projects: projectIds.length,
        supplier_attachments: supplierAttachments.length,
        temporary_issued_copies: uniqueObjects(issuedCopies.objects).length,
        retained_security_events: Number(preview.retainedSecurityEvents ?? 0),
        financial_history_preserved: true,
        legal_and_security_history_preserved: true,
        auth_deleted: authDeleted,
        warning,
      },
    });

    return json({
      deleted: true,
      deletedObjects: storageCleanup.deleted,
      deletedProjects: projectIds.length,
      financialHistoryPreserved: true,
      legalAndSecurityHistoryPreserved: true,
      storageCleanupComplete: storageCleanup.failed.length === 0,
      authDeleted,
      warning,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha na exclusão segura.';
    const status = message.includes('Acesso') ? 403 : message.includes('Sessão') ? 401 : 500;
    return json({ error: message }, status);
  }
});
