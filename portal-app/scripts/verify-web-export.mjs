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
  'home.html',
  'documents.html',
  'requests.html',
  '_headers',
  'robots.txt',
];

assert.ok(existsSync(outputRoot), 'A pasta dist não foi gerada.');
for (const file of requiredFiles) {
  assert.ok(existsSync(join(outputRoot, file)), `Arquivo obrigatório ausente no export web: ${file}`);
}

const forbiddenNames = [/^\.env(?:\.|$)/i, /ARQUIVO_ENV_LOCAL/i];
const forbiddenContent = [/sb_secret_[A-Za-z0-9_-]{16,}/i, /SUPABASE_SERVICE_ROLE_KEY\s*[:=]/i];
const textExtensions = new Set(['.html', '.js', '.json', '.css', '.txt', '']);
const stack = [outputRoot];

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

process.stdout.write('APROVADO: export web completo, identificado e sem credenciais administrativas.\n');
