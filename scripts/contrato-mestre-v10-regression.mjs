// Contrato Mestre v10: quadro-resumo no início, parcelas com percentual,
// trechos condicionais por cliente e renumeração sem remissões quebradas.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import JSZip from '../portal-app/node_modules/jszip/lib/index.js';
import { Packer } from '../portal-app/node_modules/docx/dist/index.mjs';
import { contractDocument } from '../portal-app/supabase/functions/_shared/commercial-word-renderer.ts';
import { enhanceContractDocument } from '../portal-app/supabase/functions/_shared/commercial-word-enhancements.ts';

for (const name of ['commercial-word-renderer.ts', 'commercial-word-enhancements.ts']) {
  assert.equal(fs.readFileSync(`supabase/functions/_shared/${name}`, 'utf8'), fs.readFileSync(`portal-app/supabase/functions/_shared/${name}`, 'utf8'), `${name} fora de sincronia`);
}
const body = fs.readFileSync('docs/contrato-mestre-v11/corpo.txt', 'utf8');
const profile = { full_name: 'Engenheira Teste', professional_title: 'Engenheira Civil', crea_rj: '123', cpf: '000.000.000-00', professional_address: 'Rua A, 1', email_professional: 'a@b.c' };
const base = {
  id: 'r1', quote_number: 'REF-CON-1', contract_number: 'CON-TESTE-1', status: 'convertido', prospect_name: 'Cliente Teste',
  cpf_cnpj: '12345678901', email: 'c@d.e', phone: '21 99999-0000', address: 'Rua B, 2', city: 'Rio de Janeiro', state: 'RJ',
  property_address: 'Obra Teste, Rua C, 3', experience_level: 'bronze', custom_service: null, total_value: 10000,
  coobligors: [], contract_master_version: 10, document_version: '1.0', smart_texts: {}, payment_terms: [],
  services: [{ code: 'c', name: 'Projeto Legal', included: true, levelApplicable: true, level: { code: 'bronze', label: 'BRONZE' } }],
  commercial_terms: {
    payment_method: 'pix', schedule: { days: '30', day_type: 'uteis', start_trigger: 'Assinatura do contrato' },
    installments: [{ amount: '4000', due_date: '2026-12-01', due_event: 'Assinatura' }, { amount: '6000', due_date: '2027-01-10', due_event: 'Entrega final' }],
    scope: [{ code: 'c', days: '30', unit: 'projeto', quantity: '1', revisions: '2', visits: '0', deliverables: 'Plantas, cortes e fachadas', deadline_type: 'technical' }],
  },
};
async function render(record) {
  const bytes = new Uint8Array(await Packer.toBuffer(contractDocument(record, profile, body, new Date('2026-11-10T15:00:00Z'))));
  const enhanced = await enhanceContractDocument(bytes, record.property_address, record.services, record.custom_service, record.experience_level, record.commercial_terms, false);
  const xml = await (await JSZip.loadAsync(enhanced)).file('word/document.xml').async('string');
  return [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => m[1]).join('\n');
}

const pf = await render(base);
assert.ok(pf.indexOf('QUADRO-RESUMO') < pf.indexOf('CLÁUSULA 1 – OBJETO E ESCOPO'), 'Quadro-Resumo precisa vir antes das cláusulas');
assert.ok(pf.indexOf('QUADRO DE ESCOPO') < pf.indexOf('Projeto Legal\n') || pf.includes('1. Projeto Legal'), 'Escopo precisa entrar no Quadro de Escopo');
assert.ok(pf.indexOf('1. Projeto Legal') < pf.indexOf('QUALIFICAÇÃO DAS PARTES'), 'Escopo inserido fora do Quadro de Escopo');
assert.ok(pf.indexOf('CLÁUSULA 14') < pf.indexOf('ASSINATURAS'), 'Foro deve ser a última cláusula');
assert.ok(pf.includes('40%') && pf.includes('60%'), 'Percentual das parcelas ausente');
assert.ok(pf.indexOf('Revisões incluídas\n') > pf.indexOf('QUADRO DE ESCOPO') && pf.indexOf('Revisões incluídas\n') < pf.indexOf('1. Projeto Legal'), 'Tabela de atividades (prazo, revisões, visitas) deve abrir o Quadro de Escopo');
assert.match(pf, /Projeto Legal\n1 projeto\n30 dias úteis\n2\nNenhuma\n/, 'Linha da atividade com quantidade, prazo, revisões e visitas');
// Toda remissão do texto precisa apontar para algo que existe no próprio documento.
assert.ok(!/\bQuadro\b(?![- ]Resumo| de Escopo)/.test(body), 'Remissão a "Quadro" sem dizer qual quadro');
for (const heading of ['QUADRO-RESUMO', 'PARCELAS E ENTREGAS', 'QUADRO DE ESCOPO']) assert.ok(pf.includes(heading), 'Quadro citado no texto não existe: ' + heading);
for (const column of ['Quantidade', 'Prazo', 'Revisões incluídas', 'Visitas incluídas', 'Formato']) assert.ok(pf.includes(column + '\n'), 'Coluna citada pelo contrato ausente: ' + column);
const items = new Set([...pf.matchAll(/^(\d+\.\d+)\. /gm)].map(m => m[1]));
for (const [, ref] of pf.matchAll(/\bitens? (\d+\.\d+)/g)) assert.ok(items.has(ref), 'Remissão a item inexistente: ' + ref);
const clauses = new Set([...pf.matchAll(/^CLÁUSULA (\d+) /gm)].map(m => m[1]));
for (const [, ref] of pf.matchAll(/Cláusula (\d+)\b/g)) assert.ok(clauses.has(ref), 'Remissão a cláusula inexistente: ' + ref);
assert.ok(!pf.includes('{{se:'), 'Marcação condicional vazou para o Word');
assert.ok(!/\[[^\]]+\]/.test(body), 'Contrato Mestre não pode ter colchetes (o banco bloqueia campos provisórios)');
assert.ok(!pf.includes('Quando o Quadro de Escopo incluir legalização'), 'Legalização só entra com serviço municipal');
assert.ok(!pf.includes('reajustadas anualmente'), 'Reajuste só entra com parcela após 12 meses');
assert.match(pf, /portador\(a\) do RG nº _{10,}/, 'Pessoa física sem RG recebe linha em branco para preencher');
assert.ok(pf.includes('bem comum de casal') && !pf.includes('Contratante pessoa jurídica'), 'Pessoa física recebe só a regra de cônjuge');
assert.match(pf, /1\.4\. Arquivos editáveis/, 'Itens devem ser renumerados após omissão');
assert.match(pf, /13\.1\. Se o imóvel for bem comum/, 'Cláusula 13 renumerada');
assert.match(pf, /multa do item 12\.5/, 'Remissão interna preservada');

