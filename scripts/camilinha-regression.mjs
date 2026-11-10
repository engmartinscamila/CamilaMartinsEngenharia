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
console.info('Camilinha: CTAs, galeria, maquete 3D e acessibilidade OK.');
