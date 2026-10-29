import {supabase} from '@/lib/supabase';
export async function listPendingEmailJobs(){
 const data:any[]=[];
 for(let offset=0;offset<100000;offset+=100){
  const result=await supabase.rpc('admin_client_email_history',{p_status:'attention',p_offset:offset,p_limit:100});
  if(result.error)return {data:[],error:'Histórico de e-mails indisponível.'};
  data.push(...(result.data??[]));if((result.data??[]).length<100)return {data,error:null};
 }
 return {data:[],error:'O histórico excedeu o limite seguro. Consulte os filtros de e-mail em Clientes.'};
}
