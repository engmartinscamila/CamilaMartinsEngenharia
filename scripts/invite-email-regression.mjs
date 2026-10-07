import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

const entrypoint = process.argv[2] || 'supabase/functions/admin-invite-client/index.ts';
const shared = readFileSync('supabase/functions/_shared/client-email.ts', 'utf8').replace(/export /g, '');
const source = readFileSync(entrypoint, 'utf8').replace(/^import .*;\n/gm, '');
const js = stripTypeScriptTypes(shared + '\n' + source);
async function run({ apiKey = 're_test', from = 'Equipe <portal@example.com>', provider = { status: 200, body: { id: 'sent-id' } }, admin = true, active = true, authExists = true, existing = true, authMismatch = false, emailChanged = false, adminAccount = false, prepared = null, providerAttempts = 1 } = {}) {
  let handler, generated = 0;
  const sent = [], logs = [], events = [];
  const user = { id: 'client-auth', email: 'client@example.com' };
  const client = { id: 'client-id', nome: 'Cliente', email: user.email, auth_id: authExists || emailChanged ? user.id : null, status: active ? 'ativo' : 'inativo' };
  const job = { id: 'email-job-id', client_id: client.id, kind: 'invite', payload: prepared || {}, lease_token: 'lease' };
  const caller = { auth: { getUser: async () => ({ data: { user: { id: 'admin' } } }) }, rpc: async name => ({ data: name === 'is_portal_admin' ? admin : true }) };
  const service = {
    auth: { admin: {
      listUsers: async () => ({ data: { users: authExists ? [{...user, id: authMismatch ? 'different-auth' : user.id}] : [] } }),
      generateLink: async args => { generated++; events.push({generate: args.type}); return { data: { user, properties: { hashed_token: 'private-token' } } }; },
      getUserById: async () => ({data:{user:{...user,email:'previous@example.com'}}}),
      updateUserById: async (id,args) => { events.push({emailUpdate:id,args}); return {data:{user}}; },
    } },
    rpc: async (name, args) => {
      events.push({rpc: name, args});
      if (name === 'enqueue_client_invitation') return {data: job.id};
      if (name === 'claim_client_email_jobs') return {data: [job]};
      return {data: null};
    },
    from(table) {
      let inserted = false, ilike = false;
      const query = {
        select() { return query; }, eq() { return query; }, ilike() { ilike = true; return query; },
        maybeSingle: async () => ({ data: table === 'pdf_admins' ? (adminAccount ? {user_id:user.id} : null) : (ilike && !existing ? null : client) }),
        update(data) { events.push({update: table}); if (table === 'client_email_queue') job.payload = data.payload; return query; },
        single: async () => ({ data: inserted ? {id:client.id} : client }),
        insert(data) { inserted = true; events.push({insert: table, data}); return query; },
        then(resolve) { resolve({data:null,error:null}); },
      };
      return query;
    },
  };
  const env = { SUPABASE_URL: 'https://hghtwlopqztfcosfxafd.supabase.co', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service', RESEND_API_KEY: apiKey, NOTIFICATION_FROM_EMAIL: from };
  vm.runInNewContext(js, {
    Deno: { env: { get: key => env[key] }, serve: h => { handler = h; } },
    createClient: (_url,key) => key === 'service' ? service : caller,
    Response, URL, AbortSignal,
    console: { error: (...args) => logs.push(args.join(' ')) },
    fetch: async (_url,request) => { sent.push({ headers: request.headers, body: JSON.parse(request.body) }); return new Response(JSON.stringify(provider.body), {status:provider.status}); },
  });
  let result;
  for (let i = 0; i < providerAttempts; i++) {
    const response = await handler(new Request('https://example.com', {method:'POST',headers:{Authorization:'Bearer admin-token','Content-Type':'application/json'},body: JSON.stringify(existing ? {clientId:client.id} : {name:client.nome,email:client.email})}));
    result = {status:response.status,body:await response.json(),sent,logs,events,generated};
  }
  return result;
}
let r = await run({apiKey:'  re_test\n',from:'  Equipe <portal@example.com>  '});
assert.equal(r.status,200); assert.equal(r.body.invitationSent,true);
assert.equal(r.sent[0].headers.Authorization,'Bearer re_test');
assert.equal(r.sent[0].headers['Idempotency-Key'],'client-email/email-job-id');
assert.match(r.sent[0].body.html,/redefinir-senha.html\?token_hash=private-token&amp;type=recovery/);
for (const from of ['', 'onboarding@resend.dev', 'Camila Martins Engenharia <onboarding@resend.dev>']) {
  r=await run({from}); assert.equal(r.status,200);
  assert.equal(r.sent[0].body.from,'Camila Martins Engenharia <nao-responda@auth.camilamartinsengenharia.com.br>');
}
for (const options of [{from:'Equipe sem e-mail'},{from:'Equipe <portal@example.com>\r\nBcc: other@example.com'},{apiKey:'re_ bad'}]) {
  r=await run(options); assert.equal(r.status,500); assert.equal(r.sent.length,0); assert.equal(r.generated,0);
}
r=await run({authExists:false,existing:false}); assert.equal(r.status,200); assert.equal(r.body.mode,'invite');
assert.equal(r.events.some(e=>e.insert==='clientes'),true);
r=await run({provider:{status:429,body:{message:'Temporary limit'}},providerAttempts:2});
assert.equal(r.status,502); assert.equal(r.body.invitationSent,false); assert.equal(r.body.invitationQueued,true);
assert.equal(r.generated,1,'Retries must reuse the same invitation token');
assert.deepEqual(r.sent[0],r.sent[1],'Retries must use identical provider body and idempotency key');
assert.equal(r.events.filter(e=>e.rpc==='finish_client_email_job'&&e.args.p_error).length,2);
assert.doesNotMatch(r.logs.join(' '),/re_test|private-token|client@example.com/);
r=await run({admin:false}); assert.equal(r.status,403); assert.equal(r.sent.length,0);
r=await run({active:false}); assert.equal(r.status,409); assert.equal(r.sent.length,0);
r=await run({authMismatch:true}); assert.equal(r.status,502); assert.equal(r.sent.length,0);
r=await run({authExists:false,emailChanged:true}); assert.equal(r.status,200); assert.equal(r.body.mode,'recovery');
assert.equal(r.events.some(e=>e.emailUpdate==='client-auth'&&e.args.email_confirm===false),true,'An email edit must preserve identity and verify the new mailbox');
r=await run({adminAccount:true}); assert.equal(r.status,502); assert.equal(r.sent.length,0); assert.equal(r.generated,0);
r=await run({prepared:{token_hash:'expired-token',recipient:'client@example.com',mode:'recovery',generated_at:'2020-01-01T00:00:00Z'}});
assert.equal(r.status,200); assert.equal(r.generated,1); assert.equal(r.sent[0].headers['Idempotency-Key'],'client-email/email-job-id/1');
assert.doesNotMatch(r.sent[0].body.html,/expired-token/);
console.log('PASS: convite novo/recuperação, autenticação administrativa, fila obrigatória, nova tentativa idempotente e proteção contra vínculo incorreto.');
