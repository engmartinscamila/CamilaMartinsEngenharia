import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const checkOnly = process.argv.includes('--check');

function discoverImageSizeRoots() {
  const roots = new Set([resolve('node_modules/image-size')]);

  if (existsSync('package-lock.json')) {
    const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
    for (const packagePath of Object.keys(lock.packages ?? {})) {
      if (packagePath === 'node_modules/image-size' || packagePath.endsWith('/node_modules/image-size')) {
        roots.add(resolve(packagePath));
      }
    }
  }

  return [...roots].filter((root) => existsSync(resolve(root, 'package.json')));
}

const packageRoots = discoverImageSizeRoots();
if (packageRoots.length === 0) {
  throw new Error('Dependência image-size instalada, mas nenhuma raiz válida foi encontrada.');
}

function patchFile(filePath, original, replacement, marker, expectedReplacements = 1) {
  let content = readFileSync(filePath, 'utf8');

  if (content.includes(marker)) return false;
  if (checkOnly) throw new Error(`Correção de segurança ausente em ${filePath}.`);

  const occurrences = content.split(original).length - 1;
  if (occurrences !== expectedReplacements) {
    throw new Error(`Estrutura inesperada em ${filePath}; a correção não foi aplicada.`);
  }

  content = content.split(original).join(replacement);
  writeFileSync(filePath, content, 'utf8');
  return true;
}

const icnsOriginal = `        imageOffset += imageHeader[1];`;
const icnsReplacement = `        // CME-SECURITY: reject entries that cannot advance the parser.\n        const entryLength = imageHeader[1];\n        if (entryLength < SIZE_HEADER || imageOffset + entryLength > fileLength || imageOffset + entryLength > inputLength)\n            throw new TypeError('Invalid ICNS image entry length');\n        imageOffset += entryLength;`;

const jxlOriginal = `        offset = jxlpBox.offset + jxlpBox.size;`;
const jxlReplacement = `        // CME-SECURITY: a zero or undersized jxlp box would keep this loop at the same offset.\n        if (jxlpBox.size < 12)\n            throw new TypeError('Invalid JXL partial stream box size');\n        offset = jxlpBox.offset + jxlpBox.size;`;

let patched = 0;
let legacyInstallations = 0;
let modernInstallations = 0;

for (const packageRoot of packageRoots) {
  const typesRoot = resolve(packageRoot, 'dist/types');
  const icnsPath = resolve(typesRoot, 'icns.js');
  const jxlPath = resolve(typesRoot, 'jxl.js');
  const utilsPath = resolve(typesRoot, 'utils.js');

  const present = [icnsPath, jxlPath, utilsPath].map((filePath) => existsSync(filePath));

  if (present.every((value) => !value)) {
    modernInstallations += 1;
    continue;
  }

  if (!present.every(Boolean)) {
    throw new Error(`Estrutura parcial inesperada do image-size em ${packageRoot}.`);
  }

  legacyInstallations += 1;
  if (patchFile(icnsPath, icnsOriginal, icnsReplacement, 'CME-SECURITY: reject entries', 2)) patched += 1;
  if (patchFile(jxlPath, jxlOriginal, jxlReplacement, 'CME-SECURITY: a zero or undersized jxlp box', 1)) patched += 1;

  const utilsContent = readFileSync(utilsPath, 'utf8');
  if (!utilsContent.includes('offset += box.size > 0 ? box.size : 8;')) {
    throw new Error(`Correção de avanço seguro ausente em ${utilsPath}.`);
  }
}

if (legacyInstallations === 0) {
  process.stdout.write(`APROVADO: ${modernInstallations} instalação(ões) do image-size usam estrutura nova; patches legados não se aplicam.\n`);
} else if (checkOnly) {
  process.stdout.write(`APROVADO: correções locais presentes em ${legacyInstallations} instalação(ões) legadas do image-size.\n`);
} else if (patched > 0) {
  process.stdout.write(`APLICADO: ${patched} correção(ões) local(is) de segurança no image-size.\n`);
} else {
  process.stdout.write('APROVADO: correções locais do image-size já estavam aplicadas.\n');
}
