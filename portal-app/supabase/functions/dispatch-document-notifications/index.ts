import { createClient } from 'npm:@supabase/supabase-js@2.112.3';

const corsHeaders={
  'Access-Control-Allow-Origin':'https://camilamartinsengenharia.com.br',
  'Access-Control-Allow-Headers':'content-type,x-document-dispatch-token',
  'Access-Control-Allow-Methods':'POST,OPTIONS'
};

function json(body:unknown,status=200){
  return new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json; charset=utf-8'}});
}

const htmlEsc=(value:unknown)=>String(value??'').replace(/[&<>"']/g,char=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[char]||char));

async function sendEmail(
  apiKey:string,
  from:string,
  to:string,
  name:string,
  documentName:string,
  idempotencyKey:string
){
  const portalUrl='https://camilamartinsengenharia.com.br/documentos-cliente.html';
  const response=await fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{
      Authorization:`Bearer ${apiKey}`,
      'Content-Type':'application/json',
      'Idempotency-Key':idempotencyKey
    },
    body:JSON.stringify({
      from,
      to:[to],
      subject:`${documentName} disponível — Camila Martins Engenharia`,
      html:`<p>Olá, ${htmlEsc(name||'cliente')}.</p><p>Um novo documento vinculado ao seu contrato foi disponibilizado no Portal do Cliente.</p><p><a href="${portalUrl}">Acessar documentos do projeto</a></p><p>Camila Martins Engenharia</p>`
    })
  });
  if(!response.ok)throw new Error(`Resend respondeu HTTP ${response.status}`);
}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST')return json({error:'Método não permitido.'},405);

  const url=Deno.env.get('SUPABASE_URL');
  const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendKey=Deno.env.get('RESEND_API_KEY');
  const resendFrom=Deno.env.get('RESEND_FROM')||'Camila Martins Engenharia <onboarding@resend.dev>';
  if(!url||!serviceKey||!resendKey)return json({error:'Configuração segura do servidor ausente.'},500);

  const service=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const token=req.headers.get('x-document-dispatch-token')||'';
  const verified=await service.rpc('verify_internal_document_dispatch_token',{p_token:token});
  if(verified.error||verified.data!==true)return json({error:'Não autorizado.'},401);

  const due=await service.from('notificacoes')
    .select('id,cliente_id,projeto_id,referencia_id,titulo,scheduled_for')
    .eq('tipo','documento_contratual')
    .eq('destinatario','cliente')
    .eq('delivery_status','scheduled')
    .lte('scheduled_for',new Date().toISOString())
    .order('scheduled_for',{ascending:true})
    .limit(50);
  if(due.error)throw due.error;

  let sent=0,failed=0;
  for(const notification of due.data||[]){
    try{
      const documentId=String(notification.referencia_id||'');
      if(!/^[0-9a-f-]{36}$/i.test(documentId))throw new Error('Referência de documento inválida');
      const [docRes,clientRes]=await Promise.all([
        service.from('documentos').select('id,nome,workflow_status,arquivo').eq('id',documentId).maybeSingle(),
        service.from('clientes').select('nome,email').eq('id',notification.cliente_id).maybeSingle()
      ]);
      if(docRes.error||clientRes.error)throw docRes.error||clientRes.error;
      if(!docRes.data?.arquivo)throw new Error('Documento ainda não foi gerado');
      const email=String(clientRes.data?.email||'').trim();
      if(!email)throw new Error('Cliente sem e-mail cadastrado');

      const now=new Date().toISOString();
      const docUpdate=await service.from('documentos').update({
        workflow_status:'enviado',
        client_visible:true,
        exibir_cliente:true,
        client_released_at:now
      }).eq('id',documentId).in('workflow_status',['gerado','enviado']);
      if(docUpdate.error)throw docUpdate.error;

      // A chave estável evita e-mail duplicado quando houver retry ou execução concorrente.
      await sendEmail(
        resendKey,
        resendFrom,
        email,
        String(clientRes.data?.nome||''),
        String(docRes.data.nome||'Documento'),
        `document-notification/${notification.id}`
      );

      const notificationUpdate=await service.from('notificacoes').update({
        delivery_status:'sent',
        sent_at:now,
        lida:false,
        mensagem:'Um novo documento vinculado ao seu contrato foi disponibilizado em Documentos.',
        link_path:'/documentos-cliente.html'
      }).eq('id',notification.id).eq('delivery_status','scheduled');
      if(notificationUpdate.error)throw notificationUpdate.error;
      sent+=1;
    }catch(error){
      failed+=1;
      console.error('Falha ao processar notificação agendada',notification.id,error instanceof Error?error.message:'erro desconhecido');
    }
  }
  return json({ok:true,checked:(due.data||[]).length,sent,failed});
});