import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

// Sem mocks, sessão fabricada ou scripts desativados. HTTP 200 não basta:
// o bundle real precisa reconhecer a rota e executar a proteção de acesso.
const base = process.env.SITE_BASE || 'http://127.0.0.1:4174';
const source = readFileSync('portal-app/src/lib/admin-navigation.ts', 'utf8');
const block = source.match(/modernWebsiteAdminSections = new Set\(\[([\s\S]*?)\]\)/)[1];
const sections = [...block.matchAll(/'([^']+)'/g)].map((match) => match[1]);
const browser = await chromium.launch({ headless: true });
let checked = 0;
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const targets = sections.flatMap((key) => [
      `/portal/admin/${key}/`,
      `/portal/admin/${key}.html`,
      `/portal/admin/${key}/index.html`,
    ]);
    targets.push('/portal/admin/index.html?section=crm');
    for (const path of targets) {
      errors.length = 0;
      const response = await page.goto(base + path, { waitUntil: 'domcontentloaded' });
      assert.equal(response.status(), 200, `${path}: HTTP`);
      await page.getByRole('textbox', { name: 'E-mail', exact: true }).waitFor({ timeout: 15000 });
      assert.equal(new URL(page.url()).pathname, '/portal/login', `${path}: login protegido`);
      assert.equal(await page.getByText('Página não encontrada', { exact: true }).count(), 0, `${path}: rota não reconhecida`);
      assert.deepEqual(errors, [], `${path}: erro JavaScript`);
      checked++;
      console.log(`OK ${viewport.width}px ${path}: bundle executado e login protegido montado`);
    }
    await context.close();
  }
} finally {
  await browser.close();
}
console.log(`APROVADO: ${checked} aberturas com JavaScript real, sem autenticação. Operações internas exigem teste com sessão administrativa.`);
