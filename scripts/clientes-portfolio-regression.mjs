import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Smoke tests without credentials, data access or writes.
// These validate startup contracts; browser CRUD/upload flows require separate testing.
function checkModule(file) {
  const source = readFileSync(file, 'utf8');
  const events = new Map();
  const errors = [];
  const document = {
    readyState: 'loading',
    addEventListener(name, handler) { events.set(name, handler); },
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
  const window = {
    location: { hash: '', pathname: '/portfolio.html' },
    history: { replaceState() {} },
    addEventListener() {},
    confirm() { return false; },
  };
  const sandbox = {
    document, window,
    File: class File {},
    console: { log() {}, warn() {}, error(...values) { errors.push(values.join(' ')); } },
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    setTimeout() { return 1; },
  };
  new vm.Script(source, { filename: file }).runInNewContext(sandbox, { timeout: 2000 });
  assert.deepEqual(errors, [], file + ': startup reported errors');
  return { source, events, window };
}

const clients = checkModule('js/clientes.js');
assert.equal(typeof clients.events.get('DOMContentLoaded'), 'function', 'Clients init must register');
assert.equal(typeof clients.window.carregarClientesAdmin, 'function', 'Clients admin API must remain available');
assert.ok(clients.source.includes('dbBuscarClientes'), 'Clients data lookup must remain intact');
assert.ok(clients.source.includes('salvarCliente'), 'Clients save flow must remain intact');

await clients.events.get('DOMContentLoaded')();

const portfolio = checkModule('js/portfolio-admin.js');
assert.ok(portfolio.source.includes('portfolioProjectSlug'), 'Project slug editor must remain available');
assert.ok(portfolio.source.includes('portfolioMediaPoster'), 'Media upload editor must remain available');
assert.ok(!portfolio.source.includes('function a0_0x22eb'), 'Obfuscated string lookup table must not return');

console.log('Clientes e Portfólio: sintaxe, inicialização e interfaces essenciais aprovadas.');
