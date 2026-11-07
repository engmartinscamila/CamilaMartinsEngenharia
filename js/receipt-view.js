/* Formatação e visualização de recibos já emitidos. Nenhuma operação de gravação. */
(function(){'use strict';
const $=id=>document.getElementById(id);
  const escape = val => String(val ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const money = val => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const date = val => String(val).slice(0,10).split('-').reverse().join('/');
  function parseAmount(input) {
    const text = String(input).trim();
    if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(text)) throw new Error('Use o formato brasileiro para o valor, por exemplo 1.250,00.');
    const number = Number(text.replaceAll('.', '').replace(',', '.'));
    if (!Number.isFinite(number) || number <= 0 || number >= 1e12) throw new Error('Informe um valor recebido maior que zero e menor que 1 trilhão.');
    return number;
  }

  function showReceipt(row, onSelect) {
    onSelect(row);
    document.title = window.CMEReceiptIdentity.fileStem(row);
    const s = row.snapshot;
    const issuedOn = new Date(row.created_at).toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
    const number = `REC-${String(row.receipt_number).padStart(6,'0')}/${issuedOn.slice(0,4)}`;
    $('receiptPaper').innerHTML = `<header><div><strong>Camila Martins Engenharia</strong><br><span class="receipt-meta">${escape(s.issuer.title || 'Prestação de serviços')}</span></div><div><h1>RECIBO</h1><strong>${escape(number)}</strong></div></header><div class="receipt-value">${escape(money(row.amount))}</div><p>Recebi de <strong>${escape(s.payer_name)}</strong>${s.payer_document ? ', CPF/CNPJ ' + escape(s.payer_document) : ''}, a importância de <strong>${escape(money(row.amount))}</strong>, referente a:</p><p class="receipt-service">${escape(row.description)}</p><p><strong>Projeto:</strong> ${escape(s.project_name || 'Serviço sem projeto')}${s.contract_number ? '<br><strong>Contrato:</strong> ' + escape(s.contract_number) : ''}<br><strong>Recebimento:</strong> ${escape(date(row.paid_on))}<br><strong>Forma de pagamento:</strong> ${escape(row.payment_method)}</p><p>${escape(s.city)}, ${escape(date(issuedOn))}.</p><div class="receipt-signature"><strong>${escape(s.issuer.name)}</strong><br>CPF/CNPJ: ${escape(s.issuer.document)}</div><p class="receipt-meta">Emitido em ${escape(new Date(row.created_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}))} · ${escape(number)}</p>`;
    if($('receiptEditor'))$('receiptEditor').hidden=true;
    $('receiptResult').hidden = false; $('receiptResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

window.CMEReceiptView={escape,money,date,parseAmount,showReceipt};
}());
