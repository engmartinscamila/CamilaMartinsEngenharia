import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
const requireTest=createRequire(path.join(process.env.CME_FINANCIAL_TEST_ROOT??path.resolve('../../financial-qa'),'index.js'));
const React=requireTest('react'),{create,act}=requireTest('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const e=React.createElement;
function load(file,deps){
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}
 }).outputText,{exports,Date,Intl,Math,Number,Map,Set,JSON,console,require:name=>{
  if(!(name in deps))throw Error('Missing '+name);return deps[name];
 }});
 return exports;
}
const paymentId='00000000-0000-4000-8000-000000000001',clientId='00000000-0000-4000-8000-000000000002';
const base={
 clients:[{id:clientId,name:'Cliente de teste'}],contracts:[],projects:[],accounts:[],
 titles:[],installments:[],payments:[{id:paymentId,clientId,accountId:null,amount:150,paidOn:'2026-11-07',method:'Pix',reversed:false}],
 totalOpen:0,overdue:0,cashReceived:150,unallocatedCredit:150
};
let records=[],issues=0,loads=0;
let enabled=true;
const services={
 financeV2HomologationEnabled:true,
 loadFinanceV2Snapshot:async()=>({data:base,error:null}),
 createFinanceV2Title:async()=>({data:null,error:'not used'}),
 recordFinanceV2Payment:async()=>({data:null,error:'not used'}),
 reverseFinanceV2Payment:async()=>({data:null,error:'not used'}),
};
const refs={
 listFinanceV2ReceiptRecords:async()=>{loads++;return {data:records,error:null}},
 issueFinanceV2ReceiptReference:async id=>{assert.equal(id,paymentId);issues++;
  records=[{id:'e1',paymentId,referenceNumber:'1',issuedAt:'2026-11-07T20:00:00Z',amount:150,paidOn:'2026-11-07',clientName:'Cliente de teste'}];
  return {data:'e1',error:null};
 }
};
const ui={
 Button:props=>e('button',props),Card:props=>e('div',props,props.children),
 Field:props=>e('field',props),Notice:props=>e('notice',props,props.children),
 Screen:props=>e('div',props,props.children),StateView:props=>e('state',props,props.description)
};
let uuidN=0;
const deps={
 react:React,'react-native':{Pressable:props=>e('button',props,props.children),Text:'span',View:'div'},
 'expo-crypto':{randomUUID:()=> '00000000-0000-4000-8000-'+String(++uuidN).padStart(12,'0')},
 'expo-router':{useRouter:()=>({replace(){}})},
 '@/components/admin-ui':{AdminPageHeader:()=>null,SelectionChips:props=>e('choices',props)},
 '@/components/date-field':{DateField:props=>e('field',props)},
 '@/components/ui':ui,
 '@/lib/finance-v2-forms':{buildMonthlyInstallments:()=>[],suggestPaymentDistribution:()=>({allocations:[],applied:0,unallocated:0})},
 '@/lib/financial-model':{financialToday:()=> '2026-11-07'},
 '@/lib/format':{formatCurrency:v=>String(v),parseBrazilianCurrency:v=>v.trim()?Number(v.replace(',','.')):null},
 '@/providers/theme-provider':{useAppTheme:()=>({colors:{ink:'#222',muted:'#777',line:'#ddd'}})},
 '@/services/finance-v2-service':services,
 '@/services/finance-v2-receipt-service':refs
};
const comp=load('src/app/admin/financial-v2.tsx',deps).default;
let renderer;
await act(async()=>{renderer=create(e(comp));});
const text=()=>JSON.stringify(renderer.toJSON());
const button=title=>renderer.root.findAllByType('button').find(n=>n.props.title===title);
assert(button('Registrar comprovante interno (homologação)'),'Pagamento V2 deve poder registrar comprovante');
await act(async()=>button('Registrar comprovante interno (homologação)').props.onPress());
assert.equal(issues,1,'Uma ação emite uma referência');
assert(text().includes('Comprovante interno H-1'));
assert(!button('Registrar comprovante interno (homologação)'),'Pagamento com comprovante não oferece outra emissão');
assert(loads>=2);
await act(async()=>renderer.unmount());
const locked=load('src/app/admin/financial-v2.tsx',{
 ...deps,
 '@/services/finance-v2-service':{...services,financeV2HomologationEnabled:false}
}).default;
const before=issues, reads=loads;
await act(async()=>{renderer=create(e(locked));});
assert(text().includes('Operação bloqueada no ambiente atual'));
assert.equal(issues,before);
assert.equal(loads,reads);
await act(async()=>renderer.unmount());
console.log('PASS: interface de homologação exibe comprovante interno uma única vez e bloqueia produção.');
