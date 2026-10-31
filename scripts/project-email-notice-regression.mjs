import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const context=vm.createContext({window:{},document:{addEventListener(){}}});
vm.runInContext(readFileSync('js/email-status.js','utf8'),context);
const notice=context.window.CMEEmailNotice;
assert.match(notice({enviado:false,agendado:true}),/fila automática/);
assert.doesNotMatch(notice({enviado:false,agendado:true}),/não.*configurado|recebeu/);
assert.match(notice({enviado:true}),/provedor aceitou/);
assert.match(notice({enviado:false,motivo:'Falha temporária no provedor.'}),/Falha temporária/);
assert.doesNotMatch(notice({enviado:false}),/não.*configurado/);
for(const page of ['projetos','cronograma']){
 const html=readFileSync(page+'.html','utf8');
 assert.ok(html.indexOf('js/email-status.js')<html.indexOf('js/'+page+'.js'),'Load delivery formatter before '+page);
 assert.match(readFileSync('js/'+page+'.js','utf8'),/window\.CMEEmailNotice\(/);
}
console.log('PASS: projeto e cronograma distinguem aviso na fila, envio aceito, falha e estado desconhecido sem inventar falta de configuração.');
