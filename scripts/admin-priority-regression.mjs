import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { webcrypto } from 'node:crypto';

const context={window:{},TextEncoder,Uint8Array,DataView,Blob,crypto:webcrypto,console};
vm.runInNewContext(fs.readFileSync('js/admin-backup.js','utf8'),context);
const backup=context.window.CMEAdminBackup;
const packet=()=>{
  const tables=Object.fromEntries(['clientes','contratos','projetos','documentos','fotos','financeiro','payment_receipts'].map(name=>[name,[]]));
  tables.payment_receipts=[{id:'receipt-1',amount:123.45}];
  return {version:3,created_at:'2026-10-28T12:00:00Z',tables,counts:Object.fromEntries(Object.entries(tables).map(([name,rows])=>[name,rows.length])),
    storage_objects:[{bucket:'documentos',path:'obra/contrato.pdf',size:4,updated_at:'2026-10-28T12:00:00Z'}],limitations:['Auth e Vault excluídos']};
};
const client=(snap=()=>packet(),download=()=>({data:new Blob([new Uint8Array([0,1,254,255])]),error:null}))=>({rpc:async()=>({data:snap(),error:null}),storage:{from:()=>({download:async()=>download()})}});
const good=await backup.collect(client(),true);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cme-backup-test-'));
try {
  const zipPath=path.join(dir,'backup.zip');fs.writeFileSync(zipPath,new Uint8Array(await good.blob.arrayBuffer()));
  const result=spawnSync('python3',['-c',`
import zipfile,hashlib,json,sys
with zipfile.ZipFile(sys.argv[1]) as z:
 assert z.testzip() is None
 m=json.loads(z.read('manifesto.json'))
 assert hashlib.sha256(z.read('dados.json')).hexdigest()==m['data_sha256']
 assert json.loads(z.read('dados.json'))['tables']['payment_receipts'][0]['amount']==123.45
 for f in m['files']:
  data=z.read(f['entry'])
  assert len(data)==f['size'] and hashlib.sha256(data).hexdigest()==f['sha256']
 assert z.read(m['files'][0]['entry'])==bytes([0,1,254,255])
`,zipPath],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
} finally {fs.rmSync(dir,{recursive:true,force:true});}
await assert.rejects(()=>backup.collect({rpc:async()=>({error:{message:'offline'}})},false),/Nenhum pacote parcial/);
await assert.rejects(()=>backup.collect(client(()=>{const p=packet();p.counts.payment_receipts=2;return p;}),false),/Contagem incompleta/);
await assert.rejects(()=>backup.collect(client(undefined,()=>({error:{message:'offline'}})),true),/ZIP foi cancelado/);
await assert.rejects(()=>backup.collect(client(undefined,()=>({data:new Blob(['short'])})),true),/Tamanho/);
let reads=0;
await assert.rejects(()=>backup.collect(client(()=>{const p=packet();if(reads++)p.tables.payment_receipts[0].amount=999;return p;}),true),/dados mudaram/);
await assert.rejects(()=>backup.collect(client(()=>{const p=packet();p.storage_objects[0].size=300*1024*1024;return p;}),true),/256 MB/);
assert.throws(()=>backup.zip([['../unsafe','bad']]),/Nome inválido/);
assert.throws(()=>backup.zip([['same','a'],['same','b']]),/Nome inválido/);
const jsonOnly=await backup.collect(client(),false);assert.equal(JSON.parse(await jsonOnly.blob.text()).tables.payment_receipts.length,1);

function fileHarness({shared=false,readError=false,deleteError=false,storageError=false}={}) {
  const records={documentos:shared?[{id:'doc',arquivo:'x',storage_bucket:'biblioteca'}]:[],fotos:[],biblioteca:[{id:'lib',arquivo:'x',storage_bucket:'biblioteca'}]};
  const events=[];
  const db={from:table=>{
    let deleting=false,id;
    const query={delete(){deleting=true;return this;},select(){return this;},eq(key,value){if(key==='id')id=value;return this;},
      async maybeSingle(){return {data:records[table].find(row=>row.id===id),error:null};},
      then(resolve,reject){const run=()=>{
        if(deleting){events.push('metadata');if(deleteError)return {error:{message:'retained'}};records[table]=records[table].filter(row=>row.id!==id);return {data:[{id}],error:null};}
        events.push('references');return readError?{error:{message:'offline'}}:{data:records[table],error:null};
      };return Promise.resolve().then(run).then(resolve,reject);}};return query;
  }};
  const ctx={window:{supabaseClient:db,dbExcluirArquivoStorage:async()=>{events.push('physical');if(storageError)throw Error('storage offline');}},document:{getElementById:()=>({}),createElement:()=>({setAttribute(){}})},console};
  vm.runInNewContext(fs.readFileSync('js/file-operations.js','utf8'),ctx);
  return {ops:ctx.window.CMEFileOperations,events,records};
}
let h=fileHarness();await h.ops.removeItem('biblioteca','lib');assert.equal(h.events[0],'metadata');assert.equal(h.events.at(-1),'physical');
h=fileHarness({shared:true});await h.ops.removeItem('biblioteca','lib');assert(!h.events.includes('physical'),'Shared live object must remain');
h=fileHarness({deleteError:true});await assert.rejects(()=>h.ops.removeItem('biblioteca','lib'));assert(!h.events.includes('physical'));
h=fileHarness({readError:true});await h.ops.removeItem('biblioteca','lib');assert(!h.events.includes('physical'));
h=fileHarness({storageError:true});await h.ops.removeItem('biblioteca','lib');assert.equal(h.records.biblioteca.length,0);
console.log('PRIORITY REPAIRS PASSED: ZIP/CRC/SHA-256, receipts, failures, changed data, limits, metadata-before-storage and shared-file preservation.');
