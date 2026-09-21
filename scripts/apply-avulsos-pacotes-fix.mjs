import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(content, before, after, reason) {
  const occurrences = content.split(before).length - 1;
  assert.equal(occurrences, 1, `${reason}: esperada uma única ocorrência; encontradas ${occurrences}. Não modificar código desconhecido.`);
  return content.replace(before, after);
}
function patch(path, edits) {
  const previous = readFileSync(path, 'utf8');
  let next = previous;
  for (const [from, to, label] of edits) next = replaceOnce(next, from, to, label);
  assert.notEqual(next, previous, `Nenhuma alteração realizada em ${path}`);
  writeFileSync(path, next);
}
const finalPath = 'supabase/functions/generate-commercial-document-final/index.ts';
patch(finalPath, [
  ["// Snapshots anteriores podem indicar indevidamente elegibilidade de nível para\n// consultorias e serviços que não são projetos, contrariando o Contrato Mestre.\nconst nonProjectServiceCodes = new Set(['k', 'l', 'm', 'n', 'o', 'p', 'q']);\nconst isProjectTierEligible = (item: Obj) => item.levelApplicable === true && !nonProjectServiceCodes.has(text(item.code).toLowerCase());",
   '// A elegibilidade vem do snapshot versionado; serviços avulsos também podem ter pacote.\n// Não recalcular contratos históricos usando códigos fixos.\nconst isProjectTierEligible = (item: Obj) => item.levelApplicable === true;', 'eliminar exclusão fixa dos serviços avulsos'],
  ["aplicável exclusivamente aos serviços de projeto elegíveis expressamente contratados. Não acrescenta serviços", "aplicável exclusivamente às atividades elegíveis expressamente contratadas. Não acrescenta serviços", 'resumo de nível no contrato'],
  ["  const onlyNonProject = selected.length > 0 && selected.every(item => !isProjectTierEligible(item));\n  const legacyConsultancy", "  const onlyNonProject = selected.length > 0 && selected.every(item => !isProjectTierEligible(item));\n  const onlyStandaloneService = selected.length > 0 && selected.every(item => ['j', 'k', 'l', 'm', 'n', 'o', 'p', 'q'].includes(text(item.code).toLowerCase()));\n  const legacyConsultancy", 'separar aplicabilidade do pacote e prazo de projeto'],
  ["&& !onlyNonProject && !legacyConsultancy && selected.every(isProjectTierEligible)) return bytes;", "&& !onlyNonProject && !onlyStandaloneService && !legacyConsultancy && selected.every(isProjectTierEligible)) return bytes;", 'não ignorar correção de prazos para avulsos com pacote'],
  ["Bronze, Prata e Ouro aplicam-se apenas a serviços de projeto. As atividades desta proposta seguem exclusivamente as condições específicas aprovadas no orçamento e no Anexo I.", "O registro anterior não contém pacote válido no snapshot; prevalecem as condições específicas aprovadas no orçamento e no Anexo I, sem atribuição retroativa de nível.", 'históricos sem pacote não devem receber pacote retroativo'],
  ["  if (!replacement.size) return bytes;", "  if (onlyStandaloneService && !onlyNonProject) {\n    // A contratação avulsa pode ter pacote, mas não herda prazos/revisões de projeto.\n    values.forEach((value, index) => {\n      if (value.startsWith('Na ausência de indicação específica no Anexo I, aplicam-se até 2')) {\n        replacement.set(index, wordParagraph('Revisões e condições de aceite deste serviço avulso são as expressamente aprovadas para a atividade no Anexo I; erros técnicos continuam sujeitos a correção.'));\n      }\n      if (value.startsWith('O prazo geral de referência é de 45')) {\n        replacement.set(index, wordParagraph('O prazo do serviço avulso é o cronograma específico aprovado no Anexo I, sem aplicação automática de prazo de projeto ou de análise de terceiros.'));\n      }\n    });\n  }\n  if (!replacement.size) return bytes;", 'prazo e revisões dos avulsos elegíveis']
]);
const corePath = 'supabase/functions/generate-commercial-document/index.ts';
patch(corePath, [
  ["O nível selecionado aplica-se somente aos serviços de projeto elegíveis nesta proposta:", "O nível selecionado aplica-se somente às atividades elegíveis incluídas nesta proposta:", 'rótulo de elegibilidade no orçamento'],
  ["arrStrings(item.deliveryFormats).join(', ')||'PDF'", "arrStrings(item.deliveryFormats).join(', ')||'conforme Anexo I'", 'não presumir PDF em consultorias']
]);
console.log('PASS: alterações determinísticas aplicadas sem modificar outros arquivos.');