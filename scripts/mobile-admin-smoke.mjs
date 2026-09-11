import { chromium } from 'playwright';

const BASE = process.env.SITE_BASE || 'http://127.0.0.1:4173';
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };

const supabaseMock = `
(function(){
  const isAdmin = !/portal\.html$/i.test(location.pathname);
  const user={id:isAdmin?'admin-mobile':'client-mobile',email:isAdmin?'admin@teste.local':'cliente@teste.local',user_metadata:{nome:isAdmin?'Camila':'Cliente'}};
  const session={user,access_token:'mock-mobile'};
  const emptyChain=()=>{const api={select(){return api},eq(){return api},neq(){return api},not(){return api},is(){return api},in(){return api},order(){return api},limit(){return api},range(){return api},insert(){return api},update(){return api},upsert(){return api},delete(){return api},maybeSingle:async()=>({data:null,error:null}),single:async()=>({data:null,error:null}),then(resolve,reject){return Promise.resolve({data:[],error:null,count:0}).then(resolve,reject)}};return api};
  window.supabaseClient={
    auth:{getSession:async()=>({data:{session},error:null}),getUser:async()=>({data:{user},error:null}),signOut:async()=>({error:null})},
    rpc:async name=>({data:name==='is_portal_admin'?isAdmin:[],error:null}),
    from:()=>emptyChain(),
    functions:{invoke:async()=>({data:{ok:true},error:null})},
    storage:{from:()=>({list:async()=>({data:[],error:null}),createSignedUrl:async()=>({data:{signedUrl:'https://example.invalid/mock'},error:null})})}
  };
  window.supabase={createClient:()=>window.supabaseClient};
  window.dbBuscarConfiguracoes=async()=>({tema:'escuro',cor_principal:'#b89a63',notificacoes:true});
})();
`;

async function installAdminMocks(page) {
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.supabase={createClient:()=>window.supabaseClient};' }));
  await page.route('**/js/supabase.js*', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: supabaseMock }));
  await page.route('**/js/database.js*', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: supabaseMock }));
  await page.route('**/js/admin.js*', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await page.route('**/js/system-health-web.js*', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await page.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com/, route => route.abort());
}

async function assertNoHorizontalOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    viewport: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  assert(metrics.scrollWidth <= metrics.viewport + 2, `${label}: HTML excede viewport (${metrics.scrollWidth}px > ${metrics.viewport}px)`);
  assert(metrics.bodyScrollWidth <= metrics.viewport + 2, `${label}: body excede viewport (${metrics.bodyScrollWidth}px > ${metrics.viewport}px)`);
}

const browser = await chromium.launch({ headless: true });
const adminContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

for (const file of ['admin.html', 'integridade-sistema.html', 'clientes.html', 'documentos.html']) {
  const page = await adminContext.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await installAdminMocks(page);
  await page.goto(`${BASE}/${file}?mobileqa=1`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(700);

  assert(errors.length === 0, `${file}: erro JS no mobile: ${errors.join(' | ')}`);
  await assertNoHorizontalOverflow(page, file);

  const menuButton = page.locator('#cmeAdminMobileMenuButton');
  assert(await menuButton.count() === 1, `${file}: botão do menu mobile ausente`);
  if (await menuButton.count()) {
    assert(await menuButton.isVisible(), `${file}: botão do menu mobile não está visível`);
    const buttonBox = await menuButton.boundingBox();
    assert(Boolean(buttonBox && buttonBox.x >= 0 && buttonBox.x + buttonBox.width <= 390), `${file}: botão mobile saiu da viewport`);

    const closedSidebar = await page.locator('.sidebar').boundingBox();
    assert(Boolean(closedSidebar && closedSidebar.right <= 3), `${file}: sidebar deveria iniciar fechada no celular`);

    await menuButton.click();
    await page.waitForTimeout(280);
    assert(await page.locator('body').evaluate(el => el.classList.contains('cme-admin-menu-open')), `${file}: menu não abriu`);
    assert(await menuButton.getAttribute('aria-expanded') === 'true', `${file}: aria-expanded não indica menu aberto`);
    const openSidebar = await page.locator('.sidebar').boundingBox();
    assert(Boolean(openSidebar && openSidebar.x >= -2 && openSidebar.width <= 322 && openSidebar.right <= 390), `${file}: drawer aberto extrapola a viewport`);
    assert(await page.locator('.menu-lateral a.menu-item').count() === 28, `${file}: menu mobile não contém os 28 destinos canônicos`);
    assert(await page.locator('.cme-admin-mobile-overlay').isVisible(), `${file}: overlay do menu não apareceu`);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(260);
    assert(!(await page.locator('body').evaluate(el => el.classList.contains('cme-admin-menu-open'))), `${file}: Escape não fechou o menu`);
  }

  const contentBox = await page.locator('.conteudo').boundingBox();
  assert(Boolean(contentBox && contentBox.x >= -1 && contentBox.right <= 391), `${file}: conteúdo principal extrapola a viewport`);

  const overflowCards = await page.locator('.card,.card-grande,.card-lateral,.health-card,.doc-shell').evaluateAll((els) => els.filter(el => {
    const r=el.getBoundingClientRect(); return r.left < -2 || r.right > window.innerWidth + 2;
  }).length).catch(() => 0);
  assert(overflowCards === 0, `${file}: ${overflowCards} card(s) extrapolam a viewport`);

  if (file === 'integridade-sistema.html') {
    const columns = await page.locator('.health-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns);
    assert(!columns.includes(' ') || columns.split(' ').length === 1, `integridade-sistema.html: cards de diagnóstico não ficaram em uma coluna (${columns})`);
  }
  await page.close();
}

await adminContext.close();

// Portal do cliente: validação visual mobile isolada da lógica de autenticação.
const clientContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const clientPage = await clientContext.newPage();
await clientPage.route('**/js/*.js*', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
await clientPage.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net/, route => route.abort());
await clientPage.goto(`${BASE}/portal.html?mobileqa=1`, { waitUntil: 'domcontentloaded', timeout: 15000 });
await clientPage.waitForTimeout(250);
await assertNoHorizontalOverflow(clientPage, 'portal.html');
const clientOverflow = await clientPage.locator('.welcome-card,.status-card,.portal-card,.engineer-message,.support-card').evaluateAll((els) => els.filter(el => {
  const r=el.getBoundingClientRect(); return r.left < -2 || r.right > window.innerWidth + 2;
}).length);
assert(clientOverflow === 0, `portal.html: ${clientOverflow} card(s) extrapolam a viewport`);
const portalColumns = await clientPage.locator('.portal-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns);
assert(!portalColumns.includes(' ') || portalColumns.split(' ').length === 1, `portal.html: grade principal não ficou em uma coluna (${portalColumns})`);
await clientPage.close();
await clientContext.close();

await browser.close();

if (failures.length) {
  console.error('\nFALHAS MOBILE:');
  failures.forEach((failure, index) => console.error(`${index + 1}. ${failure}`));
  process.exit(1);
}
console.log('MOBILE APROVADO: Admin clássico e Portal do Cliente sem overflow em 390×844, com drawer administrativo acessível.');
