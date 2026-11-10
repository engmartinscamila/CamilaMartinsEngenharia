import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const index = read('index.html');
const gallery = read('galeria-projetos.html');
const css = read('css/camilinha.css');
const galleryJs = read('js/galeria-projetos.js');

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

const script = index.match(/<script id="portfolio-live3d-inline-v17">([\s\S]*?)<\/script>/);
assert.ok(script, 'Script de maquetes 3D presente');
assert.doesNotThrow(() => new Function(script[1]), 'Script de maquetes 3D deve ser sintaticamente válido');
console.info('Camilinha: CTAs, galeria, maquete 3D e acessibilidade OK.');
