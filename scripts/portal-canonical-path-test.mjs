import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync('portal-app/src/app/+html.tsx', 'utf8');
const literal = html.match(/const canonicalPortalPath = (`[^`]+`);/)[1];
const script = vm.runInNewContext(literal);
for (const [pathname, expected] of [
  ['/portal/admin/crm.html', '/portal/admin/crm/'],
  ['/portal/admin/crm/index.html', '/portal/admin/crm/'],
  ['/portal/admin/index.html', '/portal/admin/'],
  ['/portal/index.html', '/portal/'],
  ['/portal/reset-password.html', '/portal/reset-password/'],
  ['/portal/admin/crm/', null],
  ['/configuracoes.html', null],
  ['/portal.html', null],
  ['/other/portal/login.html', null],
]) {
  let actual = null;
  const state = { preserved: true };
  vm.runInNewContext(script, {
    location: { pathname, search: '?section=crm&filter=active', hash: '#details' },
    history: { state, replaceState: (nextState, title, url) => {
      assert.equal(nextState, state);
      actual = url;
    } },
  });
  assert.equal(actual, expected && expected + '?section=crm&filter=active#details', pathname);
}
console.log('OK: aliases .html normalizados antes do router; consultas, fragmentos e rotas clássicas preservados.');
