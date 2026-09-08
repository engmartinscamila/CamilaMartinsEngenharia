import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';
let handler, administrator=false, visible=true, uploads=0, downloads=0;
const row={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',cliente_id:null,projeto_id:null,nome:'Manual',arquivo:'legacy.pdf',storage_bucket:null,protection_mode:'administrative',autoral:true};
const caller={auth:{getUser:async()=>({data:{user:{id:'user-a'}},error:null})},rpc:async()=>({data:administrator}),from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:visible?{...row}:null,error:null})})};
const service={from:()=>({select(){return this;},is(){return this;},lt(){return this;},like(){return this;},limit:async()=>({data:[]}),insert:async()=>({error:null})}),storage:{from:bucket=>({
  download:async()=>{assert.equal(bucket,'documentos');downloads++;return {data:new Blob(['PDF'],{type:'application/pdf'}),error:null};},
  upload:async()=>{uploads++;return {error:null};},
  createSignedUrl:async()=>({data:{signedUrl:`https://project.supabase.co/storage/v1/object/sign/${bucket}/file?token=ok`},error:null}),
})}};
const source=fs.readFileSync('../supabase/functions/issue-protected-asset/index.ts','utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(code,{exports:{},Response,Request,Blob,TextEncoder,Uint8Array,crypto:webcrypto,btoa,
 Deno:{env:{get:key=>key==='SUPABASE_SERVICE_ROLE_KEY'?'service':key==='SUPABASE_URL'?'https://project.supabase.co':'public'},serve:fn=>{handler=fn;}},
 require:name=>name.includes('supabase')?{createClient:(_url,key)=>key==='service'?service:caller}:{PDFDocument:{load:async()=>({embedFont:async()=>({}),getPages:()=>[],save:async()=>new Uint8Array([1,2,3])})},StandardFonts:{},degrees:()=>0,rgb:()=>0},
});
const issue=async(body,authenticated=true)=>handler(new Request('https://edge.test',{method:'POST',headers:authenticated?{Authorization:'Bearer synthetic-session'}:{},body:JSON.stringify(body)}));
assert.equal((await issue({},false)).status,401);
visible=false;assert.equal((await issue({assetId:row.id})).status,404);assert.equal(downloads,0);
visible=true;
let response=await issue({assetId:row.id,adminOriginal:true});assert.equal(response.status,200);
assert.equal((await response.json()).protectedCopy,true);assert.equal(uploads,1);
administrator=true;response=await issue({assetId:row.id,adminOriginal:true});
assert.equal(response.status,200);assert.equal((await response.json()).protectedCopy,false);assert.equal(uploads,1);
process.stdout.write('PASS: protected issuance requires authentication and metadata RLS, protects legacy authored originals, and validates admin override.\n');
