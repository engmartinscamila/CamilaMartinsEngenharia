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

const draftMigration = fs.readdirSync(migrationDir).find((name) => name.endsWith('_draft_service_level_texts_and_search_metadata.sql'));
ok(Boolean(draftMigration), 'migration de rascunhos e busca existe');
const draftSql = fs.readFileSync(path.join(migrationDir, draftMigration), 'utf8');
ok(draftSql.includes("'t','Reforma / adequação de edificação'"), 'reforma é serviço canônico');
ok(draftSql.includes("review_status='pending'"), 'rascunhos permanecem pendentes de revisão');
ok(draftSql.includes('budget_description = concat('), 'rascunho de orçamento é preenchido');
ok(draftSql.includes('contract_scope = concat('), 'rascunho de contrato é preenchido');
ok(draftSql.includes('annex_scope = concat('), 'rascunho de Anexo I é preenchido');
ok(draftSql.includes("aliases = case code"), 'aliases são alimentados no catálogo');
ok(draftSql.includes("synonyms = case code"), 'sinônimos são alimentados no catálogo');
ok(draftSql.includes("keywords = case code"), 'palavras-chave são alimentadas no catálogo');


const reviewMigration = fs.readdirSync(migrationDir).find((name) => name.endsWith('_service_level_scope_admin_review.sql'));
ok(Boolean(reviewMigration), 'migration de revisão individual existe');
const reviewSql = fs.readFileSync(path.join(migrationDir, reviewMigration), 'utf8');
ok(reviewSql.includes('admin_review_service_level_scope'), 'RPC de revisão individual existe');
ok(reviewSql.includes("if v_reason is null or length(v_reason)<5"), 'justificativa é obrigatória');
ok(reviewSql.includes("v_decision not in ('pending','approved','rejected')"), 'decisão é restrita a estados conhecidos');
ok(reviewSql.includes('for update'), 'revisão trava a combinação individual durante a decisão');
ok(reviewSql.includes('service_level_scope_versions'), 'cada decisão gera histórico versionado');
ok(!reviewSql.includes('admin_review_all_service_level_scope') && !reviewSql.includes('admin_bulk_review_service_level_scope'), 'não existe endpoint de aprovação coletiva');
ok(reviewSql.includes("if v_decision='approved'"), 'aprovação valida os três textos antes de liberar');
ok(reviewSql.includes('public.is_portal_admin()'), 'revisão exige Admin no servidor');

const consumeMigration = fs.readdirSync(migrationDir).find((name) => name.endsWith('_use_service_level_scope_matrix.sql'));
ok(Boolean(consumeMigration), 'migration de consumo da matriz existe');
const consumeSql = fs.readFileSync(path.join(migrationDir, consumeMigration), 'utf8');
ok(consumeSql.includes("v_scope.review_status='approved'"), 'somente matriz aprovada substitui texto legado');
ok(consumeSql.includes("'budgetDescription'"), 'snapshot guarda texto específico de orçamento aprovado');
ok(consumeSql.includes("'contractScope'"), 'snapshot guarda texto específico de contrato aprovado');
ok(consumeSql.includes("'annexScope'"), 'snapshot guarda texto específico de Anexo I aprovado');

const approvalMigration = fs.readdirSync(migrationDir).find((name) => name.endsWith('_approve_service_level_scope_owner_authorized.sql'));
ok(Boolean(approvalMigration), 'migration de aprovação autorizada da matriz existe');
const approvalSql = fs.readFileSync(path.join(migrationDir, approvalMigration), 'utf8');
ok(approvalSql.includes("v_total<>114 or v_pending<>114"), 'aprovação em lote exige a matriz exata que foi autorizada');
ok(approvalSql.includes("v_invalid>0"), 'aprovação autorizada ainda valida completude antes de liberar');
ok(approvalSql.includes("review_status='approved'"), 'matriz autorizada é publicada como aprovada');
ok(approvalSql.includes('service_level_scope_versions'), 'aprovação preserva histórico de versões');
ok(approvalSql.includes('owner_authorized'), 'audit log registra autorização explícita da titular');

console.log(`MATRIZ SERVIÇO X NÍVEL: ${checks} verificações passaram.`);