const pj = await render({
  ...base, cpf_cnpj: '59504708000122', prospect_name: 'Empresa Teste LTDA',
  services: [...base.services, { code: 'l', name: 'Alvará de Construção', included: true, levelApplicable: true, level: { code: 'bronze' } }],
  commercial_terms: {
    ...base.commercial_terms,
    compatibilization: true,
    legal_representative: { name: 'Sócia Teste', cpf: '497.111.088-79', role: 'Sócia', powers: 'Representante legal' },
    installments: [...base.commercial_terms.installments, { amount: '0', due_date: '2028-01-10', due_event: 'Saldo' }],
    scope: [...base.commercial_terms.scope, { code: 'l', unit: 'processo', quantity: '1', revisions: '10', visits: '0', deliverables: 'Protocolo e acompanhamento', deadline_type: 'municipal', municipal_notes: 'Condição combinada.' }],
  },
});
assert.ok(pj.includes('59.504.708/0001-22'), 'CNPJ formatado');
assert.ok(!pj.includes('RG nº'), 'Pessoa jurídica não recebe linha de RG');
assert.ok(pj.includes('Quando o Quadro de Escopo incluir legalização'), 'Legalização deve entrar com alvará');
assert.ok(pj.includes('reajustadas anualmente'), 'Reajuste deve entrar com parcela após 12 meses');
assert.ok(pj.includes('Contratante pessoa jurídica') && !pj.includes('bem comum de casal'), 'Pessoa jurídica recebe a regra própria');
assert.ok(pj.includes('compatibilização entre todos os projetos'), 'Compatibilização marcada deve aparecer');
assert.ok(pj.includes('Condição específica acordada: Condição combinada'), 'Observação municipal acordada deve aparecer');
assert.ok(!pf.includes('compatibilização entre todos os projetos'), 'Compatibilização não pode ser presumida');
assert.ok(!pf.includes('CONDIÇÕES ESPECÍFICAS'), 'Sem condições específicas, a seção não aparece');
const esp = await render({ ...base, commercial_terms: { ...base.commercial_terms, specific_clauses: [{ title: 'Acompanhamento do alvará', text: 'Texto acordado.' }] } });
assert.ok(esp.indexOf('1. Projeto Legal') < esp.indexOf('CONDIÇÕES ESPECÍFICAS DESTE CONTRATO') && esp.indexOf('CONDIÇÕES ESPECÍFICAS DESTE CONTRATO') < esp.indexOf('QUALIFICAÇÃO DAS PARTES'), 'Condições específicas entre o escopo e a qualificação');
assert.ok(esp.includes('E.1. Acompanhamento do alvará') && esp.includes('prevalecem sobre as cláusulas gerais'), 'Condição específica numerada e com regra de prevalência');
assert.ok(pf.includes('Nível desta atividade: BRONZE'), 'Por padrão o nível aparece no detalhamento');
const semNivel = await render({ ...base, commercial_terms: { ...base.commercial_terms, hide_service_level: true } });
assert.ok(!/bronze|prata|ouro|Nível de (prestação|experiência)|Nível desta/i.test(semNivel), 'Com hide_service_level o contrato não menciona nível');
assert.ok(semNivel.includes('1. Projeto Legal') && semNivel.includes('Entrega técnica aprovada'), 'Ocultar nível não remove o escopo');
console.log('PASS: Contrato Mestre v10 com quadro-resumo, parcelas, escopo, condicionais e renumeração.');
