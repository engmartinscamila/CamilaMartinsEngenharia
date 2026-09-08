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

// The updated Expo dependency graph no longer needs advisory exceptions.
const totals = report.metadata?.vulnerabilities;
if (report.error || !totals || auditProcess.status !== 0 || totals.total !== 0) {
  process.stderr.write('REPROVADO: auditoria indisponível ou dependências com vulnerabilidades conhecidas.\n');
  for (const [name, finding] of Object.entries(report.vulnerabilities ?? {})) {
    process.stderr.write(`- ${name}: ${finding.severity}\n`);
  }
  process.exit(1);
}
process.stdout.write('APROVADO: nenhuma vulnerabilidade conhecida; nenhuma exceção de advisory.\n');
