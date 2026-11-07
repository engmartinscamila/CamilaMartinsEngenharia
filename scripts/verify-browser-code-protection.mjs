import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// Este teste garante que os dois scripts legados continuem ofuscados no
// repositório público. Não transforma a ofuscação em proteção criptográfica.
const protectedScripts = [
  {file: 'js/clientes.js', signature: /^function cm_[a-zA-Z0-9_]+_0x[0-9a-f]+\(/},
  {file: 'js/portfolio-admin.js', signature: /^function a0_0x[0-9a-f]+\(/},
];

for (const {file, signature} of protectedScripts) {
  const code = fs.readFileSync(file, 'utf8');
  assert(code.length > 10_000, `${file}: arquivo inesperadamente curto; revisar antes de publicar`);
  assert(signature.test(code), `${file}: código ofuscado foi substituído por fonte legível ou desconhecida`);
  assert((code.match(/\n/g) ?? []).length <= 2,
    `${file}: formato publicado inesperadamente descompactado`);
  assert(code.includes('0x'), `${file}: não corresponde ao padrão atual de ofuscação`);
  assert(!/sourceMappingURL|sourceURL/.test(code), `${file}: referência a fonte original exposta`);
  execFileSync(process.execPath, ['--check', file], {stdio: 'pipe'});
}

// Evitar incluir cópias legíveis dos módulos no site/repositório público.
// Uma fonte privada deve ser armazenada FORA deste repositório.
for (const directory of ['js', 'assets']) {
  const entries = fs.readdirSync(directory);
  for (const name of entries) {
    assert(!/^(?:clientes|portfolio-admin)(?:[._-](?:source|original|unminified|deobfuscated|readable|map))\b/i.test(name),
      `Fonte não ofuscada encontrada em ${path.join(directory, name)}`);
  }
}
console.log('PASS: clientes e portfolio permanecem ofuscados e sem source maps públicos.');
