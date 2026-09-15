import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

// Bundle real, sessão/servidor sintéticos isolados. Este teste NUNCA aceita um
// endereço de produção e não valida RLS nem gravações reais de clientes.
const base = new URL(process.env.SITE_BASE || 'http://127.0.0.1:4174');
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname), 'Use apenas o servidor local de teste');
const source = readFileSync('portal-app/src/lib/admin-navigation.ts', 'utf8');
const sections = [...source.match(/modernWebsiteAdminSections = new Set\(\[([\s\S]*?)\]\)/)[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
const config = readFileSync('.github/workflows/pages.yml', 'utf8');
const backend = new URL(config.match(/EXPO_PUBLIC_SUPABASE_URL:\s*(https:\/\/[^\s]+)/)[1]);
const user = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'navigation@example.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const expiry = Math.floor(Date.now() / 1000) + 3600;
const jwt = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: user.id, exp: expiry, aud: 'authenticated', role: 'authenticated' })).toString('base64url'), 'SYNTHETIC_NOT_A_VALID_SIGNATURE'].join('.');
const session = { access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: expiry, refresh_token: 'SYNTHETIC_NOT_A_VALID_REFRESH_TOKEN', user };
const browser = await chromium.launch({ headless: true });
let checked = 0;
async function testContext(viewport, admin = true) {
  const context = await browser.newContext({ viewport });
  await context.routeWebSocket('**/*', socket => socket.close());
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname !== backend.hostname) return route.continue();
    let data = [];
    if (url.pathname.endsWith('/rpc/is_portal_admin')) {
      // A consulta de papel deliberadamente termina depois de INITIAL_SESSION.
      await new Promise(resolve => setTimeout(resolve, 100)); data = admin;
    } else if (url.pathname === '/auth/v1/user') data = user;
    else if (url.pathname.includes('/auth/v1/')) return route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"synthetic auth only"}' });
    else if ((route.request().headers().accept || '').includes('vnd.pgrst.object')) data = null;
    else if (url.pathname.endsWith('/rpc/admin_document_archive_reminder')) data = 0;
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'content-range': '*/0' }, body: JSON.stringify(data) });
  });
  await context.addInitScript(({ key, value }) => { localStorage.setItem(key, value); }, { key: `sb-${backend.hostname.split('.')[0]}-auth-token`, value: JSON.stringify(session) });
  return context;
}
async function verifyTool(page, section) {
  await page.getByRole('button', { name: 'Início da administração', exact: true }).waitFor({ timeout: 20000 });
  assert.equal(new URL(page.url()).pathname.replace(/\/$/, ''), `/portal/admin/${section}`, 'A sessão deve permanecer na ferramenta escolhida');
  assert.equal(await page.getByText('Página não encontrada', { exact: true }).count(), 0);
  assert.equal(await page.getByRole('heading', { name: 'Painel Administrativo', exact: true }).count(), 0);
  checked++;
}
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await testContext(viewport);
    const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    for (const section of sections) {
      await page.goto(new URL('/configuracoes.html', base).href);
      await page.locator('.menu-lateral[data-cme-ordem-fixa="true"]').waitFor();
      if (viewport.width < 820) await page.locator('#cmeAdminMobileMenuButton').click();
      await page.locator(`a[data-cme-portal-section="${section}"]`).click();
      await verifyTool(page, section);
      assert.deepEqual(errors, [], `${section}: JavaScript`);
      console.log(`OK ${viewport.width}px Configurações -> ${section}: sessão preservada e ferramenta montada`);
    }
    if (viewport.width > 820) {
      for (const section of sections) {
        await page.goto(new URL('/admin.html', base).href);
        await page.locator(`#abrirFerramenta-${section}`).click();
        await verifyTool(page, section);
      }
      for (const section of ['crm', 'tasks', 'portal-control']) {
        await page.goto(new URL(`/portal/admin/${section}/`, base).href);
        await verifyTool(page, section); await page.reload(); await verifyTool(page, section);
      }
      await page.goto(new URL('/portal/login/?returnTo=%2Fadmin%2Ftasks', base).href);
      await verifyTool(page, 'tasks');
    }
    assert.deepEqual(errors, [], 'Nenhuma exceção na navegação autenticada com fixtures');
    await context.close();
  }
  const deniedContext = await testContext({ width: 390, height: 844 }, false);
  const deniedPage = await deniedContext.newPage();
  await deniedPage.goto(new URL('/portal/admin/crm/', base).href);
  await deniedPage.getByText('Acesso administrativo negado', { exact: true }).waitFor({ timeout: 20000 });
  assert.equal(await deniedPage.getByRole('button', { name: 'Início da administração', exact: true }).count(), 0);
  await deniedContext.close();
} finally { await browser.close(); }
console.log(`PASS: ${checked} destinos com sessão sintética, menu de Configurações, atalhos, reload e retorno do login; perfil sem autorização bloqueado.`);
