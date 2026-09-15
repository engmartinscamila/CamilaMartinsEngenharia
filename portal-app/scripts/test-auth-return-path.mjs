import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(path, dependencies = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, URL, URLSearchParams, require: name => { assert.ok(name in dependencies); return dependencies[name]; } });
  return exports;
}
const sections = load('src/lib/admin-sections.ts');
const { safeAdminReturnPath } = load('src/lib/auth-return-path.ts', { './admin-sections': sections });
for (const section of sections.adminSections) {
  const path = typeof section.href === 'string' ? section.href : section.href.pathname;
  assert.equal(safeAdminReturnPath(path), path);
  assert.equal(safeAdminReturnPath(`/portal${path}/index.html`), path);
}
for (const value of [undefined, null, ['foo'], '', '//evil.invalid/admin/crm', 'https://evil.invalid/admin/crm', 'javascript:alert(1)', '/admin/unknown', '/admin/CRM', '/admin/\\evil', '/admin/crm\n', '/admin?section=unknown', '/portal/admin/%2fcrm']) assert.equal(safeAdminReturnPath(value), null);
assert.equal(safeAdminReturnPath('/portal/admin/index.html?section=crm'), '/admin/crm');
assert.equal(safeAdminReturnPath('/admin/tasks?projectId=project-1&next=https://evil.invalid'), '/admin/tasks?projectId=project-1');
assert.equal(safeAdminReturnPath('/admin/content?tipo=photo&projectId=project-1'), '/admin/content?projectId=project-1&tipo=photo');
assert.equal(safeAdminReturnPath('/admin/tasks?tipo=photo&projectId=invalid%3C'), '/admin/tasks');
process.stdout.write('PASS: retorno interno após login, aliases, projeto/tipo e rejeição de destinos externos ou desconhecidos.\n');
