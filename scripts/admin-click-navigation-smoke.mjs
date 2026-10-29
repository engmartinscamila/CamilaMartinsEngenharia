import {revealMenuTarget} from './admin-menu-test-helpers.mjs';
import { chromium } from 'playwright';

const BASE = process.env.SITE_BASE || 'http://127.0.0.1:4174';
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

const menuTargets = [
  [
    "Visão geral",
    "/portal/admin/workspace/"
  ],
  [
    "Clientes e projetos",
    "/portal/admin/client-center/"
  ],
  [
    "Oportunidades comerciais",
    "/portal/admin/crm/"
  ],
  [
    "Contratos gerais",
    "/orcamentos-contratos.html"
  ],
  [
    "Acervo do projeto",
    "/portal/admin/asset-center/"
  ],
  [
    "Emissões e aprovações",
    "/portal/admin/document-center/"
  ],
  [
    "Gestão da obra",
    "/portal/admin/works-center/"
  ],
  [
    "Financeiro e recibos",
    "/portal/admin/finance-center/"
  ],
  [
    "Agenda e relacionamento",
    "/portal/admin/relationship-center/"
  ],
  [
    "Configurações",
    "/portal/admin/settings-center/"
  ]
];

const quickTargets = [
  [
    "workspace",
    "/portal/admin/workspace/"
  ],
  [
    "client-center",
    "/portal/admin/client-center/"
  ],
  [
    "crm",
    "/portal/admin/crm/"
  ],
  [
    "asset-center",
    "/portal/admin/asset-center/"
  ],
  [
    "document-center",
    "/portal/admin/document-center/"
  ],
  [
    "works-center",
    "/portal/admin/works-center/"
  ],
  [
    "finance-center",
    "/portal/admin/finance-center/"
  ],
  [
    "relationship-center",
    "/portal/admin/relationship-center/"
  ],
  [
    "settings-center",
    "/portal/admin/settings-center/"
  ]
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });

async function newAdminPage(viewport) {
  const page = await context.newPage();
  if (viewport) await page.setViewportSize(viewport);

  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = request.url();

    if (!new URL(page.url()).pathname.startsWith('/portal/') && request.resourceType() === 'script' && !/\/js\/(?:ui-core|library-route|financial-route)\.js(?:\?|$)/i.test(url)) {
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
    }

    if (/fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com/i.test(url)) {
      return route.abort();
    }

    return route.continue();
  });

  const response = await page.goto(`${BASE}/admin.html?clicktest=${Date.now()}`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });

  assert(Boolean(response) && response.status() < 400, `admin.html não abriu para o teste de clique (${response?.status() ?? 'sem resposta'})`);

  try {
    await page.waitForFunction(
      () => document.querySelector('.menu-lateral')?.dataset?.cmeOrdemFixa === 'true',
      null,
      { timeout: 5000 },
    );
  } catch {
    failures.push('admin.html: o menu canônico não ficou pronto para os cliques');
  }

  return page;
}

async function clickAndAssert({ label, selector, expectedPath, viewport }) {
  const page = await newAdminPage(viewport);
  const target = page.locator(selector).first();
  const count = await page.locator(selector).count();
  assert(count === 1, `${label}: esperado 1 alvo clicável, encontrado ${count}`);

  if (count === 1) {
    try {
      await revealMenuTarget(target);
      const [response] = await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }),
        target.click({ timeout: 5000 }),
      ]);

      if(label.includes('Biblioteca'))await page.waitForURL(url=>url.pathname===expectedPath,{timeout:10000});
      const current = new URL(label.includes('Biblioteca')?page.url():(response?.url() || page.url()));
      assert(current.pathname === expectedPath, `${label}: clique abriu ${current.pathname}, esperado ${expectedPath}`);
      assert(Boolean(response) && response.status() < 400, `${label}: destino respondeu HTTP ${response?.status() ?? 'sem resposta'}`);

      if (expectedPath.startsWith('/portal/')) {
        // Executar o bundle real: sem sessão, a proteção deve montar o login.
        await page.getByRole('textbox', { name: 'E-mail', exact: true }).waitFor({ timeout: 15000 });
        assert(new URL(page.url()).pathname === '/portal/login', `${label}: a proteção não encaminhou ao login`);
      }
      const body = (await page.locator('body').innerText().catch(() => '')) || '';
      assert(!/Página não encontrada|Page not found|\b404\b/i.test(body), `${label}: clique terminou em página não encontrada`);
    } catch (error) {
      failures.push(`${label}: clique/navegação falhou: ${error.message}`);
    }
  }

  await page.close();
}

for (const [label, expectedPath] of menuTargets) {
  await clickAndAssert({
    label: `Menu > ${label}`,
    selector: `a.menu-item:has(span:text-is("${label.replaceAll('"', '\\"')}") )`,
    expectedPath,
  });
}

for (const [slug, expectedPath] of quickTargets) {
  await clickAndAssert({
    label: `Ação rápida > ${slug}`,
    selector: `#abrirFerramenta-${slug}`,
    expectedPath,
  });
}

// A preparação documental foi consolidada em Contratos Gerais.
// A rota antiga permanece apenas como compatibilidade interna e não deve voltar ao menu.
{
  const page = await newAdminPage();
  assert(
    await page.locator('a.menu-item').filter({ hasText: 'Preparar documento do projeto' }).count() === 0,
    'Menu: preparação documental legada reapareceu',
  );
  assert(
    await page.locator('#abrirFerramenta-document-preparation').count() === 0,
    'Ações rápidas: preparação documental legada reapareceu',
  );
  assert(
    await page.locator('a.menu-item').filter({ hasText: 'Contratos gerais' }).count() === 1,
    'Menu: Contratos Gerais deve permanecer como único ponto canônico documental',
  );
  await page.close();
}

{
  const page = await newAdminPage({ width: 390, height: 844 });
  const mobileButton = page.locator('#cmeAdminMobileMenuButton');
  assert(await mobileButton.count() === 1, 'Mobile: botão do menu administrativo ausente');
  if (await mobileButton.count() === 1) {
    await mobileButton.click();
    assert(await page.locator('.sidebar.open').count() === 1, 'Mobile: clique no botão não abriu a sidebar');

    const target = page.locator('a.menu-item').filter({ hasText: 'Gestão da obra' }).first();
    try {
      await revealMenuTarget(target);
      const [response] = await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }),
        target.click({ timeout: 5000 }),
      ]);
      const current = new URL(response?.url() || page.url());
      assert(current.pathname === '/portal/admin/works-center/', `Mobile: clique em Gestão da obra abriu ${current.pathname}`);
      assert(Boolean(response) && response.status() < 400, `Mobile: Gestão da obra respondeu HTTP ${response?.status() ?? 'sem resposta'}`);
    } catch (error) {
      failures.push(`Mobile: clique em Gestão da obra falhou: ${error.message}`);
    }
  }
  await page.close();
}

await browser.close();

if (failures.length) {
  console.error('\nFALHAS NA NAVEGAÇÃO DO ADMIN (ORIGEM ISOLADA, DESTINOS REAIS):');
  failures.forEach((failure, index) => console.error(`${index + 1}. ${failure}`));
  process.exit(1);
}

console.log(`APROVADO: ${menuTargets.length} itens do menu + ${quickTargets.length} ações rápidas + navegação mobile foram clicados; destinos modernos executaram o bundle real e chegaram ao login protegido (sem sessão admin).`);
