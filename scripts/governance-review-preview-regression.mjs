import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('js/configuracoes.js','utf8');
const start = source.indexOf('    function conteudoDaRevisao(item) {');
const end = source.indexOf('    function renderizarPendenciasGovernanca() {',start);
assert.ok(start>=0 && end>start,'Função de conteúdo da revisão ausente');
const code=source.slice(start,end);
const state={
 contractBody:'1.5. Serviços avulsos aceitam níveis.\nParágrafo complementar: todos os limites devem ser respeitados.\n\n1.7. Nenhuma atividade adicional será presumida.\nExceções somente se previstas no Anexo I.\n2.1. Cláusula alheia à revisão.',
 services:[{code:'q',name:'Consultoria Técnica',description:'Avaliação técnica de fachada.',deliverables:['Orientação escrita'],exclusions:['Execução']}],
 levels:[{code:'prata',label:'PRATA',subtitle:'Ampliado',description:'Suporte contratual específico.',features:['Suporte'],exclusions:[]}],
 texts:[{code:'level_scope_rule',body:'Os níveis abrangem apenas atividades selecionadas.'}]
};
function evaluate(review){return vm.runInNewContext(`${code}\nconteudoDaRevisao(item);`,{governanceState:state,item:review});}
const service=evaluate({source_type:'contract',source_code:'service:q',clause_refs:['1.5','1.7']});
assert.equal(service.complete,true);
assert.match(service.sourceText,/Consultoria Técnica/);
assert.match(service.contractText,/Serviços avulsos aceitam níveis/);
assert.match(service.contractText,/Parágrafo complementar: todos os limites/,'Texto da cláusula 1.5 foi cortado');
assert.match(service.contractText,/Exceções somente se previstas no Anexo I/,'Texto da cláusula 1.7 foi cortado');
assert.doesNotMatch(service.contractText,/Cláusula alheia à revisão/,'Incluiu cláusula não vinculada');
const text=evaluate({source_type:'text',source_code:'level_scope_rule',clause_refs:['1.7']});
assert.equal(text.complete,true);
assert.match(text.sourceText,/atividades selecionadas/);
assert.match(text.contractText,/Exceções somente/);
const unknown=evaluate({source_type:'service',source_code:'inexistente',clause_refs:['1.5']});
assert.equal(unknown.complete,false,'Item desconhecido não pode ser aprovado às cegas');
const missing=evaluate({source_type:'service',source_code:'q',clause_refs:['9.9']});
assert.equal(missing.complete,false,'Cláusula não localizada deve bloquear aprovação');
assert.ok(source.includes('data-governance-details'), 'Painel de conferência ausente');
assert.ok(source.includes('data-review-complete'), 'Condição de liberação ausente');
assert.ok(source.includes('botao.disabled = !detalhes.open'), 'Confirmar não depende da leitura');
assert.ok(source.includes('if (!detalhes?.open || detalhes.dataset.reviewComplete !== "true") return;'), 'Confirmação pode ser acionada sem abrir os detalhes');
console.log('PASS: texto completo de cláusulas multilinha, ausência de cláusulas alheias, referências faltantes bloqueadas e confirmação condicionada à visualização.');
