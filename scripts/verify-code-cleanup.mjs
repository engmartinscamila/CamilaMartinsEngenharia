import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const removed = [
  'css/contato.css',
  'css/dashboard.css',
  'css/financeiro-avancado.css',
  'css/portfolio-3d.css',
  'css/solicitacoes.css',
  'js/contato.js',
  'js/admin-guard.js',
  'js/admin-name-fix.js',
  'js/admin-dashboard-fix.js',
  'js/admin-ui-resilience.js',
  'js/biblioteca.js',
  'js/casa-urben-capa-movimento-v1.js',
  'js/casa-urben-v17-galeria.js',
  'js/dashboard.js',
  'js/financeiro-avancado.js',
  'js/financeiro.js',
  'js/fotos-lote.js',
  'js/portfolio-3d.js',
  'js/portfolio-live3d.js',
  'js/portfolio-motion-v1.js',
  'js/storage.js',
  'scripts/build-frases-do-dia-fast.mjs',
  'scripts/build-frases-do-dia.mjs',
];
const removedPaths = new Set(removed);

for (const file of removed) assert.equal(fs.existsSync(path.join(root, file)), false,
  `O arquivo obsoleto ${file} não pode voltar a ser distribuído sem justificativa funcional.`);

// Static page references must not point to removed JS/CSS.
const htmlFiles = fs.readdirSync(root).filter(file => file.endsWith('.html'));
for (const html of htmlFiles) {
  const source = fs.readFileSync(path.join(root, html), 'utf8');
  for (const tag of source.match(/<(?:script|link)\b[^>]*>/gi) ?? []) {
    const raw = tag.match(/\b(?:href|src)\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!raw || /^[a-z]+:\/\//i.test(raw)) continue;
    const assetPath = raw.replace(/^\//, '').split(/[?#]/)[0];
    assert(!removedPaths.has(assetPath), `${html} referencia código excluído: ${assetPath}`);
  }
}

// Keep compatibility routes and the interactive 3D implementation that are actually used.
const required = {
  'admin.html': ['js/admin.js', 'js/auth.js'],
  'financeiro.html': ['js/financial-route.js'],
  'biblioteca.html': ['js/library-route.js'],
  'fotos.html': ['js/fotos.js', 'js/project-files.js'],
  'index.html': ['portfolio-live3d-inline-v17', 'css/portfolio-live3d.css'],
};
for (const [html, markers] of Object.entries(required)) {
  const source = fs.readFileSync(path.join(root, html), 'utf8');
  for (const marker of markers) {
    assert(source.includes(marker), `Funcionalidade preservada ausente: ${html} / ${marker}`);
    if (marker.startsWith('js/') || marker.startsWith('css/')) {
      assert(fs.existsSync(path.join(root, marker)), `Recurso crítico removido: ${marker}`);
    }
  }
}
assert(fs.existsSync(path.join(root, 'supabase/functions/generate-contract-document/index.ts')));
assert(fs.existsSync(path.join(root, 'portal-app/src/lib/financial-model.ts')));
console.log(`PASS: ${removed.length} arquivos comprovadamente sem execução retirados; rotas, modelos 3D e controladores essenciais preservados.`);
