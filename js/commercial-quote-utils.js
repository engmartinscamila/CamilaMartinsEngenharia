/* Regras de consolidação de orçamentos e valores. */
(function(){'use strict';
const digits=value=>String(value||'').replace(/\D/g,'');
  function moneyValue(value) {
    if (value === null || value === undefined || value === '') return '';
    const numeric = Number(value);
    return Number.isFinite(numeric)
      ? numeric.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : String(value);
  }


  function quoteIdentity(item) {
    const documentNumber = digits(item?.cpf_cnpj);
    if (documentNumber) return `documento:${documentNumber}`;
    return `nome:${String(item?.prospect_name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()}`;
  }

  function sameQuoteOwner(items) {
    const identities = new Set(items.map(quoteIdentity).filter(value => !value.endsWith(':')));
    return identities.size <= 1;
  }

  function firstFilled(items, field) {
    return items.map(item => item?.[field]).find(value => value !== null && value !== undefined && String(value).trim() !== '') ?? '';
  }

  function combinedServices(items, servicesCatalog) {
    // Mantém o snapshot integral de cada orçamento: valores por atividade,
    // níveis, entregáveis, revisões, exclusões e textos aprovados.
    const firstSeen = new Map();
    const included = new Map();
    (Array.isArray(items) ? items : []).forEach(item => {
      (Array.isArray(item.services) ? item.services : []).forEach(service => {
        const code = String(service?.code || '');
        if (!code) return;
        if (!firstSeen.has(code)) firstSeen.set(code, { ...service });
        if (service.included === true && !included.has(code)) included.set(code, { ...service });
      });
    });
    const seen = new Set();
    const result = servicesCatalog.map(([code, name], index) => {
      seen.add(code);
      const original = included.get(code) || firstSeen.get(code) || {};
      return {
        ...original,
        code,
        name: original.name || name,
        included: included.has(code),
        acceptanceRequired: original.acceptanceRequired !== false,
        displayOrder: index + 1
      };
    });
    included.forEach((service, code) => {
      if (!seen.has(code)) result.push({ ...service, code, included: true });
    });
    return result;
  }

  function parseMoney(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const cleaned = String(value).replace(/\s/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
    const numeric = Number(cleaned);
    return Number.isFinite(numeric) ? numeric : null;
  }


window.CMECommercialQuotes={moneyValue,quoteIdentity,sameQuoteOwner,firstFilled,combinedServices,parseMoney};
}());
