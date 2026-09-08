import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

// Expo 57.0.21 removed image-size. Check the lockfile instead of resolving a
// package from an unrelated parent workspace or the machine's global modules.
const lockfile = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
if (!lockfile.packages) throw new Error('Lockfile inválido: dependências ausentes.');
if (!Object.keys(lockfile.packages).some((path) => /(^|\/)node_modules\/image-size$/.test(path))) {
  process.stdout.write('APROVADO: image-size e seus parsers vulneráveis não fazem parte das dependências do app.\n');
  process.exit(0);
}

const cases = [
  {
    name: 'ICNS com entrada de tamanho zero',
    code: `
      const imageSize = require('image-size');
      const input = Buffer.alloc(16);
      input.write('icns', 0, 'ascii');
      input.writeUInt32BE(16, 4);
      input.write('ic07', 8, 'ascii');
      input.writeUInt32BE(0, 12);
      try { imageSize(input); } catch {}
    `,
  },
  {
    name: 'JXL com caixa parcial de tamanho zero',
    code: `
      const imageSize = require('image-size');
      const input = Buffer.alloc(36);
      input.writeUInt32BE(12, 0);
      input.write('JXL ', 4, 'ascii');
      input.set([0x0d, 0x0a, 0x87, 0x0a], 8);
      input.writeUInt32BE(16, 12);
      input.write('ftyp', 16, 'ascii');
      input.write('jxl ', 20, 'ascii');
      input.writeUInt32BE(0, 28);
      input.write('jxlp', 32, 'ascii');
      try { imageSize(input); } catch {}
    `,
  },
  {
    name: 'HEIF/JXL com caixa genérica de tamanho zero',
    code: `
      const { findBox } = require('./node_modules/image-size/dist/types/utils.js');
      const input = Buffer.alloc(16);
      input.writeUInt32BE(0, 0);
      input.write('free', 4, 'ascii');
      findBox(input, 'meta', 0);
    `,
  },
];

for (const testCase of cases) {
  const result = spawnSync(process.execPath, ['-e', testCase.code], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 1500,
  });

  if (result.error?.code === 'ETIMEDOUT') {
    process.stderr.write(`REPROVADO: ${testCase.name} causou travamento.\n`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.stderr.write(`REPROVADO: ${testCase.name} falhou durante o teste.\n`);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(1);
  }
}

process.stdout.write('APROVADO: imagens ICNS, JXL e HEIF malformadas não travam o compilador.\n');
