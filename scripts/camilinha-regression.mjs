import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const index = read('index.html');
const gallery = read('galeria-projetos.html');
const css = read('css/camilinha.css');
const galleryJs = read('js/galeria-projetos.js');
const workJs = read('js/camilinha-work.js');
const atlas = readFileSync(new URL('../assets/camilinha/work-atlas.png', import.meta.url));
assert.equal(atlas.toString('hex', 0, 8), '89504e470d0a1a0a', 'PNG válido');
assert.equal(atlas.readUInt32BE(16), 768, 'Atlas deve ter 8 colunas de 96 px');
assert.equal(atlas.readUInt32BE(20), 1144, 'Atlas deve ter 11 linhas de 104 px');
assert.equal(createHash('sha256').update(atlas).digest('hex'),
  'b0bb5830ab2991cb8c4697ca3aadb15a30ddafccf640fd1bb433bdd9823e9df9',
  'Atlas precisa vir das animações originais do Work');

for (const asset of ['aceno.webp', 'planta.webp']) {
  const path = new URL('../assets/camilinha/' + asset, import.meta.url);
  assert.ok(statSync(path).size > 100, asset + ' precisa estar presente');
}

assert.match(index, /class="btn primary camilinha-orcamento"/, 'CTA principal preservada');
assert.match(index, /class="camilinha-orcamento" href="https:\/\/wa\.me\//, 'CTA de contato preservada');
assert.match(gallery, /gallery-budget camilinha-orcamento/, 'CTA da galeria');
assert.match(galleryJs, /}, 500\);/, 'Galeria usa atraso de 500 ms');
assert.match(index, /camilinha-3d-carregando/, 'Maquete 3D usa animação de espera');
assert.match(index, /requestId !== openRequestId/, 'Carregamentos obsoletos descartados');
assert.match(index, /dialog\.addEventListener\('close'/, 'Fechamento libera animação');
assert.match(css, /prefers-reduced-motion: reduce/, 'Redução de movimento respeitada');
assert.match(css, /work-atlas\.png/, 'CSS usa folha original do Work');
const states = ['idle', 'running-right', 'running-left', 'waving', 'jumping', 'failed', 'waiting', 'running', 'review'];
for (const state of states) {
  assert.ok(css.includes('[data-state="' + state + '"]'), 'Estado original ' + state + ' disponível');
  assert.ok(workJs.includes("'" + state + "'"), 'API da Camilinha reconhece ' + state);
}
assert.match(index, /js\/camilinha-work\.js/, 'Home carrega API da mascote');
assert.match(gallery, /js\/camilinha-work\.js/, 'Galeria carrega API da mascote');
assert.match(index, /camilinha-3d-erro/, 'Maquete 3D reage a erro sem ocultá-lo');

const script = index.match(/<script id="portfolio-live3d-inline-v17">([\s\S]*?)<\/script>/);
assert.ok(script, 'Script de maquetes 3D presente');
assert.doesNotThrow(() => new Function(script[1]), 'Script de maquetes 3D deve ser sintaticamente válido');
const classicClient = read('js/camilinha-client-classic.js');
const hardening = read('scripts/harden-public-html.mjs');
assert.match(hardening, /camilinhaClassicPages/, 'Publicação cobre o portal clássico');
for (const name of ['portal.html', 'meu-projeto.html', 'biblioteca-cliente.html', 'documentos-cliente.html',
  'fotos-cliente.html', 'agenda-cliente.html', 'cronograma-cliente.html', 'solicitacoes-cliente.html']) {
  assert.ok(hardening.includes("'" + name + "'"), 'Página protegida vinculada: ' + name);
}
assert.ok(hardening.includes('js/camilinha-client-classic.js'), 'Módulo clássico na publicação');
assert.ok(hardening.includes('css/camilinha.css'), 'Estilos do atlas no portal clássico');
assert.match(classicClient, /MutationObserver/, 'Observa carregamentos assíncronos sem interceptar fetch');
assert.match(classicClient, /delay = 500/, 'Evita mascote em carregamento rápido');
assert.match(classicClient, /CamilinhaWork/, 'Reutiliza os nove estados do atlas original');
assert.doesNotThrow(() => new Function(classicClient), 'JS do cliente clássico sem erro de sintaxe');
const cursor = read('js/camilinha-cursor.js');
const guard = read('js/admin-form-guard.js');
assert.match(cursor, /pointer-events:none/, 'Camilinha do cursor não pode bloquear cliques');
assert.match(cursor, /prefers-reduced-motion/, 'Camilinha do cursor respeita redução de movimento');
assert.match(cursor, /\(hover: hover\) and \(pointer: fine\)/, 'Camilinha do cursor só com mouse');
assert.match(cursor, /\/portal\/admin/, 'No portal React, só nas rotas do admin');
assert.match(guard, /camilinha-cursor\.js/, 'Páginas clássicas do admin carregam a Camilinha do cursor');
for (const page of ['portal.html', 'meu-projeto.html', 'index.html', 'login.html']) {
  assert.doesNotMatch(read(page), /admin-form-guard|camilinha-cursor/, 'Cursor da Camilinha fora do admin: ' + page);
}
console.info('Camilinha: site público, área do cliente clássica e API original OK.');
