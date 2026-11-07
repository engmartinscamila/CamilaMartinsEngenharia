/* Funções puras para localizar serviços comerciais. */
(function(){'use strict';
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

  function suggestCatalogService(value, serviceCatalogMeta) {
    const needle = normalizeSearch(value);
    if (!needle || needle.length < 4) return null;
    let best = null;
    for (const item of serviceCatalogMeta) {
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


window.CMECommercialSearch={normalizeSearch,editDistance,serviceSearchTerms,suggestCatalogService(value,meta){return suggestCatalogService(value,meta)}};
}());
