import { createClient } from 'npm:@supabase/supabase-js@2.112.3';
import { deliverClientEmail, failClientEmail } from '../_shared/client-email.ts';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return json({ error: 'Configuração segura ausente.' }, 500);
  const service = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  // Uses the existing Vault-backed scheduler credential. The body cannot name
  // recipients or request privileged Auth operations; all work comes from SQL.
  const { data: allowed, error: tokenError } = await service.rpc('verify_internal_document_dispatch_token', { p_token: request.headers.get('x-document-dispatch-token') || '' });
  if (tokenError || allowed !== true) return json({ error: 'Não autorizado.' }, 401);
  const { data: jobs, error } = await service.rpc('claim_client_email_jobs', { p_limit: 10 });
  if (error) return json({ error: 'Não foi possível consultar os envios pendentes.' }, 500);
  let sent = 0, failed = 0;
  for (const job of jobs || []) {
    try { await deliverClientEmail(service, job); sent++; }
    catch (error) { await failClientEmail(service, job, error); failed++; console.error('client-email: envio adiado', job.id); }
  }
  return json({ ok: true, checked: (jobs || []).length, sent, failed });
});
