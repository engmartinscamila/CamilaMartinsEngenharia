import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=fs.readFileSync('src/services/operations-service.ts','utf8');
const start=source.indexOf('export async function createPurchaseQuote(');
const stop=source.indexOf('export async function listProjectFinancialSummaries(',start);
assert(start>=0&&stop>start);
const exports={};let calls=[],failure=null;
const supabase={
  rpc:async(name,args)=>{calls.push({name,args});return {data:failure?null:'00000000-0000-4000-8000-000000000001',error:failure};},
  from:()=>{throw Error('Operação fragmentada via tabela detectada!')}
};
vm.runInNewContext(ts.transpileModule(source.slice(start,stop),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,
 {exports,supabase,isValidIsoDate:x=>/^\d{4}-\d{2}-\d{2}$/.test(x),Number,Math,Date});
const {createPurchaseQuote,addSupplierBid,selectSupplierBid}=exports;
const quote={projectId:'project',requestId:'stable-uuid',title:'Custo hidráulico',itemDescription:'Tubo PVC 25 mm',quantity:20,unit:'m'};
assert.equal(await createPurchaseQuote(quote),null);
assert.equal(calls[0].name,'admin_create_purchase_quote');
assert.equal(calls[0].args.p_request_id,'stable-uuid');
assert.equal(calls[0].args.p_quantity,20);
assert((await createPurchaseQuote({...quote,quantity:0}))?.includes('Preencha'));
assert.equal(calls.length,1,'Quantidade inválida não deve consultar banco');
assert.equal(await addSupplierBid({quoteId:'q',supplierId:'s',totalAmount:200,leadTimeDays:7,paymentTerms:'Pix'}),null);
assert.equal(calls[1].name,'admin_register_supplier_bid');
assert.equal(await selectSupplierBid('q','s'),null);
assert.equal(calls[2].name,'admin_approve_supplier_bid');
failure={message:'Não autorizado'};
assert((await selectSupplierBid('q','s'))?.includes('não concluída'));
assert((await createPurchaseQuote(quote))?.includes('Não foi possível'));
const ui=fs.readFileSync('src/app/admin/procurement.tsx','utf8');
assert(ui.includes("projectResult.data;"),'Projetos sem contrato precisam ser listados');
assert(ui.includes("project.contractNumber??'Sem contrato'"),'Projeto sem contrato visível na tela');
assert(ui.includes("requestId:quoteRequest.current.id"),'Chave idempotente mantida no retry');
assert(ui.includes("analyzeSupplierQuote("),'Comparação explícita de propostas');
console.log('PASS: compras — chamadas transacionais, validação, projetos pré-contrato, retry e análise.');
