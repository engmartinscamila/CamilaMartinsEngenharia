import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

// Caso T43 do dossiê: download do Word original não cria revisão nem modifica snapshot.
// Executa a função real do serviço em isolamento com endpoint simulado; sem acesso ao banco.
const service = readFileSync('portal-app/src/services/commercial-service.ts', 'utf8');
const screen = readFileSync('portal-app/src/app/admin/commercial-documents.tsx', 'utf8');
const start = service.indexOf('export interface IssuedWordDownloadResult {');
const end = service.indexOf('export async function generateCommercialDocument(', start);
assert.ok(start >= 0 && end > start, 'Download isolado não localizado no serviço comercial.');
const snippet = service.slice(start, end).replace(/^export /gm, '');
const executable = stripTypeScriptTypes(snippet, { mode: 'strip' });
const id = '00000000-0000-4000-8000-000000000001';

async function scenario({data, error = null, recover = false, downloadFails = false} = {}) {
  const calls = [];
  const context = {
    supabase: {functions: {invoke: async (fn, args) => {
      calls.push({fn, body: args.body});
      return {data, error};
    }}},
    downloadBase64File: async (bytes, name) => {
      calls.push({download: {bytes, name}});
      if (downloadFails) throw new Error('Falha ao salvar no dispositivo');
    },
    Error,
  };
  vm.runInNewContext(`${executable}\nthis.downloadIssuedCommercialWord=downloadIssuedCommercialWord;`, context);
  const response = await context.downloadIssuedCommercialWord(id, recover);
  return {response, calls};
}

const issued = await scenario({data:{delivered:true, version:'1.0', fileName:'Contrato-123-v1.0.docx', contentBase64:'QUJD', reconstituted:false}});
assert.equal(issued.response.error, null);
assert.equal(issued.response.version, '1.0');
assert.equal(issued.response.reconstituted, false);
assert.equal(issued.calls.length, 2);
assert.equal(issued.calls[0].fn, 'download-commercial-word');
assert.equal(issued.calls[0].body.documentId, id);
assert.equal(issued.calls[0].body.recover, false);
assert.equal(issued.calls[1].download.bytes, 'QUJD');
assert.ok(!issued.calls.some(call => /generate|deliver|revision/.test(call.fn || '')), 'Download não pode gerar documento/revisão.');

const missing = await scenario({error:{message:'non-2xx',context:{json:async()=>({code:'ORIGINAL_WORD_MISSING',error:'Original ausente'})}},data:null});
assert.equal(missing.response.missingOriginal, true);
assert.equal(missing.calls.length, 1);
assert.equal(missing.calls[0].body.recover, false);

const recovered = await scenario({recover:true,data:{delivered:true,version:'1.0',reconstituted:true,fileName:'copia-reconstituida.docx',contentBase64:'REVG'}});
assert.equal(recovered.response.error, null);
assert.equal(recovered.response.reconstituted, true);
assert.equal(recovered.calls[0].body.recover, true);
assert.equal(recovered.calls[1].download.name, 'copia-reconstituida.docx');

const failedSave = await scenario({data:{delivered:true,contentBase64:'QUJD'},downloadFails:true});
assert.match(failedSave.response.error, /Falha ao salvar/);
const invalidContext = {supabase:{functions:{invoke:()=>{throw Error('Não deveria chamar backend');}}},downloadBase64File:()=>{},Error};
vm.runInNewContext(`${executable}\nthis.downloadIssuedCommercialWord=downloadIssuedCommercialWord;`, invalidContext);
assert.match((await invalidContext.downloadIssuedCommercialWord('inválido')).error,/identificador válido/);

// Interface: download e revisão são ações distintas e não usam a função de geração.
assert.match(screen, /Baixar Word já emitido \(sem revisão\)/);
assert.match(screen, /Criar nova revisão do contrato/);
assert.match(screen, /Criar nova revisão do orçamento/);
assert.match(screen, /downloadIssuedCommercialWord\(documentId,recover\)/);
assert.match(screen, /pendingWordRecovery/);
assert.match(screen, /downloadIssuedWord\(record,pendingWordRecovery.kind,true\)/);
const isolatedHandler = screen.split('const downloadIssuedWord=async')[1]?.split('const requestGenerate = async')[0] ?? '';
assert.ok(!isolatedHandler.includes('generateCommercialDocument'), 'Download não pode chamar gerador.');
assert.ok(!isolatedHandler.includes('setPending({'), 'Download não pode iniciar revisão.');
console.log('PASS T43: Word emitido rebaixado sem nova revisão, perda do original exige confirmação, recuperação mantém versão.');
