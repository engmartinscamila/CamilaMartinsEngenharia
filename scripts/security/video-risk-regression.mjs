import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const read = path => readFileSync(resolve(root, path), 'utf8');
let checks = 0;
const ok = (condition, message) => { assert.ok(condition, message); checks++; };

const login = read('login.html');
const auth = read('js/auth.js');
const resetHtml = read('redefinir-senha.html');
const resetJs = read('js/redefinir-senha.js');
const passwordLink = read('supabase/functions/client-password-link/index.ts');
const appAuth = read('portal-app/src/services/auth-service.ts');
const headers = read('_headers');
const securityWorkflow = read('.github/workflows/security.yml');
const rlsTest = read('scripts/security/rls-regression.mjs');

// 01 — Segredos: a suíte de segurança deve continuar executando o scanner histórico.
ok(securityWorkflow.includes('node scripts/security/secret-scan.mjs'), 'Scanner de segredos saiu do CI');

// 02 — Entradas: limites explícitos evitam payloads desnecessariamente grandes.
ok(login.includes('maxlength="254"'), 'Login web sem limite de e-mail');
ok(login.includes('maxlength="256"'), 'Login web sem limite de senha');
ok(resetHtml.match(/maxlength="256"/g)?.length >= 2, 'Redefinição web sem limite máximo');
ok(auth.includes('email.length > 254'), 'Login web não valida limite de e-mail no JavaScript');
ok(auth.includes('campoSenha.value.length > 256'), 'Login web não valida limite de senha no JavaScript');
ok(appAuth.includes('normalizedEmail.length > 254'), 'Aplicativo não valida limite de e-mail');
ok(appAuth.includes('password.length > 256'), 'Aplicativo não valida limite máximo de senha');
ok(resetJs.includes('senha.length > 256'), 'Redefinição web não valida limite máximo de senha');

// 03 — Injection: autenticação administrativa e consultas ficam no SDK/RPC, sem autorização no frontend.
ok(auth.includes('rpc("is_portal_admin")'), 'Autorização administrativa deixou de ser validada no servidor');
ok(!auth.includes('session.user.id !== window.ADMIN_UID'), 'Autorização administrativa voltou a depender do frontend');

// 04 — XSS: renderizadores de dados devem manter escape contextual antes de HTML dinâmico.
for (const [path, marker] of [
  ['js/admin.js', 'function escaparAdmin'],
  ['js/biblioteca-categorias.js', 'function escapar'],
  ['js/cliente-area.js', 'function escapar'],
  ['js/commercial-documents-web.js', 'const esc='],
  ['js/document-governance-web.js', 'const esc='],
]) {
  ok(read(path).includes(marker), path + ' perdeu o helper de escape de HTML');
}

