import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const errors = [];
const fail = (message) => errors.push(message);
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

const htmlFiles = fs.readdirSync(ROOT).filter((name) => name.endsWith('.html'));
for (const file of htmlFiles) {
  const html = read(file);
  if (html.includes('menu-lateral') && !html.includes('js/ui-core.js')) {
    fail(`${file}: possui menu administrativo, mas não carrega js/ui-core.js; a ordem pode divergir entre páginas.`);
  }
}

const uiCore = read('js/ui-core.js');
if (!uiCore.includes('MENU_ADMIN_CANONICO')) fail('ui-core.js: menu administrativo não possui lista canônica.');
if (!uiCore.includes('menu.replaceChildren(fragment)')) fail('ui-core.js: menu clássico não é reconstruído em ordem fixa.');
if (!uiCore.includes('menu.dataset.cmeOrdemFixa="true"')) fail('ui-core.js: marcador de ordem fixa ausente.');
const canonicalBlock = uiCore.match(/const MENU_ADMIN_CANONICO=\[([\s\S]*?)\];/i)?.[1] ?? '';
const canonicalRoutes = [...canonicalBlock.matchAll(/\["([^"]+)","[^"]+","([^"]+)"\]/g)].map((match) => ({ href: match[1], title: match[2] }));
if (canonicalRoutes.length < 25) fail(`ui-core.js: menu canônico incompleto (${canonicalRoutes.length} itens).`);
const hrefs = canonicalRoutes.map((item) => item.href);
if (new Set(hrefs).size !== hrefs.length) fail('ui-core.js: há destinos duplicados no menu canônico.');
for (const item of canonicalRoutes) {
  if (item.href.startsWith('portal/admin/')) {
    const slug = item.href.slice('portal/admin/'.length);
    const source = slug === '' ? 'portal-app/src/app/admin/index.tsx' : `portal-app/src/app/admin/${slug}.tsx`;
    if (!exists(source)) fail(`Menu "${item.title}": rota ${item.href} não possui tela fonte ${source}.`);
  } else if (!exists(item.href)) {
    fail(`Menu "${item.title}": arquivo clássico ausente ${item.href}.`);
  }
}

const sections = read('portal-app/src/lib/admin-sections.ts');
const navigation = read('portal-app/src/lib/admin-navigation.ts');
const sectionKeys = [...sections.matchAll(/\{\s*key:\s*'([^']+)'/g)].map((match) => match[1]);
const navigationKeys = new Set([...navigation.matchAll(/^\s*(?:'([^']+)'|([a-z][a-z-]*)):\s*'([^']+)'/gm)].map((match) => match[1] || match[2]));
for (const key of sectionKeys) if (!navigationKeys.has(key)) fail(`Admin React: seção ${key} não possui destino web explícito.`);
if (!sections.includes("key: 'construction-schedule'")) fail('Admin React: Cronograma de obra completo não está no menu.');
if (!navigation.includes("'construction-schedule': '/portal/admin/construction-schedule'")) fail('Admin React: rota web do Cronograma de obra completo está incorreta.');

const adminUi = read('portal-app/src/components/admin-ui.tsx');
if (adminUi.includes('adminSections.filter(')) fail('Admin React: menu ainda remove a seção atual e muda a ordem dos botões.');
if (!adminUi.includes('adminSections.map((section)')) fail('Admin React: menu não preserva a ordem fixa definida em adminSections.');

const dashboard = read('portal-app/src/app/admin/index.tsx');
if (!dashboard.includes('openWebsiteAdminSection(section.key)')) fail('Dashboard React: botões não passam pelo roteamento web seguro.');
if (!dashboard.includes('openWebsiteAdminSection(metric.key)')) fail('Dashboard React: indicadores não passam pelo roteamento web seguro.');

const crm = read('portal-app/src/app/admin/crm.tsx');
for (const token of ['detailBlock', 'flexShrink: 1', 'compactContact', 'compactLocation', 'compactServices']) {
  if (!crm.includes(token)) fail(`Oportunidades comerciais: proteção de layout ausente (${token}).`);
}

const health = read('integridade-sistema.html');
if (/health-card[^}]*background:var\(--card-bg,#fff\)/.test(health)) fail('Integridade do sistema: permanece fallback branco incompatível com texto do tema escuro.');
for (const token of ['background:var(--painel', 'color:var(--texto', 'color:var(--texto-claro']) if (!health.includes(token)) fail(`Integridade do sistema: token de contraste ausente (${token}).`);

for (const required of [
  'portal-app/src/app/admin/construction-schedule.tsx',
  'portal-app/src/services/construction-schedule-service.ts',
  'portal-app/supabase/functions/generate-construction-schedule-xlsx/index.ts',
  'portal-app/supabase/migrations/20260910231500_construction_schedule_professional.sql',
]) if (!exists(required)) fail(`Cronograma completo: arquivo obrigatório ausente ${required}.`);

const constructionScreen = read('portal-app/src/app/admin/construction-schedule.tsx');
for (const token of ['Gerar Excel completo', 'Adicionar atividade específica', 'Peso (%)', 'Avanço real (%)', 'Custo previsto (R$)', 'Custo real (R$)']) if (!constructionScreen.includes(token)) fail(`Cronograma completo: recurso obrigatório ausente (${token}).`);

const constructionService = read('portal-app/src/services/construction-schedule-service.ts');
for (const token of ['admin_initialize_construction_schedule', 'generate-construction-schedule-xlsx', 'downloadBase64File']) if (!constructionService.includes(token)) fail(`Cronograma completo: integração ausente (${token}).`);

if (errors.length) {
  console.error('\nERROS FUNCIONAIS DO ADMIN:');
  errors.forEach((error, index) => console.error(`${index + 1}. ${error}`));
  process.exit(1);
}
console.log(`AUDITORIA FUNCIONAL DO ADMIN APROVADA: ${canonicalRoutes.length} itens de menu, ${sectionKeys.length} áreas React e ${htmlFiles.length} páginas HTML verificadas.`);
