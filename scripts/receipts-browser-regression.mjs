import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
const root=process.cwd();
const qaDir=process.env.CME_QA_DIR || fs.mkdtempSync(path.join(os.tmpdir(),'cme-receipts-'));
fs.mkdirSync(qaDir,{recursive:true});
const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://localhost').pathname);try{res.setHeader('content-type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.statusCode=404;res.end();}});
await new Promise(resolve=>server.listen(4175,'127.0.0.1',resolve));
const mock=`window.__PRINTED__=false;window.print=()=>{window.__PRINTED__=true;window.__PRINT_TITLE__=document.title;};
const clients=[{id:'client',nome:'Cliente de validação'},{id:'client-b',nome:'Cliente B'}],projects=[{id:'project',cliente_id:'client',nome:'Projeto de validação',numero_contrato:'TESTE'},{id:'project-b',cliente_id:'client-b',nome:'Obra B',numero_contrato:'CT-B'}];
const extraReceipts=[{id:'extra-b',client_id:'client-b',project_id:'project-b',receipt_number:99,amount:500,paid_on:'2026-10-20',payment_method:'Pix',description:'Medição da obra B',created_at:'2026-10-20T01:00:00Z',snapshot:{payer_name:'Cliente B',project_name:'Obra B',contract_number:'CT-B'}},{id:'extra-a',client_id:'client',project_id:null,receipt_number:98,amount:300,paid_on:'2026-10-19',payment_method:'Pix',description:'Visita avulsa',created_at:'2026-10-19T01:00:00Z',snapshot:{payer_name:'Cliente de validação',project_name:null,contract_number:null}}];
window.dbBuscarClientes=async()=>clients;window.dbBuscarProjetos=async()=>projects;window.dbBuscarConfiguracoes=async()=>({notificacoes:true});
window.supabaseClient={auth:{getUser:async()=>({data:{user:{id:'admin'}}})},rpc:async(name,args)=>{if(name==='is_portal_admin')return{data:true};window.__RECEIPT_PAYLOAD__=args.p_data;const row={id:'receipt',client_id:args.p_data.client_id,project_id:args.p_data.project_id,receipt_number:17,amount:args.p_data.amount,paid_on:args.p_data.paid_on,payment_method:args.p_data.payment_method,description:args.p_data.description,created_at:'2026-10-29T01:00:00Z',snapshot:{issuer:{name:'Profissional de validação',document:'Documento de teste',title:'Engenheira Civil'},payer_name:clients[0].nome,project_name:args.p_data.project_id?projects[0].nome:null,contract_number:'TESTE',city:args.p_data.city}};localStorage.setItem('qa-receipt',JSON.stringify(row));return{data:row}},from:table=>{const q={select:()=>q,eq:()=>q,order:()=>q,limit:()=>q,range:()=>q,maybeSingle:async()=>({data:table==='financeiro'?{id:'paid',cliente_id:'client',projeto_id:null,descricao:'Recebimento existente',valor:1234.56,tipo:'entrada',status:'pago',data_pagamento:'2026-10-28',forma_pagamento:'Pix'}:table==='payment_receipts'?JSON.parse(localStorage.getItem('qa-receipt')||'null'):{cidade:'São Paulo'}}),then:resolve=>{const saved=JSON.parse(localStorage.getItem('qa-receipt')||'null');resolve({data:[...(saved?[saved]:[]),...(table==='payment_receipts'?extraReceipts:[])],error:null});}};return q}};`;
const openHistory=async page=>{await page.locator('#receiptHistory details').first().waitFor({state:'attached'});for(const summary of await page.locator('#receiptHistory details > summary').all())if(!(await summary.evaluate(el=>el.parentElement.open)))await summary.click();};
const browser=await chromium.launch({headless:true});
try{
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1')return route.abort();if(url.pathname==='/js/supabase.js')return route.fulfill({contentType:'application/javascript',body:mock});if(url.pathname==='/js/database.js')return route.fulfill({contentType:'application/javascript',body:''});return route.continue();});
  await page.goto('http://127.0.0.1:4175/recibos.html');await page.locator('#newStandaloneReceipt').click();await page.locator('#receiptClient').selectOption('client');if(width===1440)await page.locator('#receiptProject').selectOption('project');await page.locator('#receiptAmount').fill('1.234,56');await page.locator('#receiptDate').fill('2026-10-28');await page.locator('#receiptDescription').fill('Parcela de serviço conferida para teste local');await page.locator('#receiptConfirmed').check();await page.locator('#issueReceipt').click();
  await page.getByText('Recibo emitido e preservado no histórico.',{exact:false}).waitFor();assert.match(await page.locator('#receiptPaper').innerText(),/REC-000017\/2026/);assert.equal(await page.evaluate(()=>window.__RECEIPT_PAYLOAD__.project_id),width===1440?'project':null);if(width===390)assert.match(await page.locator('#receiptPaper').innerText(),/Serviço sem projeto/);await page.locator('#printReceipt').click();assert.equal(await page.evaluate(()=>window.__PRINTED__),true);assert.equal(await page.evaluate(()=>window.__PRINT_TITLE__),'Recibo-TESTE-REC-000017-2026');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,`${width}px must not overflow`);
  // O grupo do recibo recém-emitido abre sozinho e o recibo fica destacado.
  await page.locator('#receiptHistory .receipt-focus').waitFor();assert.match(await page.locator('#receiptHistory .receipt-focus').innerText(),/REC-000017/);
  assert.deepEqual(await page.locator('#receiptHistory .receipt-client > summary').allInnerTexts(),['Cliente B · 1 recibo(s)','Cliente de validação · 2 recibo(s)'],'Clientes em ordem alfabética');
  assert.deepEqual(await page.locator('#receiptHistory .receipt-client:has-text("Cliente de validação") .receipt-project > summary').allInnerTexts(),width===1440?['Projeto de validação · 1 recibo(s)','Serviços sem projeto · 1 recibo(s)']:['Serviços sem projeto · 2 recibo(s)'],'Projetos separados e serviço sem projeto agrupado');
  assert.equal(await page.locator('#receiptHistory .receipt-client:has-text("Cliente B")').evaluate(el=>el.open),false,'Outros clientes continuam recolhidos');
  // Busca por número, cliente ou descrição abre os grupos encontrados.
  await page.locator('#receiptSearch').fill('rec-000099');
  assert.match(await page.locator('#receiptHistoryState').innerText(),/1 recibo\(s\) encontrado\(s\) em 1 cliente/);
  assert.equal(await page.getByRole('button',{name:'Abrir recibo',exact:true}).locator('visible=true').count(),1);
  await page.locator('#receiptSearch').fill('medicao obra');assert.match(await page.locator('#receiptHistory').innerText(),/REC-000099/);
  await page.locator('#receiptSearch').fill('inexistente');assert.match(await page.locator('#receiptHistoryState').innerText(),/Nenhum recibo encontrado/);
  await page.locator('#receiptSearch').fill('');assert.equal(await page.locator('#receiptHistory .receipt-client:has-text("Cliente B")').evaluate(el=>el.open),false,'Limpar a busca volta ao estado anterior dos grupos');
  assert.equal(await page.locator('#receiptHistory .receipt-focus').isVisible(),false,'Busca limpa o destaque');
  await page.reload();await openHistory(page);await page.locator('#receiptHistory div.item-lista:has-text("REC-000017")').getByRole('button',{name:'Abrir recibo',exact:true}).click();assert.match(await page.locator('#receiptPaper').innerText(),/1.234,56/);
  assert.deepEqual(errors,[]);
  const downloaded = page.waitForEvent('download'); await page.locator('#wordReceipt').click(); const file = await downloaded;
  assert.equal(file.suggestedFilename(),'Recibo-TESTE-REC-000017-2026.docx'); const docxPath=path.join(qaDir,'receipt-qa.docx'); await file.saveAs(docxPath);
  execFileSync(process.env.CODEX_PRIMARY_RUNTIME_PYTHON || 'python3',['-c', `import sys,zipfile,xml.etree.ElementTree as ET
with zipfile.ZipFile(sys.argv[1]) as z:
 assert z.testzip() is None
 root=ET.fromstring(z.read('word/document.xml'))
 text=''.join(root.itertext())
 assert 'REC-000017/2026' in text and '1.234,56' in text and 'Parcela de serviço' in text
 assert '<w:pgSz' in z.read('word/document.xml').decode()
`,docxPath]);
  if(width===1440){await page.locator('#receiptResult').screenshot({path:path.join(qaDir,'receipt-qa.png')});await page.pdf({path:path.join(qaDir,'receipt-qa.pdf'),format:'A4'});} 
  await page.goto('http://127.0.0.1:4175/recibos.html?financialId=paid');
  await page.getByText('Recibo já emitido para este recebimento.',{exact:false}).waitFor();
  assert.equal(await page.locator('#receiptEditor').isVisible(),false);assert.match(await page.locator('#receiptPaper').innerText(),/REC-000017\/2026/);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('qa-receipt')).receipt_number),17,'Opening the payment reuses its issued receipt');
  assert.deepEqual(errors,[]);
  // A02: recibo estornado continua acessível, mas identificado como estornado na tela, no histórico e no Word.
  await page.evaluate(()=>{const r=JSON.parse(localStorage.getItem('qa-receipt'));r.reversed_at='2026-11-02T15:00:00Z';r.reversal_reason='Valor lançado em duplicidade';localStorage.setItem('qa-receipt',JSON.stringify(r));});
  await page.goto('http://127.0.0.1:4175/recibos.html?financialId=paid');
  await page.getByText('posteriormente estornado',{exact:false}).waitFor();
  assert.match(await page.locator('#receiptPaper').innerText(),/RECIBO ESTORNADO em 02\/11\/2026 — motivo: Valor lançado em duplicidade/);
  await openHistory(page);assert.match(await page.locator('#receiptHistory').innerText(),/ESTORNADO/);
  const reversedDownload=page.waitForEvent('download');await page.locator('#wordReceipt').click();const reversedFile=await reversedDownload;
  assert.equal(reversedFile.suggestedFilename(),'Recibo-TESTE-REC-000017-2026-ESTORNADO.docx');const reversedPath=path.join(qaDir,'receipt-reversed.docx');await reversedFile.saveAs(reversedPath);
  execFileSync(process.env.CODEX_PRIMARY_RUNTIME_PYTHON || 'python3',['-c',`import sys,zipfile
t=zipfile.ZipFile(sys.argv[1]).read('word/document.xml').decode()
assert 'RECIBO ESTORNADO' in t and 'REC-000017/2026' in t`,reversedPath]);
  assert.deepEqual(errors,[]);
  await context.close();console.log('PASS: recibo '+width+'px — emissão, histórico após reload, reimpressão, PDF, Word válido e sem exceções.');
 }
}finally{await browser.close();server.close();}
