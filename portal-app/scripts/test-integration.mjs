import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

let checks = 0;
const check = (actual, expected, label) => { assert.equal(actual, expected, label); checks++; };
function load(path, dependencies) {
  const output = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, URL, console, require: name => {
    if (!(name in dependencies)) throw new Error(`Unmocked dependency: ${name}`);
    return dependencies[name];
  } }, { filename: path });
  return exports;
}
let admin = false, rpcError = null, client = null, membership = null, networkFailure = false;
let invoked, signed = 0, responseUrl;
const clientMock = {
  rpc: async name => { assert.equal(name, 'is_portal_admin'); return {data:admin,error:rpcError}; },
  from(table) {
    assert.notEqual(table, 'usuarios', 'Do not compare Auth UUID with legacy numeric identity');
    const builder = { select:()=>builder, eq:()=>builder, limit:()=>builder,
      maybeSingle: async()=>({data: table==='clientes'?client:membership,error:null}) };
    return builder;
  },
  auth: {
    signInWithPassword: async input => { invoked=input; if(networkFailure) throw Error('network'); return {error:null}; },
    updateUser: async () => { if(networkFailure) throw Error('network'); return {error:null}; },
  },
  functions: { invoke: async(name, options) => { invoked={name,...options}; if(networkFailure) throw Error('network'); return {data:{viewUrl:responseUrl},error:null}; } },
  storage:{from:()=>({createSignedUrl:async()=>{signed++;return {data:{signedUrl:'https://project.supabase.co/storage/v1/object/sign/biblioteca/file?token=ok'},error:null};}})},
};
const dependencies = {
  '@/lib/supabase': {supabase:clientMock},
  '@/lib/errors': {toUserMessage:()=> 'Não foi possível conectar.',isMissingRelationError:()=>false},
  '@/lib/env':{env:{supabaseUrl:'https://project.supabase.co'}},
  '@/services/push-service':{dispatchPendingPushNotifications:async()=>{}},
};
const auth=load('src/services/auth-service.ts',dependencies);
const user={id:'client-a'};
admin=true; check((await auth.resolveIdentity(user)).role,'admin','server-confirmed administrator');
admin=false;client={id:'a',auth_id:user.id,nome:'Cliente A',status:'ativo'};
check((await auth.resolveIdentity(user)).role,'client','active client');
client.status=null;check((await auth.resolveIdentity(user)).role,'client','legacy null status matches database');
client.status='inativo';membership={project_id:'p'};
check((await auth.resolveIdentity(user)).role,'unassigned','membership cannot override suspension');
client=null;check((await auth.resolveIdentity(user)).role,'collaborator','explicit active collaborator');
membership=null;check((await auth.resolveIdentity(user)).role,'unassigned','unassigned account blocked');
rpcError=Error('offline');await assert.rejects(auth.resolveIdentity(user));checks++;rpcError=null;
check(await auth.signInWithPassword(' CLIENTE@EXAMPLE.COM ','pw'),null,'successful login');
check(invoked.email,'cliente@example.com','normalized login email');
await auth.sendAccessLink(' CLIENTE@EXAMPLE.COM ');
check(invoked.name,'client-password-link','first access shares website delivery and rate limit');
check(invoked.body.email,'cliente@example.com','normalized recovery email');
networkFailure=true;
check(typeof await auth.signInWithPassword('a','b'),'string','offline login returns visible error');
check(typeof await auth.sendAccessLink('a'),'string','offline recovery returns visible error');
check(typeof await auth.updatePassword('b'),'string','offline password update returns visible error');
networkFailure=false;
const portal=load('src/services/portal-service.ts',dependencies);
responseUrl='https://project.supabase.co/storage/v1/object/sign/private/copy.pdf?token=ok';
check((await portal.createStorageSignedUrl('biblioteca','client-a/original.pdf')).url,responseUrl,'library opens authorized copy');
check(invoked.name,'proteger-pdf','library invokes protected server');
check(signed,0,'protected original is never directly signed by the app');
responseUrl='https://attacker.invalid/file.pdf';
check((await portal.createStorageSignedUrl('biblioteca','client-a/original.pdf')).url,null,'foreign URL rejected');
responseUrl='https://project.supabase.co/storage/v1/object/public/private/original.pdf';
check((await portal.createStorageSignedUrl('biblioteca','client-a/original.pdf')).url,null,'unsigned original URL rejected');
await portal.createStorageSignedUrl('biblioteca','client-a/manual.docx');
check(signed,1,'ordinary non-PDF still uses RLS signed access');
process.stdout.write(`PASS: ${checks} app integration regression checks (synthetic identities, no real emails or customer writes).\n`);
