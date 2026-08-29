import { corsHeaders, cleanText, json } from '../_shared/http.ts';
import { requireAdmin } from '../_shared/admin.ts';

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
    const name = cleanText(body.name, 160);
    const email = cleanText(body.email, 254).toLowerCase();
    const phone = cleanText(body.phone, 40) || null;
    if (name.length < 3 || !emailPattern.test(email)) return json({ error: 'Nome ou e-mail inválido.' }, 400);

    const { data: existingClient, error: clientLookupError } = await service
      .from('clientes')
      .select('id')
      .ilike('email', email)
      .maybeSingle();
    if (clientLookupError) throw clientLookupError;
    if (existingClient) return json({ error: 'Já existe um cliente com este e-mail.' }, 409);

    let authUser = await findAuthUserByEmail(service, email);
    let invited = false;
    if (!authUser) {
      const redirectTo = Deno.env.get('APP_REDIRECT_URL');
      const { data, error } = await service.auth.admin.inviteUserByEmail(email, {
        data: { full_name: name, portal_role: 'client' },
        ...(redirectTo ? { redirectTo } : {}),
      });
      if (error || !data.user) throw error ?? new Error('O convite não criou o usuário.');
      authUser = data.user;
      invited = true;
    }

    const { data: client, error: insertError } = await service
      .from('clientes')
      .insert({ nome: name, email, telefone: phone, auth_id: authUser.id, status: 'ativo' })
      .select('id')
      .single();
    if (insertError) {
      if (invited) await service.auth.admin.deleteUser(authUser.id);
      throw insertError;
    }

    await service.from('audit_log').insert({
      user_id: user.id,
      action: 'invite_client',
      entity_type: 'clientes',
      entity_id: client.id,
      details: { invitation_sent: invited },
    });
    return json({ clientId: client.id, invitationSent: invited }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao convidar cliente.';
    const status = message.includes('Acesso') ? 403 : message.includes('Sessão') ? 401 : 500;
    return json({ error: message }, status);
  }
});
