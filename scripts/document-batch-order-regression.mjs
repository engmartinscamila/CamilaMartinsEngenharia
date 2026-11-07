import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';

// Execute the production batch initializer with file selection in the same
// event turn as "new". Deferred cleanup must never erase the selected names.
const timers=[],all=[];
function node(tag='div',id=''){
 const el={tag,id,children:[],dataset:{},value:'',textContent:'',listeners:{},hidden:false,
  append(...items){this.children.push(...items);},appendChild(item){this.children.push(item);},
  replaceChildren(...items){this.children=items;},setAttribute(){},removeAttribute(){},insertAdjacentElement(){},
  addEventListener(type,handler){(this.listeners[type]??=[]).push(handler);},
  fire(type){for(const handler of this.listeners[type]||[])handler({target:this});},
  querySelector(){return null;},querySelectorAll(selector){const found=[];const visit=p=>{for(const c of p.children){if(c.className===selector.slice(1))found.push(c);visit(c);}};visit(this);return found;}};
 all.push(el);return el;
}
for(const id of ['formDocumento','documentoArquivo','documentoNome','documentoCategoria','salvarDocumento','novoDocumento'])node('input',id);
const get=id=>all.find(el=>el.id===id),category=get('documentoCategoria');
category.querySelector=selector=>['automatico','modelo'].some(value=>selector.includes(value))?{}:null;
get('documentoArquivo').parentElement=node();
const document={readyState:'complete',getElementById:get,createElement:node,querySelector:()=>({textContent:'Cadastrar Documento'})};
vm.runInNewContext(fs.readFileSync(process.env.CME_BATCH_SOURCE||'js/documentos-lote.js','utf8'),{document,window:{setTimeout:fn=>timers.push(fn)},alert:message=>{throw Error(message);}});
get('novoDocumento').fire('click');get('documentoArquivo').files=[{name:'Primeiro arquivo.pdf'},{name:'Segundo arquivo.pdf'}];get('documentoArquivo').fire('change');
for(const timer of timers)timer();
assert.deepEqual(get('documentoLotePreview').querySelectorAll('.documento-nome-lote').map(el=>el.value),['Primeiro arquivo','Segundo arquivo']);
assert.equal(get('documentoNome').readOnly,true);

// Execute the actual submit handler while the list refresh is deliberately
// pending. A second submit must not start another upload or unlock the form.
const source=fs.readFileSync(process.env.CME_DOCUMENT_SOURCE||'js/documentos.js','utf8'),start=source.indexOf('    async function salvarDocumento('),end=source.indexOf('    function mostrarDetalhes(',start);
assert.ok(start>=0&&end>start);
let releaseRefresh,refreshStarted;
const refresh=new Promise(resolve=>releaseRefresh=resolve),started=new Promise(resolve=>refreshStarted=resolve);
const button={},file={name:'arquivo.pdf'},calls={writes:0,closed:false};
const values={documentoNome:'Arquivo',documentoCategoria:'outros',documentoCliente:'c1',documentoProjeto:'p1'};
const context=vm.createContext({documentoSelecionadoId:null,localizar:()=>null,valor:id=>values[id]||'',
 document:{getElementById:id=>id==='documentoArquivo'?{files:[file]}:id==='salvarDocumento'?button:{checked:false},querySelectorAll:()=>[]},
 window:{CMEProjectFiles:{validate(){},bucket:()=> 'documentos'}},crypto:{randomUUID},normalizarNome:value=>value,
 projetoPertenceAoCliente:()=>true,dbUploadArquivo:async()=>{},dbCriarDocumento:async()=>{calls.writes++;},
 dbNotificarAtualizacao:async()=>({}),dbExcluirArquivoStorage:async()=>{},
 recarregar:()=>{refreshStarted();return refresh;},fecharModal:()=>{calls.closed=true;},avisoNotificacao:()=>'',alert(){},
 alternarSalvamento:(target,busy)=>{target.disabled=busy;},tratarErro:(_message,error)=>{throw error;}});
vm.runInContext('let salvando=false;const concluidos=new WeakSet();'+source.slice(start,end)+';globalThis.submit=salvarDocumento;',context);
const pending=context.submit({preventDefault(){}});await started;
assert.equal(vm.runInContext('salvando',context),true);assert.equal(button.disabled,true);assert.equal(calls.closed,false);
await context.submit({preventDefault(){}});assert.equal(calls.writes,1);
releaseRefresh();await pending;assert.equal(vm.runInContext('salvando',context),false);assert.equal(button.disabled,false);assert.equal(calls.closed,true);
console.log('PASS: seleção rápida mantém nomes do lote; envio continua exclusivo durante a atualização da lista; nova tentativa não duplica a gravação.');
