/* Delivery metadata only: never request invitation payloads or tokens. */
(function(){
 'use strict';
 const labels={sent:'Aceito pelo provedor',pending:'Na fila automática',processing:'Em envio',failed:'Falha — reenvie o acesso',cancelled:'Cancelado'};
 window.CMEEmailNotice=function(result){
  if(result?.enviado)return '\nO provedor aceitou o e-mail. A entrega na caixa de entrada depende do destinatário.';
  if(result?.agendado)return '\nAviso na fila automática do servidor; o envio será tentado novamente em caso de falha.';
  return '\n'+(result?.motivo||'Não foi possível confirmar o aviso por e-mail. Consulte o histórico em Clientes.');
 };
 let offset=0,busy=false;
 async function load(){
  const host=document.getElementById('emailDeliveryHistory');if(!host||busy)return;
  busy=true;host.textContent='Carregando histórico...';
  try{
   const [result,clients]=await Promise.all([window.supabaseClient.rpc('admin_client_email_history',{p_status:document.getElementById('emailStatusFilter').value||null,p_offset:offset,p_limit:50}),window.dbBuscarClientes().catch(()=>[])]);
   if(result.error){host.textContent='Não foi possível consultar os envios. Atualize o histórico para tentar novamente.';return;}
   host.replaceChildren();
   for(const row of result.data||[]){const entry=document.createElement('p');entry.textContent=`${clients.find(client=>String(client.id)===row.client_id)?.nome||'Cliente'} · ${new Date(row.created_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})} · ${row.kind==='invite'?'Acesso':'Atualização'} · ${labels[row.status]||row.status} · ${row.attempts} tentativa(s)${row.last_error?' · '+row.last_error:''}`;host.append(entry);}
   if(!result.data?.length)host.textContent='Nenhum envio nesta página.';
   document.getElementById('emailHistoryPage').textContent=`Página ${Math.floor(offset/50)+1}`;
   document.getElementById('emailHistoryPrevious').disabled=offset===0;document.getElementById('emailHistoryNext').disabled=(result.data||[]).length<50;
  }catch{host.textContent='Histórico indisponível. Tente atualizar.';}finally{busy=false;}
 }
 document.addEventListener('DOMContentLoaded',()=>{
  if(!document.getElementById('listaClientes'))return;
  const card=document.createElement('section');card.className='card-grande';
  const title=document.createElement('h2');title.textContent='Histórico de e-mails';
  const note=document.createElement('p');note.textContent='“Aceito pelo provedor” confirma o envio. A chave atual não permite consultar entrega, rejeição ou spam no destinatário.';
  const filter=document.createElement('select');filter.id='emailStatusFilter';filter.setAttribute('aria-label','Filtrar situação dos e-mails');filter.append(new Option('Todos os envios',''),...Object.entries(labels).map(([value,label])=>new Option(label,value)));filter.addEventListener('change',()=>{if(!busy){offset=0;void load();}});
  const button=document.createElement('button');button.type='button';button.textContent='Atualizar histórico';button.addEventListener('click',()=>void load());
  const history=document.createElement('div');history.id='emailDeliveryHistory';history.setAttribute('aria-live','polite');
  const previous=document.createElement('button');previous.type='button';previous.id='emailHistoryPrevious';previous.textContent='Página anterior';previous.addEventListener('click',()=>{if(!busy){offset=Math.max(0,offset-50);void load();}});
  const next=document.createElement('button');next.type='button';next.id='emailHistoryNext';next.textContent='Próxima página';next.addEventListener('click',()=>{if(!busy){offset+=50;void load();}});
  const page=document.createElement('span');page.id='emailHistoryPage';card.append(title,note,filter,button,history,previous,page,next);document.querySelector('main')?.append(card);void load();
 });
})();
