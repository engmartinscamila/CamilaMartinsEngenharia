import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');

const webFn = read('supabase/functions/client-password-link/index.ts');
const appFn = read('portal-app/supabase/functions/client-password-link/index.ts');
assert.equal(appFn, webFn, 'As duas cópias da Edge Function de recuperação divergiram');

assert.match(webFn, /service_consume_password_link_network_rate_limit/, 'Falta rate limit por rede');
assert.match(webFn, /sha256\("network:" \+ requestNetworkFingerprint\(request\)\)/, 'Fingerprint de rede não é hashado com namespace');
assert.match(webFn, /sha256\("email:" \+ email\)/, 'Rate limit por e-mail precisa de namespace próprio');
assert.match(webFn, /rawBody\.length > 4096/, 'Corpo da requisição não possui limite de tamanho');
assert.match(webFn, /EMAIL_PATTERN\.test\(email\)/, 'Validação de e-mail foi removida');
assert.match(webFn, /GENERIC_MESSAGE/, 'Resposta uniforme contra enumeração foi removida');
assert.ok(
  webFn.indexOf('consumeNetworkRateLimit(admin, request)') < webFn.indexOf('.from("clientes")'),
  'O limite por rede precisa acontecer antes da consulta de cliente'
);
assert.equal(
  (webFn.match(/fetch\("https:\/\/api\.resend\.com\/emails"/g) || []).length,
  1,
  'Recuperação deve manter o provedor de e-mail fixo'
);
assert.equal(
  (webFn.match(/fetch\("https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/siteverify"/g) || []).length,
  1,
  'Turnstile deve usar somente o endpoint oficial fixo de verificação'
);
assert.match(webFn, /const TURNSTILE_REQUIRED = Deno\.env\.get\("TURNSTILE_REQUIRED"\) === "true"/, 'Turnstile deve ser ativado explicitamente');
assert.match(webFn, /TURNSTILE_SECRET_KEY = Deno\.env\.get\("TURNSTILE_SECRET_KEY"\)/, 'Segredo Turnstile deve permanecer somente no servidor');
assert.match(webFn, /verifyTurnstile\(request, captchaToken\)/, 'Recuperação deve validar o token quando Turnstile estiver ativo');
assert.doesNotMatch(webFn, /fetch\(\s*(?:body|payload|params|input|url)\b/, 'Entrada do usuário não pode controlar destino HTTP');

const migrationPath = 'supabase/migrations/20260923172327_password_link_network_rate_limit.sql';
const migration = read(migrationPath);
const appMigration = read('portal-app/' + migrationPath);
assert.equal(appMigration, migration, 'Migration de rate limit divergiu entre site e app');
assert.match(migration, /security invoker/i, 'Limiter não deve ganhar privilégio por SECURITY DEFINER');
assert.match(migration, /revoke all[\s\S]*public, anon, authenticated/i, 'Limiter deve negar execução direta a cliente/anon');
assert.match(migration, /grant execute[\s\S]*service_role/i, 'Limiter deve ser exclusivo do backend');
assert.match(migration, /interval '10 seconds'/, 'Cooldown de rede inesperado');
assert.match(migration, /request_count < 30/, 'Janela horária de rede inesperada');

console.log('PASS: recuperação com limite por rede + e-mail, corpo limitado, resposta anti-enumeração e backend exclusivo.');
