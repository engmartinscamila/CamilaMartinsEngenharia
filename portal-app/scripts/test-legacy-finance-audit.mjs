import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(file,deps={}){
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,
 {exports,console,Date,Intl,Number,Math,Map,Set,JSON,Error,require:name=>{if(!(name in deps))throw Error('Dependency '+name);return deps[name];}});
 return exports;
}
const finance=load('src/lib/financial-model.ts');
const {auditLegacyReceivables}=load('src/lib/legacy-finance-audit.ts',{'@/lib/financial-model':finance});
const contract={id:'contract-1',clientId:'client-1',clientName:'Cliente 1',contractNumber:'2026-001',status:'ativo',contractValue:1000};
const project={id:'project-1',clientId:'client-1',contractId:'contract-1',name:'Obra 1'};
const paid={id:'payment-1',clientId:'client-1',contractId:null,projectId:'project-1',projectName:'Obra 1',clientName:'Cliente 1',contractNumber:'2026-001',type:'entrada',status:'pago',amount:200,date:'2026-11-02',paidAt:'2026-11-03'};
const receipt={id:'receipt-1',financialEntryId:'payment-1',clientId:'client-1',projectId:'project-1',amount:200,paidOn:'2026-11-03'};
const same=(x)=>JSON.parse(JSON.stringify(x));
let out=auditLegacyReceivables([contract],[project],[paid],[receipt]);
assert.equal(out.countEntries,1);assert.equal(out.countReceipts,1);
assert.equal(out.confirmedReceiptLinks,1);assert.equal(out.paidWithoutReceipt,0);
assert.equal(out.contractsMissingValue.length,0);assert.equal(out.unclassifiedEntries.length,0);
assert.equal(out.receiptIssues.length,0);assert.equal(out.migrationReady,true);
out=auditLegacyReceivables([{...contract,contractValue:null}],[project],
 [paid,{...paid,id:'pending-1',contractId:null,projectId:null,status:'pendente',amount:100}],
 [receipt]);
assert.equal(out.contractsMissingValue.length,1);
assert.equal(out.unclassifiedEntries.length,1,'Sem contrato não pode ser atribuído arbitrariamente');
assert.equal(out.unclassifiedEntries[0].id,'pending-1');
assert.equal(out.migrationReady,false);
const standalone={...paid,id:'standalone-1',projectId:null,contractId:null,amount:125.5};
const approved={id:8,financialEntryId:'standalone-1',classification:'servico_avulso',reason:'Serviço diretamente contratado',snapshot:{
 clientId:'client-1',projectId:null,contractId:null,amount:125.5,type:'entrada',status:'pago'}};
out=auditLegacyReceivables([contract],[project],[standalone],[],[approved]);
assert.equal(out.confirmedStandaloneEntries,1);
assert.equal(out.unclassifiedEntries.length,0);
assert.equal(out.migrationReady,true);
const stale={...standalone,amount:129.5};
out=auditLegacyReceivables([contract],[project],[stale],[],[approved]);
assert.equal(out.confirmedStandaloneEntries,0,'Valor alterado exige revalidação');
assert.equal(out.unclassifiedEntries.length,1);
const pendingReview={...approved,id:9,classification:'vinculo_pendente'};
out=auditLegacyReceivables([contract],[project],[standalone],[],[approved,pendingReview]);
assert.equal(out.unclassifiedEntries.length,1,'Revisão mais recente deve prevalecer');
out=auditLegacyReceivables([contract],[project],[standalone],[],[pendingReview,approved]);
assert.equal(out.unclassifiedEntries.length,1,'A ordem recebida não pode decidir revisão mais recente');
out=auditLegacyReceivables([contract],[project],[{...standalone,clientId:'outro'}],[],[approved]);
assert.equal(out.unclassifiedEntries.length,1,'Cliente alterado exige revalidação');
out=auditLegacyReceivables([contract],[project],[paid],[]);
assert.equal(out.paidWithoutReceipt,1);
assert.equal(out.migrationReady,true,'Recibo não emitido não torna um pagamento não recebido');
const problematic=[
 {...receipt,id:'wrong-amount',financialEntryId:'pay-amount',amount:220},
 {...receipt,id:'wrong-date',financialEntryId:'pay-date',paidOn:'2026-11-04'},
 {...receipt,id:'other-client',financialEntryId:'pay-client',clientId:'client-2'},
 {...receipt,id:'wrong-project',financialEntryId:'pay-project',projectId:'p-other'},
 {...receipt,id:'missing-entry',financialEntryId:'missing'},
 {...receipt,id:'no-link',financialEntryId:null},
 {...receipt,id:'duplicate-link',financialEntryId:'pay-amount'},
];
const paymentVariants=['pay-amount','pay-date','pay-client','pay-project'].map(id=>({...paid,id}));
out=auditLegacyReceivables([contract],[project],paymentVariants,problematic);
const codes=out.receiptIssues.map(x=>x.code);
for(const code of ['amount_mismatch','date_mismatch','client_mismatch','project_mismatch','missing_entry','missing_payment_link','duplicate_receipt']){
 assert(codes.includes(code),'Missing check '+code);
}
assert.equal(out.migrationReady,false);
out=auditLegacyReceivables([contract],[project],[paid],[{...receipt,projectId:null}]);
assert(out.receiptIssues.some(x=>x.code==='project_mismatch'),'Projeto omitido no recibo não pode parecer vínculo completo');
out=auditLegacyReceivables([contract],[project],[{...paid,status:'pendente'}],[receipt]);
assert(out.receiptIssues.some(x=>x.code==='not_paid'));
const db=[
 {id:'r1',financial_entry_id:'p1',client_id:'c1',project_id:null,amount:'120.50',paid_on:'2026-11-03'},
 {id:'r2',financial_entry_id:null,client_id:'c1',project_id:'pr',amount:'25.00',paid_on:'2026-11-05'}
];
let fail=false,reads=0;
const query={select(){return this},order(){return this},async range(start,end){
 reads++;
 if(fail&&start>=500)return {data:null,error:{message:'second page failure'}};
 if(start===0&&fail)return {data:Array.from({length:500},(_,i)=>({...db[0],id:String(i)})),error:null};
 return {data:db.slice(start,end+1),error:null};
}};
const {listAdminReceiptReferences}=load('src/services/legacy-receipt-service.ts',{
 '@/lib/supabase':{supabase:{from(table){assert.equal(table,'payment_receipts');return query}}},
 '@/lib/paginated-query':{readAllRows:async q=>{const rows=[];for(let i=0;i<1000;i+=500){const r=await q.order('id').range(i,i+499);if(r.error)return {data:[],error:r.error};rows.push(...r.data);if(r.data.length<500)return {data:rows,error:null};}return {data:[],error:{message:'limit'}};}}
});
let received=await listAdminReceiptReferences();
assert.equal(received.error,null);
assert.deepEqual(same(received.data),[
 {id:'r1',financialEntryId:'p1',clientId:'c1',projectId:null,amount:120.5,paidOn:'2026-11-03'},
 {id:'r2',financialEntryId:null,clientId:'c1',projectId:'pr',amount:25,paidOn:'2026-11-05'}
]);
fail=true;received=await listAdminReceiptReferences();
assert.equal(received.data.length,0);
assert(received.error?.includes('reconciliação foi bloqueada'));
assert(reads>=3);
console.log('PASS: conciliação legada — recibos 1:1, valor, data, cliente, projeto, serviço avulso, contratos sem valor e paginação íntegra.');
