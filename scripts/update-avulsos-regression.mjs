import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const path='scripts/commercial-word-regression.mjs';
let src=readFileSync(path,'utf8');
function replaceOnce(before,after,name){assert.equal(src.split(before).length-1,1,`Não alterar teste desconhecido: ${name}`);src=src.replace(before,after);}
replaceOnce("const start = source.indexOf('const nonProjectServiceCodes =');","const start = source.indexOf('const isProjectTierEligible =');",'isolamento do gerador');
replaceOnce("const legacyConsultancy = { code: 'q', name: 'Consultoria Técnica', included: true, levelApplicable: true };","const legacyConsultancy = { code: 'q', name: 'Consultoria Técnica', included: true, levelApplicable: false };",'snapshot legado sem pacote');
replaceOnce("assert.ok(mixedContract.includes('aplicável exclusivamente aos serviços de projeto elegíveis'), 'Nível não foi restrito ao projeto da proposta mista');","assert.ok(mixedContract.includes('aplicável exclusivamente às atividades elegíveis'), 'Nível não foi restrito às atividades com pacote da proposta mista');",'nível de serviço elegível no contrato');
const marker="console.log('PASS: DOCX/ZIP/XML; Outros sem duplicação; endereços independentes; consultoria legada sem PDF/revisões/prazo/nível; proposta mista e projeto regular preservados.');";
const newTests=`const tieredConsultancy = { ...legacyConsultancy, levelApplicable: true };
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
console.log('PASS: históricos preservados; consultoria avulsa com pacote; sem prazos e revisões presumidos; escopo, endereços e Word válidos.');`;
replaceOnce(marker,newTests,'novos cenários de regressão');
writeFileSync(path,src);
console.log('PASS: testes atualizados sem remover cenários históricos.');