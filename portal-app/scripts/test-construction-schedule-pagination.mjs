import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

// Isolamento: dependências Supabase simuladas, sem acessar banco, clientes ou credenciais.
function loadService(path, dependencies) {
  const source = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  const fakeRequire = (name) => {
    if (name in dependencies) return dependencies[name];
    throw new Error(`Dependência inesperada no teste: ${name}`);
  };
  new Function('require', 'module', 'exports', js)(fakeRequire, module, module.exports);
  return module.exports;
}

let checks = 0;
const ok = (value, description) => { assert.ok(value, description); checks += 1; };
const mockDownload = { downloadBase64File: async () => {} };

const projectRows = Array.from({ length: 430 }, (_, i) => ({
  id: `project-${String(i).padStart(5, '0')}`,
  cliente_id: `client-${String(i).padStart(5, '0')}`,
  contract_id: null,
  nome: `Projeto ${i}`,
  tipo: 'residencial',
  numero_contrato: null,
  data_inicio: null,
  data_fim: null,
  area_construida_m2: null,
  area_terreno_m2: null,
}));
const clients = projectRows.map((row) => ({ id: row.cliente_id, nome: `Cliente ${row.cliente_id}` }));
const projectRanges = [];
const clientGroups = [];
function projectQuery(table) {
  let ids = [];
  return {
    select() { return this; },
    order() { return this; },
    in(_field, values) { ids = values; return this; },
    async range(start, end) {
      projectRanges.push([start, end]);
      return { data: projectRows.slice(start, end + 1), error: null };
    },
    then(resolve, reject) {
      if (table !== 'clientes') return Promise.reject(new Error(`then inesperado: ${table}`)).then(resolve, reject);
      clientGroups.push([...ids]);
      return Promise.resolve({ data: clients.filter((row) => ids.includes(row.id)), error: null }).then(resolve, reject);
    },
  };
}
const projectService = loadService('../src/services/construction-schedule-service.ts', {
  '@/lib/download-generated-file': mockDownload,
  '@/lib/errors': { toUserMessage: (_error, fallback) => fallback },
  '@/lib/supabase': { supabase: { from: projectQuery } },
});
const projects = await projectService.listConstructionScheduleProjects();
ok(projects.error === null, 'lista de projetos retorna sem erro');
ok(projects.data.length === 430, 'recupera projetos além do antigo limite 200');
ok(projectRanges.length === 3 && projectRanges[1][0] === 200, 'páginas do projeto não se sobrepõem');
ok(projects.data[429].clientName === 'Cliente client-00429', 'nome do último cliente não desaparece');
ok(clientGroups.length === 5 && clientGroups.every((batch) => batch.length <= 100), 'busca nomes somente dos clientes pertinentes em lotes');

const documents = Array.from({ length: 450 }, (_, i) => ({
  id: `record-${String(i).padStart(5, '0')}`,
  record_kind: i % 2 ? 'contrato' : 'orcamento',
  quote_number: `ORC-${i}`,
  contract_number: `CON-${i}`,
  status: 'rascunho',
  linked_project_id: null,
  linked_client_id: null,
  linked_contract_id: null,
  services: [],
  total_value: null,
}));
const links = Array.from({ length: 1050 }, (_, i) => ({
  quote_record_id: `quote-${String(i).padStart(5, '0')}`,
  contract_record_id: `contract-${String(i).padStart(5, '0')}`,
}));
const authorizations = [{
  document_id: 'additional-001',
  project_id: 'project-00001',
  contract_id: null,
  document_version: '1.0',
  accepted_at: '2026-09-23T20:00:00Z',
  service_code: 's',
  service_name: 'Cronograma completo',
  service_level: 'ouro',
}];
const documentRanges = [];
const linkRanges = [];
const rpcCalls = [];
let missingAuthorizationRpc = false;
let failSecondDocumentPage = false;
function commercialQuery(table) {
  return {
    select() { return this; },
    in() { return this; },
    order() { return this; },
    async range(start, end) {
      if (table === 'commercial_records') {
        documentRanges.push([start, end]);
        if (failSecondDocumentPage && start === 200) return { data: null, error: { message: 'Falha simulada na segunda página' } };
        return { data: documents.slice(start, end + 1), error: null };
      }
      if (table === 'commercial_contract_quote_links') {
        linkRanges.push([start, end]);
        return { data: links.slice(start, end + 1), error: null };
      }
      throw new Error(`Tabela inesperada: ${table}`);
    },
  };
}
const commercialService = loadService('../src/services/construction-schedule-contract-service.ts', {
  '@/lib/download-generated-file': mockDownload,
  '@/lib/supabase': { supabase: {
    from: commercialQuery,
    rpc: async (name) => {
      rpcCalls.push(name);
      if (name === 'admin_list_full_schedule_additional_authorizations') {
        if (missingAuthorizationRpc) return { data: null, error: { code: 'PGRST202', message: 'Could not find the function admin_list_full_schedule_additional_authorizations' } };
        return { data: authorizations, error: null };
      }
      return { data: null, error: { message: `RPC inesperada: ${name}` } };
    },
  } },
  '@/services/construction-schedule-service': { listConstructionScheduleProjects: async () => ({ data: projects.data, error: null }) },
});
const result = await commercialService.loadScheduleCommercialOptions();
ok(result.error === null && result.data !== null, 'opções carregam sem erro');
ok(result.data.quotes.length + result.data.contracts.length === 450, 'orçamentos/contratos completos');
ok(result.data.links.length === 1050, 'vínculos além do antigo limite 1000 recuperados');
ok(result.data.additionalAuthorizations.length === 1 && result.data.additionalAuthorizations[0].serviceCode === 's', 'Serviço Adicional aceito entra como autorização alternativa do cronograma');
ok(rpcCalls.includes('admin_list_full_schedule_additional_authorizations'), 'autorizações adicionais são carregadas pelo RPC protegido');
ok(new Set(result.data.quotes.concat(result.data.contracts).map((item) => item.id)).size === 450, 'sem duplicar documentos');
ok(documentRanges.length === 3 && documentRanges[2][0] === 400, 'paginação de documentos usa intervalo correto');
ok(linkRanges.length === 6 && linkRanges[5][0] === 1000, 'paginação de vínculos usa intervalo correto');

missingAuthorizationRpc = true;
const rolloutCompatible = await commercialService.loadScheduleCommercialOptions();
ok(rolloutCompatible.error === null && rolloutCompatible.data?.additionalAuthorizations.length === 0,
  'ausência temporária do novo RPC não quebra o caminho antigo de orçamento e contrato');
missingAuthorizationRpc = false;

failSecondDocumentPage = true;
const failed = await commercialService.loadScheduleCommercialOptions();
ok(failed.data === null && failed.error?.includes('Falha simulada'), 'falha intermediária nunca devolve lista parcial como se estivesse completa');
console.log(`PAGINAÇÃO COMERCIAL/CRONOGRAMA: ${checks} verificações passaram com dados sintéticos.`);
