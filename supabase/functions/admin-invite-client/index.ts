import { emailConfiguration, deliverClientEmail, failClientEmail } from '../_shared/client-email.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

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
async function requireAdmin(request: Request) {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) throw new Error('Sessão administrativa ausente.');
  const { url, anonKey, serviceKey } = environment();
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) throw new Error('Sessão administrativa inválida.');
  const { data: isAdmin, error: adminError } = await caller.rpc('is_portal_admin');
  if (adminError || isAdmin !== true) throw new Error('Acesso administrativo necessário.');
  const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return { caller, service, user: userData.user };
}
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
  try {
    const { caller, service, user } = await requireAdmin(request);
    const { error: rateError } = await caller.rpc('consume_admin_rate_limit', { p_action: 'admin-invite-client' });
    if (rateError) throw new Error('Muitas tentativas de convite. Aguarde alguns minutos.');

    const body = await request.json();
    const clientId = cleanText(body.clientId, 80);
    let name = cleanText(body.name, 160);
    let email = cleanText(body.email, 254).toLowerCase();
    let phone = cleanText(body.phone, 40) || null;
    let existingClient = null;

    if (clientId) {
      const { data: clientById, error: clientLookupError } = await service
        .from('clientes')
        .select('id,nome,email,telefone,auth_id,status')
        .eq('id', clientId)
        .maybeSingle();

      if (clientLookupError) throw clientLookupError;
      if (!clientById) return json({ error: 'Cliente não encontrado.' }, 404);

      existingClient = clientById;
      name = cleanText(clientById.nome, 160);
      email = cleanText(clientById.email, 254).toLowerCase();
      phone = cleanText(clientById.telefone, 40) || null;
    } else {
      if (name.length < 3 || !emailPattern.test(email)) {
        return json({ error: 'Nome ou e-mail inválido.' }, 400);
      }

      const { data: clientByEmail, error: clientLookupError } = await service
        .from('clientes')
        .select('id,auth_id')
        .ilike('email', email)
        .maybeSingle();

      if (clientLookupError) throw clientLookupError;
      if (clientByEmail) return json({ error: 'Já existe um cliente com este e-mail.' }, 409);
    }

    if (name.length < 3 || !emailPattern.test(email)) {
      return json({ error: 'O cadastro precisa ter nome e e-mail válidos.' }, 400);
    }

    if (existingClient && existingClient.status !== 'ativo') {
      return json({ error: 'Ative o cliente antes de enviar o acesso.' }, 409);
    }
    // Validate the channel before creating any account. The database trigger
    // enqueues an invitation for every creation path, so a lost browser request
    // or provider failure cannot silently leave a client without an invitation.
    emailConfiguration();
    let client = existingClient;
    if (!client) {
      const { data, error } = await service.from('clientes')
        .insert({ nome: name, email, telefone: phone, status: 'ativo' })
        .select('id').single();
      if (error) throw new Error('Não foi possível cadastrar o cliente.');
      client = data;
    }
    const { data: jobId, error: enqueueError } = await service.rpc('enqueue_client_invitation', { p_client_id: client.id });
    if (enqueueError || !jobId) throw new Error('Não foi possível registrar o convite.');
    const { data: jobs, error: claimError } = await service.rpc('claim_client_email_jobs', { p_limit: 1, p_job_id: jobId });
    if (claimError) throw new Error('Não foi possível iniciar o envio do convite.');
    const job = jobs?.[0];
    if (!job) {
      const { data: state } = await service.from('client_email_queue').select('status').eq('id', jobId).maybeSingle();
      if (state?.status === 'sent') return json({ clientId: client.id, invitationSent: true, message: 'Convite de acesso enviado.' });
      return json({ clientId: client.id, invitationSent: false, invitationQueued: true, error: 'O convite está sendo enviado pelo servidor. O cadastro foi preservado.' }, 503);
    }
    let delivery;
    try {
      delivery = await deliverClientEmail(service, job);
    } catch (error) {
      await failClientEmail(service, job, error);
      const failure = error as Error & { providerStatus?: number };
      return json({ clientId: client.id, invitationSent: false, invitationQueued: true,
        providerStatus: failure.providerStatus, error: `O cadastro foi preservado e o servidor tentará novamente. ${failure.message}` }, 502);
    }
    const mode = delivery.mode;
    const sent = true;

    await service.from('audit_log').insert({
      user_id: user.id,
      action: 'invite_client',
      entity_type: 'clientes',
      entity_id: client.id,
      details: { invitation_sent: sent, email_mode: mode, provider_id: delivery.providerId }
    });

    return json({
      clientId: client.id,
      invitationSent: sent,
      mode,
      message: mode === 'recovery'
        ? 'E-mail de recuperação de acesso enviado.'
        : 'Convite de acesso enviado.'
    }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao enviar acesso do cliente.';
    const status = message.includes('Acesso') ? 403 : message.includes('Sessão') ? 401 : 500;
    return json({ error: message }, status);
  }
});
