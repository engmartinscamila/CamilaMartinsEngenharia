import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('js/ui-core.js','utf8'),groups=JSON.parse(fs.readFileSync('portal-app/src/lib/admin-menu-groups.json','utf8'));
assert.equal(groups.length,7);assert.deepEqual(groups.map(g=>g.title),['Início','Clientes e contratos','Documentos e arquivos','Gestão de obras','Financeiro e recibos','Agenda e comunicação','Configurações']);
const embedded=JSON.parse(source.match(/const ADMIN_MENU_GROUPS=(\[[^\n]*\]);/)[1]);assert.deepEqual(embedded,groups,'Web and native categories must not drift');
const keys=groups.flatMap(g=>g.sections);assert.equal(new Set(keys).size,keys.length,'Every function belongs to exactly one area');
const sections=fs.readFileSync('portal-app/src/lib/admin-sections.ts','utf8');const native=[...sections.matchAll(/key: '([^']+)'/g)].map(m=>m[1]);assert.deepEqual([...keys].sort(),[...native,'dashboard'].sort());
const classic=JSON.parse(source.match(/const CLASSIC_MENU_KEYS=(\{[^\n]*\});/)[1]);
const routes=[...source.match(/const MENU_ADMIN_CANONICO=\[([\s\S]*?)\];/)[1].matchAll(/\["([^"]+)",/g)].map(m=>m[1]);
for(const route of routes){const key=route.startsWith('portal/admin/')?route.slice(13):classic[route];assert(keys.includes(key),`Unreachable menu destination: ${route}`);}
assert.equal(routes.length,29);assert(!keys.some(key=>/nfse|fiscal/.test(key)),'NF remains on standby');
console.log('PASS: sete áreas, 29 destinos clássicos e 34 seções do portal, sem funções perdidas ou repetidas entre grupos.');
