(function () {
  'use strict';
  let clients = [], projects = [], history = [], offset = 0, requestId = null, busy = false, selectedReceipt = null;
  const $ = id => document.getElementById(id);
  const value = id => $(id).value.trim();
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
  function message(text, error = false) { $('receiptMessage').textContent = text; $('receiptMessage').dataset.error = String(error); }
  function options(id, items, label) { $(id).replaceChildren(new Option(label, ''), ...items.map(row => new Option(row.label || row.nome, row.id))); }
  function selectProject() {
    const matching = projects.filter(row => String(row.cliente_id) === value('receiptClient'));
    options('receiptProject', matching.map(row => ({ ...row, label: [row.numero_contrato || row.contract_number, row.nome].filter(Boolean).join(' · ') })), 'Selecione o contrato / projeto');
  }
  function showReceipt(row) {
    selectedReceipt = row;
    const s = row.snapshot;
    const issuedOn = new Date(row.created_at).toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
    const number = `REC-${String(row.receipt_number).padStart(6,'0')}/${issuedOn.slice(0,4)}`;
    $('receiptPaper').innerHTML = `<header><div><strong>Camila Martins Engenharia</strong><br><span class="receipt-meta">${escape(s.issuer.title || 'Prestação de serviços')}</span></div><div><h1>RECIBO</h1><strong>${escape(number)}</strong></div></header><div class="receipt-value">${escape(money(row.amount))}</div><p>Recebi de <strong>${escape(s.payer_name)}</strong>${s.payer_document ? ', CPF/CNPJ ' + escape(s.payer_document) : ''}, a importância de <strong>${escape(money(row.amount))}</strong>, referente a:</p><p class="receipt-service">${escape(row.description)}</p><p><strong>Projeto:</strong> ${escape(s.project_name)}${s.contract_number ? '<br><strong>Contrato:</strong> ' + escape(s.contract_number) : ''}<br><strong>Recebimento:</strong> ${escape(date(row.paid_on))}<br><strong>Forma de pagamento:</strong> ${escape(row.payment_method)}</p><p>${escape(s.city)}, ${escape(date(issuedOn))}.</p><div class="receipt-signature"><strong>${escape(s.issuer.name)}</strong><br>CPF/CNPJ: ${escape(s.issuer.document)}</div><p class="receipt-meta">Emitido em ${escape(new Date(row.created_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}))} · ${escape(number)}</p>`;
    $('receiptResult').hidden = false; $('receiptResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  async function loadHistory() {
    $('receiptHistoryState').textContent = 'Carregando recibos...';
    const { data, error } = await supabaseClient.from('payment_receipts').select('*').order('created_at', { ascending: false }).range(offset, offset + 49);
    if (error) { $('receiptHistoryState').textContent = 'Não foi possível carregar o histórico. Tente atualizar.'; return; }
    history = data || []; $('receiptHistory').replaceChildren();
    $('receiptHistoryState').textContent = history.length ? `${offset + 1} a ${offset + history.length} · Clique em Abrir para reimprimir a mesma emissão.` : 'Nenhum recibo nesta página.';
    for (const row of history) {
      const entry = document.createElement('div'); entry.className = 'item-lista';
      const copy = document.createElement('span'); copy.textContent = `REC-${String(row.receipt_number).padStart(6,'0')} · ${row.snapshot.payer_name} · ${money(row.amount)} · ${date(row.paid_on)}`;
      const open = document.createElement('button'); open.type = 'button'; open.textContent = 'Abrir recibo'; open.addEventListener('click', () => showReceipt(row)); entry.append(copy, open); $('receiptHistory').append(entry);
    }
    $('receiptPrevious').disabled = offset === 0; $('receiptNext').disabled = history.length < 50;
  }
  async function issue(event) {
    event.preventDefault(); if (busy) return;
    let amount;
    try { amount = parseAmount(value('receiptAmount')); } catch (error) { message(error.message, true); return; }
    const c = clients.find(row => String(row.id) === value('receiptClient'));
    if (!c || !projects.some(row => String(row.id) === value('receiptProject') && row.cliente_id === c.id)) { message('Selecione o cliente e um projeto vinculado a ele.',true); return; }
    if (!confirm(`Emitir recibo para ${c.nome}?\n${money(amount)} recebidos em ${date(value('receiptDate'))}.\n\nConfira os dados: a emissão preserva este registro e recebe um número único.`)) return;
    busy = true; $('issueReceipt').disabled = true; message('Emitindo recibo...');
    requestId ||= crypto.randomUUID();
    const { data, error } = await supabaseClient.rpc('admin_issue_payment_receipt', { p_data: { request_id: requestId, client_id: c.id, project_id: value('receiptProject'), amount, paid_on: value('receiptDate'), payment_method: value('receiptMethod'), description: value('receiptDescription'), city: value('receiptCity') } });
    busy = false; $('issueReceipt').disabled = false;
    if (error || !data?.id) { message(error?.message || 'Não foi possível confirmar a emissão. Tente novamente sem alterar os dados.',true); return; }
    showReceipt(data); message('Recibo emitido e preservado no histórico. Você já pode imprimir ou salvar em PDF.');
    requestId = null; $('receiptConfirmed').checked = false; offset = 0; await loadHistory();
  }
  document.addEventListener('DOMContentLoaded', async () => {
    $('issueReceipt').disabled = true;
    const { data: user } = await supabaseClient.auth.getUser();
    if (!user?.user) { location.replace('login.html'); return; }
    const admin = await supabaseClient.rpc('is_portal_admin');
    if (admin.error || admin.data !== true) { location.replace('portal.html'); return; }
    $('logoutButton')?.addEventListener('click', async () => { await supabaseClient.auth.signOut(); location.replace('login.html'); });
    try {
      [clients, projects] = await Promise.all([dbBuscarClientes(), dbBuscarProjetos()]);
      options('receiptClient',clients,'Selecione o cliente');
      const config = await supabaseClient.from('configuracoes').select('cidade').limit(1).maybeSingle(); $('receiptCity').value = config.data?.cidade || '';
      const today = new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}); $('receiptDate').value = today; $('receiptDate').max = today;
      $('receiptClient').addEventListener('change',selectProject); $('receiptForm').addEventListener('submit',event => void issue(event));
      $('wordReceipt').addEventListener('click', () => {
        try {
          const blob = window.CMEReceiptWord.build(selectedReceipt), url = URL.createObjectURL(blob), link = document.createElement('a');
          link.href = url; link.download = `Recibo-${String(selectedReceipt.receipt_number).padStart(6,'0')}.docx`;
          document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
        } catch (error) { message(error.message || 'Não foi possível gerar o Word.',true); }
      });
      $('printReceipt').addEventListener('click',() => window.print()); $('refreshReceipts').addEventListener('click',() => void loadHistory());
      $('receiptPrevious').addEventListener('click',()=>{offset=Math.max(0,offset-50);void loadHistory();}); $('receiptNext').addEventListener('click',()=>{offset+=50;void loadHistory();});
      $('receiptForm').addEventListener('input',()=>{if (!busy) requestId=null;});
      $('issueReceipt').disabled = false; await loadHistory();
    } catch { message('Não foi possível carregar os cadastros. Atualize a página para tentar novamente.',true); }
  });
  window.CMEReceipts = { parseAmount, showReceipt };
})();
