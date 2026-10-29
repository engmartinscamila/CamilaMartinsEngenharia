/* Unsaved form state stays in memory; never persist client data in browser storage. */
(function(){
 'use strict';
 const initial=new WeakMap();
 const fields=form=>Array.from(form.querySelectorAll('input,select,textarea')).filter(el=>!['submit','button','hidden'].includes(el.type));
 const snapshot=form=>fields(form).map(el=>el.type==='checkbox'||el.type==='radio'?el.checked:el.type==='file'?Array.from(el.files||[]).map(f=>f.name+':'+f.size).join('|'):el.value).join('\u001f');
 const dirty=()=>Array.from(document.forms).some(form=>initial.has(form)&&initial.get(form)!==snapshot(form));
 document.addEventListener('focusin',event=>{const form=event.target.form;if(form&&!initial.has(form))initial.set(form,snapshot(form));});
 document.addEventListener('reset',event=>{if(event.target instanceof HTMLFormElement)setTimeout(()=>initial.set(event.target,snapshot(event.target)),0);});
 document.addEventListener('cme:form-saved',event=>{const form=event.target;if(form instanceof HTMLFormElement)initial.set(form,snapshot(form));});
 window.addEventListener('beforeunload',event=>{if(dirty()){event.preventDefault();event.returnValue='';}});
 document.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(link&&link.target!=='_blank'&&!link.hasAttribute('download')&&dirty()&&!confirm('Há campos ainda preenchidos neste formulário. Deseja sair e descartar o preenchimento?')){event.preventDefault();event.stopImmediatePropagation();}},true);
})();
