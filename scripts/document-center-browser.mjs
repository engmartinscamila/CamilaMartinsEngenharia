import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
const base=new URL(process.env.SITE_BASE||'http://127.0.0.1:4174');
assert.ok(['127.0.0.1','localhost'].includes(base.hostname),'Somente testes locais com dados sintéticos');
const backend=new URL(readFileSync('.github/workflows/pages.yml','utf8').match(/EXPO_PUBLIC_SUPABASE_URL:\s*(https:\/\/[^\s]+)/)[1]);
const user={id:'00000000-0000-4000-8000-000000000001',aud:'authenticated',role:'authenticated',email:'document-center@example.invalid',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
const expires=Math.floor(Date.now()/1000)+3600;
const token=[Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),Buffer.from(JSON.stringify({sub:user.id,exp:expires,aud:'authenticated',role:'authenticated'})).toString('base64url'),'SYNTHETIC_NOT_VALID'].join('.');
const browser=await chromium.launch({headless:true});
try{
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const writes=[];let failDecisions=false,slowProject=false;
  const contract={id:'ct1',contract_number:'CT-TESTE-001',cliente_id:'c1',status:'active',service_type:'Projeto',contract_value:100,currency:'BRL'};
  const projects=[{id:'p1',cliente_id:'c1',contract_id:'ct1',nome:'Projeto Alfa',status:'ativo',clientes:{nome:'Cliente Teste'},contratos:contract},{id:'p2',cliente_id:'c2',contract_id:'ct2',nome:'Projeto Beta',status:'ativo',clientes:{nome:'Outro Cliente'},contratos:{...contract,id:'ct2',contract_number:'CT-TESTE-002'}}];
  const docs=[
   {id:'d2',nome:'Anexo revisão 2',document_kind:'anexo_i',version:'2.0',versao:'2.0',revision_of:'d1',projeto_id:'p1',arquivo:'p1/d2.docx',workflow_status:'enviado',created_at:'2026-10-02',client_released_at:'2026-10-02',acceptance_required:true},
   {id:'d1',nome:'Anexo revisão 1',document_kind:'anexo_i',version:'1.0',projeto_id:'p1',arquivo:'p1/d1.docx',workflow_status:'gerado',created_at:'2026-10-01',superseded_at:'2026-10-02'},
   {id:'d3',nome:'Vistoria pronta',document_kind:'levantamento_tecnico',version:'1.0',projeto_id:'p1',arquivo:'p1/d3.docx',workflow_status:'gerado',created_at:'2026-10-03'},
   {id:'d4',nome:'Serviço recusado',document_kind:'servico_adicional',version:'1.0',projeto_id:'p1',arquivo:'p1/d4.docx',workflow_status:'enviado',created_at:'2026-10-04',client_released_at:'2026-10-04'},
  ];
  const decisions=[{id:'x4',document_id:'d4',document_version:'1.0',decision:'rejected',note:'Rever o escopo sintético.',accepted_at:'2026-10-05'}];
  const maps=[{document_id:'d2',document_kind:'anexo_i',lifecycle_status:'aguardando_aceite',is_current:true,acceptance_required:true,version:'2.0'},{document_id:'d3',document_kind:'levantamento_tecnico',lifecycle_status:'emitido',is_current:true,version:'1.0'}];
  const approvals=[{id:'a1',projeto_id:'p1',tipo:'Layout',titulo:'Decisão do layout',approval_object:'Aprovar layout térreo',status:'aguardando',approval_due_at:'2020-01-01',created_at:'2026-10-01'},{id:'a2',projeto_id:'p1',tipo:'Documento',titulo:'Aceite do anexo',related_document_id:'d2',status:'aguardando',approval_due_at:'2020-01-01',created_at:'2026-10-02'}];
  await context.routeWebSocket('**/*',socket=>socket.close());
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.hostname!==backend.hostname)return route.continue();
   const method=route.request().method(),body=method==='POST'?route.request().postDataJSON():null;
   let data=[];
   if(url.pathname==='/auth/v1/user')data=user;
   else if(url.pathname.includes('/auth/v1/'))return route.fulfill({status:401,contentType:'application/json',body:'{"error":"synthetic auth only"}'});
   else if(url.pathname.endsWith('/rpc/is_portal_admin'))data=true;
   else if(url.pathname.endsWith('/projetos'))data=projects;
   else if(url.pathname.endsWith('/documentos')){
    if(slowProject&&url.searchParams.get('projeto_id')==='eq.p1')await new Promise(resolve=>setTimeout(resolve,700));
    data=url.searchParams.get('projeto_id')==='eq.p1'?docs:[];
   }else if(url.pathname.endsWith('/document_acceptances')){
    if(failDecisions)return route.fulfill({status:400,contentType:'application/json',body:'{"message":"synthetic unavailable"}'});
    data=url.searchParams.get('project_id')==='eq.p1'?decisions:[];
   }else if(url.pathname.endsWith('/aprovacoes')){
    if(method==='POST'){writes.push({path:'approval',body});approvals.push({...body,id:'created-approval',created_at:'2026-10-06'});data=null;}
    else data=approvals.filter(item=>!url.searchParams.has('projeto_id')||url.searchParams.get('projeto_id')===`eq.${item.projeto_id}`);
   }else if(url.pathname.endsWith('/rpc/admin_project_document_map'))data=body?.p_project_id==='p1'?maps:[];
   else if(url.pathname.endsWith('/rpc/admin_release_document_for_client')){
    writes.push({path:'release',body});assert.equal(body.p_document_id,'d3');maps[1].lifecycle_status='aguardando_aceite';docs[2].client_released_at='2026-10-06';data=null;
   }else if(url.pathname.endsWith('/rpc/admin_document_archive_reminder'))data=0;
   else if((route.request().headers().accept||'').includes('vnd.pgrst.object'))data=null;
   return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET, POST, OPTIONS','content-range':'*/0'},body:JSON.stringify(data)});
  });
  await context.addInitScript(({key,value})=>localStorage.setItem(key,value),{key:`sb-${backend.hostname.split('.')[0]}-auth-token`,value:JSON.stringify({access_token:token,token_type:'bearer',expires_in:3600,expires_at:expires,refresh_token:'SYNTHETIC_INVALID',user})});
  await page.goto(new URL('/portal/admin/document-center/',base).href);
  await page.getByText('Escolha um projeto para começar',{exact:true}).waitFor();
  await page.getByPlaceholder('Pesquisar cliente, projeto ou contrato').fill('Alfa');
  await page.getByRole('button',{name:'Selecionar projeto Projeto Alfa',exact:true}).click();
  const row=title=>page.getByRole('button',{name:`Ver detalhes de ${title}`,exact:true});
  await row('Anexo revisão 2').waitFor();
  await page.getByRole('button',{name:'Aguardando cliente (1)',exact:true}).click();
  assert.equal(await row('Vistoria pronta').count(),0);
  await row('Anexo revisão 2').click();
  await page.getByText('Versões e histórico',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Baixar + arquivar',exact:true}).count(),0,'Versão enviada não oferece regeneração');
  await page.getByRole('button',{name:'Ver versão 1.0',exact:true}).click();
  await page.getByText('Substituído',{exact:true}).last().waitFor();
  await page.getByRole('button',{name:'Fechar painel',exact:true}).click();
  await page.getByPlaceholder('Pesquisar documento ou decisão').fill('Anexo');
  await page.reload();await row('Anexo revisão 2').waitFor();
  assert.equal(await page.getByPlaceholder('Pesquisar documento ou decisão').inputValue(),'Anexo');
  assert.equal(new URL(page.url()).searchParams.get('filter'),'waiting');
  await page.getByPlaceholder('Pesquisar documento ou decisão').fill('');
  await page.getByRole('button',{name:'Todos (4)',exact:true}).click();
  await row('Vistoria pronta').click();
  page.once('dialog',dialog=>dialog.dismiss());
  await page.getByRole('button',{name:'Liberar e solicitar aceite',exact:true}).click();
  assert.equal(writes.length,0,'Cancelar não envia nem libera');
  await page.waitForTimeout(550);
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Liberar e solicitar aceite',exact:true}).click();
  await page.getByText('Versão liberada com aceite obrigatório.',{exact:true}).last().waitFor();
  assert.equal(writes.length,1);assert.equal(writes[0].body.p_acceptance_required,true);
  await page.getByRole('button',{name:'Fechar painel',exact:true}).click();
  await page.getByRole('button',{name:'Decisões do projeto',exact:true}).click();
  await page.getByText('Aprovar layout térreo',{exact:true}).waitFor();
  assert.equal(await page.getByText('Aceite do anexo',{exact:true}).count(),0,'Aceite documental não duplica a lista de decisões');
  await page.getByRole('button',{name:'Nova aprovação',exact:true}).click();
  await page.getByPlaceholder('Ex.: Layout térreo — versão 03').fill('Rascunho preservado');
  await page.getByRole('button',{name:'Fechar painel',exact:true}).click();
  await page.getByRole('button',{name:'Nova aprovação',exact:true}).click();
  assert.equal(await page.getByPlaceholder('Ex.: Layout térreo — versão 03').inputValue(),'Rascunho preservado');
  page.once('dialog',dialog=>dialog.dismiss());
  await page.getByRole('button',{name:'Enviar aprovação ao cliente',exact:true}).click();
  assert.equal(writes.filter(item=>item.path==='approval').length,0,'Cancelar preserva o rascunho sem enviar');
  await page.waitForTimeout(550);page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Enviar aprovação ao cliente',exact:true}).click();
  await page.getByRole('button',{name:'Fechar painel',exact:true}).waitFor({state:'hidden'});
  await page.getByText('Rascunho preservado',{exact:true}).waitFor();
  assert.equal(writes.filter(item=>item.path==='approval').length,1);
  assert.equal(writes.find(item=>item.path==='approval').body.projeto_id,'p1');
  await page.getByRole('button',{name:'Documentos',exact:true}).click();
  await page.screenshot({path:`/tmp/document-center-clean-${width}.png`,fullPage:true});
  slowProject=true;
  await page.reload();await page.getByRole('button',{name:'Trocar projeto',exact:true}).click();
  await page.getByRole('button',{name:'Selecionar projeto Projeto Beta',exact:true}).click();
  await page.waitForTimeout(800);
  assert.equal(await row('Anexo revisão 2').count(),0,'Resposta atrasada de outro projeto não reaparece');
  failDecisions=true;await page.getByRole('button',{name:'Atualizar lista',exact:true}).click();
  await page.getByText('Não foi possível consultar o histórico de aceites.',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Todos (—)',exact:true}).count(),1,'Consulta falha não vira total zero');
  failDecisions=false;await page.getByRole('button',{name:'Atualizar lista',exact:true}).click();
  await page.getByRole('button',{name:'Todos (0)',exact:true}).waitFor();
  assert.deepEqual(errors,[],'Sem exceções no bundle real');
  await context.route('**/orcamentos-contratos.html**',route=>route.fulfill({contentType:'text/html',body:'<h1>Destino de criação sintético</h1>'}));
  await page.getByRole('button',{name:'Criar documento',exact:true}).click();
  await page.waitForURL(url=>url.pathname==='/orcamentos-contratos.html');
  assert.equal(new URL(page.url()).searchParams.get('projectId'),'p2','Criação preserva o projeto explicitamente escolhido');
  await context.close();console.log(`PASS ${width}px: pesquisa, contexto, filtros, versões, confirmação, rascunho, corrida entre projetos e falha sem total falso.`);
 }
}finally{await browser.close();}
