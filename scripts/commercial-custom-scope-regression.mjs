import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Executa apenas a função pura de leitura do formulário, sem sessão, rede ou banco.
const source = fs.readFileSync('js/commercial-documents-web.js', 'utf8');
const start = source.indexOf('  function form() {');
const end = source.indexOf('\n  async function lookup(', start);
assert.ok(start >= 0 && end > start, 'Função form() não localizada');
const snippet = source.slice(start, end);
const servicesCatalog = [['a', 'Estudo Preliminar'], ['p', 'Outro'], ['q', 'Consultoria Técnica']];
function inspect({ custom = '', selected = [] } = {}) {
  const inputs = new Map([['customService', custom], ['prospectName', 'Prospect fictício'], ['experienceLevel', 'bronze']]);
  const elements = { getElementById: id => ({ value: inputs.get(id) ?? '' }), querySelector: selector => {
    const match = selector.match(/^\[data-service="([a-z]+)"\]$/);
    return match ? { checked: selected.includes(match[1]) } : null;
  } };
  return vm.runInNewContext(`${snippet}\nform();`, {
    servicesCatalog,
    document: elements,
    $: elements.getElementById,
  });
}
const customOnly = inspect({ custom: 'Vistoria específica de fachada' });
assert.equal(customOnly.services.filter(item => item.included).length, 1, 'Descrição livre deve selecionar uma única atividade');
assert.equal(customOnly.services.find(item => item.code === 'p').included, true, 'Outro precisa estar vinculado ao snapshot');
assert.equal(customOnly.custom_service, 'Vistoria específica de fachada');
const mixed = inspect({ custom: 'Vistoria específica de fachada', selected: ['a', 'p'] });
assert.deepEqual(Array.from(mixed.services.filter(item => item.included).map(item => item.code)), ['a', 'p'], 'Atividade normal deve permanecer selecionada e Outro não pode duplicar');
const regular = inspect({ selected: ['q'] });
assert.deepEqual(Array.from(regular.services.filter(item => item.included).map(item => item.code)), ['q'], 'Sem descrição personalizada, nenhuma atividade adicional deve surgir');
assert.ok(source.includes('if (!serviceCatalogMeta.length || !levelCatalog.length)'), 'Falha de catálogo precisa interromper criação em vez de usar lista antiga');
assert.ok(source.includes("$('customService')?.addEventListener('input'"), 'Interface deve marcar Outro ao receber descrição');
console.log('PASS: Outros automático, sem duplicação; serviço regular preservado; falha de catálogo bloqueada; checkbox sincronizado.');
