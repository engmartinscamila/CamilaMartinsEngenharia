import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
let destination=null;
const exports={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/admin-navigation.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{
 exports,URLSearchParams,window:{location:{pathname:'/portal/admin/workspace/',assign:value=>{destination=value;}}},require:name=>{assert.equal(name,'react-native');return {Platform:{OS:'web'}};},
});
assert.equal(exports.openWebsiteAdminSection('financial',{projectId:'synthetic-project'}),true);
assert.equal(destination,'/portal/admin/financial/?projectId=synthetic-project');
exports.openWebsiteAdminSection('documents',{projectId:'synthetic-project'});assert.equal(destination,'/documentos.html?projectId=synthetic-project');
exports.openWebsiteAdminSection('document-preparation');assert.equal(destination,'/orcamentos-contratos.html');
exports.openWebsiteAdminSection('receipts');assert.equal(destination,'/recibos.html');
const previous=destination;assert.equal(exports.openWebsiteAdminSection('https://evil.invalid/'),false);assert.equal(destination,previous);
exports.openWebsiteAdminSection('financial',{projectId:'a&b=c'});assert.equal(destination,'/portal/admin/financial/?projectId=a%26b%3Dc');
console.log('PASS: navegação preserva projeto, codifica parâmetros, mantém aliases e recusa destinos externos.');
