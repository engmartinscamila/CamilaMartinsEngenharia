/* Renderização da lista de contratos e orçamentos. */
(function(){'use strict';
const $=id=>document.getElementById(id);
  function renderList(rows, mode, esc) {
    const box = $('commercialList');
    if (!box) return;

    const kind = mode();
    const data = rows.filter(record => (record.record_kind || 'orcamento') === kind).sort((a,b)=>String(a.prospect_name).localeCompare(String(b.prospect_name),'pt-BR')||String(a.contract_number||a.quote_number).localeCompare(String(b.contract_number||b.quote_number),'pt-BR',{numeric:true}));
    const title = $('commercialExistingTitle');
    if (title) title.textContent = kind === 'contrato' ? 'Contratos' : 'Orçamentos';

    if (!data.length) {
      box.innerHTML = `<p>Nenhum ${kind === 'contrato' ? 'contrato' : 'orçamento'} criado nesta central.</p>`;
      return;
    }

    box.innerHTML = data.map(record => {
      const number = kind === 'contrato' ? record.contract_number : record.quote_number;
      const origin = record.source_quote_number
        ? ` • origem: ${esc(record.source_quote_number)}`
        : '';

      const actions = kind === 'contrato'
        ? `${record.contract_document_id?`<button class="doc-btn secondary" data-action="contract-download" data-document-id="${record.contract_document_id}" data-id="${record.id}">Baixar Word emitido</button><button class="doc-btn secondary" data-action="contract-versions" data-id="${record.id}">Versões anteriores</button><button class="doc-btn secondary" data-action="commercial-terms" data-id="${record.id}">Editar parcelas, prazos e quantidades</button><button class="doc-btn ghost" data-action="contract-revision" data-id="${record.id}">Criar nova revisão</button>`:`<button class="doc-btn secondary" data-action="commercial-terms" data-id="${record.id}">Editar parcelas, prazos e quantidades</button><button class="doc-btn secondary" data-action="contract" data-id="${record.id}">Gerar Word e arquivar</button>`}
           <button type="button" class="doc-btn" data-closure-record="${record.id}">Resolver pendências</button>
           <button class="doc-btn secondary" data-action="reclassify-services" data-id="${record.id}">Corrigir enquadramento de serviços</button>
           <button class="doc-btn" data-action="convert" data-id="${record.id}" ${record.status === 'convertido' ? 'disabled' : ''}>
             ${record.status === 'convertido' ? 'Cliente/projeto vinculados' : 'Formalizar cliente + projeto'}
           </button>`
        : `<button class="doc-btn secondary" data-action="commercial-terms" data-id="${record.id}">Editar parcelas, prazos e quantidades</button><button class="doc-btn" data-action="use-quote" data-id="${record.id}">Criar contrato deste orçamento</button>
           ${record.quote_document_id?`<button class="doc-btn secondary" data-action="quote-download" data-document-id="${record.quote_document_id}" data-id="${record.id}">Baixar orçamento emitido</button><button class="doc-btn secondary" data-action="quote-versions" data-id="${record.id}">Versões anteriores</button><button class="doc-btn ghost" data-action="quote-revision" data-id="${record.id}">Criar nova revisão</button>`:`<button class="doc-btn secondary" data-action="quote" data-id="${record.id}">Gerar orçamento e arquivar</button>`}`;

      return `
        <details class="doc-row">
          <summary class="doc-row-head">
            <div>
              <strong>${esc(record.prospect_name)} • ${esc(number)}</strong>
              <div class="doc-meta">
                ${esc(record.property_type || 'Serviço de engenharia')} •
                ${new Date(record.created_at).toLocaleDateString('pt-BR')}${origin}
              </div>
            </div>
            <span class="doc-badge">${esc(kind==='contrato'&&!record.contract_document_id?'Word pendente — cadastro salvo':kind === 'contrato' && record.status === 'rascunho_orcamento' ? 'Rascunho de contrato' : String(record.status || '').replaceAll('_', ' '))}</span>
          </summary>
          <div class="doc-actions">${actions}</div>
        </details>
      `;
    }).join('');
  }


window.CMECommercialRecordView={renderList};
}());
