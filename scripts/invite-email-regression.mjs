import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

const source = readFileSync(process.argv[2] || 'supabase/functions/admin-invite-client/index.ts', 'utf8');
const js = stripTypeScriptTypes(source.replace(/^import .*;\n/, ''));
async function run({ apiKey = 're_test', from = 'Equipe <portal@example.com>', provider = { status: 200, body: { id: 'sent-id' } }, admin = true, active = true } = {}) {
  let handler;
  const sent = [], logs = [], events = [];
  const user = { id: 'client-auth', email: 'client@example.com' };
  const caller = { auth: { getUser: async () => ({ data: { user: { id: 'admin' } } }) }, rpc: async (name) => ({ data: name === 'is_portal_admin' ? admin : true }) };
  const client = { id: 'client-id', nome: 'Cliente', email: user.email, auth_id: user.id, status: active ? 'ativo' : 'inativo' };
  const service = {
    auth: { admin: {
      listUsers: async () => ({ data: { users: [user] } }),
      generateLink: async () => { events.push('link'); return { data: { user, properties: { hashed_token: 'private-token' } } }; },
    } },
    from(table) {
      const query = { select() { return query; }, eq() { return query; },
        maybeSingle: async () => ({ data: client }),
        update() { events.push('update'); return query; },
        single: async () => ({ data: { id: client.id } }),
        insert: async (data) => { if (table === 'audit_log') events.push(data); return {}; },
      };
      return query;
    },
  };
  const env = { SUPABASE_URL: 'https://hghtwlopqztfcosfxafd.supabase.co', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service', RESEND_API_KEY: apiKey, NOTIFICATION_FROM_EMAIL: from };
  vm.runInNewContext(js, {
    Deno: { env: { get: (key) => env[key] }, serve: (h) => { handler = h; } },
    createClient: (_url, key) => key === 'service' ? service : caller,
    Response, URL,
    console: { error: (...args) => logs.push(args.join(' ')) },
    fetch: async (_url, request) => { sent.push({ headers: request.headers, body: JSON.parse(request.body) }); return new Response(JSON.stringify(provider.body), { status: provider.status }); },
  });
  const response = await handler(new Request('https://example.com', { method: 'POST', headers: { Authorization: 'Bearer admin-token', 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: client.id }) }));
  return { status: response.status, body: await response.json(), sent, logs, events };
}

let r = await run({ apiKey: '  re_test\n', from: '  Equipe <portal@example.com>  ' });
assert.equal(r.status, 200);
assert.equal(r.body.invitationSent, true);
assert.equal(r.sent[0].headers.Authorization, 'Bearer re_test');
assert.equal(r.sent[0].body.from, 'Equipe <portal@example.com>');
assert.match(r.sent[0].body.html, /https:\/\/camilamartinsengenharia.com.br\/redefinir-senha.html\?token_hash=private-token&amp;type=recovery/);

// A sandbox sender must never restrict invitations to the account owner's inbox.
for (const from of ['', 'onboarding@resend.dev', 'Camila Martins Engenharia <onboarding@resend.dev>']) {
  r = await run({ from });
  assert.equal(r.status, 200);
  assert.equal(r.body.invitationSent, true);
  assert.equal(r.sent[0].body.from, 'Camila Martins Engenharia <nao-responda@auth.camilamartinsengenharia.com.br>');
  assert.equal(r.sent[0].body.to[0], 'client@example.com');
}

for (const options of [{ from: 'Equipe sem e-mail' }, { from: 'Equipe <portal@example.com>\r\nBcc: other@example.com' }, { apiKey: 're_ bad' }]) {
  r = await run(options);
  assert.equal(r.status, 500);
  assert.equal(r.sent.length, 0);
  assert.equal(r.events.length, 0, 'Invalid configuration must not generate or replace password links');
}

r = await run({ provider: { status: 400, body: { name: 'validation_error', message: 'Invalid API key re_test for client@example.com https://example.com/?token_hash=private-token' } } });
assert.equal(r.status, 502);
assert.equal(r.body.invitationSent, false);
assert.equal(r.body.providerStatus, 400);
assert.match(r.body.error, /RESEND_API_KEY/);
assert.equal(r.events.some(e => typeof e === 'object' && e.action === 'invite_client'), false);
assert.doesNotMatch(r.logs.join(' '), /re_test|client@example.com|private-token/);

for (const [message, expected] of [
  ['The example.com domain is not verified', /domínio.*não está verificado/],
  ['Invalid from field format', /NOTIFICATION_FROM_EMAIL/],
  ['You can only send testing emails to your own email address', /e-mails de teste/],
  ['Daily quota exceeded', /cota/],
  ['Invalid field: unexpected payload', /HTTP 400/],
]) {
  r = await run({ provider: { status: 400, body: { name: 'validation_error', message } } });
  assert.equal(r.body.invitationSent, false);
  assert.match(r.body.error, expected);
  assert.match(r.logs.join(' '), /validation_error/);
}

r = await run({ admin: false });
assert.equal(r.status, 403);
assert.equal(r.sent.length, 0);
r = await run({ active: false });
assert.equal(r.status, 409);
assert.equal(r.sent.length, 0);
console.log('PASS: envio confirmado, configuração normalizada, recusas diagnosticadas sem segredos, admin e cliente ativo exigidos.');
