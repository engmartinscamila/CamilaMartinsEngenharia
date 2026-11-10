/* Funções puras do catálogo de guias autorais (também usadas nos testes). */
(function (root) {
  'use strict';

  const SMALL = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'com', 'em', 'para', 'a', 'o', 'as', 'os']);

  function slugify(value) {
    return String(value ?? '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'guia';
  }

  function titleCase(text) {
    return String(text ?? '').split(' ').filter(Boolean).map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && SMALL.has(lower)) return lower;
      if (/^[A-Z0-9]{2,4}$/.test(word)) return word; // siglas (QR, ART)
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    }).join(' ');
  }

  const pad = (n) => String(n).padStart(2, '0');

  /* Sugere título, série e número a partir do nome do arquivo.
     "CM_Guia_09_Estrutura_Formas.pdf"            -> Guia de Obra 09 — Estrutura Formas
     "10_Guia_de_Banheiros_Camila_Martins.pdf"    -> Guia de Interiores 10 — Banheiros */
  function suggestFromFilename(fileName) {
    let base = String(fileName ?? '').replace(/\.pdf$/i, '').replace(/^\d{10,}-/, '');
    base = base.replace(/[_]+/g, ' ').replace(/(\p{L})-(?=\p{L})/gu, '$1 ').replace(/\s+/g, ' ').trim();
    base = base.replace(/\b(camila\s+martins(\s+engenharia)?)\b/gi, '').replace(/\s+/g, ' ').trim();
    let series = null; let number = null; let rest = base;
    let match = base.match(/^(?:cm\s+)?guia\s+(?:de\s+obra\s+)?(\d{1,3})\b\s*[-–—:]?\s*(.*)$/i);
    if (match && /^cm\b/i.test(base)) { series = 'Obra'; number = Number(match[1]); rest = match[2]; }
    else if ((match = base.match(/^(\d{1,3})\s+guia\s+(?:de\s+)?(.*)$/i))) { series = 'Interiores'; number = Number(match[1]); rest = match[2]; }
    else if ((match = base.match(/^guia\s+de\s+(obra|interiores)\s+(\d{1,3})\b\s*[-–—:]?\s*(.*)$/i))) { series = titleCase(match[1]); number = Number(match[2]); rest = match[3]; }
    else if ((match = base.match(/^(?:cm\s+)?guia\s+(\d{1,3})\b\s*[-–—:]?\s*(.*)$/i))) { series = 'Obra'; number = Number(match[1]); rest = match[2]; }
    rest = titleCase(rest.replace(/^(de|do|da)\s+/i, '').trim());
    const title = series && number != null
      ? `Guia de ${series} ${pad(number)}${rest ? ` — ${rest}` : ''}`
      : (titleCase(base) || 'Guia');
    const category = series === 'Interiores' ? 'Guias de Interiores' : series === 'Obra' ? 'Guias de Obra' : 'Outros';
    const code = series && number != null ? `${slugify(series)}-${pad(number)}` : slugify(title);
    return { title, series, number, category, code };
  }

  function clientCopyPath(clientId, projectId, title, now = Date.now()) {
    return `${clientId}/${projectId || 'geral'}/${now}-${slugify(title)}.pdf`;
  }

  function masterPath(materialId, version, title, now = Date.now()) {
    return `autorais/${materialId}/v${version}-${now}-${slugify(title)}.pdf`;
  }

  /* Situação de cada cliente diante do catálogo: o que tem (e se está na versão atual) e o que falta. */
  function clientMatrix(materials, documents, clients) {
    const active = materials.filter((m) => m.active !== false);
    return clients.map((client) => {
      const docs = documents.filter((d) => String(d.cliente_id) === String(client.id) && d.authored_material_id);
      const has = docs.map((d) => {
        const material = active.find((m) => m.id === d.authored_material_id);
        return material ? { material, document: d, outdated: Number(d.authored_material_version || 0) < Number(material.current_version) } : null;
      }).filter(Boolean);
      const owned = new Set(has.map((h) => h.material.id));
      return { client, has, missing: active.filter((m) => !owned.has(m.id)) };
    });
  }

  const api = { slugify, titleCase, suggestFromFilename, clientCopyPath, masterPath, clientMatrix };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CMEAuthoredUtils = api;
}(typeof window !== 'undefined' ? window : globalThis));
