(function(){
  'use strict';
  function fileStem(row){
    const snapshot=row?.snapshot||{};
    const identity=String(snapshot.contract_number||snapshot.payer_name||'Cliente').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9.-]+/g,'-').replace(/^[.-]+|[.-]+$/g,'').slice(0,110)||'Cliente';
    const issued=new Date(row.created_at);
    const year=Number.isNaN(issued.getTime())?'':issued.toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}).slice(0,4);
    return `Recibo-${identity}-REC-${String(row.receipt_number).padStart(6,'0')}${year?'-'+year:''}${row?.reversed_at?'-ESTORNADO':''}`;
  }
  window.CMEReceiptIdentity={fileStem};
})();
