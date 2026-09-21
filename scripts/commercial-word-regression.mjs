import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const portalRequire = createRequire(pathToFileURL(resolve(root, 'portal-app/package.json')));
const JSZip = portalRequire('jszip');
const { Document, Paragraph, TextRun, Packer } = portalRequire('docx');
const source = readFileSync(resolve(root, 'supabase/functions/generate-commercial-document-final/index.ts'), 'utf8');
const start = source.indexOf('const isProjectTierEligible =');
const end = source.indexOf('async function sha256(');
assert.ok(start > 0 && end > start, 'Funções de revisão Word não foram encontradas');
const isolatedCode = stripTypeScriptTypes(source.slice(start, end), { mode: 'strip' });
const context = {
  JSZip,
  Uint8Array,
  text: value => String(value ?? '').trim(),
  isOther: item => ['p', 'outro', 'outros'].includes(String(item.code ?? '').trim().toLowerCase()),
};
const api = runInNewContext(`${isolatedCode}\n({ enhanceQuoteDocument, enhanceContractDocument });`, context);

async function fixture(paragraphs) {
  const doc = new Document({ sections: [{ properties: {}, children: paragraphs.map(value => new Paragraph({ children: [new TextRun(value)] })) }] });
  return new Uint8Array(await Packer.toBuffer(doc));
}
async function xmlOf(bytes) {
  const archive = await JSZip.loadAsync(bytes);
  const xml = await archive.file('word/document.xml')?.async('string');
  assert.ok(xml?.includes('w:document'), 'Word sem documento XML');
  execFileSync('python3', ['-c', 'import sys, xml.etree.ElementTree as ET; ET.fromstring(sys.stdin.read()); print("XML OK")'], { input: xml, stdio: ['pipe', 'pipe', 'pipe'] });
  return xml;
}

const specification = 'Levantamento de informações para diagnóstico de infiltrações na cobertura';
const service = { code: 'p', name: 'Outro', included: true, levelApplicable: false };
const quote = await fixture([
  'PROPOSTA COMERCIAL',
  '2. NÍVEL DE PRESTAÇÃO DE SERVIÇO',
  'Nível selecionado: BRONZE — Essencial',
  'Recursos visuais exclusivos de projeto',
  '3. ESCOPO INTELIGENTE DE SERVIÇOS',
  '1. Outro',
  'Prestação de serviço técnico conforme escopo específico descrito nesta proposta e no Anexo I.',
  'Revisões incluídas: conforme condição específica do Anexo I • Formatos: PDF • Prazo: integrado ao cronograma geral',
  'Serviço adicional descrito no orçamento',
  specification,
  'Este item somente integra o escopo nos limites expressamente descritos nesta proposta e no Anexo I.',
  '5. PROCESSO DE DESENVOLVIMENTO E REVISÕES',
  'Na ausência de indicação específica no Anexo I, aplicam-se até 2 (duas) rodadas de revisão por etapa para ajustes dentro do escopo original.',
  '6. PRAZO E CRONOGRAMA',
  'O prazo geral de referência é de 45 (quarenta e cinco) dias úteis, contado conforme as condições previstas no Contrato.',
]);
const revisedQuote = await api.enhanceQuoteDocument(quote, [service], specification);
const revisedXml = await xmlOf(revisedQuote);
assert.equal(revisedXml.split(specification).length - 1, 1, 'Especificação repetida ou ausente no orçamento');
assert.ok(!revisedXml.includes('Serviço adicional descrito no orçamento'), 'Duplicação de Outros permanece');
assert.ok(!revisedXml.includes('Formatos: PDF'), 'Formato PDF foi presumido para atividade personalizada');
assert.ok(!revisedXml.includes('até 2 (duas) rodadas'), 'Rodadas foram presumidas para serviço não relacionado a projeto');
assert.ok(!revisedXml.includes('prazo geral de referência é de 45'), 'Prazo geral de projeto foi presumido para atividade personalizada');
assert.ok(!revisedXml.includes('Nível selecionado: BRONZE'), 'Nível de projeto aplicado indevidamente a Outros');
assert.ok(!revisedXml.includes('Recursos visuais exclusivos de projeto'), 'Recursos de projetos mantidos em Outros');
assert.ok(revisedXml.includes('Atividade específica solicitada:'), 'Texto personalizado não foi construído');

