import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const migrationDir = path.resolve('supabase/migrations');
const file = fs.readdirSync(migrationDir).find((name) => name.endsWith('_service_level_scope_matrix_foundation.sql'));
assert.ok(file, 'migration da matriz serviço x nível não encontrada');
const sql = fs.readFileSync(path.join(migrationDir, file), 'utf8');

let checks = 0;
const ok = (value, message) => { assert.ok(value, message); checks += 1; };

ok(sql.includes('add column if not exists aliases text[]'), 'catálogo suporta aliases');
ok(sql.includes('add column if not exists synonyms text[]'), 'catálogo suporta sinônimos');
ok(sql.includes('add column if not exists keywords text[]'), 'catálogo suporta palavras-chave');
ok(sql.includes('create table if not exists public.service_level_scope_catalog'), 'matriz serviço x nível existe');
ok(sql.includes('budget_description text') && sql.includes('contract_scope text') && sql.includes('annex_scope text'), 'textos de orçamento, contrato e Anexo I ficam separados');
ok(sql.includes('create table if not exists public.service_level_scope_versions'), 'histórico versionado existe');
ok(sql.includes("review_status text not null default 'pending'"), 'novos textos não são aprovados automaticamente');
ok(sql.includes('cross join public.service_level_catalog'), 'combinações são derivadas do catálogo central de níveis');
ok(sql.includes('alter table public.service_level_scope_catalog enable row level security'), 'RLS está habilitada na matriz');
ok(sql.includes('for select') && sql.includes('using (public.is_portal_admin())'), 'leitura da matriz exige Admin');
ok(sql.includes('revoke all on public.service_level_scope_catalog from public, anon, authenticated'), 'privilégios amplos são removidos');
ok(!/grant\s+(insert|update|delete|all)\s+on\s+public\.service_level_scope_catalog\s+to\s+authenticated/i.test(sql), 'authenticated não recebe escrita direta');
ok(sql.includes('on conflict (service_code, level_code) do nothing'), 'backfill é idempotente e preserva combinações existentes');

console.log(`MATRIZ SERVIÇO X NÍVEL: ${checks} verificações passaram.`);
