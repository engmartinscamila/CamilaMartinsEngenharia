import assert from 'node:assert/strict';
import fs from 'node:fs';

const serviceSource = fs.readFileSync(new URL('../src/services/commercial-service.ts', import.meta.url), 'utf8');
const screenSource = fs.readFileSync(new URL('../src/app/admin/commercial-documents.tsx', import.meta.url), 'utf8');

let checks = 0;
const ok = (condition, message) => { assert.ok(condition, message); checks += 1; };

ok(serviceSource.includes(".from('service_catalog')"), 'fluxo comercial consulta service_catalog');
ok(serviceSource.includes(".eq('active', true)"), 'somente serviços ativos são oferecidos');
ok(serviceSource.includes(".order('code')"), 'catálogo é carregado em ordem canônica');
ok(screenSource.includes('listCommercialServiceCatalog'), 'tela comercial carrega o catálogo central');
ok(screenSource.includes('catalogServices.map'), 'seleção de serviços é renderizada pelo catálogo central');
ok(!screenSource.includes('CONTRACT_SCOPE_PRESETS'), 'tela comercial não usa lista fixa paralela');
ok(screenSource.includes('disabled={catalogServices.length===0}'), 'criação é bloqueada se o catálogo falhar, evitando escopo desatualizado');

console.log(`CATÁLOGO COMERCIAL CENTRAL: ${checks} verificações passaram.`);
