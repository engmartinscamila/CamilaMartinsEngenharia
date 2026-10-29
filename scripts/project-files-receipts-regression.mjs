import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const tables = { biblioteca: [{id:17,arquivo:'p/guia.pdf',storage_bucket:'biblioteca',autoral:true}], documentos: [{id:'doc',arquivo:'p/planta.pdf',storage_bucket:'documentos'}, {id:'image-doc',arquivo:'p/planta.png',storage_bucket:'documentos'}], fotos:[{id:'photo',arquivo:'p/obra.jpg',storage_bucket:'fotos',protection_mode:'authored_photo'}] };
const writes = [], removed = [];
function query(table) {
  let operation = 'select', input, id, path;
  const q = { select(){return q},order(){return q},range(){return q},eq(key,val){if(key==='id')id=val;else if(key==='arquivo')path=val;return q},insert(data){operation='insert';input=data;return q},update(data){operation='update';input=data;return q},delete(){operation='delete';return q},
    then(resolve,reject) {
      if(operation!=='select') { writes.push({table,operation,input,id}); return Promise.resolve({data:[{id:id||'new'}],error:null}).then(resolve,reject); }
      return Promise.resolve({data:tables[table].filter(row=>!path||row.arquivo===path),error:null}).then(resolve,reject);
    } };
  return q;
}
const context = { document:{getElementById(){return null}},supabaseClient:{from:query}, BUCKETS:{DOCUMENTOS:'documentos',FOTOS:'fotos'},dbGerarUrlArquivo:async (b,p)=>b+'/'+p,dbExcluirArquivoStorage:async (b,p)=>removed.push([b,p]) };
context.window=context; vm.createContext(context);vm.runInContext(readFileSync('js/project-files.js','utf8'),context);
let rows=await context.dbBuscarDocumentos();assert.equal(rows.length,4);assert.equal(rows.find(r=>r.id==='biblioteca:17').autoral,true);assert.equal(rows.find(r=>r.id==='foto:photo').url,'fotos/p/obra.jpg');
assert.equal((await context.dbBuscarFotos()).length,2,'Album sees legacy photo and document image without copies');
await context.dbCriarDocumento({arquivo:'p/new.jpg',tipo:'foto',autoral:true,storage_bucket:'fotos'});
assert.equal(writes.at(-1).table,'fotos');assert.equal(writes.at(-1).input.protection_mode,'authored_photo');assert.ok(!('autoral'in writes.at(-1).input));
await context.dbEditarDocumento('foto:photo',{nome:'Atualizado',arquivo:'p/obra.jpg',autoral:true});assert.equal(writes.at(-1).id,'photo');assert.equal(writes.at(-1).table,'fotos');
await assert.rejects(context.dbEditarDocumento('foto:photo',{arquivo:'p/test.pdf'}),/imagem/);
await context.dbEditarDocumento('biblioteca:17',{nome:'Guia atualizado',arquivo:'p/guia.pdf',autoral:true});assert.equal(writes.at(-1).table,'biblioteca');assert.equal(writes.at(-1).input.autoral,true);
await context.dbExcluirDocumento('foto:photo');assert.equal(writes.at(-1).table,'fotos');
await context.dbExcluirArquivoStorage('fotos','p/obra.jpg');assert.equal(removed.length,0,'Referenced blob must survive');
await context.dbExcluirArquivoStorage('fotos','p/unreferenced.jpg');assert.equal(removed.length,1);
const elements=new Map();const dom={getElementById(id){if(!elements.has(id))elements.set(id,{innerHTML:'',hidden:true,scrollIntoView(){}});return elements.get(id)},addEventListener(){}};
const receiptCtx=vm.createContext({document:dom,window:{},console,URLSearchParams,location:{search:''}});vm.runInContext(readFileSync('js/recibos.js','utf8'),receiptCtx);
const receipts=receiptCtx.window.CMEReceipts;assert.equal(receipts.parseAmount('1.234,56'),1234.56);assert.equal(receipts.parseAmount('100,50'),100.5);
for(const v of ['','0','-10','1,234','12.34','NaN','1e6'])assert.throws(()=>receipts.parseAmount(v));
receipts.showReceipt({receipt_number:17,amount:1234.56,created_at:'2026-10-29T01:00:00Z',paid_on:'2026-10-28',payment_method:'Pix',description:'Serviço <script>',snapshot:{issuer:{name:'Profissional',document:'Documento de teste'},payer_name:'Cliente <script>',project_name:'Projeto',city:'São Paulo'}});
assert.match(elements.get('receiptPaper').innerHTML,/28\/10\/2026/);assert.doesNotMatch(elements.get('receiptPaper').innerHTML,/<script>/);assert.match(elements.get('receiptPaper').innerHTML,/REC-000017\/2026/);
console.log('PASS: central file metadata, image routing, authorship, shared blob retention, receipt amounts, timezone and escaping.');
