import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const errors = [];
const requireText = (rel, needle, message) => {
  if (!read(rel).includes(needle)) errors.push(`${rel}: ${message}`);
};
const forbidText = (rel, needle, message) => {
  if (read(rel).includes(needle)) errors.push(`${rel}: ${message}`);
};

const generators = [
  ['supabase/functions/generate-commercial-document/index.ts', 'portal-app/supabase/functions/generate-commercial-document/index.ts'],
  ['supabase/functions/generate-contract-document/index.ts', 'portal-app/supabase/functions/generate-contract-document/index.ts']
];

for (const [canonical, mirror] of generators) {
  if (read(canonical) !== read(mirror)) errors.push(`${mirror}: gerador divergente de ${canonical}`);
  requireText(canonical, "rpc('assert_document_governance_ready')", 'não bloqueia geração com governança incoerente');
  requireText(canonical, 'emitted_at', 'não registra a data de emissão no snapshot');
  requireText(canonical, 'document_date', 'não registra a data civil da geração no snapshot');
  requireText(canonical, 'contract_signed_at', 'não alinha a data de assinatura à geração');
  forbidText(canonical, 'Local e data: _______________________________, _____/_____/________', 'ainda deixa a data de assinatura totalmente manual');
  requireText(canonical, 'generatedDatePt', 'não imprime a data de geração no Word');
}

for (const rel of [
  'supabase/functions/generate-commercial-document/deno.json',
  'supabase/functions/generate-contract-document/deno.json',
  'portal-app/supabase/functions/generate-commercial-document/deno.json',
  'portal-app/supabase/functions/generate-contract-document/deno.json'
]) {
  const imports = read(rel);
  if (!imports.includes('@supabase/supabase-js@2.112.3') || !imports.includes('docx@9.5.1')) {
    errors.push(`${rel}: dependências do gerador não estão fixadas em versões exatas`);
  }
}

const dynamicFiles = [
  'js/commercial-documents-web.js',
  'orcamentos-contratos.html',
  ...generators.flat()
];
for (const rel of dynamicFiles) {
  const content = read(rel);
  if (/BRONZE\s*[\/,]|PRATA\s*[\/,]|OURO\s*[\/,]/i.test(content)) {
    errors.push(`${rel}: contém lista fixa de níveis de prestação`);
  }
}

const migration = 'supabase/migrations/20260902045000_reforca_governanca_documental_inteligente.sql';
for (const marker of [
  'document_changed_clause_refs',
  'queue_governance_after_service_update_trg',
  'queue_governance_after_level_update_trg',
  'validate_commercial_governance_selection',
  'assert_document_governance_ready',
  "'proposal_revision_rule',array['6.1','6.2','6.3','6.4','6.5']",
  "'proposal_timeline_rule',array['2.1','2.2','2.3','3.6']"
]) requireText(migration, marker, `marcador obrigatório ausente: ${marker}`);

const contractFlowFix = 'supabase/migrations/20260902123000_corrige_fluxo_documentos_contratuais.sql';
for (const marker of [
  'v_approval public.aprovacoes%rowtype;',
  'legacy_missing_snapshot',
  'current_document_text_snapshot_all()',
  "d.workflow_status in ('rascunho','gerado')"
]) requireText(contractFlowFix, marker, `correção contratual ausente: ${marker}`);
if (read(contractFlowFix) !== read(`portal-app/${contractFlowFix}`)) {
  errors.push(`portal-app/${contractFlowFix}: migração divergente da versão canônica`);
}

requireText('js/contract-documents-web.js', 'safeError(error', 'pode expor erro interno do banco na interface');
requireText('js/contract-documents-web.js', 'docs.filter(d=>d.document_kind===activeDocumentKind)', 'não filtra a lista pelo tipo de documento aberto');
requireText('js/contract-documents-web.js', 'expectedDocumentKind:expected', 'não informa ao servidor o tipo contratual esperado');
requireText('js/commercial-documents-web.js', 'const documentId = generated.data.documentId', 'ignora o ID exato retornado pela geração comercial');
requireText('js/commercial-documents-web.js', 'expectedDocumentKind: kind', 'não informa ao servidor o tipo comercial esperado');
if (read('js/contract-documents-web.js').includes('prepareOptionalStudy')) {
  errors.push('js/contract-documents-web.js: mantém fluxo legado que ignora a governança central');
}

const delivery = read('portal-app/supabase/functions/deliver-generated-document/index.ts');
for (const marker of [
  'const archive = body.archive === true',
  "storage_mode: archive ? 'archived' : 'download_only'",
  'if (archive)',
  'arquivo: null',
  "remove([row.arquivo])"
]) {
  if (!delivery.includes(marker)) errors.push(`deliver-generated-document: regra de não salvamento ausente: ${marker}`);
}
for (const marker of ['expectedDocumentKind', 'actualDocumentKind', 'commercial_document_kind', 'documentKind: actualDocumentKind']) {
  if (!delivery.includes(marker)) errors.push(`deliver-generated-document: validação de tipo ausente: ${marker}`);
}
requireText('supabase/functions/generate-contract-document/index.ts', 'row.document_kind!==expectedDocumentKind', 'gerador contratual aceita ID de outro tipo');
requireText('supabase/functions/generate-commercial-document/index.ts', 'commercial_document_kind:kind', 'gerador comercial não registra o tipo no snapshot');

if (errors.length) {
  console.error('ERROS NA GOVERNANÇA DOCUMENTAL:');
  errors.forEach((error, index) => console.error(`${index + 1}. ${error}`));
  process.exit(1);
}

console.log('GOVERNANÇA DOCUMENTAL APROVADA.');
