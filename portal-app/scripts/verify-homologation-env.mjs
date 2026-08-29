import assert from 'node:assert/strict';

const expectedRef = process.env.EXPO_PUBLIC_EXPECTED_SUPABASE_PROJECT_REF?.trim().toLowerCase();
const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const key = (
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
)?.trim();
const appEnvironment = process.env.EXPO_PUBLIC_APP_ENV?.trim().toLowerCase();

assert.equal(appEnvironment, 'homologation', 'EXPO_PUBLIC_APP_ENV deve ser homologation.');
assert.ok(expectedRef, 'Referência esperada do projeto ausente.');
assert.ok(url, 'URL do Supabase ausente.');
assert.ok(key, 'Chave pública do Supabase ausente.');
assert.ok(!key.startsWith('sb_secret_'), 'Chave Secret bloqueada: use a chave Publishable.');
assert.ok(!key.toLowerCase().includes('service_role'), 'Chave service_role bloqueada.');

const actualRef = url.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co\/?$/i)?.[1]?.toLowerCase();
assert.ok(actualRef, 'URL do Supabase inválida.');
assert.equal(actualRef, expectedRef, 'A URL não pertence ao projeto de homologação esperado.');

process.stdout.write(`APROVADO: aplicativo travado na homologação (${actualRef}).\n`);
