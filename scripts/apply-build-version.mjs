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

console.log(`Cache-busting automático aplicado a ${htmlFiles.length} página(s) com build ${version}.`);
