import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const adminSession = { user: { id: 'synthetic-admin' } };
const clientSession = { user: { id: 'synthetic-client' } };

// Provider real, identidades sintéticas e agendamento determinístico; nenhuma rede.
function mount() {
  const slots = [], effects = [], timers = [], requests = [];
  let cursor = 0, mounted = false, listener;
  const initial = deferred();
  const react = {
    createContext: () => ({ Provider: 'provider' }), useContext: () => null,
    useState: value => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof value === 'function' ? value() : value;
      return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
    },
    useRef: value => { const index = cursor++; return slots[index] ??= { current: value }; },
    useCallback: callback => callback, useMemo: callback => callback(),
    useEffect: callback => { if (!mounted) effects.push(callback); },
  };
  const dependencies = {
    react, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    'expo-linking': {}, 'react-native': { Platform: { OS: 'web' }, AppState: {} },
    '@/lib/env': { env: { isSupabaseConfigured: true } },
    '@/lib/supabase': { supabase: { auth: {
      getSession: () => initial.promise,
      onAuthStateChange: callback => { listener = callback; return { data: { subscription: { unsubscribe() {} } } }; },
      signOut: async () => {},
    } } },
    '@/services/auth-service': {
      resolveIdentity: user => { const request = { user, ...deferred() }; requests.push(request); return request.promise; },
      sendAccessLink: async () => null, signInWithPassword: async () => null, updatePassword: async () => null,
    },
  };
  const exports = {};
  const code = ts.transpileModule(readFileSync('src/providers/auth-provider.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, URLSearchParams, console, setTimeout: callback => timers.push(callback), require: key => {
    assert.ok(key in dependencies, `Unexpected dependency ${key}`); return dependencies[key];
  } });
  const render = () => { cursor = 0; return exports.AuthProvider({ children: null }).props.value; };
  render(); mounted = true;
  const cleanups = effects.map(callback => callback());
  return {
    initial, requests, state: render, event: (event, session) => listener(event, session),
    tick: async () => { while (timers.length) timers.shift()(); await flush(); },
    unmount: () => cleanups.forEach(cleanup => cleanup?.()),
  };
}

{
  const app = mount();
  app.event('INITIAL_SESSION', adminSession);
  app.initial.resolve({ data: { session: adminSession } }); await flush();
  assert.equal(app.state().loading, true, 'A rota não pode tratar a sessão como anônima enquanto o papel é consultado');
  await app.tick();
  assert.equal(app.state().loading, true); assert.equal(app.requests.length, 1);
  app.requests[0].resolve({ role: 'admin', client: null }); await flush();
  assert.equal(app.state().loading, false); assert.equal(app.state().role, 'admin');
  assert.equal(app.state().session, adminSession);
}
{
  const app = mount();
  app.event('INITIAL_SESSION', adminSession); await app.tick();
  app.event('SIGNED_IN', clientSession); await app.tick();
  app.requests[0].resolve({ role: 'admin', client: null }); await flush();
  assert.equal(app.state().loading, true, 'Resposta antiga não encerra a validação da conta nova');
  assert.notEqual(app.state().role, 'admin');
  app.requests[1].resolve({ role: 'client', client: { id: 'client' } }); await flush();
  assert.equal(app.state().role, 'client'); assert.equal(app.state().session, clientSession);
  assert.equal(app.state().loading, false);
}
{
  const app = mount();
  app.event('INITIAL_SESSION', adminSession); await app.tick();
  app.event('SIGNED_OUT', null); await app.tick();
  app.requests[0].resolve({ role: 'admin', client: null }); await flush();
  assert.equal(app.state().session, null); assert.equal(app.state().role, 'unassigned');
  assert.equal(app.state().loading, false, 'Logout não restaura a sessão antiga');
}
{
  const app = mount();
  app.event('INITIAL_SESSION', adminSession); await app.tick();
  app.requests[0].reject(new Error('Servidor indisponível')); await flush();
  assert.equal(app.state().role, 'unassigned'); assert.equal(app.state().loading, false);
}
{
  const app = mount();
  app.event('INITIAL_SESSION', null); await app.tick();
  assert.equal(app.state().session, null); assert.equal(app.state().loading, false);
  assert.equal(app.requests.length, 0);
}
{
  const app = mount();
  app.event('INITIAL_SESSION', adminSession); await app.tick();
  app.requests[0].resolve({ role: 'admin', client: null }); await flush();
  app.event('TOKEN_REFRESHED', adminSession); await app.tick();
  assert.equal(app.state().loading, false, 'Renovação não desmonta a ferramenta');
  app.requests[1].resolve({ role: 'admin', client: null }); await flush();
  app.event('SIGNED_IN', clientSession); await app.tick(); app.unmount();
  const before = app.state();
  app.requests[2].resolve({ role: 'client', client: null }); await flush();
  assert.equal(app.state().role, before.role, 'Resposta tardia não altera provider desmontado');
}
process.stdout.write('PASS: restauração, concorrência de perfis, logout, falha, sessão ausente, renovação e desmontagem; sem rede nem dados reais.\n');
