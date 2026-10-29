import { createClient } from 'npm:@supabase/supabase-js@2.112.3';
import { emailConfiguration, deliverClientEmail, failClientEmail } from '../_shared/client-email.ts';

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
  const body = await request.json().catch(() => ({}));
  if (body.action === 'probe') {
    const { apiKey, from } = emailConfiguration();
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': 'portal-channel-probe-20261029' },
      body: JSON.stringify({ from, to: ['delivered+portal-validation@resend.dev'], subject: 'Validação técnica do canal do portal', text: 'Teste automatizado para o simulador oficial do provedor. Nenhum dado de cliente.' }),
    });
    const result = await response.json().catch(() => ({}));
    return json({ accepted: response.ok && Boolean(result.id), providerStatus: response.status, providerId: result.id || null, reason: response.ok ? null : String(result.message || '').slice(0,200) });
  }
  if (body.action === 'delivery-status') {
    const { apiKey } = emailConfiguration();
    const { data: history, error: historyError } = await service.from('client_email_queue')
      .select('id,kind,provider_id,sent_at,status,last_error').order('created_at', { ascending: false }).limit(3);
    if (historyError) return json({ error: 'Histórico indisponível.' }, 500);
    const results = [];
    for (const job of history || []) {
      if (!job.provider_id) { results.push({ id: job.id, kind: job.kind, status: job.status, error: job.last_error }); continue; }
      const response = await fetch(`https://api.resend.com/emails/${encodeURIComponent(job.provider_id)}`, {
        headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(15000),
      });
      const event = await response.json().catch(() => ({}));
      results.push({ id: job.id, kind: job.kind, sent_at: job.sent_at, provider_status: response.status, event: response.ok ? event.last_event : null, reason: response.ok ? null : String(event.message || event.name || '').slice(0,200) });
      await new Promise(resolve => setTimeout(resolve, 600));
    }
    return json({ results });
  }
  const { data: jobs, error } = await service.rpc('claim_client_email_jobs', { p_limit: 10 });
  if (error) return json({ error: 'Não foi possível consultar os envios pendentes.' }, 500);
  let sent = 0, failed = 0;
  for (const job of jobs || []) {
    try { await deliverClientEmail(service, job); sent++; }
    catch (error) { await failClientEmail(service, job, error); failed++; console.error('client-email: envio adiado', job.id); }
  }
  return json({ ok: true, checked: (jobs || []).length, sent, failed });
});
