import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=process.env.SITE_BASE||'http://127.0.0.1:4173';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const browser=await chromium.launch({headless:true});
try{for(const width of [1920,1440,1280,1024,960,820,390,360]){
 const page=await browser.newPage({viewport:{width,height:1000}});
 await page.route('**/*',route=>{const url=new URL(route.request().url());if(route.request().resourceType()==='script'&&!/\/js\/ui-core\.js(?:\?|$)/.test(url.pathname+url.search))return route.fulfill({contentType:'application/javascript',body:''});if(url.origin!==new URL(base).origin)return route.abort();return route.continue();});
 await page.goto(base+'/orcamentos-contratos.html');
 await page.locator('#cmeAdminPolish').waitFor({state:'attached'});
 await page.waitForFunction(()=>!!document.getElementById('cmeAdminPolish')?.sheet);
 await page.waitForFunction(()=>getComputedStyle(document.getElementById('loading')).display==='none');
 await page.evaluate(()=>{document.querySelector('#historyBody').innerHTML='<tr><td>29/10/2026</td><td>Ficha de Levantamento Técnico / Vistoria com observações complementares</td><td>MIG-C5272F21</td><td>Cliente sintético com nome empresarial extenso para validar a leitura completa</td><td>1.0</td><td>Aguardando manifestação do cliente</td><td>Arquivado com cópia preservada</td><td>150 KB</td></tr>';});
 const overflow=await page.evaluate(()=>({page:document.documentElement.scrollWidth-innerWidth,outside:[...document.querySelectorAll('.doc-shell,.doc-picker button,.doc-compact-filters input,#historyBody td')].filter(el=>{const r=el.getBoundingClientRect();return r.right>innerWidth+1||r.left<0||el.scrollWidth>el.clientWidth+2;}).map(el=>el.id||el.tagName)}));
 assert.ok(overflow.page<=2,`${width}px: página excedeu a tela ${JSON.stringify(overflow)}`);assert.deepEqual(overflow.outside,[],`${width}px: campos ou textos cortados`);
 assert.equal(await page.locator('.doc-picker button:visible').count(),10);
 assert.equal(await page.locator('#historyBody td:visible').count(),8);
 if(width===1920||width===390)await page.screenshot({path:`/tmp/document-hub-fit-${width}.png`,fullPage:true});
 await page.close();console.log(`PASS ${width}px: dez opções, filtros e oito informações do histórico dentro da tela.`);
}}finally{await browser.close();}
