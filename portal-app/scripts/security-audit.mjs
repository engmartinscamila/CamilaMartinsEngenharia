import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const auditProcess = process.platform === 'win32'
  ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm.cmd audit --json'], {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    })
  : spawnSync('npm', ['audit', '--json'], {
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024,
  });

if (!auditProcess.stdout?.trim()) {
  process.stderr.write('ERRO: o npm não devolveu o relatório de segurança.\n');
  if (auditProcess.stderr) process.stderr.write(auditProcess.stderr);
  process.exit(1);
}

let report;
try {
  report = JSON.parse(auditProcess.stdout);
} catch {
  process.stderr.write('ERRO: o relatório de segurança do npm não pôde ser interpretado.\n');
  process.exit(1);
}

const allowedAdvisories = new Set([
  'https://github.com/advisories/GHSA-w3rx-r6r6-pgpr',
  'https://github.com/advisories/GHSA-5p2g-fcmc-qvqq',
]);
const advisories = [];

for (const vulnerability of Object.values(report.vulnerabilities ?? {})) {
  for (const source of vulnerability.via ?? []) {
    if (typeof source === 'object' && source?.url) advisories.push(source);
  }
}

const unknownAdvisories = advisories.filter((advisory) => !allowedAdvisories.has(advisory.url));
const critical = report.metadata?.vulnerabilities?.critical ?? 0;
const packageManifest = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
const imageSizeIsDirect = Boolean(
  packageManifest.dependencies?.['image-size']
  || packageManifest.devDependencies?.['image-size'],
);
const icnsPatched = readFileSync(resolve('node_modules/image-size/dist/types/icns.js'), 'utf8')
  .includes('CME-SECURITY: reject entries');
const jxlPatched = readFileSync(resolve('node_modules/image-size/dist/types/jxl.js'), 'utf8')
  .includes('CME-SECURITY: a zero or undersized jxlp box');
const boxParserPatched = readFileSync(resolve('node_modules/image-size/dist/types/utils.js'), 'utf8')
  .includes('offset += box.size > 0 ? box.size : 8;');

if (critical > 0 || unknownAdvisories.length > 0 || imageSizeIsDirect || !icnsPatched || !jxlPatched || !boxParserPatched) {
  process.stderr.write('REPROVADO: foi encontrada uma vulnerabilidade nova, crítica ou fora da ressalva controlada.\n');
  for (const advisory of unknownAdvisories) {
    process.stderr.write(`- ${advisory.severity}: ${advisory.title} (${advisory.url})\n`);
  }
  process.exit(1);
}

if (advisories.length === 0) {
  process.stdout.write('APROVADO: nenhuma vulnerabilidade conhecida foi encontrada.\n');
  process.exit(0);
}

process.stdout.write('APROVADO COM RESSALVA CONTROLADA: 0 vulnerabilidades críticas.\n');
process.stdout.write('O alerta upstream de image-size ainda aparece porque não existe uma nova versão publicada.\n');
process.stdout.write('Os parsers vulneráveis foram corrigidos localmente e a correção é reaplicada após cada instalação.\n');
