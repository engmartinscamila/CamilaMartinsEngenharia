import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync('src/lib/financial-model.ts', 'utf8');
const exports = {};
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText, { exports, Date, Intl });

const { financialAmountOrNull, financialLinkIssues, receivableStatements } = exports;
assert.equal(financialAmountOrNull(null), null);
assert.equal(financialAmountOrNull(undefined), null);
assert.equal(financialAmountOrNull(''), null);
assert.equal(financialAmountOrNull('valor desconhecido'), null);
assert.equal(financialAmountOrNull('12500.50'), 12500.50);
assert.equal(financialAmountOrNull(0), 0, 'Contrato legítimo de valor zero permanece zero');
assert.match(fs.readFileSync('src/services/admin-service.ts', 'utf8'), /contractValue: financialAmountOrNull\(contract\.contract_value\)/);
assert.match(fs.readFileSync('src/services/admin-service.ts', 'utf8'), /contractValue: financialAmountOrNull\(row\.contract_value\)/);
const contracts = [
  { id: 'contract-1', clientId: 'client-1', clientName: 'Cliente 1', contractNumber: 'C-1', contractValue: 1200, status: 'active' },
  { id: 'contract-2', clientId: 'client-2', clientName: 'Cliente 2', contractNumber: 'C-2', contractValue: 900, status: 'active' },
];
const projects = [
  { id: 'project-1', clientId: 'client-1', contractId: 'contract-1', name: 'Projeto 1' },
  { id: 'project-2', clientId: 'client-1', contractId: null, name: 'Projeto antes do contrato' },
];
const entry = (id, changes = {}) => ({
  id, clientId: 'client-1', contractId: 'contract-1', projectId: 'project-1',
  projectName: 'Projeto 1', clientName: 'Cliente 1', contractNumber: 'C-1',
  description: 'Parcela', amount: 100, type: 'entrada', status: 'pago',
  date: '2026-11-01', dueDate: '2026-11-01', paidAt: '2026-11-01',
  category: 'honorarios', notes: null, accountId: null, ...changes,
});
assert.equal(financialLinkIssues(contracts, projects, [
  entry('valid'), entry('draft', { projectId: 'project-2', contractId: null }),
]).length, 0, 'Projeto sem contrato é legítimo');
const cases = [
  entry('client-mismatch', { clientId: 'client-2' }),
  entry('contract-mismatch', { contractId: 'contract-2' }),
  entry('unknown-project', { projectId: 'unknown-project', contractId: null }),
];
const issues = financialLinkIssues(contracts, projects, cases);
assert.equal(issues.filter(row => row.referenceId === 'client-mismatch').length, 2);
assert.equal(issues.filter(row => row.referenceId === 'contract-mismatch').length, 2);
assert.equal(issues.filter(row => row.code === 'project_missing').length, 1);
assert.ok(issues.every(row => row.message.length > 20 && row.referenceId));
assert.equal(financialLinkIssues(contracts, [
  ...projects, { id: 'project-3', clientId: 'client-1', contractId: 'contract-2', name: 'Vínculo errado' },
], []).length, 1, 'Projeto associado a contrato de outro cliente gera alerta');

// A diagnosis must never mutate balances or historical entries.
const sourceRows = [entry('paid'), entry('future', { status: 'pendente', amount: 300 })];
const snapshot = JSON.stringify(sourceRows);
const before = receivableStatements(contracts, projects, sourceRows, []);
financialLinkIssues(contracts, projects, sourceRows);
const after = receivableStatements(contracts, projects, sourceRows, []);
assert.equal(JSON.stringify(sourceRows), snapshot);
assert.equal(JSON.stringify(after), JSON.stringify(before));
assert.equal(after.find(row => row.id === 'contract-1').remaining, 1100);
assert.equal(after.find(row => row.id === 'contract-1').pending, 300);

const projectScreen = fs.readFileSync('src/app/admin/projects.tsx', 'utf8');
assert.match(projectScreen, /value: 'orcamento'/);
assert.match(projectScreen, /value: 'em_andamento'/);
assert.match(projectScreen, /setEditStatus\(project\.status\)/);
assert.match(projectScreen, /Situação existente:/);
assert.match(projectScreen, /Selecione explicitamente o contrato/);
assert.doesNotMatch(projectScreen, /setSelectedClientId\(\(current\) => current \?\? clientResult/);
assert.doesNotMatch(projectScreen, /setSelectedContractId\(\(current\) => current \?\? contractResult/);

const financialScreen = fs.readFileSync('src/app/admin/financial.tsx', 'utf8');
assert.doesNotMatch(financialScreen, /current \?\? contractResult\.data\[0\]/,
  'O financeiro não deve selecionar automaticamente o primeiro contrato');

console.log('PASS: integridade entre cliente/projeto/contrato, projeto pré-contratual, saldos preservados e estados reais na edição.');
