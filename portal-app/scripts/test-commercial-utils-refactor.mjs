import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const script = fs.readFileSync('../js/commercial-documents-utils.js','utf8');
const window = {};
vm.runInNewContext(script, { window });
const utils = window.CMECommercialUtils;
assert.ok(Object.isFrozen(utils));
assert.equal(utils.normalizeSearch('Projetó  Hidráulico!'), 'projeto hidraulico');
assert.equal(utils.editDistance('elétrico', 'eletrico'), 0);
assert.equal(utils.editDistance('casa', 'caso'), 1);
assert.equal(utils.serviceSearchTerms({ name: 'Projeto Legal', aliases: ['Aprovação'], synonyms: [], keywords: ['Prefeitura'] }).length, 3);
assert.equal(utils.suggestCatalogService('projeto eletico', [
  { code: 'e', name: 'Projeto Elétrico', aliases: [], synonyms: ['projeto eletrico'], keywords: [] },
  { code: 'p', name: 'Outro', aliases: ['projeto eletico'] },
])?.code, 'e', 'Não substituir serviço técnico por Outro');
assert.equal(utils.suggestCatalogService('xy', [{code:'a',name:'Construção'}]), null);
assert.equal(utils.quoteIdentity({cpf_cnpj:'123.456.789-00', prospect_name:'Pessoa'}),'documento:12345678900');
assert.equal(utils.quoteIdentity({prospect_name:'João  José'}), 'nome:joao jose');
assert.equal(utils.sameQuoteOwner([{cpf_cnpj:'123.456.789-00'},{cpf_cnpj:'12345678900'}]),true);
assert.equal(utils.sameQuoteOwner([{cpf_cnpj:'123'},{cpf_cnpj:'456'}]),false);
assert.equal(utils.firstFilled([{price:null},{price:' '},{price:'13,00'}],'price'),'13,00');
assert.equal(utils.moneyValue(null),'');
assert.equal(utils.moneyValue(1234.5),'1.234,50');
assert.equal(utils.parseMoney('1.234,50'),1234.5);
assert.equal(utils.parseMoney(''),null);
assert.equal(utils.parseMoney('sem valor'),null);
const sources=[
  {services:[{code:'a',name:'Estudo',included:false,notes:'Primeiro orçamento'}, {code:'b',name:'Legal',included:true,notes:'Aprovado',revisions:3}]},
  {services:[{code:'a',name:'Estudo atualizado',included:true,notes:'Contratado',price:500,deliverables:['planta']},{code:'custom',name:'Assessoria',included:true,price:100}]},
];
const combined=utils.combinedServices(sources,[['a','Estudo preliminar'],['b','Projeto legal'],['c','Outro']]);
assert.equal(combined.length,4);
assert.equal(combined[0].included,true);
assert.equal(combined[0].price,500);
assert.deepEqual([...combined[0].deliverables],['planta']);
assert.equal(combined[1].revisions,3);
assert.equal(combined[2].included,false);
assert.equal(combined[3].code,'custom');
assert.equal(utils.buildProjectAddress({endereco_obra:'Rua A',numero_obra:'45',bairro_obra:'Centro',cidade_obra:'São Paulo'}),'Rua A, 45, Centro, São Paulo');

// Carregador histórico: vínculo de cliente, contrato, endereço e escopo sem alterar snapshots.
const tables = {
  clientes: [{ id: 'c1', nome: 'Cliente 1', cpf_cnpj: '12345678900', email: 'cliente@example.com', telefone: '', endereco: 'Rua Cliente' }],
  contratos: [{ id: 'k1', contract_number: 'CTR-01', contract_value: 5400, service_type: 'Projeto legal', notes: 'Prazo validado' }],
  contract_scope_items: [{ contract_id: 'k1', service_code: 'c', service_name: 'Projeto legal', included: true, acceptance_required: true, display_order: 1, notes: 'Aprovado' }],
};
const db = { from(name) { return { select() { return { async in(field, ids) {
  return { data: (tables[name] || []).filter(row => ids.includes(row[field])), error: null };
} }; } }; } };
const project = { id: 'p1', nome: 'Casa Cliente', cliente_id: 'c1', contract_id: 'k1',
  numero_orcamento: 'ORC-12', endereco_obra: 'Rua Obra', numero_obra: '25', cidade_obra: 'São Paulo' };
const legacy = await utils.loadLegacyQuoteSources([project], db);
assert.equal(legacy.length, 1);
assert.equal(legacy[0].key, 'project:p1');
assert.equal(legacy[0].sourceType, 'project');
assert.equal(legacy[0].cpf_cnpj, '12345678900');
assert.equal(legacy[0].total_value, 5400);
assert.equal(legacy[0].property_address, 'Rua Obra, 25, São Paulo');
assert.equal(legacy[0].services[0].acceptanceRequired, true);
assert.equal(legacy[0].services[0].notes, 'Aprovado');
assert.deepEqual([...await utils.loadLegacyQuoteSources([], db)], []);

const html=fs.readFileSync('../orcamentos-contratos.html','utf8');
const main=fs.readFileSync('../js/commercial-documents-web.js','utf8');
assert.ok(html.indexOf('commercial-documents-utils.js') < html.indexOf('commercial-documents-web.js'),
  'A biblioteca comercial precisa carregar antes do formulário');
assert.match(main, /window\.CMECommercialUtils/);
assert.match(main, /commercialUtils\.combinedServices\(items, servicesCatalog\)/);
assert.match(main, /commercialUtils\.suggestCatalogService\(value, serviceCatalogMeta\)/);
assert.match(main, /p_record_id|commercial_records/, 'Fluxos de contrato e orçamento preservados');
console.log('PASS: identidade de cliente, busca aproximada, valores e snapshots completos das propostas preservados.');
