import { createClient } from 'supabase';

const corsHeaders={
  'Access-Control-Allow-Origin':Deno.env.get('ALLOWED_ORIGIN')??'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json; charset=utf-8'}});

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST')return json({error:'Método não permitido.'},405);
  try{
    const url=Deno.env.get('SUPABASE_URL');
    const anon=Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const auth=req.headers.get('Authorization');
    if(!url||!anon||!serviceKey||!auth?.startsWith('Bearer '))throw new Error('Configuração ou sessão ausente.');
    const caller=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:userData,error:userError}=await caller.auth.getUser();
    if(userError||!userData.user)throw new Error('Sessão inválida.');
    const {data:isAdmin,error:adminError}=await caller.rpc('is_portal_admin');
    if(adminError||isAdmin!==true)throw new Error('Acesso administrativo necessário.');
    const {data:db,error:dbError}=await caller.rpc('admin_system_health');
    if(dbError)throw dbError;
    const service=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:buckets,error:bucketError}=await service.storage.listBuckets();
    return json({ok:true,checkedAt:new Date().toISOString(),database:db,storage:{ok:!bucketError,buckets:(buckets??[]).length},edge:{ok:true,function:'system-health'}});
  }catch(error){
    return json({ok:false,error:error instanceof Error?error.message:'Falha na verificação.'},403);
  }
});