const unchanged = await api.enhanceQuoteDocument(quote, [{ code: 'a', name: 'Estudo Preliminar', included: true, levelApplicable: true }], '');
assert.equal(unchanged, quote, 'Orçamento de projeto regular sofreu modificação indevida');

const legacyConsultancy = { code: 'q', name: 'Consultoria Técnica', included: true, levelApplicable: false };
const consultancyWord = await fixture([
  '2. NÍVEL DE PRESTAÇÃO DE SERVIÇO',
  'Nível selecionado: BRONZE — Essencial',
  'Maior detalhamento de projeto não contratado',
  'O nível selecionado aplica-se somente aos serviços de projeto elegíveis nesta proposta: Consultoria Técnica.',
  '3. ESCOPO INTELIGENTE DE SERVIÇOS',
  '1. Consultoria Técnica',
  'Prestação de consultoria técnica conforme finalidade contratada.',
  'Revisões incluídas: 2 • Formatos: PDF • Prazo: integrado ao cronograma geral',
  'Na ausência de indicação específica no Anexo I, aplicam-se até 2 (duas) rodadas de revisão por etapa para ajustes dentro do escopo original.',
  'O prazo geral de referência é de 45 (quarenta e cinco) dias úteis, contado conforme as condições previstas no Contrato.',
]);
const consultancyXml = await xmlOf(await api.enhanceQuoteDocument(consultancyWord, [legacyConsultancy], ''));
assert.ok(consultancyXml.includes('Consultoria Técnica'), 'Descrição de consultoria desapareceu');
assert.ok(!consultancyXml.includes('Formatos: PDF'), 'Consultoria legada mantém formato presumido');
assert.ok(!consultancyXml.includes('Revisões incluídas: 2'), 'Consultoria legada mantém revisões presumidas');
assert.ok(!consultancyXml.includes('até 2 (duas) rodadas'), 'Consultoria mantém revisões globais genéricas');
assert.ok(!consultancyXml.includes('prazo geral de referência é de 45'), 'Consultoria mantém prazo geral de projeto');
assert.ok(!consultancyXml.includes('Nível selecionado: BRONZE'), 'Consultoria ainda recebe Bronze no orçamento');
assert.ok(!consultancyXml.includes('Maior detalhamento de projeto não contratado'), 'Benefícios de projeto permanecem em consultoria');

const mixed = await fixture([
  '2. NÍVEL DE PRESTAÇÃO DE SERVIÇO',
  'Nível selecionado: BRONZE — Essencial',
  'O nível selecionado aplica-se somente aos serviços de projeto elegíveis nesta proposta: Consultoria Técnica, Estudo Preliminar.',
  '3. ESCOPO INTELIGENTE DE SERVIÇOS',
]);
const mixedXml = await xmlOf(await api.enhanceQuoteDocument(mixed, [legacyConsultancy, { code: 'a', name: 'Estudo Preliminar', included: true, levelApplicable: true }], ''));
assert.ok(mixedXml.includes('O nível selecionado aplica-se exclusivamente aos serviços de projeto elegíveis desta proposta: Estudo Preliminar.'), 'Proposta mista inclui consultoria como elegível');
assert.ok(!mixedXml.includes('Consultoria Técnica, Estudo Preliminar'), 'O texto antigo de elegibilidade não foi substituído');

