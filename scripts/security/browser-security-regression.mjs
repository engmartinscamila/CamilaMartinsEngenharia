import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');

const critical = [
  'js/auth.js',
  'js/cliente-area.js',
  'js/document-acceptance-client.js',
  'js/redefinir-senha.js',
  'portal-app/src/app/login.tsx',
  'portal-app/src/app/forgot-password.tsx',
  'portal-app/src/app/reset-password.tsx',
];

for (const path of critical) {
  const source = read(path);
  assert.doesNotMatch(source, /\beval\s*\(/, path + ': eval não é permitido');
  assert.doesNotMatch(source, /\bnew\s+Function\s*\(/, path + ': Function dinâmica não é permitida');
  assert.doesNotMatch(source, /document\.write\s*\(/, path + ': document.write não é permitido');
  assert.doesNotMatch(source, /dangerouslySetInnerHTML/, path + ': React não deve injetar HTML bruto');
  assert.doesNotMatch(source, /javascript\s*:/i, path + ': URL javascript: não é permitida');
}

const clientArea = read('js/cliente-area.js');
assert.match(clientArea, /function escapar\(/, 'Área do cliente deve manter função de escape');
assert.doesNotMatch(clientArea, /mostrarErro\(error\.message/, 'Erro técnico não pode ser exibido ao cliente');

const acceptance = read('js/document-acceptance-client.js');
assert.match(acceptance, /const esc=v=>String/, 'Aceite documental deve manter escape explícito');
assert.doesNotMatch(acceptance, /alert\(error\.message/, 'Erro de RPC não pode ser exibido diretamente ao cliente');
assert.match(acceptance, /console\.error\('Falha ao registrar manifestação documental:'/, 'Detalhe técnico deve ficar somente no console');

const auth = read('js/auth.js');
assert.match(auth, /mensagem\.textContent = texto/, 'Mensagens de autenticação devem usar textContent');
assert.doesNotMatch(auth, /session\.user\.id !== window\.ADMIN_UID/, 'Autorização administrativa não pode depender do frontend');

console.log('PASS: superfícies críticas do cliente sem sinks executáveis e sem vazamento direto de mensagens internas.');
