import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
const requireTest=createRequire(path.join(process.env.CME_FINANCIAL_TEST_ROOT??path.resolve('../../financial-qa'),'index.js'));
const React=requireTest('react'),{create,act}=requireTest('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const e=React.createElement;
function load(file,deps={}){
  const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText,{exports,console,Date,Intl,window:{location:{assign(){}}},require:name=>{if(!(name in deps))throw Error(`Missing ${name}`);return deps[name];}});return exports;
}
const format=load('src/lib/format.ts'),model=load('src/lib/financial-model.ts');
const today=model.financialToday();
let entries=[{id:'paid',projectId:'p',projectName:'Obra',clientName:'Cliente',contractNumber:'CON-1',description:'Parcela recebida',amount:100,type:'entrada',status:'pago',date:today,paidAt:today,dueDate:today,category:'Projetos',accountId:'account',notes:null},
 {id:'cancel',projectId:'p',projectName:'Obra',clientName:'Cliente',contractNumber:'CON-1',description:'Cancelada',amount:999,type:'entrada',status:'cancelado',date:today,paidAt:null,dueDate:today,category:'outros',accountId:null,notes:null}];
const project={id:'p',clientId:'c',clientName:'Cliente',contractId:'contract',contractNumber:'CON-1',name:'Obra'};
const ok=data=>Promise.resolve({data,error:null});
let calls=0,release,fail=false;
const admin={listAdminContracts:()=>ok([{id:'contract',contractNumber:'CON-1',clientName:'Cliente',contractValue:500}]),listAdminProjects:()=>ok([project]),listAdminFinancialEntries:()=>ok(entries),listFinancialArchive:()=>ok([]),
 createAdminFinancialEntry:async input=>{calls++;await new Promise(resolve=>{release=resolve;});if(fail)return 'Falha simulada';entries=[...entries,{...entries[0],id:'new',description:input.description,amount:input.amount}];return null;},updateAdminFinancialEntry:async()=>null,deleteAdminFinancialEntry:async()=>null,updateAdminContractValue:async()=>null};
const operations={listFinancialAccounts:()=>ok([{id:'account',name:'Conta de teste',openingBalance:1000,openingBalanceDate:'2020-01-01',accountType:'bank'}]),listTimesheets:()=>ok([]),listFiscalDocuments:()=>ok([]),getAdminFinancialPreferences:()=>ok({defaultHourlyRate:null}),createFinancialAccount:async()=>null,updateAdminFinancialPreferences:async()=>null,createTimesheet:async()=>null,createFiscalDocument:async()=>null,importOfxTransactions:async()=>({imported:0,reconciled:0,error:null})};
const component=load('src/app/admin/financial.tsx',{
 react:React,'react-native':{View:'div',Text:'span',Pressable:props=>e('button',{onPress:props.onPress},props.children),ActivityIndicator:()=>null,Platform:{OS:'web'},Linking:{}},
 'expo-document-picker':{},'expo-crypto':{randomUUID:()=> '00000000-0000-4000-8000-000000000001'},
 '@/hooks/use-unsaved-form':{useUnsavedForm(){}},
 '@/hooks/use-notification-project':{useNotificationProject(){}},'@/hooks/use-live-refresh':{useLiveRefresh:callback=>React.useEffect(()=>{void callback();},[callback])},
 '@/components/admin-ui':{AdminPageHeader:()=>null,SelectionChips:props=>e('choices',props)},
 '@/components/date-field':{DateField:props=>e('field',{...props,onChangeText:props.onChange})},
 '@/components/ui':{Button:props=>e('button',props),Card:props=>e('div',props,props.children),Field:props=>e('field',props),Notice:props=>e('notice',props,props.children),Screen:props=>e('div',props,props.children),StateView:props=>e('state',props),StatusPill:props=>e('pill',props)},
 '@/lib/financial-model':model,'@/lib/format':format,'@/lib/supabase':{supabase:{}},
 '@/services/admin-service':admin,'@/services/operations-service':operations,
 '@/services/financial-tools':{listBankTransactions:()=>ok([]),exportFinancialCsv:async()=>{},exportFinancialExcel:async()=>{},updateAccountReference:async()=>null},
 '@/providers/theme-provider':{useAppTheme:()=>({colors:{}}),useThemeStyles:()=>({})},
 '@/theme/tokens':{radius:{},spacing:{},typography:{}},
}).default;
let renderer;await act(async()=>{renderer=create(e(component));});
const field=label=>renderer.root.findAllByType('field').find(node=>node.props.label===label);
const choices=label=>renderer.root.findAllByType('choices').find(node=>node.props.label===label);
const button=title=>renderer.root.findAllByType('button').find(node=>node.props.title===title);
const text=()=>JSON.stringify(renderer.toJSON());
assert(text().includes('SALDO REALIZADO'));assert(text().includes('100,00'));assert(!text().includes('1.099,00'),'Cancelled value must not inflate cash totals');
await act(async()=>{choices('Situação do lançamento').props.onChange('cancelado');});
assert(text().includes('Cancelada'));assert(!text().includes('Parcela recebida'));
await act(async()=>{button('Limpar filtros').props.onPress();choices('Contrato e projeto')?.props.onChange?.('p');});
await act(async()=>{const match=renderer.root.findAllByType('button').find(node=>node.findAllByType('span').some(child=>child.children.join('').includes('CON-1'))&&!node.props.title);assert(match);match.props.onPress();field('Descrição').props.onChangeText('Nova parcela');field('Valor (R$)').props.onChangeText('250,00');});
await act(async()=>{button('Registrar no extrato administrativo').props.onPress();button('Registrar no extrato administrativo').props.onPress();});
assert.equal(calls,1,'Double-click must start one mutation');await act(async()=>release());assert.equal(field('Descrição').props.value,'');
fail=true;
await act(async()=>{field('Descrição').props.onChangeText('Preservar formulário');field('Valor (R$)').props.onChangeText('300,00');});
await act(async()=>button('Registrar no extrato administrativo').props.onPress());await act(async()=>release());assert.equal(field('Descrição').props.value,'Preservar formulário');assert(text().includes('Falha simulada'));
await act(async()=>choices('Área financeira').props.onChange('accounts'));
assert(text().includes('Saldo gerencial: '));assert(text().includes('1.350,00'),'Account must reflect opening plus paid entries');
await act(async()=>choices('Área financeira').props.onChange('fiscal'));assert(text().includes('Não valida os requisitos municipais'));assert(choices('Projeto do rascunho fiscal'));
await act(async()=>renderer.unmount());
console.log('FINANCEIRO UI: filtros, cancelados, cadastro com clique duplo, preservação após erro, saldo e rascunho fiscal aprovados.');
