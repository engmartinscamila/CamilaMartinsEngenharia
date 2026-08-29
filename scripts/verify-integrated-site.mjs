import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const root = resolve('dist');
const requiredFiles = [
  'index.html', 'contato.html', 'experiencias.html', 'galeria-projetos.html',
  'portfolio.html', 'pdf-protegido.html', 'login.html', 'redefinir-senha.html',
  'portal.html', 'meu-projeto.html', 'biblioteca-cliente.html',
  'documentos-cliente.html', 'fotos-cliente.html', 'agenda-cliente.html',
  'cronograma-cliente.html', 'solicitacoes-cliente.html', 'admin.html',
  'dashboard.html', 'clientes.html', 'projetos.html', 'documentos.html',
  'biblioteca.html', 'fotos.html', 'financeiro.html', 'agenda.html',
  'cronograma.html', 'solicitacoes.html', 'configuracoes.html',
  'css/admin-theme.css', 'css/portal-theme.css', 'css/documentos-lote.css',
  'js/documentos-lote.js', 'js/biblioteca-categorias.js',
  'js/dashboard-biblioteca-fix.js', 'robots.txt', 'sitemap.xml', '_headers',
  'portal/login/index.html', 'portal/home/index.html', 'portal/admin/index.html',
];

assert.ok(existsSync(root), 'A pasta dist não foi gerada.');
for (const file of requiredFiles) {
  assert.ok(existsSync(join(root, file)), `Arquivo obrigatório ausente: ${file}`);
}

for (const sourceOnly of ['portal-app', 'scripts', 'cloudflare', '.github', 'node_modules']) {
  assert.ok(!existsSync(join(root, sourceOnly)), `Pasta de código-fonte incluída no deploy: ${sourceOnly}`);
}

const indexHtml = readFileSync(join(root, 'index.html'), 'utf8');
const contactHtml = readFileSync(join(root, 'contato.html'), 'utf8');
const loginHtml = readFileSync(join(root, 'login.html'), 'utf8');
const adminHtml = readFileSync(join(root, 'admin.html'), 'utf8');
const documentsHtml = readFileSync(join(root, 'documentos.html'), 'utf8');

assert.match(indexHtml, /href=["']login\.html["']/i, 'A página inicial não aponta para o login clássico.');
assert.doesNotMatch(indexHtml, /href=["']\/portal\/login["']/i, 'A página inicial ainda aponta para o login Expo.');
assert.match(contactHtml, /href=["']login\.html["']/i, 'O cartão virtual não aponta para o login clássico.');
assert.doesNotMatch(contactHtml, /href=["']\/portal\/login["']/i, 'O cartão virtual ainda aponta para o login Expo.');
assert.match(loginHtml, /Primeiro acesso/i, 'Primeiro acesso foi removido do login.');
assert.match(loginHtml, /Esqueci minha senha/i, 'Recuperação de senha foi removida do login.');
assert.match(adminHtml, /class=["']assinatura["']/i, 'Assinatura visual do painel Admin ausente.');
assert.match(adminHtml, /admin-theme\.css/i, 'Tema clássico do painel Admin ausente.');
assert.match(documentsHtml, /value=["']automatico["']/i, 'Classificação automática não está disponível em Documentos.');
assert.match(documentsHtml, /multiple/i, 'Upload múltiplo de documentos não está disponível.');

const portalCompat = readFileSync(join(root, 'portal/admin/index.html'), 'utf8');
assert.match(portalCompat, /\.\.\/\.\.\/admin\.html/, 'Compatibilidade /portal/admin não retorna ao painel clássico.');

const forbiddenNames = [/^\.env(?:\.|$)/i, /ARQUIVO_ENV_LOCAL/i, /node_modules/i];
const forbiddenContent = [/sb_secret_[A-Za-z0-9_-]{16,}/i, /SUPABASE_SERVICE_ROLE_KEY\s*[:=]/i, /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/i];
const textExtensions = new Set(['.html', '.js', '.json', '.css', '.txt', '.xml', '']);
const maxCloudflareFileSize = 25 * 1024 * 1024;
const stack = [root];

const containsServiceRoleJwt = (content) => {
  for (const match of content.matchAll(/eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)) {
    try {
      const payload = JSON.parse(Buffer.from(match[1], 'base64url').toString('utf8'));
      if (payload?.role === 'service_role') return true;
    } catch {}
  }
  return false;
};

while (stack.length) {
  const directory = stack.pop();
  if (!directory) continue;
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    const info = statSync(path);
    if (info.isDirectory()) { stack.push(path); continue; }
    const deployedPath = relative(root, path);
    assert.ok(info.size <= maxCloudflareFileSize, `Arquivo excede 25 MiB: ${deployedPath}`);
    assert.ok(!forbiddenNames.some((pattern) => pattern.test(name)), `Arquivo local proibido no deploy: ${deployedPath}`);
    if (!textExtensions.has(extname(name))) continue;
    const content = readFileSync(path, 'utf8');
    assert.ok(!forbiddenContent.some((pattern) => pattern.test(content)), `Credencial administrativa detectada: ${deployedPath}`);
    assert.ok(!containsServiceRoleJwt(content), `JWT service_role detectado: ${deployedPath}`);
  }
}

process.stdout.write('APROVADO: publicação preserva o visual clássico e os recursos do portal.\n');
