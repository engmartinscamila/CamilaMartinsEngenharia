// This module is used only by authenticated server functions. Queue payloads
// can contain temporary Auth tokens and must never be exposed to clients/logs.
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SITE = 'https://camilamartinsengenharia.com.br';
export function emailConfiguration() {
  const apiKey = (Deno.env.get('RESEND_API_KEY') || '').trim();
  let from = (Deno.env.get('NOTIFICATION_FROM_EMAIL') || Deno.env.get('RESEND_FROM') || '').trim();
  let address = (from.match(/<([^<>]+)>$/)?.[1] || from).trim();
  if (Deno.env.get('SUPABASE_URL') === 'https://hghtwlopqztfcosfxafd.supabase.co' && (!from || /@resend\.dev$/i.test(address))) {
    from = 'Camila Martins Engenharia <nao-responda@auth.camilamartinsengenharia.com.br>';
    address = 'nao-responda@auth.camilamartinsengenharia.com.br';
  }
  if (!apiKey || !from) throw new Error('Canal de e-mail não configurado.');
  if (/\s/.test(apiKey)) throw new Error('A chave RESEND_API_KEY contém espaços ou quebras de linha.');
  if (!EMAIL_PATTERN.test(address) || /[\r\n]/.test(from) || (from.includes('<') && !/^[^<>\r\n]*<[^<>]+>$/.test(from))) {
    throw new Error('Remetente de e-mail inválido. Confira NOTIFICATION_FROM_EMAIL.');
  }
  return { apiKey, from };
}
function escapeHtml(value: unknown) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}
async function authUserByEmail(service: any, email: string) {
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error('Falha ao localizar acesso do cliente.');
    const match = data.users.find((user: any) => user.email?.toLowerCase() === email);
    if (match || data.users.length < 1000) return match || null;
  }
  throw new Error('Limite de busca de usuários atingido.');
}
async function assertClientAccount(service: any, id: string) {
  if (id === (Deno.env.get('ADMIN_UID') || '5c9d7a0e-0495-4e96-8561-1d7f220be154')) throw new Error('Acesso administrativo não pode ser vinculado a cliente.');
  const { data, error } = await service.from('pdf_admins').select('user_id').eq('user_id', id).maybeSingle();
  if (error) throw new Error('Falha ao validar o papel do acesso.');
  if (data) throw new Error('Acesso administrativo não pode ser vinculado a cliente.');
}
function providerReason(status: number, result: any) {
  const reason = String(result?.message || '').toLowerCase();
  if (/api.?key/.test(reason) && /invalid|not active|suspend|missing/.test(reason)) return 'A chave RESEND_API_KEY está inválida ou inativa.';
  if (/testing emails|own email address/.test(reason)) return 'O Resend está limitado a e-mails de teste.';
  if (/domain/.test(reason) && /not verified|verify/.test(reason)) return 'O domínio do remetente não está verificado.';
  if (/from/.test(reason)) return 'Remetente recusado. Confira NOTIFICATION_FROM_EMAIL.';
  if (/quota|limit.*reached/.test(reason)) return 'A cota de envio do Resend foi atingida.';
  return `Resend recusou o envio (HTTP ${status}).`;
}
export async function deliverClientEmail(service: any, job: any) {
  const { apiKey, from } = emailConfiguration();
  const { data: client, error: clientError } = await service.from('clientes').select('id,nome,email,auth_id,status').eq('id', job.client_id).maybeSingle();
  if (clientError) throw new Error('Falha ao consultar o cliente.');
  if (!client) throw new Error('Cliente não encontrado.');
  const email = String(client.email || '').trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) throw new Error('O cadastro precisa ter e-mail válido.');
  if (job.kind === 'invite' && client.status !== 'ativo') throw new Error('Ative o cliente antes de enviar o acesso.');

  let payload = job.payload || {};
  let destination = SITE + '/portal.html';
  let subject = 'Atualização no Portal do Cliente - Camila Martins Engenharia';
  let message = String(payload.message || 'Seu cadastro ou projeto foi atualizado. Acesse o portal para conferir.');
  if (job.kind === 'invite') {
    // Refresh an unsent invitation before its default Auth expiration. Ordinary
    // retries retain the same token/body/key; a refresh has its own version so
    // Resend never sees a changed body under the previous idempotency key.
    if (payload.token_hash && Date.now() - Date.parse(payload.generated_at || '') > 45 * 60 * 1000) {
      payload = { ...payload, token_hash: null, prepared_email: null, recipient: null, mode: null, delivery_version: Number(payload.delivery_version || 0) + 1 };
    }
    const production = Deno.env.get('SUPABASE_URL') === 'https://hghtwlopqztfcosfxafd.supabase.co';
    destination = production ? SITE + '/redefinir-senha.html' : (Deno.env.get('APP_REDIRECT_URL') || `${Deno.env.get('SITE_URL')}/redefinir-senha.html`);
    const link = new URL(destination);
    if (link.protocol !== 'https:' && !(link.protocol === 'camilamartinsengenharia:' && !production)) throw new Error('URL de acesso inválida.');
    if (payload.token_hash && payload.recipient !== email) throw new Error('O e-mail do cadastro mudou durante o envio. Reenvie o convite.');
    if (!payload.token_hash) {
      let authUser = await authUserByEmail(service, email);
      if (authUser) await assertClientAccount(service, authUser.id);
      if (client.auth_id && authUser?.id !== client.auth_id) {
        if (authUser) throw new Error('O e-mail não corresponde ao acesso vinculado ao cliente.');
        // An administrator can edit the registration email. Preserve the Auth
        // UUID/project memberships, require verification at the new address,
        // and never attach an account already owned by another person.
        const { data: linked, error: linkedError } = await service.auth.admin.getUserById(client.auth_id);
        if (linkedError || !linked?.user) throw new Error('O acesso vinculado ao cliente não foi encontrado.');
        await assertClientAccount(service, client.auth_id);
        const { data: changed, error: emailError } = await service.auth.admin.updateUserById(client.auth_id, { email, email_confirm: false });
        if (emailError || !changed?.user) throw new Error('Não foi possível atualizar o endereço do acesso.');
        authUser = changed.user;
      }
      const mode = authUser ? 'recovery' : 'invite';
      const { data, error } = await service.auth.admin.generateLink({ type: mode, email, options: { redirectTo: destination, data: { full_name: client.nome, portal_role: 'client' } } });
      if (error || !data?.user || !data?.properties?.hashed_token) throw new Error('Não foi possível gerar o link de acesso.');
      authUser = data.user;
      await assertClientAccount(service, authUser.id);
      const { error: updateError } = await service.from('clientes').update({ auth_id: authUser.id }).eq('id', client.id);
      if (updateError) throw new Error('Não foi possível vincular o acesso do cliente.');
      payload = { ...payload, recipient: email, token_hash: data.properties.hashed_token, mode, generated_at: new Date().toISOString() };
      const { error: saveError } = await service.from('client_email_queue').update({ payload }).eq('id', job.id).eq('lease_token', job.lease_token);
      if (saveError) throw new Error('Não foi possível preservar o convite para novas tentativas.');
    }
    link.searchParams.set('token_hash', payload.token_hash);
    link.searchParams.set('type', payload.mode);
    destination = link.toString();
    subject = 'Acesso ao Portal do Cliente - Camila Martins Engenharia';
    message = 'Seu acesso ao Portal do Cliente está disponível. Crie sua senha pelo botão abaixo. Este link é pessoal e temporário.';
  }
  const button = job.kind === 'invite' ? 'Criar ou redefinir minha senha' : 'Conferir atualização no portal';
  // Notifications contain a fixed summary, never internal notes, identifiers,
  // document contents, storage URLs, or arbitrary HTML from a database row.
  const text = `Olá, ${client.nome || 'cliente'}.\n\n${message}\n\n${button}: ${destination}\n\nCamila Martins Engenharia`;
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${subject}</title></head><body><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;color:#14243b;padding-top:24px;padding-bottom:24px;"><p>Olá, ${escapeHtml(client.nome || 'cliente')}.</p><p>${escapeHtml(message)}</p><p><a href="${escapeHtml(destination)}">${button}</a></p><p>Camila Martins Engenharia</p></td></tr></table></body></html>`;
  const prepared = payload.prepared_email || { from, to: [email], subject, html, text };
  if (String(prepared.to[0]).trim().toLowerCase() !== email) throw new Error('O e-mail do cadastro mudou durante o envio. Reenvie o convite.');
  if (!payload.prepared_email) {
    payload = { ...payload, prepared_email: prepared };
    const { error: saveError } = await service.from('client_email_queue').update({ payload }).eq('id', job.id).eq('lease_token', job.lease_token);
    if (saveError) throw new Error('Não foi possível preservar o e-mail para novas tentativas.');
  }
  const version = payload.delivery_version ? `/${payload.delivery_version}` : '';
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `client-email/${job.id}${version}` }, body: JSON.stringify(prepared) });
  const delivery = await response.json().catch(() => ({}));
  if (!response.ok || !delivery.id) {
    const error: any = new Error(providerReason(response.status, delivery));
    error.providerStatus = response.status;
    throw error;
  }
  const { error: finishError } = await service.rpc('finish_client_email_job', { p_job_id: job.id, p_lease_token: job.lease_token, p_provider_id: delivery.id, p_error: null });
  if (finishError) throw new Error('O e-mail foi enviado, mas o registro de entrega precisa de nova tentativa.');
  return { providerId: delivery.id, mode: payload.mode || null };
}
export async function failClientEmail(service: any, job: any, error: any) {
  // Only application-controlled messages are stored; no raw provider body or token.
  const message = error?.name === 'TimeoutError' ? 'Tempo de envio esgotado; nova tentativa automática.' : (error?.message || 'Falha no envio.');
  const { error: updateError } = await service.rpc('finish_client_email_job', { p_job_id: job.id, p_lease_token: job.lease_token, p_provider_id: null, p_error: String(message).slice(0, 500) });
  if (updateError) console.error('client-email: falha ao registrar nova tentativa', job.id);
}
