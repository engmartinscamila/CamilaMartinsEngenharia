import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

function run(name, code) {
  const result = spawnSync(process.execPath, ['-e', code], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 1500,
  });

  if (result.error?.code === 'ETIMEDOUT') {
    process.stderr.write(`REPROVADO: ${name} causou travamento.\n`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.stderr.write(`REPROVADO: ${name} falhou durante o teste.\n`);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(1);
  }
}

const prelude = `
  const mod = require('image-size');
  const imageSize =
    typeof mod === 'function' ? mod :
    typeof mod.imageSize === 'function' ? mod.imageSize :
    typeof mod.default === 'function' ? mod.default : null;
  if (!imageSize) throw new Error('API image-size indisponível');
`;

run('ICNS com entrada de tamanho zero', `
  ${prelude}
  const input = Buffer.alloc(16);
  input.write('icns', 0, 'ascii');
  input.writeUInt32BE(16, 4);
  input.write('ic07', 8, 'ascii');
  input.writeUInt32BE(0, 12);
  try { imageSize(input); } catch {}
`);

run('JXL com caixa parcial de tamanho zero', `
  ${prelude}
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
`);

const legacyUtils = resolve('node_modules/image-size/dist/types/utils.js');
if (existsSync(legacyUtils)) {
  run('HEIF/JXL com caixa genérica de tamanho zero', `
    const { findBox } = require(${JSON.stringify(legacyUtils)});
    const input = Buffer.alloc(16);
    input.writeUInt32BE(0, 0);
    input.write('free', 4, 'ascii');
    findBox(input, 'meta', 0);
  `);
}

process.stdout.write('APROVADO: entradas ICNS/JXL malformadas não travam o compilador.\n');