// Bloqueia primitives de execução arbitrária em código de primeira parte.
function sourceFiles(dir) {
  const base = resolve(root, dir);
  if (!existsSync(base)) return [];
  const out = [];
  for (const entry of readdirSync(base, { withFileTypes: true })) {
    const path = join(base, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(path.slice(root.length + 1)));
    else if (['.js', '.mjs', '.ts', '.tsx'].includes(extname(entry.name))) out.push(path);
  }
  return out;
}
for (const file of [...sourceFiles('js'), ...sourceFiles('supabase/functions'), ...sourceFiles('portal-app/src')]) {
  const source = readFileSync(file, 'utf8');
  ok(!/\beval\s*\(/.test(source), 'Uso de eval encontrado em ' + file);
  ok(!/\bnew\s+Function\s*\(/.test(source), 'Uso de new Function encontrado em ' + file);
  ok(!/document\.write\s*\(/.test(source), 'Uso de document.write encontrado em ' + file);
}

// 05 — IDOR/BOLA: isolamento A/B e bloqueio de acesso cruzado permanecem no CI.
ok(securityWorkflow.includes('node scripts/security/rls-regression.mjs'), 'Regressão RLS saiu do CI');
ok(rlsTest.includes('other project denied'), 'Teste de projeto de outro cliente ausente');
ok(rlsTest.includes('cross-client document metadata denied'), 'Teste de documento de outro cliente ausente');
ok(rlsTest.includes('client cannot become admin'), 'Teste de escalada cliente→admin ausente');

// 06 — SSRF: recuperação só chama endpoints fixos e revisados.
const passwordFetches = [...passwordLink.matchAll(/fetch\(([^\n,]+)/g)].map(match => match[1].trim());
ok(passwordFetches.length === 2, 'Recuperação de senha ganhou chamada HTTP não revisada');
ok(passwordFetches.some(value => value.includes('"https://api.resend.com/emails"')), 'Destino do provedor de e-mail deixou de ser fixo');
ok(passwordFetches.some(value => value.includes('"https://challenges.cloudflare.com/turnstile/v0/siteverify"')), 'Validação Turnstile não usa endpoint fixo');
ok(!/fetch\s*\(\s*(?:body|payload|params|input)\b/.test(passwordLink), 'Entrada do usuário virou destino HTTP');

// 07 — Senha: política local gratuita continua forte, sem depender de recurso pago.
for (const token of ['/[^a-z]/', '/[^A-Z]/']) void token; // documentação da intenção abaixo
ok(resetJs.includes('/[a-z]/') && resetJs.includes('/[A-Z]/') && resetJs.includes('/[0-9]/') && resetJs.includes('/[^A-Za-z0-9]/'), 'Política web de senha forte foi reduzida');
ok(appAuth.includes('/[a-z]/') && appAuth.includes('/[A-Z]/') && appAuth.includes('/[0-9]/') && appAuth.includes('/[^A-Za-z0-9]/'), 'Política do app de senha forte foi reduzida');

// CAPTCHA gratuito — código fica pronto, porém só exige desafio quando a chave real for configurada.
ok(login.includes('name="cme-turnstile-site-key"'), 'Slot da Site Key do Turnstile ausente');
ok(login.includes('id="turnstileContainer"'), 'Container do Turnstile ausente');
ok(auth.includes('options: { captchaToken }'), 'Login não encaminha token CAPTCHA ao Supabase Auth');
ok(passwordLink.includes('TURNSTILE_REQUIRED'), 'Endpoint de recuperação não possui gate de Turnstile');
ok(passwordLink.includes('verifyTurnstile(request, captchaToken)'), 'Recuperação não valida CAPTCHA no servidor quando ativado');

// 08 — Abuso/DoS: recuperação limita corpo e consome quota antes da consulta cadastral.
ok(passwordLink.includes('const MAX_REQUEST_BYTES = 4096;'), 'Limite de corpo da recuperação ausente');
ok(passwordLink.includes('async function readRequestBody'), 'Leitura limitada da recuperação ausente');
const limiterPos = passwordLink.indexOf('consumeRateLimit(admin, email)');
const lookupPos = passwordLink.indexOf('.from("clientes")');
ok(limiterPos >= 0 && lookupPos >= 0 && limiterPos < lookupPos, 'Rate limit deve ocorrer antes da busca cadastral');

// 09 — Rotas administrativas: conhecer URL não concede acesso.
ok(auth.includes('PAGINAS_ADMINISTRATIVAS'), 'Guarda de páginas administrativas ausente');
ok(auth.includes('if (!autorizado)'), 'Página administrativa não bloqueia sessão sem privilégio');

// 10 — Erros e cabeçalhos: resposta externa genérica e hardening mínimo.
ok(auth.includes('E-mail ou senha incorretos.'), 'Login voltou a revelar causa específica');
ok(passwordLink.includes('GENERIC_MESSAGE'), 'Recuperação perdeu resposta anti-enumeração');
for (const header of [
  'X-Content-Type-Options: nosniff',
  'X-Frame-Options: SAMEORIGIN',
  'Strict-Transport-Security: max-age=31536000',
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
]) ok(headers.includes(header), 'Cabeçalho de segurança ausente: ' + header);

console.log('PASS: ' + checks + ' verificações de regressão cobrem os 10 grupos de risco do vídeo.');
