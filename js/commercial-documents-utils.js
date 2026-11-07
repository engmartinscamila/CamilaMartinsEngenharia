/* Utilitários determinísticos dos orçamentos e contratos. Carregar antes de commercial-documents-web.js. */
(function (global) {
  'use strict';
  const digits = value => String(value || '').replace(/\D/g, '');
  function normalizeSearch(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function editDistance(a, b) {
    const left = normalizeSearch(a), right = normalizeSearch(b);
    if (!left) return right.length;
    if (!right) return left.length;
    const row = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let i = 1; i <= left.length; i += 1) {
      let previous = row[0];
      row[0] = i;
      for (let j = 1; j <= right.length; j += 1) {
        const before = row[j];
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (left[i - 1] === right[j - 1] ? 0 : 1));
        previous = before;
      }
    }
    return row[right.length];
  }

  function serviceSearchTerms(item) {
    return [item.name, ...(Array.isArray(item.aliases) ? item.aliases : []), ...(Array.isArray(item.synonyms) ? item.synonyms : []), ...(Array.isArray(item.keywords) ? item.keywords : [])]
      .map(normalizeSearch)
      .filter(Boolean);
  }

  function suggestCatalogService(value, catalog) {
    const needle = normalizeSearch(value);
    if (!needle || needle.length < 4) return null;
    let best = null;
    for (const item of catalog) {
      if (String(item.code || '').toLowerCase() === 'p') continue;
      for (const term of serviceSearchTerms(item)) {
        const contains = term.includes(needle) || needle.includes(term);
        const distance = editDistance(needle, term);
        const limit = Math.max(2, Math.floor(Math.min(needle.length, term.length) * 0.22));
        if (contains || distance <= limit) {
          const score = contains ? 0 : distance;
          if (!best || score < best.score) best = { item, score };
        }
      }
    }
    return best?.item || null;
  }

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

  function buildProjectAddress(project) {
    return [
      project.endereco_obra,
      project.numero_obra,
      project.complemento_obra,
      project.bairro_obra,
      project.cidade_obra,
      project.estado_obra
    ].filter(Boolean).join(', ');
  }

  global.CMECommercialUtils = Object.freeze({
    digits, normalizeSearch, editDistance, serviceSearchTerms, suggestCatalogService,
    moneyValue, quoteIdentity, sameQuoteOwner, firstFilled, combinedServices, parseMoney,
    buildProjectAddress,
  });
})(window);
