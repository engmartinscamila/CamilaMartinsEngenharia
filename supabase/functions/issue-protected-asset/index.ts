import { PDFDocument, StandardFonts, degrees, rgb } from 'npm:pdf-lib@1.17.1';
import { createClient } from 'npm:@supabase/supabase-js@2.112.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } });
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
type AssetKind = 'document' | 'photo';
type AssetRow = { id: string; cliente_id: string | null; projeto_id: string | null; nome: string | null; storage_bucket: string | null; arquivo: string | null; protection_mode: string | null; permitir_download?: boolean | null; autoral?: boolean | null; protected_copy_path?: string | null; protected_copy_source?: string | null };
function trackingCode() { return `CM-${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`; }
function downloadFileName(name: string | null, storagePath: string) {
  const extension = storagePath.match(/(\.[a-z0-9]{1,10})$/i)?.[1]?.toLowerCase() ?? '';
  const safeName = (name?.trim() || 'arquivo').replace(/[\\/:*?"<>|\r\n]/g, '_').slice(0, 120);
  return extension && !safeName.toLowerCase().endsWith(extension) ? `${safeName}${extension}` : safeName;
}
async function cleanupExpiredIssuedAssets(service: ReturnType<typeof createClient>) {
  const expired = await service.from('protected_asset_issues').select('id,issued_storage_path').is('cleaned_at', null).lt('expires_at', new Date().toISOString()).like('issued_storage_path', 'issued/%').limit(100);
  if (expired.error || !expired.data?.length) return;
  const paths = [...new Set(expired.data.map((item) => item.issued_storage_path).filter(Boolean))];
  if (!paths.length) return;
  const removal = await service.storage.from('materiais-protegidos').remove(paths);
  if (removal.error) return;
  await service.from('protected_asset_issues').update({ cleaned_at: new Date().toISOString() }).in('id', expired.data.map((item) => item.id));
}
async function stampPdf(original: Uint8Array, identity: string, contractNumber: string, code: string) {
  const document = await PDFDocument.load(original, { ignoreEncryption: false, updateMetadata: false });
  const font = await document.embedFont(StandardFonts.Helvetica);
  const footerFont = await document.embedFont(StandardFonts.HelveticaBold);
  const issuedAt = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  for (const page of document.getPages()) {
    const { width, height } = page.getSize();
    page.drawText(`${identity} • ${contractNumber} • ${code}`, { x: Math.max(24, width * 0.12), y: height * 0.48, size: Math.max(13, Math.min(24, width / 28)), font, color: rgb(0.45, 0.37, 0.23), opacity: 0.17, rotate: degrees(32) });
    page.drawRectangle({ x: 0, y: 0, width, height: 30, color: rgb(0.01, 0.04, 0.08), opacity: 0.92 });
    page.drawText(`Cópia autenticada ${code} • ${identity} • ${contractNumber} • ${issuedAt} • confira em camilamartinsengenharia.com.br/verificar.html`, { x: 12, y: 10, size: 6.5, font: footerFont, color: rgb(0.82, 0.71, 0.48) });
  }
  return document.save({ useObjectStreams: true });
}
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return json({ error: 'Sessão ausente.' }, 401);
    const { url, anonKey, serviceKey } = environment();
    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
    const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: userData, error: userError } = await caller.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Sessão inválida.' }, 401);
    await cleanupExpiredIssuedAssets(service);
    const body = await request.json();
    const kind: AssetKind = body.kind === 'photo' ? 'photo' : 'document';
    const assetId = cleanText(body.assetId, 36);
    const requestedAction = body.action === 'download' ? 'download' : 'view';
    if (!/^[0-9a-f-]{36}$/i.test(assetId)) return json({ error: 'Arquivo inválido.' }, 400);
    const table = kind === 'document' ? 'documentos' : 'fotos';
    const columns = kind === 'document' ? 'id,cliente_id,projeto_id,nome,storage_bucket,arquivo,protection_mode,permitir_download,autoral' : 'id,cliente_id,projeto_id,nome,storage_bucket,arquivo,protection_mode,protected_copy_path,protected_copy_source';
    const { data: assetData, error: assetError } = await caller.from(table).select(columns).eq('id', assetId).maybeSingle();
    if (assetError || !assetData) return json({ error: 'Arquivo não encontrado ou acesso não autorizado.' }, 404);
    const asset = assetData as unknown as AssetRow;
    asset.storage_bucket = asset.storage_bucket || table;
    if (!asset.arquivo) return json({ error: 'O arquivo original não está disponível.' }, 404);
    const { data: project } = asset.projeto_id ? await service.from('projetos').select('id,cliente_id,numero_contrato,contract_id,nome').eq('id', asset.projeto_id).maybeSingle() : { data: null };
    const clientId = asset.cliente_id ?? project?.cliente_id ?? null;
    const [{ data: client }, { data: contract }] = await Promise.all([
      clientId ? service.from('clientes').select('nome').eq('id', clientId).maybeSingle() : Promise.resolve({ data: null }),
      project?.contract_id ? service.from('contratos').select('contract_number').eq('id', project.contract_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    const identity = client?.nome?.trim() || userData.user.email || 'Usuário autorizado';
    // Código interno de migração (MIG-…) não é contrato: usa o nome do projeto no carimbo.
    const realContract = contract?.contract_number && !String(contract.contract_number).startsWith('MIG-') ? contract.contract_number : null;
    const contractNumber = realContract || project?.numero_contrato || project?.nome || 'Projeto não informado';
    const code = trackingCode();
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
    const { data: adminResult } = await caller.rpc('is_portal_admin');
    const adminOriginal = body.adminOriginal === true && adminResult === true;
    const isProtected = asset.protection_mode === 'authored_pdf' || asset.protection_mode === 'authored_photo' || (kind === 'document' && asset.autoral === true);
    const shouldTransform = isProtected && !adminOriginal;
    let issuedBucket = asset.storage_bucket;
    let issuedPath = asset.arquivo;
    let downloadAllowed = kind === 'document' && (asset.permitir_download !== false || adminOriginal) && (!isProtected || adminOriginal);
    if (shouldTransform && kind === 'photo') {
      // Imagem autoral: entrega a cópia com carimbo gravado na própria imagem (JPG), gerada no
      // painel da administradora. O original nunca é entregue nem embutido na cópia.
      if (!asset.protected_copy_path || asset.protected_copy_source !== asset.arquivo) {
        return json({ error: 'Esta imagem está sendo preparada para visualização protegida. Tente novamente mais tarde.' }, 409);
      }
      issuedBucket = asset.storage_bucket;
      issuedPath = asset.protected_copy_path;
      downloadAllowed = false;
    } else if (shouldTransform) {
      const { data: original, error: downloadError } = await service.storage.from(asset.storage_bucket).download(asset.arquivo);
      if (downloadError || !original) throw new Error('Não foi possível preparar a cópia identificada.');
      const originalBytes = new Uint8Array(await original.arrayBuffer());
      issuedBucket = 'materiais-protegidos';
      if (kind === 'document') {
        if (original.type !== 'application/pdf' && !asset.arquivo.toLowerCase().endsWith('.pdf')) return json({ error: 'Documento autoral deve ser enviado em PDF.' }, 400);
        issuedPath = `issued/${userData.user.id}/document-${asset.id}-${code}.pdf`;
        const upload = await service.storage.from(issuedBucket).upload(issuedPath, await stampPdf(originalBytes, identity, contractNumber, code), { contentType: 'application/pdf', upsert: false });
        if (upload.error) throw upload.error;
      }
      downloadAllowed = false;
    }
    const action = adminOriginal ? 'admin_original' : downloadAllowed && requestedAction === 'download' ? 'download' : 'view';
    const issue = await service.from('protected_asset_issues').insert({ asset_kind: kind, asset_id: asset.id, user_id: userData.user.id, client_id: clientId, project_id: asset.projeto_id, contract_number: contractNumber, tracking_code: code, issued_storage_path: issuedPath, action, expires_at: expiresAt });
    if (issue.error) {
      if (shouldTransform && kind === 'document') await service.storage.from(issuedBucket).remove([issuedPath]);
      throw new Error('Não foi possível registrar a emissão protegida.');
    }
    const signed = await service.storage.from(issuedBucket).createSignedUrl(issuedPath, 600, { download: action === 'download' ? downloadFileName(asset.nome, issuedPath) : false });
    if (signed.error || !signed.data?.signedUrl) throw new Error('Não foi possível criar o acesso temporário.');
    return json({ url: signed.data.signedUrl, expiresAt, trackingCode: code, protectedCopy: shouldTransform, downloadAllowed: action === 'download', notice: shouldTransform ? 'Cópia identificada. Capturas de tela não podem ser impedidas completamente.' : null });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Falha ao emitir o arquivo protegido.' }, 500);
  }
});
