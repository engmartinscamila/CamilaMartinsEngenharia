import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
const requireTest=createRequire(path.join(process.env.CME_FINANCIAL_TEST_ROOT??path.resolve('../../financial-qa'),'index.js'));
const React=requireTest('react'),{create,act}=requireTest('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let receiptDestination;
const e=React.createElement;
function load(file,deps={}){
  const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText,{exports,console,Date,Intl,window:{location:{assign(value){receiptDestination=value;}}},require:name=>{if(!(name in deps))throw Error(`Missing ${name}`);return deps[name];}});return exports;
}
const format=load('src/lib/format.ts'),model=load('src/lib/financial-model.ts'),priorities=load('src/lib/receivable-priorities.ts');
const today=model.financialToday();
const payloadSource=fs.readFileSync('src/services/admin-service.ts','utf8').match(/export function financialEntryPayload[\s\S]*?\n}/)[0];
const payloadExports={};vm.runInNewContext(ts.transpileModule(payloadSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:payloadExports,...format,...model});
const standaloneInput={projectId:null,clientId:'client-only',contractId:null,description:'Serviço sem projeto',type:'entrada',amount:125,date:'2026-10-22',status:'pendente'};
const pendingPayload=payloadExports.financialEntryPayload(standaloneInput);assert.equal(pendingPayload.cliente_id,'client-only');assert.equal(pendingPayload.projeto_id,null);assert.equal(pendingPayload.contract_id,null);assert.equal(pendingPayload.data_pagamento,null);
const paidPayload=payloadExports.financialEntryPayload({...standaloneInput,status:'pago',paidAt:'2026-10-23'});assert.equal(paidPayload.data_pagamento,'2026-10-23');
assert.equal(typeof payloadExports.financialEntryPayload({...standaloneInput,clientId:null}),'string');

let entries=[{id:'paid',projectId:'p',projectName:'Obra',clientName:'Cliente',contractNumber:'CON-1',description:'Parcela recebida',amount:100,type:'entrada',status:'pago',date:today,paidAt:today,dueDate:today,category:'Projetos',accountId:'account',notes:null},
 {id:'cancel',projectId:'p',projectName:'Obra',clientName:'Cliente',contractNumber:'CON-1',description:'Cancelada',amount:999,type:'entrada',status:'cancelado',date:today,paidAt:null,dueDate:today,category:'outros',accountId:null,notes:null}];
const project={id:'p',clientId:'c',clientName:'Cliente',contractId:'contract',contractNumber:'CON-1',name:'Obra'};
const ok=data=>Promise.resolve({data,error:null});
let calls=0,release,fail=false,lastInput;
const admin={listAdminClients:()=>ok([{id:'c',name:'Cliente'},{id:'avulso',name:'Harison sintético sem contrato'}]),listAdminContracts:()=>ok([{id:'contract',clientId:'c',contractNumber:'CON-1',clientName:'Cliente',contractValue:500}]),listAdminProjects:()=>ok([project]),listAdminFinancialEntries:()=>ok(entries),listFinancialArchive:()=>ok([]),
 createAdminFinancialEntry:async input=>{lastInput=input;calls++;await new Promise(resolve=>{release=resolve;});if(fail)return 'Falha simulada';entries=[...entries,{...entries[0],...input,id:'new-'+calls,description:input.description,amount:input.amount}];return null;},updateAdminFinancialEntry:async(id,input)=>{lastInput=input;entries=entries.map(row=>row.id===id?{...row,...input}:row);return null;},deleteAdminFinancialEntry:async()=>null,updateAdminContractValue:async()=>null};
