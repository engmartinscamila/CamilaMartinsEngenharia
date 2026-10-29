import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
const source=readFileSync('supabase/functions/client-password-link/index.ts','utf8').replace(/^import .*;\n/gm,'');
async function test({known=true,rate=true,fail=false}={}){
 let handler,queued=0,sent=0,failed=0;
 const query={select(){return query},ilike(){return query},eq(){return query},maybeSingle:async()=>({data:known?{id:'client',auth_id:null}:null})};
 const admin={from:()=>query,rpc:async name=>{
  if(name.includes('rate_limit'))return{data:rate};
  if(name==='enqueue_client_invitation'){queued++;return{data:'job'}};
  if(name==='claim_client_email_jobs')return{data:[{id:'job'}]};return{};
 }};
 const ctx=vm.createContext({Deno:{env:{get:k=>({SUPABASE_URL:'https://hghtwlopqztfcosfxafd.supabase.co'})[k]},serve:h=>handler=h},withSupabase:(_,h)=>h,deliverClientEmail:async()=>{sent++;if(fail)throw new Error('temporary')},failClientEmail:async()=>{failed++},crypto,TextEncoder,URL,Response,console:{error(){}}});
 vm.runInContext(stripTypeScriptTypes(source),ctx);
 const response=await handler(new Request('https://test.invalid',{method:'POST',headers:{origin:'https://camilamartinsengenharia.com.br'},body:JSON.stringify({email:'client@example.com'})}),{supabaseAdmin:admin});
 return {status:response.status,body:await response.json(),queued,sent,failed};
}
let r=await test();assert.equal(r.sent,1,'An authorized registration without Auth UUID must receive an invitation');assert.equal(r.status,200);assert.doesNotMatch(JSON.stringify(r.body),/client|token_hash|job/);
r=await test({known:false});assert.equal(r.sent,0);assert.equal(r.queued,0);assert.equal(r.status,200);
r=await test({rate:false});assert.equal(r.queued,0);
r=await test({fail:true});assert.equal(r.failed,1);assert.equal(r.status,503);
console.log('PASS: unlinked first access uses the outbox, rate limits and anti-enumeration preserved, failures retry.');
