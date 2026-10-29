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
const mock=`window.__PRINTED__=false;window.print=()=>window.__PRINTED__=true;
const clients=[{id:'client',nome:'Cliente de validação'}],projects=[{id:'project',cliente_id:'client',nome:'Projeto de validação',numero_contrato:'TESTE'}];
window.dbBuscarClientes=async()=>clients;window.dbBuscarProjetos=async()=>projects;window.dbBuscarConfiguracoes=async()=>({notificacoes:true});
window.supabaseClient={auth:{getUser:async()=>({data:{user:{id:'admin'}}})},rpc:async(name,args)=>{if(name==='is_portal_admin')return{data:true};const row={id:'receipt',receipt_number:17,amount:args.p_data.amount,paid_on:args.p_data.paid_on,payment_method:args.p_data.payment_method,description:args.p_data.description,created_at:'2026-10-29T01:00:00Z',snapshot:{issuer:{name:'Profissional de validação',document:'Documento de teste',title:'Engenheira Civil'},payer_name:clients[0].nome,project_name:projects[0].nome,contract_number:'TESTE',city:args.p_data.city}};localStorage.setItem('qa-receipt',JSON.stringify(row));return{data:row}},from:table=>{const q={select:()=>q,order:()=>q,limit:()=>q,range:()=>q,maybeSingle:async()=>({data:{cidade:'São Paulo'}}),then:resolve=>resolve({data:JSON.parse(localStorage.getItem('qa-receipt')||'null')?[JSON.parse(localStorage.getItem('qa-receipt'))]:[],error:null})};return q}};`;
const browser=await chromium.launch({headless:true});
try{
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1')return route.abort();if(url.pathname==='/js/supabase.js')return route.fulfill({contentType:'application/javascript',body:mock});if(url.pathname==='/js/database.js')return route.fulfill({contentType:'application/javascript',body:''});return route.continue();});
  await page.goto('http://127.0.0.1:4175/recibos.html');await page.locator('#receiptClient').selectOption('client');await page.locator('#receiptProject').selectOption('project');await page.locator('#receiptAmount').fill('1.234,56');await page.locator('#receiptDate').fill('2026-10-28');await page.locator('#receiptDescription').fill('Parcela de serviço conferida para teste local');await page.locator('#receiptConfirmed').check();await page.locator('#issueReceipt').click();
  await page.getByText('Recibo emitido e preservado no histórico.',{exact:false}).waitFor();assert.match(await page.locator('#receiptPaper').innerText(),/REC-000017\/2026/);await page.locator('#printReceipt').click();assert.equal(await page.evaluate(()=>window.__PRINTED__),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,`${width}px must not overflow`);
  await page.reload();await page.getByRole('button',{name:'Abrir recibo',exact:true}).click();assert.match(await page.locator('#receiptPaper').innerText(),/1.234,56/);
  assert.deepEqual(errors,[]);
  const downloaded = page.waitForEvent('download'); await page.locator('#wordReceipt').click(); const file = await downloaded;
  assert.equal(file.suggestedFilename(),'Recibo-000017.docx'); const docxPath=path.join(qaDir,'receipt-qa.docx'); await file.saveAs(docxPath);
  execFileSync(process.env.CODEX_PRIMARY_RUNTIME_PYTHON || 'python3',['-c', `import sys,zipfile,xml.etree.ElementTree as ET
with zipfile.ZipFile(sys.argv[1]) as z:
 assert z.testzip() is None
 root=ET.fromstring(z.read('word/document.xml'))
 text=''.join(root.itertext())
 assert 'REC-000017/2026' in text and '1.234,56' in text and 'Parcela de serviço' in text
 assert '<w:pgSz' in z.read('word/document.xml').decode()
`,docxPath]);
  if(width===1440){await page.locator('#receiptResult').screenshot({path:path.join(qaDir,'receipt-qa.png')});await page.pdf({path:path.join(qaDir,'receipt-qa.pdf'),format:'A4'});} 
  await context.close();console.log('PASS: recibo '+width+'px — emissão, histórico após reload, reimpressão, PDF, Word válido e sem exceções.');
 }
}finally{await browser.close();server.close();}
