import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

// Expo 57.0.21 removed image-size. Check the lockfile instead of resolving a
// package from an unrelated parent workspace or the machine's global modules.
const lockfile = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
if (!lockfile.packages) throw new Error('Lockfile inválido: dependências ausentes.');
if (!Object.keys(lockfile.packages).some((path) => /(^|\/)node_modules\/image-size$/.test(path))) {
  process.stdout.write('APROVADO: image-size e seus parsers vulneráveis não fazem parte das dependências do app.\n');
  process.exit(0);
}

const checkOnly = process.argv.includes('--check');
const packageRoot = resolve('node_modules/image-size/dist/types');

function patchFile(relativePath, original, replacement, marker, expectedReplacements = 1) {
  const filePath = resolve(packageRoot, relativePath);
  let content = readFileSync(filePath, 'utf8');

  if (content.includes(marker)) return false;
  if (checkOnly) throw new Error(`Correção de segurança ausente em ${relativePath}.`);

  const occurrences = content.split(original).length - 1;
  if (occurrences !== expectedReplacements) {
    throw new Error(`Estrutura inesperada em ${relativePath}; a correção não foi aplicada.`);
  }

  content = content.split(original).join(replacement);
  writeFileSync(filePath, content, 'utf8');
  return true;
}

const icnsOriginal = `        imageOffset += imageHeader[1];`;
const icnsReplacement = `        // CME-SECURITY: reject entries that cannot advance the parser.\n        const entryLength = imageHeader[1];\n        if (entryLength < SIZE_HEADER || imageOffset + entryLength > fileLength || imageOffset + entryLength > inputLength)\n            throw new TypeError('Invalid ICNS image entry length');\n        imageOffset += entryLength;`;

const jxlOriginal = `        offset = jxlpBox.offset + jxlpBox.size;`;
const jxlReplacement = `        // CME-SECURITY: a zero or undersized jxlp box would keep this loop at the same offset.\n        if (jxlpBox.size < 12)\n            throw new TypeError('Invalid JXL partial stream box size');\n        offset = jxlpBox.offset + jxlpBox.size;`;

const changes = [
  patchFile('icns.js', icnsOriginal, icnsReplacement, 'CME-SECURITY: reject entries', 2),
  patchFile('jxl.js', jxlOriginal, jxlReplacement, 'CME-SECURITY: a zero or undersized jxlp box', 1),
];

const utilsPath = resolve(packageRoot, 'utils.js');
const utilsContent = readFileSync(utilsPath, 'utf8');
if (!utilsContent.includes('offset += box.size > 0 ? box.size : 8;')) {
  throw new Error('Correção de avanço seguro ausente no parser HEIF/JXL.');
}

if (checkOnly) {
  process.stdout.write('APROVADO: correções locais do image-size estão presentes.\n');
} else if (changes.some(Boolean)) {
  process.stdout.write('APLICADO: parsers ICNS, JXL e HEIF protegidos contra laços infinitos.\n');
} else {
  process.stdout.write('APROVADO: correções locais do image-size já estavam aplicadas.\n');
}
