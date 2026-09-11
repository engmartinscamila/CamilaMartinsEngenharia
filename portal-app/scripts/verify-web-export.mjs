import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const outputRoot = resolve('dist');
const requiredFiles = [
  'index.html',
  'login.html',
  'first-access.html',
  'forgot-password.html',
  'reset-password.html',
  'legal-acceptance.html',
  'terms-of-use.html',
  'privacy-policy.html',
  'admin/index.html',
  'admin/crm.html',
  'admin/construction-schedule.html',
  'admin/requests.html',
  'admin/notifications.html',
  'admin/security.html',
  'admin/system-health.html',
  'home.html',
  'documents.html',
  'requests.html',
  '_headers',
  'robots.txt',
];

assert.ok(existsSync(outputRoot), 'A pasta dist não foi gerada.');
for (const file of requiredFiles) assert.ok(existsSync(join(outputRoot, file)), `Arquivo obrigatório ausente no export web: ${file}`);

const forbiddenNames = [/^\.env(?:\.|$)/i, /ARQUIVO_ENV_LOCAL/i];
const forbiddenContent = [/sb_secret_[A-Za-z0-9_-]{16,}/i, /SUPABASE_SERVICE_ROLE_KEY\s*[:=]/i];
const textExtensions = new Set(['.html', '.js', '.json', '.css', '.txt', '']);
const stack = [outputRoot];
const containsServiceRoleJwt = (content) => {
  for (const match of content.matchAll(/eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)) {
    try { const payload = JSON.parse(Buffer.from(match[1], 'base64url').toString('utf8')); if (payload?.role === 'service_role') return true; } catch {}
  }
  return false;
};
while (stack.length) {
  const directory = stack.pop(); if (!directory) continue;
  for (const name of readdirSync(directory)) {
    const path = join(directory, name); const info = statSync(path);
    if (info.isDirectory()) { stack.push(path); continue; }
    const exportedPath = relative(outputRoot, path);
    assert.ok(!forbiddenNames.some((pattern) => pattern.test(name)), `Arquivo local proibido no export: ${exportedPath}`);
    if (!textExtensions.has(extname(name))) continue;
    const content = readFileSync(path, 'utf8');
    assert.ok(!forbiddenContent.some((pattern) => pattern.test(content)), `Credencial administrativa detectada no export: ${exportedPath}`);
    assert.ok(!containsServiceRoleJwt(content), `JWT service_role detectado no export: ${exportedPath}`);
  }
}

const indexHtml = readFileSync(join(outputRoot, 'index.html'), 'utf8');
assert.match(indexHtml, /<html[^>]+lang="pt-BR"/i, 'Idioma pt-BR ausente no HTML exportado.');
assert.match(indexHtml, /<title>Portal do Cliente \| Camila Martins Engenharia<\/title>/i, 'Título institucional ausente no HTML exportado.');

const navigationSource = readFileSync(resolve('src/lib/admin-navigation.ts'), 'utf8');
const sectionSource = readFileSync(resolve('src/lib/admin-sections.ts'), 'utf8');
const routePairs = [...navigationSource.matchAll(/^\s*(?:'([^']+)'|([a-z][a-z-]*)):\s*'([^']+)'/gm)];
const webRoutes = new Map(routePairs.map((match) => [match[1] || match[2], match[3]]));
const sectionKeys = [...sectionSource.matchAll(/\{\s*key:\s*'([^']+)'/g)].map((match) => match[1]);
assert.ok(sectionKeys.length >= 20, 'A lista de áreas administrativas parece incompleta.');
for (const key of sectionKeys) assert.ok(webRoutes.has(key), `A área administrativa ${key} não possui destino web explícito.`);
for (const [key, destination] of webRoutes.entries()) {
  if (!destination.startsWith('/portal/admin/')) continue;
  assert.ok(destination.endsWith('.html'), `Destino publicado de ${key} precisa apontar para arquivo HTML real: ${destination}`);
  const exported = destination.replace(/^\/portal\//, '');
  assert.ok(existsSync(join(outputRoot, exported)), `Destino publicado de ${key} não existe no export: ${exported}`);
}
for (const [key, destination] of [
  ['crm', '/portal/admin/crm.html'],
  ['construction-schedule', '/portal/admin/construction-schedule.html'],
  ['notifications', '/portal/admin/notifications.html'],
  ['security', '/portal/admin/security.html'],
]) assert.equal(webRoutes.get(key), destination, `Destino web ausente/incorreto para ${key}.`);
assert.equal(webRoutes.get('system-health'), '/integridade-sistema.html', 'Destino web incorreto para Verificar funcionamento.');
assert.equal(webRoutes.get('requests'), '/solicitacoes.html', 'Destino web incorreto para Solicitações.');

const adminUiSource = readFileSync(resolve('src/components/admin-ui.tsx'), 'utf8');
assert.ok(adminUiSource.includes("openWebsiteAdminSection('notifications')"), 'O sino de notificações não usa o roteamento seguro do site integrado.');
assert.ok(adminUiSource.includes('adminSections.map((section)'), 'O menu de outras áreas precisa preservar a ordem fixa da lista administrativa.');
assert.ok(!adminUiSource.includes('adminSections.filter('), 'O menu administrativo não pode remover a área atual e mudar a ordem visual dos botões.');

const dashboardSource = readFileSync(resolve('src/app/admin/index.tsx'), 'utf8');
assert.ok(dashboardSource.includes('openWebsiteAdminSection(section.key)'), 'Os botões do dashboard não usam o roteamento seguro do site integrado.');
assert.ok(dashboardSource.includes("openWebsiteAdminSection('contract-documents')"), 'Atalho de pendências contratuais não usa o roteamento seguro.');
assert.ok(dashboardSource.includes("openWebsiteAdminSection('document-archive')"), 'Atalho de arquivo documental não usa o roteamento seguro.');
assert.ok(dashboardSource.includes('openWebsiteAdminSection(metric.key)'), 'Os indicadores do dashboard não usam o roteamento seguro.');

const crmSource = readFileSync(resolve('src/app/admin/crm.tsx'), 'utf8');
assert.ok(crmSource.includes('detailBlock'), 'O CRM precisa manter campos comerciais em blocos próprios para evitar sobreposição visual.');
assert.ok(crmSource.includes('flexShrink: 1'), 'O CRM precisa permitir quebra e encolhimento seguro de textos longos.');

const scheduleSource = readFileSync(resolve('src/app/admin/construction-schedule.tsx'), 'utf8');
for (const token of ['Gerar Excel completo', 'Adicionar atividade específica', 'Peso (%)', 'Avanço real (%)', 'Custo previsto (R$)', 'Custo real (R$)']) assert.ok(scheduleSource.includes(token), `Cronograma completo sem recurso obrigatório: ${token}`);
const scheduleService = readFileSync(resolve('src/services/construction-schedule-service.ts'), 'utf8');
assert.ok(scheduleService.includes("generate-construction-schedule-xlsx"), 'Cronograma completo sem integração com exportador Excel.');
assert.ok(scheduleService.includes('admin_initialize_construction_schedule'), 'Cronograma completo sem inicialização automática do modelo padrão.');

process.stdout.write('APROVADO: export web completo, destinos Admin apontam para HTML publicado, ordem estável, CRM protegido e Cronograma de Obra Completo exportável.\n');
