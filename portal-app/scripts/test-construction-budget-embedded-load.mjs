// A01 — Orçamento técnico deve carregar quando o projeto é escolhido pela
// navegação principal (modo incorporado), limpar dados ao trocar de projeto e
// descartar respostas atrasadas de projetos anteriores.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = require('react');
const TestRenderer = require('react-test-renderer');
const { act } = TestRenderer;

const source = fs.readFileSync('src/app/admin/construction-schedule-budget.tsx', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
}).outputText;

// Contexto administrativo controlado pelo teste.
const ModuleContext = React.createContext(null);
const pending = new Map(); // projectId -> resolve
const calls = [];
const host = (name) => { const C = (props) => React.createElement(name, props, props.children); C.displayName = name; return C; };
const stubs = {
  react: React,
  'react-native': { Text: host('Text'), View: host('View') },
  '@/components/admin-ui': { AdminPageHeader: host('Header') },
  '@/components/ui': {
    Button: host('Button'), Card: host('Card'), Field: host('Field'),
    Notice: host('Notice'), Screen: host('Screen'), StateView: host('StateView'),
  },
  '@/services/construction-schedule-service': {
    listConstructionScheduleProjects: async () => ({ data: [], error: null }),
  },
  '@/lib/construction-budget-validation': {
    analyzeExecutionBudget: () => ({ total: 0, valid: true, errors: [], lineCosts: {} }),
  },
  '@/services/construction-schedule-budget-service': {
    loadCurrentScheduleBudget: (projectId) => {
      calls.push(projectId);
      return new Promise((resolve) => pending.set(projectId, resolve));
    },
    saveCurrentScheduleBudget: async () => ({ total: 0, error: null }),
  },
  '@/providers/admin-module-context': {
    useAdminModule: () => React.useContext(ModuleContext),
    useAdminProjectSelection: () => {
      const ctx = React.useContext(ModuleContext);
      return [ctx.projectId, (id) => ctx.onProjectChange(id)];
    },
  },
};
const moduleExports = {};
vm.runInNewContext(compiled, {
  exports: moduleExports, module: { exports: moduleExports }, console, setTimeout, clearTimeout,
  require: (name) => { if (!(name in stubs)) throw new Error(`módulo inesperado: ${name}`); return stubs[name]; },
});
const Screen = moduleExports.default;

const draftFor = (projectId, title) => ({
  data: { scheduleId: `s-${projectId}`, projectId, title, revisionNumber: 1, items: [] },
  error: null,
});
const texts = (renderer) => renderer.root.findAllByType('Text').map((n) => [].concat(n.props.children).join(''));
const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 5)); });

function App({ projectId }) {
  return React.createElement(ModuleContext.Provider, {
    value: { projectId, module: 'construction-schedule-budget', onProjectChange: () => {}, onNavigate: () => {} },
  }, React.createElement(Screen));
}

let renderer;
await act(async () => { renderer = TestRenderer.create(React.createElement(App, { projectId: 'proj-A' })); });
await tick();
assert.deepEqual(calls, ['proj-A'], 'deve carregar o rascunho automaticamente pelo projeto do painel principal');

// Troca para B antes de A responder.
await act(async () => { renderer.update(React.createElement(App, { projectId: 'proj-B' })); });
await tick();
assert.deepEqual(calls, ['proj-A', 'proj-B'], 'deve recarregar ao trocar de projeto');

// B responde primeiro, depois A responde atrasado — A deve ser descartado.
await act(async () => { pending.get('proj-B')(draftFor('proj-B', 'Cronograma B')); });
await act(async () => { pending.get('proj-A')(draftFor('proj-A', 'Cronograma A')); });
let shown = texts(renderer).join(' | ');
assert.match(shown, /Cronograma B/, 'deve exibir o orçamento do projeto atual');
assert.doesNotMatch(shown, /Cronograma A/, 'resposta atrasada de outro projeto não pode sobrescrever a tela');

// Ao trocar para C, os dados de B devem sumir enquanto carrega.
await act(async () => { renderer.update(React.createElement(App, { projectId: 'proj-C' })); });
await tick();
shown = texts(renderer).join(' | ');
assert.doesNotMatch(shown, /Cronograma B/, 'dados do projeto anterior devem ser limpos ao trocar');

// Erro do serviço deve aparecer.
await act(async () => { pending.get('proj-C')({ data: null, error: 'Sem cronograma em rascunho.' }); });
const notices = renderer.root.findAllByType('Notice').map((n) => [].concat(n.props.children).join(''));
assert.ok(notices.some((t) => t.includes('Sem cronograma em rascunho.')), 'erro deve ser exibido');

await act(async () => { renderer.unmount(); });
console.log('PASS (A01): orçamento carrega pelo painel principal, limpa ao trocar de projeto, descarta respostas atrasadas e mostra erros.');
