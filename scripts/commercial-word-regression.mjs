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
const start = source.indexOf('const wordParagraph =');
const end = source.indexOf('async function sha256(');
assert.ok(start > 0 && end > start, 'Funções de revisão Word não foram encontradas');
const isolatedCode = stripTypeScriptTypes(source.slice(start, end), { mode: 'strip' });
const context = {
  JSZip,
  Uint8Array,
  text: value => String(value ?? '').trim(),
  isOther: item => ['p', 'outro', 'outros'].includes(String(item.code ?? '').trim().toLowerCase()),
  xmlEsc: value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
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
assert.ok(revisedXml.includes('Atividade específica solicitada:'), 'Texto personalizado não foi construído');

const unchanged = await api.enhanceQuoteDocument(quote, [{ code: 'a', name: 'Estudo Preliminar', included: true }], '');
assert.equal(unchanged, quote, 'Orçamento sem Outros sofreu modificação indevida');

const partyAddress = 'Rua do Contratante, 100';
const propertyAddress = 'Rua da Obra, 200';
const contract = await fixture([
  `CONTRATANTE: Cliente de Teste, com endereço em ${partyAddress}.`,
  'CLÁUSULA 1ª – DO OBJETO',
  'RESUMO COMERCIAL VINCULADO',
  'Valor total dos honorários: R$ 1.000,00.',
]);
const revisedContract = await api.enhanceContractDocument(contract, propertyAddress, [service], specification, '');
const contractXml = await xmlOf(revisedContract);
assert.ok(contractXml.includes(partyAddress), 'Endereço cadastral foi substituído indevidamente');
assert.ok(contractXml.includes(propertyAddress), 'Endereço da obra não aparece no escopo');
assert.equal(contractXml.split(specification).length - 1, 1, 'Atividade personalizada duplicada no contrato');
assert.ok(contractXml.includes('RESUMO COMERCIAL VINCULADO'), 'Resumo comercial desapareceu');
console.log('PASS: DOCX orçamento e contrato íntegros; Outros sem duplicação; endereços separados; prazos/formatos não presumidos.');