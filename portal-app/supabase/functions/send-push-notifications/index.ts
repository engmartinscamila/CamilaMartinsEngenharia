import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization');
  if (!url || !anonKey || !serviceKey || !authorization) return json({ error: 'Configuração indisponível.' }, 401);

  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: authData, error: authError } = await caller.auth.getUser();
  if (authError || !authData.user) return json({ error: 'Sessão inválida.' }, 401);

  const service = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: notifications, error: notificationError } = await service
    .from('notificacoes')
    .select('id, cliente_id, titulo, mensagem, link_path, destinatario')
    .is('push_sent_at', null)
    .order('created_at', { ascending: true })
    .limit(50);
  if (notificationError) return json({ error: 'Fila de avisos indisponível.' }, 500);
  if (!notifications?.length) return json({ sent: 0 });

  const clientIds = [...new Set(notifications
    .filter((item) => item.destinatario === 'cliente' && item.cliente_id)
    .map((item) => item.cliente_id as string))];
  const [clientsResult, pdfAdminsResult] = await Promise.all([
    clientIds.length
      ? service.from('clientes').select('id, auth_id').in('id', clientIds)
      : Promise.resolve({ data: [], error: null }),
    service.from('pdf_admins').select('user_id'),
  ]);
  if (clientsResult.error || pdfAdminsResult.error) return json({ error: 'Destinatários indisponíveis.' }, 500);

  const clientUsers = new Map((clientsResult.data ?? [])
    .filter((item) => item.auth_id)
    .map((item) => [item.id, item.auth_id as string]));
  // pdf_admins usa o UUID real do Auth. A tabela legada usuarios usa BIGINT e
  // não pode ser misturada com app_push_tokens.user_id (UUID).
  const adminUsers = [...new Set((pdfAdminsResult.data ?? []).map((item) => item.user_id).filter(Boolean))];
  const targetUsers = [...new Set([...clientUsers.values(), ...adminUsers])];
  if (!targetUsers.length) return json({ sent: 0 });

  const { data: tokens, error: tokenError } = await service
    .from('app_push_tokens')
    .select('id, user_id, expo_push_token')
    .in('user_id', targetUsers)
    .eq('active', true);
  if (tokenError) return json({ error: 'Dispositivos indisponíveis.' }, 500);

  const messages: Array<{
    to: string;
    sound: 'default';
    title: string;
    body: string;
    data: { notificationId: string; linkPath: string | null };
    notificationId: string;
    tokenId: string;
  }> = [];
  for (const notification of notifications) {
    const users = notification.destinatario === 'admin'
      ? adminUsers
      : notification.cliente_id && clientUsers.get(notification.cliente_id)
        ? [clientUsers.get(notification.cliente_id) as string]
        : [];
    for (const token of tokens ?? []) {
      if (!users.includes(token.user_id)) continue;
      messages.push({
        to: token.expo_push_token,
        sound: 'default',
        title: notification.titulo,
        body: notification.mensagem || 'Há uma nova atualização no aplicativo.',
        data: { notificationId: notification.id, linkPath: notification.link_path },
        notificationId: notification.id,
        tokenId: token.id,
      });
    }
  }

  if (!messages.length) return json({ sent: 0 });
  const limited = messages.slice(0, 100);
  const pushResponse = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(limited.map(({ notificationId: _notificationId, tokenId: _tokenId, ...message }) => message)),
  });
  if (!pushResponse.ok) return json({ error: 'Serviço de avisos indisponível.' }, 502);

  const pushResult = await pushResponse.json();
  const tickets = Array.isArray(pushResult.data) ? pushResult.data : [];
  const sentIds = new Set<string>();
  const inactiveTokenIds = new Set<string>();
  tickets.forEach((ticket: any, index: number) => {
    const message = limited[index];
    if (!message) return;
    if (ticket?.status === 'ok') sentIds.add(message.notificationId);
    if (ticket?.details?.error === 'DeviceNotRegistered') inactiveTokenIds.add(message.tokenId);
  });

  const attemptedIds = [...new Set(limited.map((item) => item.notificationId))];
  await service.from('notificacoes').update({ push_attempted_at: new Date().toISOString() }).in('id', attemptedIds);
  if (sentIds.size) await service.from('notificacoes').update({ push_sent_at: new Date().toISOString() }).in('id', [...sentIds]);
  if (inactiveTokenIds.size) await service.from('app_push_tokens').update({ active: false, updated_at: new Date().toISOString() }).in('id', [...inactiveTokenIds]);
  return json({ sent: sentIds.size });
});
