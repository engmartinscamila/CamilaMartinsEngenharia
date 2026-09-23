import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');

const agenda = read('supabase/functions/agenda-ics/index.ts');
assert.match(agenda, /hmacHex\(serviceRoleKey, `agenda:\$\{agendaId\}`\)/, 'Agenda pública precisa de assinatura HMAC');
assert.match(agenda, /compararConstante\(assinatura, esperado\)/, 'Agenda precisa comparar assinatura em tempo constante');

const cleanup = read('supabase/functions/cleanup-expired-assets/index.ts');
assert.match(cleanup, /service_internal_secret_get/, 'Limpeza precisa obter segredo interno');
assert.match(cleanup, /constantTimeEqual\(suppliedToken, expectedToken\)/, 'Limpeza precisa comparar segredo em tempo constante');
assert.doesNotMatch(cleanup, /return json\([^\n]*error\.message/, 'Limpeza não pode expor exceção interna');

const pdf = read('supabase/functions/proteger-pdf/index.ts');
assert.match(pdf, /originAllowed\(req\)/, 'Proteção PDF precisa validar origem');
assert.match(pdf, /admin\.auth\.getUser\(token!\)/, 'Proteção PDF precisa validar token de usuário');
assert.match(pdf, /DOCUMENT_ACCESS_DENIED/, 'Proteção PDF precisa negar documento de outro usuário');
assert.match(pdf, /TOO_MANY_REQUESTS/, 'Proteção PDF precisa manter rate limit');
assert.match(pdf, /PDF_GENERATION_FAILED/, 'Proteção PDF precisa devolver erro interno genérico');

const prospect = read('portal-app/supabase/functions/prospect-document-access/index.ts');
assert.match(prospect, /\^\[a-f0-9\]\{48\}\$/, 'Acesso de prospect precisa exigir token de alta entropia');
assert.match(prospect, /tokenHash = await sha256\(token\)/, 'Token de prospect precisa ser armazenado/consultado por hash');
assert.match(prospect, /link\.revoked_at/, 'Acesso de prospect precisa respeitar revogação');
assert.match(prospect, /link\.use_count >= link\.max_uses/, 'Acesso de prospect precisa respeitar limite de usos');
assert.match(prospect, /\.eq\('link_id', link\.id\)/, 'Acesso de prospect só pode listar documentos vinculados ao token');
assert.match(prospect, /rawBody\.length > 4096/, 'Endpoint de prospect precisa limitar corpo da requisição');
assert.doesNotMatch(prospect, /return json\(\{ error: error instanceof Error \? error\.message/, 'Endpoint de prospect não pode expor exceção interna');

console.log('PASS: funções públicas usam autenticação alternativa, escopo próprio, limites e erros públicos genéricos.');
