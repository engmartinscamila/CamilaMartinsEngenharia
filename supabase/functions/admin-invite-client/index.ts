import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } });
}
function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
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
async function findAuthUserByEmail(service: any, email: string) {
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = data.users.find((user: { email?: string }) => user.email?.toLowerCase() === email);
    if (match || data.users.length < 1000) return match ?? null;
  }
  throw new Error('Limite de busca de usuários atingido.');
}
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
    const apiKey = Deno.env.get('RESEND_API_KEY');
    const from = Deno.env.get('NOTIFICATION_FROM_EMAIL') || Deno.env.get('RESEND_FROM');
    if (!apiKey || !from) throw new Error('Canal de e-mail não configurado.');
    const redirectTo = Deno.env.get('APP_REDIRECT_URL') ||
      'https://camilamartinsengenharia.com.br/redefinir-senha.html';
    const destination = new URL(redirectTo);
    if (destination.protocol !== 'https:') throw new Error('URL de acesso inválida.');

    // Resolve the actual Auth account by email, including legacy clients without auth_id.
    let authUser = await findAuthUserByEmail(service, email);
    const mode = authUser ? 'recovery' : 'invite';
    if (existingClient?.auth_id && authUser && existingClient.auth_id !== authUser.id) {
      return json({ error: 'O e-mail não corresponde ao acesso vinculado ao cliente.' }, 409);
    }
    const { data: linkData, error: linkError } = await service.auth.admin.generateLink({
      type: mode,
      email,
      options: { redirectTo, data: { full_name: name, portal_role: 'client' } },
    });
    if (linkError || !linkData?.user || !linkData?.properties?.hashed_token) {
      throw linkError ?? new Error('Não foi possível gerar o link de acesso.');
    }
    authUser = linkData.user;
    destination.searchParams.set('token_hash', linkData.properties.hashed_token);
    destination.searchParams.set('type', mode);

    let client;

    if (existingClient) {
      const { data, error: updateError } = await service
        .from('clientes')
        .update({ auth_id: authUser.id })
        .eq('id', existingClient.id)
        .select('id')
        .single();

      if (updateError) throw updateError;
      client = data;
    } else {
      const { data, error: insertError } = await service
        .from('clientes')
        .insert({
          nome: name,
          email,
          telefone: phone,
          auth_id: authUser.id,
          status: 'ativo'
        })
        .select('id')
        .single();

      if (insertError) {
        throw insertError;
      }
      client = data;
    }

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from, to: [email],
        subject: 'Acesso ao Portal do Cliente - Camila Martins Engenharia',
        html: `<p>Olá, ${escapeHtml(name)}.</p><p>Seu acesso ao Portal do Cliente está disponível.</p><p><a href="${escapeHtml(destination.toString())}">Criar ou redefinir minha senha</a></p><p>Este link é pessoal e temporário. Sua senha atual só será alterada ao salvar uma nova senha.</p>`,
      }),
    });
    const delivery = await emailResponse.json().catch(() => ({}));
    if (!emailResponse.ok || !delivery.id) {
      console.error('admin-invite-client: provedor recusou envio', emailResponse.status);
      return json({ clientId: client.id, invitationSent: false, error: 'O cliente foi salvo, mas o provedor não aceitou o e-mail. Tente reenviar o acesso.' }, 502);
    }
    const sent = true;

    await service.from('audit_log').insert({
      user_id: user.id,
      action: 'invite_client',
      entity_type: 'clientes',
      entity_id: client.id,
      details: { invitation_sent: sent, email_mode: mode, provider_id: delivery.id }
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
