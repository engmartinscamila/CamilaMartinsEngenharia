import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const root = resolve('dist');
const requiredFiles = [
  'index.html',
  'contato.html',
  'experiencias.html',
  'galeria-projetos.html',
  'portfolio.html',
  'pdf-protegido.html',
  'robots.txt',
  'sitemap.xml',
  '_headers',
  'portal/index.html',
  'portal/login.html',
  'portal/reset-password.html',
  'portal/home.html',
  'portal/project.html',
  'portal/library.html',
  'portal/documents.html',
  'portal/photos.html',
  'portal/agenda.html',
  'portal/schedule.html',
  'portal/requests.html',
  'portal/admin/index.html',
  'portal/admin/clients.html',
  'portal/admin/projects.html',
  'portal/admin/content.html',
  'portal/admin/financial.html',
  'portal/admin/agenda.html',
  'portal/admin/schedule.html',
  'portal/admin/requests.html',
  'portal/admin/security.html',
  'login.html',
  'portal.html',
  'admin.html',
];

assert.ok(existsSync(root), 'A pasta dist integrada não foi gerada.');
for (const file of requiredFiles) {
  assert.ok(existsSync(join(root, file)), `Arquivo obrigatório ausente: ${file}`);
}

for (const sourceOnly of ['portal-app', 'scripts', 'cloudflare', '.github', 'node_modules']) {
  assert.ok(!existsSync(join(root, sourceOnly)), `Pasta de código-fonte incluída no deploy: ${sourceOnly}`);
}

const publicPages = [
  'index.html',
  'contato.html',
  'experiencias.html',
  'galeria-projetos.html',
  'portfolio.html',
  'pdf-protegido.html',
];

for (const page of publicPages) {
  const html = readFileSync(join(root, page), 'utf8');
  for (const match of html.matchAll(/(?:href|src)=["']([^"']+)["']/gi)) {
    const raw = match[1];
    if (/^(?:https?:|mailto:|tel:|data:|javascript:|#)/i.test(raw)) continue;
    if (raw.startsWith('/portal')) continue;
    const clean = raw.split(/[?#]/, 1)[0];
    if (!clean) continue;
    const local = clean.startsWith('/') ? join(root, clean.slice(1)) : join(root, page, '..', clean);
    assert.ok(existsSync(local), `Referência local quebrada em ${page}: ${raw}`);
  }
}

const indexHtml = readFileSync(join(root, 'index.html'), 'utf8');
const contactHtml = readFileSync(join(root, 'contato.html'), 'utf8');
assert.ok(!/href=["']login\.html/i.test(indexHtml), 'O site público ainda aponta para o login antigo.');
assert.match(indexHtml, /href=["']\/portal\/login["']/i, 'Link novo da Área do Cliente ausente na página inicial.');
assert.match(contactHtml, /href=["']\/portal\/login["']/i, 'Link novo da Área do Cliente ausente no cartão virtual.');

const redirects = {
  'login.html': '/portal/login',
  'portal.html': '/portal/home',
  'admin.html': '/portal/admin',
  'redefinir-senha.html': '/portal/reset-password',
};
for (const [file, target] of Object.entries(redirects)) {
  assert.ok(readFileSync(join(root, file), 'utf8').includes(target), `Compatibilidade incorreta em ${file}.`);
}

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
    } catch {
      // Texto semelhante a JWT, mas inválido: não é uma credencial utilizável.
    }
  }
  return false;
};

while (stack.length) {
  const directory = stack.pop();
  if (!directory) continue;
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    const info = statSync(path);
    if (info.isDirectory()) {
      stack.push(path);
      continue;
    }

    const deployedPath = relative(root, path);
    assert.ok(info.size <= maxCloudflareFileSize, `Arquivo excede 25 MiB: ${deployedPath}`);
    assert.ok(!forbiddenNames.some((pattern) => pattern.test(name)), `Arquivo local proibido no deploy: ${deployedPath}`);
    if (!textExtensions.has(extname(name))) continue;
    const content = readFileSync(path, 'utf8');
    assert.ok(!forbiddenContent.some((pattern) => pattern.test(content)), `Credencial administrativa detectada: ${deployedPath}`);
    assert.ok(!containsServiceRoleJwt(content), `JWT service_role detectado: ${deployedPath}`);
  }
}

const robots = readFileSync(join(root, 'robots.txt'), 'utf8');
assert.match(robots, /Disallow:\s*\/portal\//i, 'robots.txt não bloqueia a indexação do portal.');
const headers = readFileSync(join(root, '_headers'), 'utf8');
assert.match(headers, /\/portal\/\*/i, 'Cabeçalhos restritos do portal ausentes.');

process.stdout.write('APROVADO: site público e portal integrado prontos para o diretório dist do Cloudflare.\n');