const operations={listFinancialAccounts:()=>ok([{id:'account',name:'Conta de teste',openingBalance:1000,openingBalanceDate:'2020-01-01',accountType:'bank'}]),listTimesheets:()=>ok([]),listFiscalDocuments:()=>ok([]),getAdminFinancialPreferences:()=>ok({defaultHourlyRate:null}),createFinancialAccount:async()=>null,updateAdminFinancialPreferences:async()=>null,createTimesheet:async()=>null,createFiscalDocument:async()=>null,importOfxTransactions:async()=>({imported:0,reconciled:0,error:null})};
const financialViewUi={
 Button:props=>e('button',props),Card:props=>e('div',props,props.children),
 Field:props=>e('field',props),Notice:props=>e('notice',props,props.children),
 StateView:props=>e('state',props),StatusPill:props=>e('pill',props)
};
const financialViewDeps={
 react:React,
 'react-native':{View:'div',Text:'span',ActivityIndicator:()=>null},
 '@/components/ui':financialViewUi,
 '@/components/admin-ui':{SelectionChips:props=>e('choices',props)},
 '@/components/date-field':{DateField:props=>e('field',{...props,onChangeText:props.onChange})},
 '@/lib/financial-model':model,
 '@/lib/receivable-priorities':priorities,
 '@/lib/format':format,
 '@/services/financial-tools':{exportFinancialCsv:async()=>{},exportReceivableCsv:async()=>{}},
};
const reconciliation=load('src/lib/financial-reconciliation.ts',{'@/lib/financial-model':model});
const legacyAudit=load('src/lib/legacy-finance-audit.ts',{'@/lib/financial-model':model});
const legacyPanel=load('src/components/legacy-financial-audit-panel.tsx',{
 ...financialViewDeps,
 '@/providers/theme-provider':{useAppTheme:()=>({colors:{ink:'#000',muted:'#777'}})}
});
financialViewDeps['@/lib/financial-reconciliation']=reconciliation;
const financialOverview=load('src/components/financial-overview.tsx',financialViewDeps);
const financialDetails=load('src/components/financial-detail-sections.tsx',financialViewDeps);
const moduleContext=load('src/providers/admin-module-context.tsx',{react:React});
const component=load('src/app/admin/financial.tsx',{
 'expo-router':{useRouter:()=>({push(){},replace(){}})},
 '@/services/finance-v2-service':{financeV2HomologationEnabled:false},
 '@/providers/admin-module-context':moduleContext,
 '@/components/financial-overview':financialOverview,
 '@/components/legacy-financial-audit-panel':legacyPanel,
 '@/lib/legacy-finance-audit':legacyAudit,
 '@/services/legacy-receipt-service':{listAdminReceiptReferences:()=>ok([{id:'synthetic-receipt',financialEntryId:'paid',clientId:'c',projectId:'p',amount:100,paidOn:today}])},
 '@/components/financial-detail-sections':financialDetails,
 '@/components/financial-styles':{financialStyleDefinitions:()=>({})},
 '@/components/admin-client-picker':{AdminClientPicker:props=>e('client-picker',props)},
 '@/components/admin-project-picker':{AdminProjectPicker:props=>e('project-picker',props)},
 react:React,'react-native':{View:'div',Text:'span',Pressable:props=>e('button',{onPress:props.onPress},props.children),ActivityIndicator:()=>null,Platform:{OS:'web'},Linking:{}},
 'expo-document-picker':{},'expo-crypto':{randomUUID:()=> '00000000-0000-4000-8000-000000000001'},
 '@/hooks/use-unsaved-form':{useUnsavedForm(){}},
 '@/hooks/use-notification-project':{useNotificationProject(){}},'@/hooks/use-live-refresh':{useLiveRefresh:callback=>React.useEffect(()=>{void callback();},[callback])},
 '@/components/admin-ui':{AdminPageHeader:()=>null,SelectionChips:props=>e('choices',props)},
 '@/components/date-field':{DateField:props=>e('field',{...props,onChangeText:props.onChange})},
 '@/components/ui':{Button:props=>e('button',props),Card:props=>e('div',props,props.children),Field:props=>e('field',props),Notice:props=>e('notice',props,props.children),Screen:props=>e('div',props,props.children),StateView:props=>e('state',props),StatusPill:props=>e('pill',props)},
 '@/lib/financial-model':model,'@/lib/receivable-priorities':priorities,'@/lib/financial-reconciliation':reconciliation,'@/lib/format':format,'@/lib/supabase':{supabase:{}},
 '@/services/admin-service':admin,'@/services/operations-service':operations,
 '@/services/financial-tools':{listBankTransactions:()=>ok([]),exportFinancialCsv:async()=>{},exportReceivableCsv:async()=>{},exportFinancialExcel:async()=>{},updateAccountReference:async()=>null},
 '@/providers/theme-provider':{useAppTheme:()=>({colors:{}}),useThemeStyles:()=>({})},
 '@/theme/tokens':{radius:{},spacing:{},typography:{}},
}).default;
let renderer;await act(async()=>{renderer=create(e(component));});
const field=label=>renderer.root.findAllByType('field').find(node=>node.props.label===label);
const choices=label=>renderer.root.findAllByType('choices').find(node=>node.props.label===label);
const button=title=>renderer.root.findAllByType('button').find(node=>node.props.title===title);
const text=()=>JSON.stringify(renderer.toJSON());
assert(text().includes('SALDO A RECEBER'));assert(text().includes('400,00'),'Contract remainder must include unlaunched installments');
await act(async()=>choices('Área financeira').props.onChange('receivables'));assert(text().includes('400,00'));
assert(text().includes('Conferência automática de integridade'),'Painel deve mostrar conferência não destrutiva');
assert(text().includes('Conciliação de lançamentos e recibos'),'Painel deve identificar pagamento recebido e recibo emitido');
assert(text().includes('Recibos conferidos: '),'Números do histórico devem ser visíveis');
assert(choices('Prioridade de cobrança'),'Filtro operacional de cobranças presente');
await act(async()=>choices('Prioridade de cobrança').props.onChange('overdue'));
assert(text().includes('Nenhum contrato ou recebimento neste filtro'),'Não inventar vencimentos');
await act(async()=>choices('Prioridade de cobrança').props.onChange('all'));
assert(text().includes('400,00'),'Restauração do extrato completo após filtro');
await act(async()=>button('Ver parcelas e recebimentos').props.onPress());assert(button('Emitir / abrir recibo'));
await act(async()=>choices('Área financeira').props.onChange('entries'));
assert(!field('Descrição'),'New entry form starts closed');
assert(text().includes('SALDO REALIZADO'));assert(text().includes('100,00'));assert(!text().includes('1.099,00'),'Cancelled value must not inflate cash totals');
await act(async()=>{choices('Situação do lançamento').props.onChange('cancelado');});
assert(text().includes('Cancelada'));assert(!text().includes('Parcela recebida'));
await act(async()=>{button('Limpar filtros').props.onPress();choices('Contrato e projeto')?.props.onChange?.('p');});
await act(async()=>{button('Novo lançamento').props.onPress();});
await act(async()=>choices('Vincular lançamento a').props.onChange('project'));
await act(async()=>{field('Descrição').props.onChangeText('Nova parcela');field('Valor (R$)').props.onChangeText('250,00');});
await act(async()=>renderer.root.findByType('project-picker').props.onChange('p'));
await act(async()=>{button('Registrar no extrato administrativo').props.onPress();button('Registrar no extrato administrativo').props.onPress();});
assert.equal(calls,1,'Double-click must start one mutation');await act(async()=>release());assert(!field('Descrição'),'Successful save closes form');
await act(async()=>button('Novo lançamento').props.onPress());
fail=true;
await act(async()=>{field('Descrição').props.onChangeText('Preservar formulário');field('Valor (R$)').props.onChangeText('300,00');});
await act(async()=>button('Registrar no extrato administrativo').props.onPress());await act(async()=>release());assert.equal(field('Descrição').props.value,'Preservar formulário');assert(text().includes('Falha simulada'));
fail=false;
await act(async()=>{button('Cancelar edição / limpar formulário').props.onPress();});
await act(async()=>button('Novo lançamento').props.onPress());
await act(async()=>choices('Vincular lançamento a').props.onChange('client'));
await act(async()=>renderer.root.findByType('client-picker').props.onChange('avulso'));
await act(async()=>button('Registrar no extrato administrativo').props.onPress());
assert(text().includes('Preencha a descrição do lançamento'));assert(text().includes('Informe um valor maior que zero'));assert(!text().includes('Selecione o cliente ou projeto'));
await act(async()=>{field('Descrição').props.onChangeText('Serviço avulso a receber');field('Valor (R$)').props.onChangeText('125,00');field('Data').props.onChangeText('31/02/2026');});
await act(async()=>button('Registrar no extrato administrativo').props.onPress());assert(text().includes('Informe uma data válida para o lançamento'));assert(!text().includes('Selecione um projeto da lista'));
await act(async()=>field('Data').props.onChangeText(today.split('-').reverse().join('/')));
await act(async()=>choices('Situação').props.onChange('pago'));
await act(async()=>field('Data efetiva de pagamento / recebimento').props.onChangeText('31/02/2026'));
await act(async()=>choices('Situação').props.onChange('pendente'));

