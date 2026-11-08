import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

// T48 do dossiê: duas versões podem ser consultadas e baixadas por seu próprio UUID,
// sem alterar o contrato, sem consultar outro cliente e sem gerar revisão.
const source = readFileSync('portal-app/src/services/commercial-service.ts','utf8');
const screen = readFileSync('portal-app/src/app/admin/commercial-documents.tsx','utf8');
const start = source.indexOf('export interface IssuedCommercialVersion {');
const end = source.indexOf('/** Baixa o Word efetivamente emitido',start);
assert.ok(start>=0 && end>start);
const sourceCode = stripTypeScriptTypes(source.slice(start,end).replace(/^export /gm,''),{mode:'strip'});
const recordId='00000000-0000-4000-8000-000000000010';
const previous='00000000-0000-4000-8000-000000000011';
const latest='00000000-0000-4000-8000-000000000012';

async function list({kind='contrato', pages, errorPage=-1}={}){
  const calls=[];
  const query={
    select(columns){calls.push({op:'select',columns});return this;},
    contains(column,data){calls.push({op:'contains',column,data});return this;},
    not(column,operator,value){calls.push({op:'not',column,operator,value});return this;},
    order(column,opts){calls.push({op:'order',column,opts});return this;},
    range(a,b){calls.push({op:'range',a,b});const page=pages[Math.floor(a/100)]??[];return Promise.resolve(Math.floor(a/100)===errorPage?{data:null,error:{message:'offline'}}:{data:page,error:null});}
  };
  const context={supabase:{from(table){calls.push({op:'from',table});return query;}}};
  vm.runInNewContext(`${sourceCode}\nthis.listIssuedCommercialVersions=listIssuedCommercialVersions;`,context);
  const result=await context.listIssuedCommercialVersions(recordId,kind);
  return {result,calls};
}
const sample=[
 {id:latest,nome:'Contrato v2',versao:'2.0',generated_at:'2026-11-07T20:00:00Z'},
 {id:previous,nome:'Contrato v1',versao:'1.0',generated_at:'2026-10-28T20:00:00Z'}
];
const ok=await list({pages:[sample]});
assert.equal(ok.result.error,null);
assert.deepEqual(Array.from(ok.result.data,item=>item.id),[latest,previous]);
assert.deepEqual(Array.from(ok.result.data,item=>item.version),['2.0','1.0']);
assert.deepEqual(Array.from(ok.calls.filter(x=>x.op==='contains').map(x=>x.data.commercial_document_kind)),['contrato']);
assert.equal(ok.calls.filter(x=>x.op==='from').length,1);
assert.equal(ok.calls.some(x=>/update|insert|rpc|functions/.test(x.op)),false);
const paged=await list({pages:[Array.from({length:100},(_,i)=>({...sample[0],id:`page1-${i}` })),[sample[1]]]});
assert.equal(paged.result.data.length,101,'A leitura não pode parar silenciosamente nas primeiras 100 versões');
assert.equal(paged.calls.filter(x=>x.op==='range').length,2);
const failed=await list({pages:[Array.from({length:100},()=>sample[0])],errorPage:1});
assert.equal(failed.result.data.length,0,'Páginas incompletas não podem parecer um histórico completo');
assert.ok(failed.result.error);
const quotes=await list({kind:'orcamento',pages:[[]]});
assert.equal(quotes.calls.find(x=>x.op==='contains').data.commercial_document_kind,'orcamento');
const invalid=await list({pages:[sample]}); // IDs válidos, nenhum fallback por nome.
assert.equal(invalid.result.data[0].id,latest);

assert.match(screen,/Consultar versões emitidas do contrato/);
assert.match(screen,/Consultar versões emitidas do orçamento/);
assert.match(screen,/downloadIssuedWord\(record,'contrato',false,version\.id\)/);
assert.match(screen,/downloadIssuedWord\(record,'orcamento',false,version\.id\)/);
assert.match(screen,/downloadIssuedWord\(record,pendingWordRecovery.kind,true,pendingWordRecovery.documentId\)/);
console.log('PASS T48: múltiplas versões com UUID próprio; download específico e recuperação idempotente sem revisão.');
