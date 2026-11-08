import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const moduleLoad=(src,deps={})=>{
 const exports={};
 const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(js,{exports,console,Number,Math,Date,require:name=>{if(!(name in deps))throw Error('Dependência inesperada '+name);return deps[name];}});
 return exports;
};
const {readAllRows}=moduleLoad(fs.readFileSync('src/lib/paginated-query.ts','utf8'));
const src=fs.readFileSync('src/services/operations-service.ts','utf8');
const a=src.indexOf('export async function listSuppliers()');
const b=src.indexOf('export async function createSupplier(',a);
const c=src.indexOf('export async function listPurchaseQuotes(',b);
const d=src.indexOf('export async function createPurchaseQuote(',c);
assert(a>=0&&b>a&&c>b&&d>c);

const suppliers=Array.from({length:625},(_,i)=>({
 id:'supplier-'+String(i).padStart(4,'0'),name:'Fornecedor '+i,
 cpf_cnpj:null,email:null,phone:null,category:'Materiais',active:i%2===0,
}));
const quotes=Array.from({length:1090},(_,i)=>({
 id:'quote-'+String(i).padStart(5,'0'),project_id:i<760?'p1':'p2',
 title:'Cotação '+i,description:null,status:'collecting',due_date:null,selected_supplier_id:null,
 client_visible:false,created_at:'2026-11-08T00:00:00Z',
 purchase_quote_items:[{count:1}],
 supplier_bids:[{id:'bid-'+i,quote_id:'quote-'+i,supplier_id:'supplier-1',total_amount:100+i,
 lead_time_days:7,payment_terms:'Pix',notes:null,suppliers:{name:'Fornecedor teste'}}],
}));
let calls=[];let failAt=null;
const db={from(table){
 const source=table==='suppliers'?suppliers:table==='purchase_quotes'?quotes:null;
 assert(source);
 const query={filter:null,select(){return this;},order(){return this;},
 eq(field,value){assert.equal(field,'project_id');this.filter=value;return this;},
 async range(start,end){
  calls.push({table,start,end,filter:this.filter});
  if(failAt===start)return {data:null,error:{message:'Falha proposital na página'}};
  const rows=this.filter?source.filter(row=>row.project_id===this.filter):source;
  return {data:rows.slice(start,end+1),error:null};
 }};
 return query;
}};
const {listSuppliers,listPurchaseQuotes}=moduleLoad(src.slice(a,b)+src.slice(c,d),{
 '@/lib/paginated-query':{readAllRows},
 '@/lib/supabase':{supabase:db},
});
let r=await listSuppliers();
assert.equal(r.error,null);assert.equal(r.data.length,625);
assert.deepEqual(Array.from(calls.map(x=>x.start)),[0,500]);
calls=[];r=await listPurchaseQuotes();
assert.equal(r.error,null);assert.equal(r.data.length,1090);
assert.equal(r.data[1030].bids[0].supplierName,'Fornecedor teste');
assert.deepEqual(Array.from(calls.map(x=>x.start)),[0,500,1000]);
calls=[];r=await listPurchaseQuotes('p1');
assert.equal(r.error,null);assert.equal(r.data.length,760);
assert.deepEqual(Array.from(calls.map(x=>x.start)),[0,500]);
assert(calls.every(x=>x.filter==='p1'),'Paginação deve preservar filtro por projeto');
failAt=500;calls=[];
r=await listSuppliers();
assert.equal(r.data.length,0);assert(r.error?.includes('lista completa'),'Falha na segunda página não pode exibir lista parcial');
calls=[];r=await listPurchaseQuotes('p1');
assert.equal(r.data.length,0);assert(r.error?.includes('consulta parcial foi descartada'));
console.log('PASS: compras — 1090 cotações, 625 fornecedores, filtro contínuo, paginação e falha segura sem lista parcial.');
