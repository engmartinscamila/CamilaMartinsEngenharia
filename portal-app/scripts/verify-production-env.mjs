import assert from 'node:assert/strict';

const expectedRef = process.env.EXPO_PUBLIC_EXPECTED_SUPABASE_PROJECT_REF?.trim().toLowerCase();
const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const key = (
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
)?.trim();
const appEnvironment = process.env.EXPO_PUBLIC_APP_ENV?.trim().toLowerCase();
const turnstileSiteKey = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY?.trim();
const isPullRequestCi = process.env.CI === 'true' && process.env.GITHUB_EVENT_NAME === 'pull_request';

assert.equal(appEnvironment, 'production', 'EXPO_PUBLIC_APP_ENV deve ser production.');
assert.ok(expectedRef, 'Referência esperada do projeto de produção ausente.');
assert.ok(url, 'URL do serviço de produção ausente.');
assert.ok(key, 'Chave pública de produção ausente.');
assert.ok(!key.startsWith('sb_secret_'), 'Chave Secret bloqueada: use a chave Publishable.');
assert.ok(!key.toLowerCase().includes('service_role'), 'Chave service_role bloqueada.');
assert.ok(isPullRequestCi || (turnstileSiteKey && turnstileSiteKey.length >= 10), 'Site key pública do Cloudflare Turnstile ausente.');
if (isPullRequestCi && !turnstileSiteKey) process.stdout.write('INFO: build de pull request sem publicação; a site key real do Turnstile continua obrigatória no deploy de produção.\n');

const actualRef = url.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co\/?$/i)?.[1]?.toLowerCase();
assert.ok(actualRef, 'URL do serviço de produção inválida.');
assert.equal(actualRef, expectedRef, 'A URL não pertence ao projeto de produção esperado.');

process.stdout.write(`APROVADO: aplicativo travado na produção (${actualRef}).\n`);
