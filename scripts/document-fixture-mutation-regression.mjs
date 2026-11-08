import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root=process.cwd();
const original=fs.readFileSync('scripts/generated-file-smoke.mts','utf8');
const directory=fs.mkdtempSync(path.join(root,'.qa-fixture-mutation-'));
try {
 const changed=original.replace("amount:10000,due_date:'2026-09-11'","value:10000,due:'2026-09-11'")
  .replace("const OUT=path.join(ROOT,'qa-generated-files');",'const OUT='+JSON.stringify(path.join(directory,'files'))+';')
  .replace("const TMP=path.join(ROOT,'.qa-generated-modules');",'const TMP='+JSON.stringify(path.join(directory,'modules'))+';');
 assert.notEqual(changed,original);
 assert(changed.includes("value:10000,due:'2026-09-11'"),'Mutation must use the original audited incorrect shape');
 const script=path.join(directory,'broken-fixture.mts');fs.writeFileSync(script,changed);
 const result=spawnSync(process.execPath,['--import','tsx',script],{cwd:root,encoding:'utf8'});
 assert.notEqual(result.status,0,'The QA gate must fail when an installment amount/due date is missing');
 assert(result.stderr.includes('Parcela 1 de 2: R$ 10.000,00 • Vencimento: 11/09/2026'),result.stderr);
 assert(result.stderr.includes('conteúdo esperado ausente'),result.stderr);
 console.log('PASS A20: restoring the audited incorrect installment fields makes the exact document QA gate fail.');
} finally {fs.rmSync(directory,{recursive:true,force:true});}
