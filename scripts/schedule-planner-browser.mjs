// Teste real do "Cronograma completo" (planejador independente) no portal exportado.
// Sessão admin sintética e backend 100% interceptado: nada é lido ou gravado no Supabase.
// Cria um cronograma pelo modelo, confere indicadores/gráficos na tela, gera o Excel
// pelo botão e reabre o .xlsx baixado para validar abas, linhas, fórmulas e imagens.
import assert from 'node:assert/strict';
import {mkdirSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import ExcelJS from 'exceljs';

const base = new URL(process.env.SITE_BASE || 'http://127.0.0.1:4174');
assert.ok(['127.0.0.1', 'localhost'].includes(base.hostname), 'Somente testes locais com dados sintéticos');
const backend = new URL(readFileSync('.github/workflows/pages.yml', 'utf8').match(/EXPO_PUBLIC_SUPABASE_URL:\s*(https:\/\/[^\s]+)/)[1]);
const outDir = process.env.PLANNER_TEST_OUT || '/tmp/schedule-planner';
mkdirSync(outDir, {recursive: true});

const user = {id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'planner@example.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z'};
const expires = Math.floor(Date.now() / 1000) + 3600;
const token = [Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'), Buffer.from(JSON.stringify({sub: user.id, exp: expires, aud: 'authenticated', role: 'authenticated'})).toString('base64url'), 'SYNTHETIC_NOT_VALID'].join('.');
const allowedCdn = new Set(['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com']);

const browser = await chromium.launch({headless: true});
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({viewport: {width, height: 1000}, acceptDownloads: true});
    const page = await context.newPage();
    const errors = [], writes = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await context.routeWebSocket('**/*', (socket) => socket.close());
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname !== backend.hostname) {
        if (url.origin !== base.origin && !allowedCdn.has(url.hostname)) return route.abort();
        return route.continue();
      }
      const method = route.request().method();
      let data = [];
      if (url.pathname === '/auth/v1/user') data = user;
      else if (url.pathname.includes('/auth/v1/')) return route.fulfill({status: 401, contentType: 'application/json', body: '{}'});
      else if (url.pathname.endsWith('/rpc/is_portal_admin')) data = true;
      else if ((route.request().headers().accept || '').includes('vnd.pgrst.object')) data = null;
      else if (url.pathname.includes('/rpc/')) data = method === 'POST' ? 0 : [];
      if (['PATCH', 'DELETE', 'PUT'].includes(method) || (method === 'POST' && !url.pathname.includes('/rpc/'))) writes.push(`${method} ${url.pathname}`);
      return route.fulfill({status: 200, contentType: 'application/json', headers: {'access-control-allow-origin': '*', 'content-range': '*/0'}, body: JSON.stringify(data)});
    });
    await context.addInitScript(({key, value}) => { localStorage.setItem(key, value); localStorage.removeItem('cme.schedulePlanner.v1'); }, {key: `sb-${backend.hostname.split('.')[0]}-auth-token`, value: JSON.stringify({access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: expires, refresh_token: 'SYNTHETIC_INVALID', user})});

    await page.goto(new URL('/portal/admin/works-center/?view=complete', base).href);
    await page.getByText('Nenhum cronograma ainda', {exact: true}).waitFor({timeout: 45000});
    await page.getByRole('button', {name: 'Novo: Residência térrea (obra completa)', exact: true}).click();

    const name = page.getByLabel('Nome da obra / projeto', {exact: true}).locator('visible=true');
    await name.fill('Obra sintética do teste');
    await page.getByLabel('Cliente', {exact: true}).locator('visible=true').fill('Cliente sintético');

    // Avanço real na primeira atividade para alimentar SPI e Curva S realizada.
    await page.getByLabel('Avanço (%)', {exact: true}).locator('visible=true').first().fill('100');

    for (const text of ['Prazos e andamento', 'Gantt', 'Curva S', 'Desembolso mensal', 'Excel completo']) {
      await page.getByText(text, {exact: true}).first().waitFor();
    }
    for (const label of ['Término planejado', 'Término previsto no ritmo atual', 'Índice de prazo (SPI)', 'Custo total']) {
      assert.ok(await page.getByText(label, {exact: true}).count() > 0, `${width}px: indicador "${label}" visível`);
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false, `${width}px: sem rolagem horizontal`);
    await page.screenshot({path: `${outDir}/planner-${width}.png`, fullPage: true});

    const [download] = await Promise.all([
      page.waitForEvent('download', {timeout: 60000}),
      page.getByRole('button', {name: 'Gerar Excel (.xlsx)', exact: true}).click(),
    ]);
    const file = `${outDir}/planner-${width}.xlsx`;
    await download.saveAs(file);
    assert.match(download.suggestedFilename(), /^Cronograma-.*\.xlsx$/, 'Nome do arquivo');

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file);
    const sheets = wb.worksheets.map((ws) => ws.name);
    assert.deepEqual(sheets, ['Resumo', 'Cronograma', 'Gantt', 'Curva S', 'Desembolso mensal', 'Caminho crítico', 'Calendário'], 'Abas do Excel');
    const crono = wb.getWorksheet('Cronograma');
    let activities = 0, formulas = 0;
    crono.eachRow((row) => {
      const code = row.getCell(1).value, start = row.getCell(6).value;
      if (code != null && start instanceof Date) activities++;
      row.eachCell((cell) => { if (cell.formula || cell.value?.formula) formulas++; });
    });
    assert.ok(activities >= 10, `Cronograma com atividades (${activities})`);
    assert.ok(formulas > 0, 'Totais por fórmula');
    assert.ok(wb.getWorksheet('Resumo').getImages().length >= 2, 'Resumo com Curva S e desembolso em imagem');
    assert.ok(wb.getWorksheet('Gantt').getImages().length >= 1, 'Gantt em imagem');
    const resumoText = [];
    wb.getWorksheet('Resumo').eachRow((row) => row.eachCell((c) => resumoText.push(String(c.value?.richText ? c.value.richText.map((r) => r.text).join('') : c.value ?? ''))));
    assert.ok(resumoText.some((t) => t.includes('Obra sintética do teste')), 'Resumo traz o nome da obra');

    assert.deepEqual(errors, [], `${width}px: sem exceções no navegador`);
    assert.deepEqual(writes, [], `${width}px: o planejador não grava no banco`);
    await context.close();
    console.log(`PASS ${width}px: cronograma criado, indicadores e gráficos na tela, Excel ${download.suggestedFilename()} com ${sheets.length} abas e ${activities} atividades.`);
  }
} finally {
  await browser.close();
}
