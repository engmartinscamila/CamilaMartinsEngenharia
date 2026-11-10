/* Regrava as imagens e vídeos já publicados na galeria com a marca timbrada (texto repetido no
   quadro inteiro). Vídeos usam a versão com marca gravada na publicação do site. Como as imagens publicadas ficam em cache por 1 ano, cada imagem regravada ganha um
   endereço novo ("-timbrada.webp"), o catálogo passa a apontar para ele e a versão antiga é
   removida. Imagens servidas pelo próprio site já recebem a marca na publicação. */
(function () {
  'use strict';
  const MARK = '-timbrada';
  const IMAGE = /\.(webp|jpe?g|png)$/i;
  const VIDEO = /\.mp4$/i;
  const bridge = () => window.CME_PORTFOLIO_R2_BRIDGE;

  function r2Key(value) {
    const text = String(value || '').split('#')[0];
    const url = text.match(/^https?:\/\/[^/]+\/media\/([^?]+)/i);
    const key = url ? decodeURIComponent(url[1]) : text.split('?')[0].replace(/^\/+/, '');
    return key.startsWith('portfolio/') && (IMAGE.test(key) || VIDEO.test(key)) ? key : null;
  }
  const isUrl = (value) => /^https?:\/\//i.test(String(value || ''));
  const newKeyFor = (key) => key.replace(/\.[a-z0-9]+$/i, '') + MARK + (VIDEO.test(key) ? '.mp4' : '.webp');
  // Vídeo publicado no R2 -> mesma obra no site, onde a marca já é gravada na publicação.
  const siteVideoFor = (key) => {
    const m = key.match(/^portfolio\/([^/]+)\/video\/([^/]+\.mp4)$/i);
    return m ? `${location.origin}/assets/projetos/${m[1]}/videos/${m[2]}` : null;
  };
  const mediaUrl = (key) => `${bridge().api}/media/${key.split('/').map(encodeURIComponent).join('/')}`;

  // Todas as referências a imagens do R2 ainda sem a marca timbrada.
  function collect(manifest) {
    const keys = new Set();
    (function visit(value) {
      if (typeof value === 'string') { const key = r2Key(value); if (key && !key.includes(MARK)) keys.add(key); }
      else if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') Object.values(value).forEach(visit);
    })(manifest);
    return [...keys];
  }

  function rewrite(manifest, mapping) {
    return (function visit(value) {
      if (typeof value === 'string') {
        const key = r2Key(value);
        if (key && mapping.has(key)) return isUrl(value) ? mediaUrl(mapping.get(key)) : mapping.get(key);
        return value;
      }
      if (Array.isArray(value)) return value.map(visit);
      if (value && typeof value === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(value)) out[k] = visit(v);
        const touched = Object.values(value).some((v) => typeof v === 'string' && mapping.has(r2Key(v)));
        if (touched && 'watermark' in out) out.watermark = 'timbrada';
        return out;
      }
      return value;
    })(manifest);
  }

  async function restampAll(onProgress = () => {}) {
    const b = bridge();
    if (!b?.fetchManifest) throw new Error('Ferramenta de mídia não carregou. Atualize a página.');
    const manifest = await b.fetchManifest();
    const keys = collect(manifest);
    if (!keys.length) return { total: 0, done: 0, failed: [] };
    const mapping = new Map(); const failed = [];
    for (let i = 0; i < keys.length; i += 1) {
      onProgress(i + 1, keys.length);
      try {
        if (VIDEO.test(keys[i])) {
          const site = siteVideoFor(keys[i]);
          const response = site ? await fetch(site, { cache: 'no-store' }) : null;
          if (!response || !response.ok) throw new Error('vídeo sem versão com marca no site; envie de novo pelo painel');
          const video = await response.blob();
          mapping.set(keys[i], await b.putObjectRaw(newKeyFor(keys[i]), new File([video], 'video.mp4', { type: 'video/mp4' })));
          continue;
        }
        const response = await fetch(mediaUrl(keys[i]), { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const source = await response.blob();
        const stamped = await b.applyWatermark(new File([source], keys[i].split('/').pop(), { type: source.type || 'image/webp' }));
        const blob = stamped.type === 'image/webp' ? stamped : await toWebp(stamped);
        const saved = await b.putObjectRaw(newKeyFor(keys[i]), blob);
        mapping.set(keys[i], saved);
      } catch (error) { failed.push(`${keys[i]} (${error.message})`); }
    }
    if (!mapping.size) return { total: keys.length, done: 0, failed };
    const updated = rewrite(manifest, mapping);
    try {
      await b.publishManifest(updated);
    } catch (error) {
      for (const key of mapping.values()) await b.deleteObjectRaw(key).catch(() => {});
      throw new Error(`A galeria não foi alterada: ${error.message}`);
    }
    // Remove as versões antigas (só a marca no canto) que não aparecem mais no catálogo.
    const old = [...mapping.keys()];
    for (let i = 0; i < old.length; i += 200) await b.deleteKeysWithManifest(old.slice(i, i + 200), updated);
    return { total: keys.length, done: mapping.size, failed };
  }

  async function toWebp(blob) {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0);
    return new Promise((resolve, reject) => canvas.toBlob((out) => (out ? resolve(out) : reject(new Error('Falha ao converter a imagem.'))), 'image/webp', 0.9));
  }

  window.CMEPortfolioRestamp = { restampAll, collect, rewrite, newKeyFor, r2Key, siteVideoFor };
}());
