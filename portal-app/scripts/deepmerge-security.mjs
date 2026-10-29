import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const root = resolve(new URL('..', import.meta.url).pathname);
// Upstream 4.3.1 has no fixed release. Filter dangerous keys in both target
// and source, including null-prototype inputs, before any assignment occurs.
const advisory = 'https://github.com/advisories/GHSA-gcqx-w48m-w2h4';
const original = 'return Object.keys(target).concat(getEnumerableOwnPropertySymbols(target))';
const replacement = original + `.filter(function(key) { /* CME-DEEPMERGE-PROTOTYPE-GUARD */ return key !== '__proto__' && key !== 'constructor' && key !== 'prototype'; })`;
function roots() {
  const lock = JSON.parse(readFileSync(resolve(root,'package-lock.json'),'utf8'));
  return Object.entries(lock.packages).filter(([key])=>/(^|\/)node_modules\/deepmerge$/.test(key)).map(([key,entry])=>{assert.equal(entry.version,'4.3.1','Review the security patch before changing deepmerge');return resolve(root,key);});
}
export function applyDeepmergePatch(checkOnly = false) {
  for (const directory of roots()) {
    for (const file of ['dist/cjs.js','dist/umd.js','index.js']) {
      const path=resolve(directory,file),source=readFileSync(path,'utf8');
      if(source.includes(replacement))continue;
      assert.equal(source.split(original).length-1,1,'Unknown deepmerge source — refuse to patch');
      assert.equal(checkOnly,false,'deepmerge prototype guard missing');
      writeFileSync(path,source.replace(original,replacement));
    }
  }
}
export function verifyDeepmergePatch() {
  const directories=roots();assert.ok(directories.length,'Missing deepmerge installation');
  applyDeepmergePatch(true);
  for(const directory of directories){
    const require=createRequire(resolve(directory,'package.json'));
    for(const file of ['dist/cjs.js','dist/umd.js']){
      const merge=require('./'+file);
      // The advisory includes poison already present in the target, and a
      // source merged into a null-prototype object. Guard both key enumerations.
      const poison=JSON.parse('{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}');
      for(const [target,source] of [[{},poison],[poison,{}],[Object.create(null),poison],[{nested:poison},{nested:{safe:1}}]]){
        const result=merge(target,source);assert.equal(Object.getPrototypeOf(result),Object.prototype);assert.equal(result.polluted,undefined);assert.equal({}.polluted,undefined);
        if(result.nested){assert.equal(Object.getPrototypeOf(result.nested),Object.prototype);assert.equal(result.nested.polluted,undefined);}
      }
      assert.deepEqual(merge({a:{one:1},list:[1]},{a:{two:2},list:[2]}),{a:{one:1,two:2},list:[1,2]});
      assert.deepEqual(merge.all([{one:1},{two:2}]),{one:1,two:2});
      const symbol=Symbol('safe');assert.equal(merge({}, {[symbol]:3})[symbol],3);
    }
  }
  return { advisory, packages: directories.length };
}
