(function(){
'use strict';
const $=id=>document.getElementById(id);
const isContract=()=>location.hash==='#contrato';
function status(text,type='error'){const e=$('commercialMessage');if(!e)return;e.textContent=text;e.className=`doc-status ${type}`;}
function syncSameAddress(){const same=$('sameWorkAddress');const cadastral=$('address');const work=$('propertyAddress');if(!same||!cadastral||!work)return;if(same.checked){work.value=cadastral.value;work.readOnly=true}else work.readOnly=false;}
function install(){const work=$('propertyAddress'),cadastral=$('address');if(!work||!cadastral)return;if(!$('sameWorkAddress')){const label=document.createElement('label');label.className='doc-service doc-address-same';label.innerHTML='<input id="sameWorkAddress" type="checkbox"><span>O endereço da obra é o mesmo endereço cadastral / residencial do contratante</span>';work.parentElement?.appendChild(label);$('sameWorkAddress')?.addEventListener('change',syncSameAddress);cadastral.addEventListener('input',()=>{if($('sameWorkAddress')?.checked)syncSameAddress()});}
 document.addEventListener('click',e=>{const b=e.target.closest('#createCommercial');if(!b||!isContract())return;syncSameAddress();if(!String(work.value||'').trim()){e.preventDefault();e.stopImmediatePropagation();status('Informe o endereço do imóvel / obra ou marque que ele é o mesmo endereço cadastral.');work.focus();}},true);
 window.addEventListener('hashchange',()=>{if(!isContract()&&$('sameWorkAddress')){$('sameWorkAddress').checked=false;syncSameAddress()}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();