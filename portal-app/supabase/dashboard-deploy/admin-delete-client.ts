import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function environment() {
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) throw new Error('Configuração segura do Supabase ausente.');
  return { url, anonKey, serviceKey };
}

async function requireAdmin(request: Request) {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) throw new Error('Sessão administrativa ausente.');
  const { url, anonKey, serviceKey } = environment();
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) throw new Error('Sessão administrativa inválida.');
  const { data: isAdmin, error: adminError } = await caller.rpc('is_portal_admin');
  if (adminError || isAdmin !== true) throw new Error('Acesso administrativo necessário.');
  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { caller, service, user: userData.user };
}

type StoredObject = { bucket: string; path: string };

function uniqueObjects(objects: StoredObject[]) {
  return [...new Map(objects.map((item) => [`${item.bucket}/${item.path}`, item])).values()];
}

async function deleteStorageObjects(service: any, objects: StoredObject[]) {
  const byBucket = new Map<string, string[]>();
  for (const item of uniqueObjects(objects)) {
    const paths = byBucket.get(item.bucket) ?? [];
    paths.push(item.path);
    byBucket.set(item.bucket, paths);
  }
  let deleted = 0;
  for (const [bucket, paths] of byBucket) {
    for (let index = 0; index < paths.length; index += 100) {
      const batch = paths.slice(index, index + 100);
      const { error } = await service.storage.from(bucket).remove(batch);
      if (error) throw new Error(`Falha ao excluir arquivos do bucket ${bucket}. O banco foi preservado.`);
      deleted += batch.length;
    }
  }
  return deleted;
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
      return (data ?? [])
        .filter((row: { arquivo?: string }) => Boolean(row.arquivo))
        .map((row: { storage_bucket?: string; arquivo: string }) => ({ bucket: row.storage_bucket ?? fallbackBucket, path: row.arquivo }));
    };

    const [documents, photos, library, protectedIssues, protectedAssetIssues] = await Promise.all([
      collect('documentos', 'documentos'),
      collect('fotos', 'fotos'),
      collect('biblioteca', 'materiais-protegidos'),
      service.from('protected_pdf_issues').select('issued_storage_path').eq('client_id', clientId),
      service.from('protected_asset_issues').select('issued_storage_path').eq('client_id', clientId),
    ]);
    if (protectedIssues.error) throw protectedIssues.error;
    if (protectedAssetIssues.error) throw protectedAssetIssues.error;
    const issuedObjects = (protectedIssues.data ?? [])
      .filter((row: { issued_storage_path?: string }) => Boolean(row.issued_storage_path))
      .map((row: { issued_storage_path: string }) => ({ bucket: 'materiais-protegidos', path: row.issued_storage_path }));
    const issuedAssetObjects = (protectedAssetIssues.data ?? [])
      .filter((row: { issued_storage_path?: string }) => Boolean(row.issued_storage_path))
      .map((row: { issued_storage_path: string }) => ({ bucket: 'materiais-protegidos', path: row.issued_storage_path }));
    const objects = uniqueObjects([...documents, ...photos, ...library, ...issuedObjects, ...issuedAssetObjects]);

    const { data: databasePreview, error: previewError } = await caller.rpc('admin_client_deletion_preview', { p_cliente_id: clientId });
    if (previewError) throw new Error('A prévia segura depende da migração da Fase 7.');
    const preview = { ...databasePreview, storageObjects: objects.length };
    if (action === 'preview') return json({ preview });

    const confirmation = cleanText(body.confirmation, 180);
    if (confirmation !== client.nome.trim()) return json({ error: 'A confirmação não corresponde ao nome completo do cliente.' }, 400);

    const deletedObjects = await deleteStorageObjects(service, objects);

    const { data: authId, error: purgeError } = await caller.rpc('admin_purge_client_database', { p_cliente_id: clientId });
    if (purgeError) throw new Error(`Os arquivos foram removidos, mas a exclusão do banco falhou: ${purgeError.message}`);
    if (authId) {
      const { error: authError } = await service.auth.admin.deleteUser(authId);
      if (authError) throw new Error('Os dados foram excluídos, mas o acesso no Auth precisa ser removido manualmente.');
    }

    await service.from('audit_log').insert({
      user_id: user.id,
      action: 'purge_client_complete',
      entity_type: 'clientes',
      details: { deleted_objects: deletedObjects, deleted_projects: projectIds.length, financial_history_preserved: true },
    });
    return json({ deleted: true, deletedObjects, deletedProjects: projectIds.length, financialHistoryPreserved: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha na exclusão segura.';
    const status = message.includes('Acesso') ? 403 : message.includes('Sessão') ? 401 : 500;
    return json({ error: message }, status);
  }
});
