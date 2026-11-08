import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import ts from 'typescript';
const qa=createRequire(process.env.CME_FINANCIAL_TEST_ROOT?process.env.CME_FINANCIAL_TEST_ROOT+'/index.js':new URL('../../package.json',import.meta.url));
const React=qa('react'),{create,act}=qa('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const baseline=process.env.CME_AUDIT_BASELINE==='1';
function source(file){return baseline?execFileSync('git',['show',`22328fb:portal-app/${file}`],{encoding:'utf8'}):fs.readFileSync(file,'utf8');}
function load(file,deps={}){
 const exports={};
 vm.runInNewContext(ts.transpileModule(source(file),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText,{
  exports,console,Date,Intl,URL,require:name=>{if(!(name in deps))throw Error('Missing '+name);return deps[name];},
 });
 return exports;
}
const format=load('src/lib/format.ts');
const model=load('src/lib/financial-model.ts');
const {readAllRows}=load('src/lib/paginated-query.ts');
const c=name=>{const Component=props=>React.createElement(name,props,props.children);Component.displayName=name;return Component;};
const ui=Object.fromEntries(['Button','Card','Field','Notice','Screen','StateView','StatusPill'].map(name=>[name,c(name)]));
const native={Text:c('Text'),View:c('View'),Pressable:c('Pressable'),ActivityIndicator:c('Spinner'),Platform:{OS:'web'}};
let failures=0;
async function test(name,fn){try{await fn();console.log('PASS '+name);}catch(error){failures++;console.error('FAIL '+name+' '+error.stack);}}

await test('A01 context loads, discards late reads/saves, clears on deselection, retries errors',async()=>{
 const context=load('src/providers/admin-module-context.tsx',{react:React});
 const requests=[],writes=[];
 const budget=load('src/app/admin/construction-schedule-budget.tsx',{
  react:React,'react-native':native,'@/components/ui':ui,'@/components/admin-ui':{AdminPageHeader:c('Header')},
  '@/providers/admin-module-context':context,
  '@/lib/construction-budget-validation':{analyzeExecutionBudget:()=>({valid:true,total:100,errors:[],lineCosts:{}})},
  '@/services/construction-schedule-service':{listConstructionScheduleProjects:async()=>({data:[],error:null})},
  '@/services/construction-schedule-budget-service':{
   loadCurrentScheduleBudget:id=>new Promise((resolve,reject)=>requests.push({id,resolve,reject})),
   saveCurrentScheduleBudget:draft=>new Promise(resolve=>writes.push({draft,resolve})),
  },
 }).default;
 const tree=id=>React.createElement(context.AdminModuleProvider,{value:{projectId:id,module:'construction-schedule-budget',onProjectChange(){}}},React.createElement(budget));
 const draft=id=>({projectId:id,scheduleId:'schedule-'+id,title:'Budget '+id,revisionNumber:1,items:[{code:'1',activity:'QA',quantity:'1',unit:'un',unitCost:'100',plannedCost:'',costSource:'QA',weightPercent:100}]});
 let root;
 await act(async()=>{root=create(tree('A'));});
 assert.equal(requests.length,1,'Main workspace context must trigger automatic read');
 await act(async()=>{root.update(tree('B'));});
 assert.equal(requests[1].id,'B');
 await act(async()=>requests[1].resolve({data:draft('B'),error:null}));
 await act(async()=>requests[0].resolve({data:draft('A'),error:null}));
 assert(JSON.stringify(root.toJSON()).includes('Budget B'));
 assert(!JSON.stringify(root.toJSON()).includes('Budget A'));
 const save=root.root.findAllByType('Button').find(x=>x.props.title.startsWith('Salvar orçamento'));
 await act(async()=>{save.props.onPress();save.props.onPress();});
 assert.equal(writes.length,1,'Double click cannot send two writes');
 await act(async()=>{root.update(tree('C'));});
 assert.equal(root.root.findAllByType('Field').length,0);
 await act(async()=>writes[0].resolve({total:100,error:null}));
 assert.equal(requests.length,3,'Late save cannot reload previous project');
 await act(async()=>requests[2].reject(Error('Network QA')));
 assert(JSON.stringify(root.toJSON()).includes('Não foi possível carregar'));
 await act(async()=>root.root.findAllByType('Button').find(x=>x.props.title==='Recarregar orçamento').props.onPress());
 assert.equal(requests[3].id,'C');
 await act(async()=>{root.update(tree(null));requests[3].resolve({data:draft('C'),error:null});});
 assert.equal(root.root.findAllByType('Field').length,0);
 await act(async()=>root.unmount());
});

const adminDeps=db=>({
 '@/lib/supabase':{supabase:db},'@/lib/paginated-query':{readAllRows},'@/lib/format':format,'@/lib/financial-model':model,
 '@/lib/errors':{},'base64-arraybuffer':{},'expo-file-system/legacy':{},'expo-crypto':{},'react-native':native,'@/services/push-service':{},
});
await test('A04 decimal precision, Brazilian thousands and retry after lost response',async()=>{
 for(const [input,expected] of [['100,005',null],['1,005',null],['12.34,56',null],['R$ 1.234,56',1234.56],['1.005',1005],['0,01',0.01],['100.01',100.01],['1.234.567,89',1234567.89],['',null]])assert.equal(format.parseBrazilianCurrency(input),expected,input);
 let row=null,inserts=0;
 const db={from(){let payload,filter;const q={insert(value){payload=value;return q;},select(){return q;},eq(key,value){filter=value;return q;},
  async single(){inserts++;if(!row){row={id:'payment-1',...payload};return {data:null,error:{message:'response lost'}};}return {data:null,error:{code:'23505'}};},
  async maybeSingle(){return {data:row?.client_request_id===filter?row:null,error:null};}};return q;}};
 const admin=load('src/services/admin-service.ts',adminDeps(db));
 const input={projectId:null,clientId:'A',description:'QA payment',type:'entrada',amount:0.1+0.2,date:'2026-10-01',status:'pendente',requestId:'request-1'};
 assert.equal(typeof admin.financialEntryPayload({...input,amount:100.005}),'string');
 assert.equal(admin.financialEntryPayload(input).valor,0.3);
 assert(await admin.createAdminFinancialEntry(input));
 assert.equal(await admin.createAdminFinancialEntry(input),null);
 assert.equal(inserts,2);assert.equal(row.valor,0.3);
 assert.match(await admin.createAdminFinancialEntry({...input,amount:1}),/outros dados/);
});

await test('A05 unknown money stays null in projects and document previews; explicit zero preserved',async()=>{
 for(const value of [null,undefined,'',' ',0,'0',123.45]){
  const db={from(){const q={select(){return q;},order(){return q;},range:async()=>({data:[{id:'p',contratos:{id:'c',contract_value:value}}],error:null})};return q;},rpc:async()=>({data:{contract_value:value},error:null})};
  const admin=load('src/services/admin-service.ts',adminDeps(db));
  const workflow=load('src/services/document-workflow-service.ts',{'@/lib/format':format,'@/lib/paginated-query':{readAllRows},'@/lib/download-generated-file':{},'@/services/push-service':{},'@/lib/supabase':{supabase:db},'@/lib/errors':{}});
  const expected=value===0||value==='0'?0:value===123.45?123.45:null;
  assert.equal((await admin.listAdminProjects()).data[0].contract.contractValue,expected);
  assert.equal((await workflow.previewContractDocument({projectId:'p',kind:'anexo_i'})).data.contractValue,expected);
 }
});

await test('A10 all portal pages, original scopes, legacy fallback and fail closed on page 2',async()=>{
 let fail=false,legacy=false,calls=[];
 const db={from(table){let scope;const q={select(columns){q.columns=columns;return q;},eq(key,value){scope=[key,value];return q;},is(key,value){scope=[key,value];return q;},or(value){scope=value;return q;},order(){return q;},limit(n){q.cap=n;return q;},
  then(resolve){resolve({data:Array.from({length:q.cap??500},(_,i)=>({id:'row-'+i,projeto_id:'A'})),error:null});},
  async range(start,end){calls.push({table,start,end,scope});
   if(legacy&&q.columns.includes('storage_bucket'))return {data:null,error:{code:'42703'}};
   if(fail&&start===500)return {data:null,error:{message:'QA second page'}};
   return {data:Array.from({length:Math.max(0,Math.min(end-start+1,1201-start))},(_,i)=>({id:'row-'+(start+i),projeto_id:'A',created_at:'2026-10-01'})),error:null};}};return q;}};
 const service=load('src/services/portal-service.ts',{'@/lib/paginated-query':{readAllRows},'@/lib/supabase':{supabase:db},'@/lib/env':{env:{}},'@/lib/format':format,'@/services/push-service':{},'@/lib/errors':{isMissingRelationError:()=>false}});
 for(const fallback of [false,true]){legacy=fallback;
  for(const [method,args] of [['listDocuments',['A']],['listPhotos',['A']],['listLibraryItems',['A','client-A']]]){
   calls=[];const result=await service[method](...args);assert.equal(result.error,null);assert.equal(result.data.length,1201,method);
   assert.equal(new Set(result.data.map(row=>row.id)).size,1201);
   assert(calls.every(x=>JSON.stringify(x.scope)===JSON.stringify(calls[0].scope)));
   assert(JSON.stringify(calls[0].scope).includes('A'));
  }
 }
 legacy=false;fail=true;
 for(const [method,args] of [['listDocuments',['A']],['listPhotos',['A']],['listLibraryItems',['A','client-A']]]){const result=await service[method](...args);assert.equal(result.data.length,0);assert(result.error);}
});

await test('A09 persisted statuses remain selectable and percentage edits preserve status',async()=>{
 for(const status of ['em_andamento','orcamento','pausado','estado_futuro']){
  let saved;
  const project={id:'A',name:'QA',clientId:'client-A',status,progress:10,contractId:null};
  const screen=load('src/app/admin/projects.tsx',{
   react:React,'react-native':native,'@/components/ui':ui,
   '@/components/admin-ui':{AdminPageHeader:c('Header'),SelectionChips:c('Choices')},
   '@/hooks/use-live-refresh':{useLiveRefresh:callback=>React.useEffect(()=>{void callback();},[callback])},
   '@/lib/format':format,'@/lib/admin-navigation':{usesWebsiteAdminHome:()=>false},
   '@/providers/theme-provider':{useAppTheme:()=>({colors:{}}),useThemeStyles:()=>({})},
   '@/theme/tokens':{radius:{},spacing:{},typography:{size:{}}},
   '@/services/admin-service':{listAdminClients:async()=>({data:[],error:null}),listAdminContracts:async()=>({data:[],error:null}),
    listAdminProjects:async()=>({data:[project],error:null}),updateAdminProject:async input=>{saved=input;return null;}},
  }).default;
  let root;await act(async()=>{root=create(React.createElement(screen));});
  await act(async()=>root.root.findAllByType('Button').find(x=>x.props.title==='Editar andamento').props.onPress());
  const choices=root.root.findByType('Choices');
  assert(choices.props.items.some(x=>x.value===status),'Persisted status must have a visible option');
  await act(async()=>root.root.findAllByType('Field').find(x=>x.props.label==='Progresso (%)').props.onChangeText('25'));
  await act(async()=>root.root.findAllByType('Button').find(x=>x.props.title==='Salvar').props.onPress());
  assert.equal(saved.status,status);assert.equal(saved.progress,25);
  await act(async()=>root.unmount());
 }
});

await test('A06 service uses one RPC and preserves request identity after a timeout',async()=>{
 let calls=[],lost=true;
 const db={from(){throw Error('Task creation must never issue split table writes or compensating DELETE');},rpc:async(name,args)=>{
  calls.push({name,args});
  if(lost){lost=false;throw Error('lost response after commit');}
  return {data:'00000000-0000-4000-8000-000000000001',error:null};
 }};
 const operations=load('src/services/operations-service.ts',{
  '@/lib/format':format,'@/lib/paginated-query':{readAllRows},'@/lib/supabase':{supabase:db},
  'expo-file-system/legacy':{},'react-native':native,
 });
 const input={requestId:'request-1',projectId:'project-A',title:'Task QA',priority:'normal',clientVisible:false,dependencyId:'parent-QA'};
 const first=await operations.createProjectTask(input);assert(first);assert(!first.includes('foi revertida'));
 assert.equal(await operations.createProjectTask(input),null);
 assert.equal(calls.length,2);assert.equal(calls[0].name,'admin_create_project_task');
 assert.equal(calls[0].args.p_request_id,calls[1].args.p_request_id);
 assert.equal(calls[1].args.p_data.dependency_id,'parent-QA');
});

await test('A02 UI service blocks receipted edits/deletes and fails closed on lookup error',async()=>{
 for(const unavailable of [false,true]){
  let writes=0;
  const db={from(table){const q={select(){return q;},eq(){return q;},limit:async()=>table==='payment_receipts'?{data:unavailable?null:[{id:'receipt'}],error:unavailable?{message:'offline'}:null}:{data:[],error:null},update(){writes++;throw Error('invalid update');},delete(){writes++;throw Error('invalid delete');}};return q;}};
  const admin=load('src/services/admin-service.ts',adminDeps(db));
  assert(await admin.updateAdminFinancialEntry('payment',{projectId:null,clientId:'client',description:'QA payment',type:'entrada',amount:100,date:'2026-10-01'}));
  assert(await admin.deleteAdminFinancialEntry('payment'));
  assert.equal(writes,0);
 }
});

if(failures)process.exit(1);
