import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const portalRequire = createRequire(pathToFileURL(resolve(root, 'portal-app/package.json')));
const JSZip = portalRequire('jszip');
const { generateNativeOptionsDocx } = await import(pathToFileURL(resolve(root, 'portal-app/supabase/functions/generate-contract-document-final/native-options-docx.ts')).href);

const profile = { name: 'Camila Martins', professionalTitle: 'Engenheira Civil', registration: 'CREA TESTE' };
const base = {
  client_name: 'Cliente Fictício',
  client_cpf_cnpj: '000.000.000-00',
  contract_number: 'TESTE-001',
  project_name: 'Projeto Fictício',
  project_type: 'Residencial',
  property_address: 'Rua Fictícia, 100',
  approval_title: 'Layout térreo — versão 03',
  delivered_at: '2026-09-24T12:00:00-03:00',
  approval_due_at: '2026-09-30T23:59:59-03:00',
};

async function xml(kind, data) {
  const bytes = await generateNativeOptionsDocx(kind, data, profile);
  assert.ok(bytes && bytes.byteLength > 500, `${kind}: DOCX não foi gerado`);
  const zip = await JSZip.loadAsync(bytes);
  const documentXml = await zip.file('word/document.xml')?.async('string');
  assert.ok(documentXml?.includes('<w:document'), `${kind}: word/document.xml ausente`);
  assert.ok(!documentXml.includes('[[CME-'), `${kind}: marcador de checkbox não convertido`);
  execFileSync('python3', ['-c', 'import sys, xml.etree.ElementTree as ET; ET.fromstring(sys.stdin.read())'], { input: documentXml });
  return documentXml;
}

const term = await xml('termo_aceite', { ...base, document_options: {} });
assert.equal((term.match(/<w14:checkbox>/g) ?? []).length, 3, 'Termo de Aceite precisa de três manifestações clicáveis');
assert.ok(term.includes('Aceito sem ressalvas.'), 'Aceite simples ausente');
assert.ok(term.includes('Aceito com ressalvas.'), 'Aceite com ressalvas ausente');
assert.ok(term.includes('Recuso esta entrega.'), 'Recusa ausente');
assert.equal((term.match(/<w14:checked w14:val="1"\/?>/g) ?? []).length, 0, 'Admin não pode pré-marcar a decisão do cliente');

const additional = await xml('servico_adicional', {
  ...base,
  document_options: {
    additional_service_code: 'teste',
    additional_service_name: 'Serviço Fictício',
    additional_service_description: 'Descrição exclusivamente sintética.',
    reasons: ['scope_change'],
    pricing: 'fixed',
    additional_value: 'R$ 1.000,00',
    payment_method: 'pix',
    schedule_impact: 'Sem impacto no cenário fictício.',
  },
});
assert.ok(additional.includes('Aceito o serviço adicional'), 'Serviço Adicional não oferece manifestação do cliente');
assert.ok(additional.includes('contrato paralelo'), 'Serviço Adicional deve permanecer vinculado ao contrato original');
assert.equal((additional.match(/<w14:checked w14:val="1"\/?>/g) ?? []).length, 2, 'Somente a origem e o critério comercial selecionados pelo admin devem vir marcados; as três decisões do cliente permanecem vazias');

const imageAuthorization = await xml('autorizacao_imagem', {
  ...base,
  document_options: {
    materials: ['renders'],
    channels: ['portfolio'],
    privacy: ['no_people'],
  },
});
assert.ok((imageAuthorization.match(/<w14:checkbox>/g) ?? []).length >= 8, 'Autorização de Imagem não recebeu controles Word reais');
assert.ok((imageAuthorization.match(/<w14:checked w14:val="1"\/?>/g) ?? []).length >= 3, 'Seleções administrativas autorizadas não foram refletidas');

const survey = await xml('levantamento_tecnico', {
  ...base,
  document_options: {
    inspection_datetime: '24/09/2026 10:30',
    observed: ['electrical','hydraulic','sanitary','structure','masonry','waterproofing','facade','accessibility','fire_safety','dimensions','equipment'],
    conditions: ['cracks','moisture','safety_risk'],
    technical_responsible: 'Camila Martins',
    measurements: 'Dados fictícios editáveis.',
    conditions_description: 'Condições fictícias.',
  },
});
for (const label of ['Esgoto / ventilação sanitária','Alvenarias e vedações','Impermeabilização','Fachadas','Acessibilidade','segurança contra incêndio','Dimensões / níveis / pé-direito','Condição aparente que requer avaliação de segurança']) {
  assert.ok(survey.toLocaleLowerCase('pt-BR').includes(label.toLocaleLowerCase('pt-BR')), `Vistoria não contém: ${label}`);
}
assert.ok((survey.match(/<w14:checkbox>/g) ?? []).length >= 20, 'Vistoria não oferece checkboxes suficientes');
assert.ok(survey.includes('REGISTROS E FOTOS') && survey.includes('Espaço para fotografias e legendas'), 'Vistoria precisa preservar espaço explícito para registro fotográfico');
assert.ok(survey.includes('Data e horário da vistoria') && survey.includes('Responsável pelo acompanhamento no local'), 'Vistoria precisa registrar data/hora e acompanhante');

console.log('DOCX OOXML de finalização: OK');
