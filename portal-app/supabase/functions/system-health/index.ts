import { createClient } from 'supabase';

const corsHeaders={
  'Access-Control-Allow-Origin':Deno.env.get('ALLOWED_ORIGIN')??'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json; charset=utf-8'}});

type ProbeResult={ok:boolean;status:number};
async function probe(url:string,anon:string,auth:string,slug:string,body:Record<string,unknown>,expected:number[]):Promise<ProbeResult>{
  try{
    const response=await fetch(`${url}/functions/v1/${slug}`,{method:'POST',headers:{Authorization:auth,apikey:anon,'Content-Type':'application/json'},body:JSON.stringify(body)});
    return {ok:expected.includes(response.status),status:response.status};
  }catch{return {ok:false,status:0};}
}

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

    const [bucketResult,deletionProbe,contractProbe,commercialProbe,deliveryProbe,scheduleProbe]=await Promise.all([
      service.storage.listBuckets(),
      fetch(`${url}/functions/v1/admin-delete-client`,{method:'POST',headers:{Authorization:auth,apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({action:'health'})}).then(async response=>{let data:Record<string,unknown>={};try{data=await response.json()}catch{}return {ok:response.ok&&data.ok===true&&data.function==='admin-delete-client',status:response.status};}).catch(()=>({ok:false,status:0})),
      probe(url,anon,auth,'generate-contract-document-final',{documentId:'invalid',action:'generate',expectedDocumentKind:'anexo_i'},[400]),
      probe(url,anon,auth,'generate-commercial-document-final',{recordId:'invalid',kind:'orcamento'},[400]),
      probe(url,anon,auth,'deliver-generated-document',{documentId:'invalid',archive:false,expectedDocumentKind:'anexo_i'},[400]),
      probe(url,anon,auth,'generate-construction-schedule-xlsx',{projectId:'invalid'},[400]),
    ]);
    const probes={
      adminDeleteClient:deletionProbe,
      contractDocument:contractProbe,
      commercialDocument:commercialProbe,
      documentDelivery:deliveryProbe,
      constructionScheduleExcel:scheduleProbe,
    };
    const edgeOk=Object.values(probes).every(item=>item.ok);
    const criticalIssues=Number((db as Record<string,unknown>)?.critical_issues??0);
    return json({
      ok:true,
      checkedAt:new Date().toISOString(),
      database:{...(db as Record<string,unknown>),ok:criticalIssues===0},
      storage:{ok:!bucketResult.error,buckets:(bucketResult.data??[]).length},
      edge:{ok:edgeOk,function:'system-health',probes},
    });
  }catch(error){
    return json({ok:false,error:error instanceof Error?error.message:'Falha na verificação.'},403);
  }
});
