import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

const shared = readFileSync('supabase/functions/_shared/client-email.ts', 'utf8').replace(/export /g, '');
const legacy = readFileSync('supabase/functions/notificar-atualizacao/index.ts', 'utf8').replace(/^import .*;\n/gm, '');
const code = stripTypeScriptTypes(shared + '\n' + legacy);
async function run({ state = 'pending', providerStatus = 200 } = {}) {
  const requests = [], finishes = [];
  const job = { id: 'meeting-job', client_id: 'client', kind: 'update', payload: {}, lease_token: 'lease' };
  const service = {
    rpc: async (name, args) => {
      if (name === 'prepare_client_update_email') { job.payload.prepared_email = args.p_email; return { data: job.id }; }
      if (name === 'claim_client_email_jobs') return { data: state === 'pending' ? [job] : [] };
      finishes.push(args); return {};
    },
    from(table) {
      const q = { select() { return q; }, eq() { return q; }, update() { return q; },
        maybeSingle: async () => ({ data: table === 'clientes' ? {id:'client',nome:'Cliente',email:'client@example.com'} : {status:state,provider_id:'previous-send'} }),
        then(resolve) { resolve({error:null}); },
      }; return q;
    },
  };
  const context = vm.createContext({
    Deno: {env:{get:key=>({SUPABASE_URL:'https://hghtwlopqztfcosfxafd.supabase.co',RESEND_API_KEY:'re_test',NOTIFICATION_FROM_EMAIL:'Equipe <portal@example.com>'})[key]},serve() {}},
    Response, URL, AbortSignal, console,
    fetch: async (_url,req) => { requests.push({body:JSON.parse(req.body),headers:req.headers}); return new Response(JSON.stringify(providerStatus===200?{id:'calendar-send'}:{message:'Temporary failure'}),{status:providerStatus}); },
  });
  vm.runInContext(code,context);
  const result = await context.enviarEmail({destinatario:'client@example.com',assunto:'Nova reunião agendada',saudacao:'Cliente',titulo:'Reunião',mensagem:'Reunião confirmada no portal.',destinoPortal:'https://camilamartinsengenharia.com.br/agenda-cliente.html',
    calendario:{filename:'reuniao.ics',icsBase64:'QkVHSU46VkNBTEVOREFS',universalUrl:'https://example.com/calendar',googleUrl:'https://example.com/google',outlookUrl:'https://example.com/outlook',dataExibicao:'08/10/2026',horarioExibicao:'14:00'},
    queue:{service,clientId:'client',projectId:'project',sourceTable:'agenda',sourceId:'meeting'},
  });
  return {result,requests,finishes};
}
let r=await run(); assert.equal(r.result.enviado,true); assert.equal(r.requests.length,1);
assert.equal(r.requests[0].body.attachments[0].filename,'reuniao.ics');
assert.equal(r.requests[0].body.attachments[0].content,'QkVHSU46VkNBTEVOREFS');
assert.match(r.requests[0].body.html,/Adicionar à agenda/);
assert.equal(r.requests[0].headers['Idempotency-Key'],'client-email/meeting-job');
r=await run({state:'sent'}); assert.equal(r.result.enviado,true); assert.equal(r.requests.length,0,'An already delivered event cannot send again');
r=await run({state:'processing'}); assert.equal(r.result.status,'agendado'); assert.equal(r.requests.length,0,'The concurrent worker owns this event');
r=await run({providerStatus:503}); assert.equal(r.result.enviado,false); assert.equal(r.finishes.length,1); assert.ok(r.finishes[0].p_error);
console.log('PASS: convite de calendário e arquivo .ics preservados, envio único e nova tentativa automática.');
