import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(file,deps={}){
  const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports,console,Date,Intl,require:name=>{if(!(name in deps))throw Error(name);return deps[name];}});return exports;
}
const m=load('src/lib/financial-model.ts'),format=load('src/lib/format.ts');
const entry=(id,extra={})=>({id,projectId:'p1',projectName:'Obra',clientName:'Cliente',contractNumber:'CON-1',description:'Serviço',amount:100,type:'entrada',status:'pago',date:'2026-10-10',dueDate:'2026-10-10',paidAt:'2026-10-10',category:'Projetos',accountId:'a1',notes:null,...extra});
const same=(a,b)=>assert.deepEqual(JSON.parse(JSON.stringify(a)),b);
assert.equal(m.financialCategory('Deslocamentos'),'deslocamento');assert.equal(m.financialCategory('Impostos'),'taxas');assert.equal(m.financialCategory('Categoria própria'),'Categoria própria');
const rows=[entry('paid'),entry('future',{status:'previsto',amount:200}),entry('cancel',{status:'cancelado',amount:999}),entry('expense',{type:'saida',amount:25})];
same(m.financialTotals(rows),{received:100,paid:25,receivable:200,payable:0,balance:75,forecast:275});
const empty={query:'',projectId:'',status:'',month:''};
assert.equal(m.filterFinancialEntries(rows,{...empty,status:'cancelado'},'2026-10-29').length,1);
assert.equal(m.filterFinancialEntries(rows,{...empty,status:'atrasado'},'2026-10-29').length,1);
assert.equal(m.filterFinancialEntries(rows,{...empty,query:'con-1'}).length,4);
assert.equal(m.filterFinancialEntries(rows,{...empty,projectId:'other'}).length,0);
assert.equal(m.filterFinancialEntries([entry('date',{dueDate:'2026-09-01',paidAt:'2026-10-10'})],{...empty,month:'2026-10'}).length,1);
const tx=[{id:'bank',accountId:'a1',date:'2026-10-10',amount:100,matchedFinancialId:'paid'},
 {id:'unmatched',accountId:'a1',date:'2026-10-10',amount:40,matchedFinancialId:null},
 {id:'transfer',accountId:'a1',date:'2026-10-10',amount:-30,matchedFinancialId:null},
 {id:'prior',accountId:'a1',date:'2026-10-01',amount:900,matchedFinancialId:null},
 {id:'future',accountId:'a1',date:'2026-11-01',amount:500,matchedFinancialId:null}];
assert.equal(m.accountBalance({id:'a1',openingBalance:1000},rows,tx),null);
assert.equal(m.accountBalance({id:'a1',openingBalance:1000,openingBalanceDate:'2026-10-01'},[entry('paid',{bankTransactionId:'bank'}),entry('manual',{amount:50})],tx,'2026-10-29'),1160);
assert(m.csvCell('=HYPERLINK("bad")').startsWith('"\''));

