import { verifyDeepmergePatch } from './deepmerge-security.mjs';
import { spawnSync } from 'node:child_process';
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

// A narrowly scoped remediation: the upstream package has no patched release.
// Accept ONLY this advisory after verifying the installed source and executing
// exploit regressions. Every other direct or transitive advisory still fails.
const patch = verifyDeepmergePatch();
const findings = report.vulnerabilities ?? {};
function remediated(name, visiting = new Set()) {
  if (visiting.has(name)) return false;
  const finding = findings[name];
  if (!finding?.via?.length) return false;
  const next = new Set(visiting).add(name);
  return finding.via.every(via => typeof via === 'string'
    ? remediated(via, next)
    : name === 'deepmerge' && via.url === patch.advisory);
}
const unresolved = Object.entries(findings).filter(([name]) => !remediated(name));
if (report.error || !report.metadata?.vulnerabilities || ![0,1].includes(auditProcess.status) || unresolved.length) {
  process.stderr.write('REPROVADO: auditoria indisponível ou vulnerabilidades sem correção verificada.\n');
  for (const [name, finding] of unresolved) process.stderr.write(`- ${name}: ${finding.severity}\n`);
  process.exit(1);
}
process.stdout.write('APROVADO: nenhuma vulnerabilidade sem correção; deepmerge protegido por patch e testes de exploração.\n');
