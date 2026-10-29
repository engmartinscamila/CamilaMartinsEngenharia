import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=process.env.SITE_BASE||'http://127.0.0.1:4173';
const titles=['Início','Clientes e contratos','Documentos e arquivos','Gestão de obras','Financeiro e recibos','Agenda e comunicação','Configurações'];
const browser=await chromium.launch({headless:true});
try{for(const width of [360,390,1440]){
 const page=await browser.newPage({viewport:{width,height:900}});
 await page.route('**/*',route=>{const url=new URL(route.request().url());if(route.request().resourceType()==='script'&&!/\/js\/ui-core\.js(?:\?|$)/.test(url.pathname+url.search))return route.fulfill({contentType:'application/javascript',body:''});if(url.origin!==new URL(base).origin)return route.abort();return route.continue();});
 await page.goto(base+'/admin.html');await page.locator('.menu-lateral[data-cme-ordem-fixa="true"]').waitFor();
 if(width<820)await page.locator('#cmeAdminMobileMenuButton').click();
 const groups=page.locator('.menu-lateral > details.cme-admin-menu-group');assert.equal(await groups.count(),7);assert.equal(await page.locator('.menu-lateral a.menu-item').count(),26);
 assert.deepEqual(await groups.locator(':scope > summary > span').allTextContents(),titles);
 assert.equal(await page.locator('.menu-lateral a.menu-item:visible').count(),2,'Only current area starts expanded');
 for(const group of await groups.all()){
  const summary=group.locator('summary');if(!await group.evaluate(node=>node.open))await summary.click();
  // An open boolean attribute has value "", so explicitly verify its DOM state.
  if(!await group.evaluate(node=>node.open))await summary.click();
  assert.equal(await group.evaluate(node=>node.open),true);assert.equal(await page.locator('.menu-lateral > details[open]').count(),1);
 }
 const docs=page.locator('.menu-lateral [data-cme-menu-group="documents"]');await docs.locator('summary').focus();await page.keyboard.press('Enter');
 assert.equal(await docs.evaluate(node=>node.open),true,'Keyboard opens group');
 await docs.locator('a.menu-item[href="documentos.html"]').click();await page.waitForURL(url=>url.pathname.endsWith('/documentos.html'));
 if(width<820)await page.locator('#cmeAdminMobileMenuButton').click();
 await page.locator('.menu-lateral [data-cme-menu-group="documents"][open]').waitFor();assert.equal(await page.locator('.menu-lateral a[aria-current="page"]').count(),1);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
 await page.waitForFunction(()=>!Array.from(document.querySelectorAll('#loading,#loader,#carregando')).some(node=>getComputedStyle(node).display!=='none'));
 await page.waitForTimeout(350);
 await page.addStyleTag({url:base+'/css/mobile-experience.css'});
 await page.evaluate(()=>{const row=document.createElement('div');row.className='item-lista';row.id='qa-action-sizing';row.innerHTML='<div class="item-info"><h3>Cliente sintético</h3></div><div class="item-acoes"><button aria-label="Visualizar">◉</button><button aria-label="Editar">✎</button><button aria-label="Excluir">×</button><button>Reenviar e-mail de acesso</button></div>';document.querySelector('main').prepend(row);});
 const actionSizes=await page.locator('#qa-action-sizing button').evaluateAll(nodes=>nodes.map(node=>({width:node.getBoundingClientRect().width,height:node.getBoundingClientRect().height,scroll:node.scrollWidth,client:node.clientWidth})));
 assert(actionSizes.every(size=>size.height<=90&&size.scroll<=size.client+2),'Actions must not stretch or clip their labels');assert(actionSizes[3].width>120,'Text action must not inherit 42px icon width');
 if(width===1440)await page.screenshot({path:'/tmp/cme-menu-groups-desktop.png'});
 if(width===390)await page.screenshot({path:'/tmp/cme-menu-groups-mobile.png'});
 await page.close();console.log(`PASS: menu ${width}px — sete áreas, teclado, expansão única, destaque e contexto após navegação.`);
}}finally{await browser.close();}