const database={financeiro:[],bank_transactions:[]};let failAfterInsert=true;
const db={from(table){let action='read',payload,filters=[],start=0,end=1e8,one=false;
 const q={select(){return q;},eq(k,v){filters.push(row=>row[k]===v);return q;},is(k,v){filters.push(row=>(row[k]??null)===v);return q;},order(){return q;},limit(n){end=n;return q;},range(a,b){start=a;end=b+1;return q;},
 insert(value){action='insert';payload=value;return q;},update(value){action='update';payload=value;return q;},delete(){action='delete';return q;},single(){one=true;return q;},maybeSingle(){one=true;return q;},
 then(resolve,reject){return Promise.resolve().then(()=>{
  let data=(database[table]??[]).filter(row=>filters.every(filter=>filter(row)));
  if(action==='insert'){
   if(database[table].some(row=>row.client_request_id===payload.client_request_id))return {data:null,error:{code:'23505'}};
   database[table].push({id:'created',...payload});if(failAfterInsert){failAfterInsert=false;return {data:null,error:{message:'lost response'}};}data=[{id:'created',...payload}];
  }
  if(action==='update')data.forEach(row=>Object.assign(row,payload));
  if(action==='delete')database[table]=database[table].filter(row=>!data.includes(row));
  data=data.slice(start,end);return {data:one?data[0]??null:data,error:null};
 }).then(resolve,reject);}};return q;
}};
const service=load('src/services/admin-service.ts',{'@/lib/paginated-query':load('src/lib/paginated-query.ts'),'@/lib/financial-model':m,'@/lib/format':format,'@/lib/supabase':{supabase:db},'@/lib/errors':{},'base64-arraybuffer':{},'expo-file-system/legacy':{},'expo-crypto':{},'react-native':{Platform:{OS:'web'}},'@/services/push-service':{}});
const input={projectId:'p1',description:'Parcela',type:'entrada',amount:100,date:'2026-10-10',status:'pago',requestId:'00000000-0000-4000-8000-000000000001'};
assert.equal(typeof await service.createAdminFinancialEntry(input),'string');
assert.equal(await service.createAdminFinancialEntry(input),null);assert.equal(database.financeiro.length,1,'Retry must not duplicate a committed insert');
assert.equal(typeof await service.createAdminFinancialEntry({...input,amount:200}),'string','Reuse with different data must fail');
database.bank_transactions=[{id:'bank',matched_financial_id:'created'}];
assert.equal(typeof await service.updateAdminFinancialEntry('created',input),'string');assert.equal(typeof await service.deleteAdminFinancialEntry('created'),'string');assert.equal(database.financeiro.length,1);
database.bank_transactions=[];database.financeiro=Array.from({length:1001},(_,i)=>({id:String(i),projeto_id:'p1',valor:1,tipo:'entrada',status:'pendente',categoria:'Impostos'}));
const all=await service.listAdminFinancialEntries();assert.equal(all.data.length,1001);assert.equal(all.error,null);assert.equal(all.data[1000].category,'taxas');
console.log('FINANCEIRO: status, categorias, filtros, caixa/previsão, referência de saldo, conciliação sem dupla contagem, CSV seguro, repetição idempotente e 1001 registros aprovados.');
const paging=load('src/lib/paginated-query.ts');let pageCalls=0;
const failingPage={order(){return this},async range(start){pageCalls++;return start===0?{data:Array.from({length:500},(_,id)=>({id})),error:null}:{data:null,error:{message:'read failed'}};}};
const failedRead=await paging.readAllRows(failingPage);assert.equal(failedRead.data.length,0,'Partial pages cannot become a complete total');assert.equal(pageCalls,2);assert(failedRead.error);
const previewDb={from(){const q={select(){return q},eq(){return q},order(){return q},limit(){return q},then(resolve){resolve({data:[
{id:'ordinary',nome:'Arquivo normal',document_kind:null,generated_at:null},
{id:'draft',nome:'Rascunho interno',document_kind:'contrato',generated_at:'2026-10-01',client_visible:false,exibir_cliente:false,client_released_at:null},
{id:'released',nome:'Documento liberado',document_kind:'contrato',generated_at:'2026-10-01',client_visible:true,exibir_cliente:false,client_released_at:'2026-10-02'},
{id:'not-released',nome:'Sem liberação',document_kind:'contrato',generated_at:'2026-10-01',client_visible:true,client_released_at:null},
],error:null});}};return q;}};
const portal=load('src/services/portal-service.ts',{'@/lib/format':format,'@/lib/errors':{},'@/lib/env':{env:{}},'@/lib/supabase':{supabase:previewDb},'@/services/push-service':{}});
const preview=await portal.listDocuments('synthetic-project',true);assert.equal(preview.error,null);assert.deepEqual(Array.from(preview.data,row=>row.id),['ordinary','released']);
console.log('PASS: página incompleta não gera total parcial; prévia exclui rascunhos e documentos não liberados.');
