import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('site-public');
const version = String(process.argv[2] ?? '').trim();
if (!version) throw new Error('BUILD_VERSION ausente.');

const htmlFiles = fs.readdirSync(root).filter((name) => name.endsWith('.html'));
const assetPattern = /\b(src|href)=(['"])((?:js|css)\/[^'"?#]+)(?:\?v=[^'"#]*)?\2/g;

for (const name of htmlFiles) {
  const file = path.join(root, name);
  const input = fs.readFileSync(file, 'utf8');
  const output = input.replace(assetPattern, (_match, attr, quote, asset) => `${attr}=${quote}${asset}?v=${encodeURIComponent(version)}${quote}`);
  fs.writeFileSync(file, output);
}

// Carregadores dinâmicos dentro do JS ('js/x.js?v=...' fixos no código) também recebem a versão do build.
const jsRoot = path.join(root, 'js');
const literalPattern = /(['"`])((?:\.?\/)?(?:js|css)\/[A-Za-z0-9_.\/-]+\.(?:js|css))\?v=[A-Za-z0-9_.-]+\1/g;
let jsTouched = 0;
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(file); continue; }
    if (!entry.name.endsWith('.js')) continue;
    const input = fs.readFileSync(file, 'utf8');
    const output = input.replace(literalPattern, (_m, q, asset) => `${q}${asset}?v=${encodeURIComponent(version)}${q}`);
    if (output !== input) { fs.writeFileSync(file, output); jsTouched += 1; }
  }
};
if (fs.existsSync(jsRoot)) walk(jsRoot);

console.log(`Cache-busting automático aplicado a ${htmlFiles.length} página(s) e ${jsTouched} script(s) com build ${version}.`);
