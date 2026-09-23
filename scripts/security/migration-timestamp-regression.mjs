import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const dir = new URL('../../supabase/migrations/', import.meta.url);
const entries = fs.readdirSync(dir).filter((name) => name.endsWith('.sql'));
const versions = new Set();
for (const entry of entries) {
  const match = /^(\d{14})_[a-z0-9_]+\.sql$/.exec(entry);
  assert.ok(match, `Migration sem formato de versão válido: ${entry}`);
  const version = match[1];
  assert.ok(!versions.has(version), `Versão de migration duplicada: ${version}`);
  versions.add(version);
  const year = Number(version.slice(0, 4)), month = Number(version.slice(4, 6)), day = Number(version.slice(6, 8));
  const hour = Number(version.slice(8, 10)), minute = Number(version.slice(10, 12)), second = Number(version.slice(12, 14));
  const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  assert.ok(parsed.getUTCFullYear() === year && parsed.getUTCMonth() + 1 === month &&
    parsed.getUTCDate() === day && parsed.getUTCHours() === hour &&
    parsed.getUTCMinutes() === minute && parsed.getUTCSeconds() === second,
  `Timestamp impossível na migration ${path.basename(entry)}`);
}
assert.ok(entries.length > 0, 'O diretório de migrações está vazio.');
console.log(`TIMESTAMPS DE MIGRAÇÕES: ${entries.length} arquivos com versões únicas e datas válidas.`);