const partyAddress = 'Rua do Contratante, 100';
const propertyAddress = 'Rua da Obra, 200';
const contract = await fixture([
  `CONTRATANTE: Cliente de Teste, com endereço em ${partyAddress}.`,
  'CLÁUSULA 1ª – DO OBJETO',
  'RESUMO COMERCIAL VINCULADO',
  'Valor total dos honorários: R$ 1.000,00.',
  'Nível de experiência: BRONZE — Essencial.',
]);
const revisedContract = await api.enhanceContractDocument(contract, propertyAddress, [service], specification, '');
const contractXml = await xmlOf(revisedContract);
assert.ok(contractXml.includes(partyAddress), 'Endereço cadastral foi substituído indevidamente');
assert.ok(contractXml.includes(propertyAddress), 'Endereço da obra não aparece no escopo');
assert.equal(contractXml.split(specification).length - 1, 1, 'Atividade personalizada duplicada no contrato');
assert.ok(contractXml.includes('RESUMO COMERCIAL VINCULADO'), 'Resumo comercial desapareceu');
assert.ok(!contractXml.includes('Nível de experiência: BRONZE'), 'Contrato de Outros ainda contém nível de projeto do gerador principal');
const consultancyContract = await xmlOf(await api.enhanceContractDocument(contract, propertyAddress, [legacyConsultancy], '', 'bronze'));
assert.ok(!consultancyContract.includes('Nível de prestação:'), 'Consultoria recebeu indevidamente nível no escopo');
assert.ok(!consultancyContract.includes('Nível de experiência: BRONZE'), 'Consultoria recebeu Bronze no resumo do contrato');
const mixedContract = await xmlOf(await api.enhanceContractDocument(contract, propertyAddress, [legacyConsultancy, { code: 'a', name: 'Estudo Preliminar', included: true, levelApplicable: true }], '', 'bronze'));
assert.ok(mixedContract.includes('aplicável exclusivamente às atividades elegíveis'), 'Nível não foi restrito às atividades com pacote da proposta mista');
assert.ok(mixedContract.includes('Nível de experiência: BRONZE'), 'Nível de projeto foi removido indevidamente de contrato misto');
const tieredConsultancy = { ...legacyConsultancy, levelApplicable: true };
const tieredConsultancyWord = await fixture([
 '2. NÍVEL DE PRESTAÇÃO DE SERVIÇO',
 'Nível selecionado: OURO — Completo',
 'Benefícios apenas do serviço expressamente contratado',
 '3. ESCOPO INTELIGENTE DE SERVIÇOS',
 '1. Consultoria Técnica',
 'Prestação de consultoria conforme escopo aprovado.',
 'Revisões incluídas: 2 • Formatos: PDF • Prazo: conforme cronograma',
 'Na ausência de indicação específica no Anexo I, aplicam-se até 2 (duas) rodadas de revisão por etapa.',
 'O prazo geral de referência é de 45 (quarenta e cinco) dias úteis.',
]);
const tieredXml = await xmlOf(await api.enhanceQuoteDocument(tieredConsultancyWord,[tieredConsultancy],''));
assert.ok(tieredXml.includes('Nível selecionado: OURO'), 'Consultoria avulsa perdeu o pacote contratado');
assert.ok(!tieredXml.includes('Revisões incluídas: 2'), 'Consultoria avulsa recebeu revisões de projeto automaticamente');
assert.ok(!tieredXml.includes('prazo geral de referência é de 45'), 'Consultoria avulsa recebeu prazo de projeto automaticamente');
const tieredContract = await xmlOf(await api.enhanceContractDocument(contract,propertyAddress,[tieredConsultancy],'','bronze'));
assert.ok(tieredContract.includes('Nível de prestação: BRONZE'), 'Contrato da consultoria avulsa perdeu o pacote');
assert.ok(tieredContract.includes(partyAddress) && tieredContract.includes(propertyAddress), 'Endereços divergiram');
const coreGenerator = readFileSync(resolve(root,'supabase/functions/generate-commercial-document/index.ts'),'utf8');
assert.ok(coreGenerator.includes('às atividades elegíveis incluídas nesta proposta'), 'Orçamento ainda restringe nível a projetos');
assert.ok(coreGenerator.includes("||'conforme Anexo I'"), 'Orçamento ainda presume PDF sem formato');
console.log('PASS: históricos preservados; consultoria avulsa com pacote; sem prazos e revisões presumidos; escopo, endereços e Word válidos.');