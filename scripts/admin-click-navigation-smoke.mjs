import { chromium } from 'playwright';

const BASE = process.env.SITE_BASE || 'http://127.0.0.1:4174';
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

const menuTargets = [
  ['Dashboard', '/admin.html'],
  ['Clientes', '/clientes.html'],
  ['Projetos', '/projetos.html'],
  ['Orçamentos e contratos', '/orcamentos-contratos.html'],
  ['Oportunidades comerciais', '/portal/admin/crm.html'],
  ['Documentos gerados e aceites', '/portal/admin/contract-documents.html'],
  ['Preparar documento do projeto', '/portal/admin/document-preparation.html'],
  ['Versões e pendências dos documentos', '/portal/admin/document-governance.html'],
  ['Arquivos antigos e restauração', '/portal/admin/document-archive.html'],
  ['Documentos', '/documentos.html'],
  ['Fotos e evolução da obra', '/fotos.html'],
  ['Tarefas do projeto', '/portal/admin/tasks.html'],
  ['Diário de obra', '/portal/admin/work-diary.html'],
  ['Fornecedores e cotações', '/portal/admin/procurement.html'],
  ['Biblioteca', '/biblioteca.html'],
  ['Financeiro', '/financeiro.html'],
  ['Contas bancárias e conciliação OFX', '/portal/admin/financial.html'],
  ['Módulos do portal do cliente', '/portal/admin/portal-control.html'],
  ['Agenda', '/agenda.html'],
  ['Cronograma (simples)', '/cronograma.html'],
  ['Cronograma de obra completo', '/portal/admin/construction-schedule.html'],
  ['Aprovações', '/portal/admin/approvals.html'],
  ['Solicitações', '/solicitacoes.html'],
  ['Notificações internas', '/portal/admin/notifications.html'],
  ['Armazenamento e auditoria', '/portal/admin/security.html'],
  ['Conteúdo do site', '/protecao-pdf-admin.html'],
  ['Configurações', '/configuracoes.html'],
  ['Verificar funcionamento', '/integridade-sistema.html'],
];

const quickTargets = [
  ['crm', '/portal/admin/crm.html'],
  ['contract-documents', '/portal/admin/contract-documents.html'],
  ['document-preparation', '/portal/admin/document-preparation.html'],
  ['document-governance', '/portal/admin/document-governance.html'],
  ['document-archive', '/portal/admin/document-archive.html'],
  ['tasks', '/portal/admin/tasks.html'],
  ['work-diary', '/portal/admin/work-diary.html'],
  ['procurement', '/portal/admin/procurement.html'],
  ['financial', '/portal/admin/financial.html'],
  ['portal-control', '/portal/admin/portal-control.html'],
  ['construction-schedule', '/portal/admin/construction-schedule.html'],
  ['approvals', '/portal/admin/approvals.html'],
  ['notifications', '/portal/admin/notifications.html'],
  ['security', '/portal/admin/security.html'],
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });

async function newAdminPage(viewport) {
  const page = await context.newPage();
  if (viewport) await page.setViewportSize(viewport);

  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = request.url();

    if (request.resourceType() === 'script' && !/\/js\/ui-core\.js(?:\?|$)/i.test(url)) {
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
      const [response] = await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }),
        target.click({ timeout: 5000 }),
      ]);

      const current = new URL(page.url());
      assert(current.pathname === expectedPath, `${label}: clique abriu ${current.pathname}, esperado ${expectedPath}`);
      assert(Boolean(response) && response.status() < 400, `${label}: destino respondeu HTTP ${response?.status() ?? 'sem resposta'}`);

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

{
  const page = await newAdminPage({ width: 390, height: 844 });
  const mobileButton = page.locator('#cmeAdminMobileMenuButton');
  assert(await mobileButton.count() === 1, 'Mobile: botão do menu administrativo ausente');
  if (await mobileButton.count() === 1) {
    await mobileButton.click();
    assert(await page.locator('.sidebar.open').count() === 1, 'Mobile: clique no botão não abriu a sidebar');

    const target = page.locator('a.menu-item').filter({ hasText: 'Cronograma de obra completo' }).first();
    try {
      const [response] = await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }),
        target.click({ timeout: 5000 }),
      ]);
      const current = new URL(page.url());
      assert(current.pathname === '/portal/admin/construction-schedule.html', `Mobile: clique no Cronograma completo abriu ${current.pathname}`);
      assert(Boolean(response) && response.status() < 400, `Mobile: Cronograma completo respondeu HTTP ${response?.status() ?? 'sem resposta'}`);
    } catch (error) {
      failures.push(`Mobile: clique no Cronograma completo falhou: ${error.message}`);
    }
  }
  await page.close();
}

await browser.close();

if (failures.length) {
  console.error('\nFALHAS NO TESTE REAL DE CLIQUES DO ADMIN:');
  failures.forEach((failure, index) => console.error(`${index + 1}. ${failure}`));
  process.exit(1);
}

console.log(`APROVADO: ${menuTargets.length} itens do menu + ${quickTargets.length} ações rápidas + navegação mobile foram clicados e abriram os destinos esperados.`);