await act(async()=>button('Registrar no extrato administrativo').props.onPress());
assert.equal(lastInput.clientId,'avulso');assert.equal(lastInput.projectId,null);assert.equal(lastInput.contractId,null);assert.equal(lastInput.status,'pendente');assert.equal(lastInput.date,today);
await act(async()=>release());
assert(text().includes('375,00'),'Pending client-only entry must count toward receivable');
await act(async()=>renderer.root.findAllByType('button').filter(node=>node.props.title==='Editar lançamento').at(-1).props.onPress());
await act(async()=>choices('Situação').props.onChange('pago'));
await act(async()=>button('Confirmar alterações').props.onPress());
assert.equal(lastInput.clientId,'avulso');assert.equal(lastInput.projectId,null);assert.equal(lastInput.status,'pago');assert(text().includes('225,00'),'Receiving a client-only payment must update received cash');
await act(async()=>choices('Área financeira').props.onChange('accounts'));
assert(text().includes('Saldo gerencial: '));assert(text().includes('1.100,00'),'Account must reflect opening plus paid entries');
await act(async()=>choices('Área financeira').props.onChange('fiscal'));assert(text().includes('Não valida os requisitos municipais'));assert(choices('Projeto do rascunho fiscal'));
await act(async()=>choices('Área financeira').props.onChange('entries'));
const pendingBefore=entries.find(row=>row.status==='pendente'),entryCount=entries.length;
assert(pendingBefore);await act(async()=>button('Registrar recebimento').props.onPress());
assert.equal(choices('Situação').props.value,'pago');
await act(async()=>button('Confirmar recebimento e emitir recibo').props.onPress());
assert.equal(entries.length,entryCount,'Receiving an installment updates the original entry');
assert.equal(lastInput.status,'pago');assert.equal(receiptDestination,'/recibos.html?financialId='+pendingBefore.id);
await act(async()=>renderer.unmount());
console.log('FINANCEIRO UI: filtros, cancelados, cadastro com clique duplo, preservação após erro, saldo e rascunho fiscal aprovados.');
