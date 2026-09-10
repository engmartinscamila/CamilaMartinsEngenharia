import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
let checks = 0;
const eq=(a,b,message)=>{assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)),message);checks++;};
function load(path,deps={}) { const exports={}; vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,URL,console,require:name=>{if(!(name in deps))throw Error(`Unexpected dependency ${name}`);return deps[name];}},{filename:path});return exports; }
const format=load('src/lib/format.ts');
for(const [value,status] of [['Concluído','concluido'],['Em andamento','em_andamento'],['em_andamento','em_andamento'],['Pendente','pendente']])eq(format.normalizeStatus(value),status,`schedule ${value}`);
const {notificationRoute:route}=load('src/lib/notification-route.ts');
eq(route('documentos-cliente.html?projeto=abc-123','client'),{pathname:'/(client)/documents',params:{projectId:'abc-123'}},'legacy website notification opens app document project');
eq(route('/portal/documents','client'),{pathname:'/(client)/documents',params:{}},'web route recognized');
eq(route('/admin/content?tipo=photo','admin'),{pathname:'/admin/content',params:{tipo:'photo'}},'photo destination retained');
eq(route('/admin/tasks','admin','project-a'),{pathname:'/admin/tasks',params:{projectId:'project-a'}},'notification metadata retains project');
for(const value of ['https://evil.invalid','javascript:alert(1)','//evil.invalid','/admin/tasks','/(client)/unknown','\\evil.invalid'])eq(route(value,'client'),null,`unsafe or unauthorized destination ${value}`);
let response={data:null,error:null}, payload, rpcResult={data:0,error:null}, inserted, invoked;
const db={from(table){ const chain={ update(value){payload=value;return chain;},select(){return chain;},eq(){return chain;},in(){return chain;},maybeSingle:async()=>response,then(resolve){return Promise.resolve(table==='bank_transactions'?{data:[],error:null}:response).then(resolve);},upsert:async(value)=>{inserted=value;return {error:null};} };return chain;},rpc:async(name,args)=>{invoked={name,args};return rpcResult;}};
const deps={'@/lib/supabase':{supabase:db},'@/lib/format':format,'expo-file-system/legacy':{},'react-native':{Platform:{OS:'web'}}};
const operations=load('src/services/operations-service.ts',deps);
for(const action of [()=>operations.updateCrmRecord({id:'missing',stage:'novo'}),()=>operations.updateProjectTask({id:'missing',status:'done'}),()=>operations.selectSupplierBid('missing','supplier')]){eq(typeof await action(),'string','zero affected rows must show error');}
response={data:{id:'ok'},error:null};eq(await operations.updateCrmRecord({id:'ok',stage:'novo',nextActionAt:null}),null,'successful change');eq(payload.next_action_at,null,'clear scheduled next action');
eq(typeof await operations.updateCrmRecord({id:'ok',stage:'perdido',lostReason:''}),'string','lost reason required');
eq(typeof await operations.updateCrmRecord({id:'ok',stage:'novo',nextActionAt:'invalid'}),'string','invalid next date rejected');
const record='<STMTTRN><TRNAMT>100.00<DTPOSTED>20260909<FITID>fixture-1<TRNTYPE>CREDIT</STMTTRN>';
const asset={file:{text:async()=>record+record}};
eq(await operations.importOfxTransactions('account-a',asset),{imported:1,reconciled:0,error:null},'duplicate OFX rows counted once');eq(inserted.length,1,'duplicate rows submitted once');eq(invoked.name,'reconcile_imported_ofx','reconciliation is atomic RPC');
rpcResult={error:{message:'offline'},data:null};const partial=await operations.importOfxTransactions('account-a',asset);eq(partial.imported,1,'import success retained when reconciliation fails');eq(typeof partial.error,'string','partial result explained');

const deletionSource=fs.readFileSync('supabase/functions/admin-delete-client/index.ts','utf8');
const purgeCall=deletionSource.indexOf("caller.rpc('admin_purge_client_database'");
const storageCleanup=deletionSource.indexOf('const storageCleanup = await deleteStorageObjects(service, objects)');
eq(deletionSource.includes('requireAdmin(request)'),true,'client deletion requires validated admin session');
eq(purgeCall>=0&&storageCleanup>purgeCall,true,'client deletion commits database purge before physical storage cleanup');
eq(deletionSource.includes("from('supplier_bids')")&&deletionSource.includes('attachment_bucket,attachment_path'),true,'client deletion inventories supplier bid attachments');
eq(deletionSource.includes("path.startsWith('issued/')")&&deletionSource.includes("path.startsWith('emitidos/')"),true,'client deletion inventories only recognized temporary protected-copy prefixes');
eq(deletionSource.includes('financialHistoryPreserved: true')&&deletionSource.includes('legalAndSecurityHistoryPreserved: true'),true,'client deletion reports required histories as preserved');
const retentionMigration=fs.readFileSync('supabase/migrations/20260910205221_preserve_client_legal_and_security_history_on_deletion.sql','utf8');
eq(retentionMigration.includes('client_retention_event_archive'),true,'client deletion archives legal/security retention events');
eq(retentionMigration.includes("'legal_acceptance'")&&retentionMigration.includes("'protected_asset_issue'")&&retentionMigration.includes("'protected_pdf_issue'"),true,'client deletion preserves all required security evidence classes');
const deletionClient=fs.readFileSync('src/services/client-deletion-service.ts','utf8');
eq(deletionClient.includes("functions.invoke('admin-delete-client'"),true,'client UI uses only the protected permanent-deletion endpoint');
eq(deletionClient.includes('retainedSecurityEvents'),true,'client deletion preview exposes preserved security-event count');

process.stdout.write(`PASS: ${checks} functional regression checks; no production writes.\n`);
