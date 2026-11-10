/* Imagens autorais: cópia carimbada gravada na própria imagem.
   - Roda no painel da administradora (Fotos e Documentos). Para cada imagem autoral sem cópia
     pronta, baixa o original, grava o carimbo (cliente, contrato ou projeto, código) e salva um
     JPG em "protegidas/<foto>/". O cliente recebe só esse JPG; o original nunca sai.
   - Na página Fotos mostra o painel para trocar cada imagem entre autoral e comum, sem aviso. */
(function () {
  'use strict';
  const MAX_SIDE = 2400;
  const client = () => window.supabaseClient;
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let running = false;
  let rows = [];

  const photoCode = (id) => `CME-F-${String(id).replace(/-/g, '').slice(0, 8).toUpperCase()}`;

  function fitText(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let cut = text;
    while (cut.length > 8 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
    return `${cut}…`;
  }

  // Desenha o carimbo. Exportado para teste.
  function drawStamp(ctx, width, height, info) {
    const code = photoCode(info.id);
    const label = `${info.client_name} • ${info.contract_number} • ${code}`;
    const size = Math.max(16, Math.round(Math.min(width, height) / 24));
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate((-24 * Math.PI) / 180);
    ctx.font = `700 ${size}px Montserrat, Arial, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.30)';
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = Math.max(1, size / 14);
    const step = ctx.measureText(label).width + size * 3;
    const diagonal = Math.hypot(width, height);
    for (let y = -diagonal / 2, row = 0; y < diagonal / 2; y += size * 4.2, row += 1) {
      for (let x = -diagonal / 2 - (row % 2) * (step / 2); x < diagonal / 2; x += step) {
        ctx.strokeText(label, x, y);
        ctx.fillText(label, x, y);
      }
    }
    ctx.restore();
    const band = Math.max(28, Math.round(height * 0.045));
    ctx.fillStyle = 'rgba(1,9,20,0.85)';
    ctx.fillRect(0, height - band, width, band);
    ctx.fillStyle = '#d0b47a';
    ctx.font = `600 ${Math.round(band * 0.38)}px Montserrat, Arial, sans-serif`;
    ctx.textBaseline = 'middle';
    const footer = `© Camila Martins Engenharia • Cópia autenticada ${code} • ${info.client_name} • verifique em camilamartinsengenharia.com.br/verificar.html`;
    ctx.fillText(fitText(ctx, footer, width - band), band / 2, height - band / 2);
    return code;
  }

  async function stampedBlob(source, info) {
    const bitmap = await createImageBitmap(source);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    drawStamp(ctx, width, height, info);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
    if (!blob) throw new Error('Não foi possível gerar a cópia carimbada.');
    return blob;
  }

  async function prepare(row) {
    const original = await client().storage.from(row.storage_bucket).download(row.arquivo);
    if (original.error || !original.data) throw new Error(`não foi possível abrir "${row.nome || row.arquivo}"`);
    const blob = await stampedBlob(original.data, row);
    const path = `protegidas/${row.id}/${Date.now()}.jpg`;
    const sent = await client().storage.from(row.storage_bucket).upload(path, blob, { contentType: 'image/jpeg', cacheControl: '3600', upsert: false });
    if (sent.error) throw new Error(sent.error.message);
    const saved = await client().rpc('admin_photo_set_protected_copy', { p_photo: row.id, p_path: path, p_source: row.arquivo });
    if (saved.error) { await client().storage.from(row.storage_bucket).remove([path]); throw new Error(saved.error.message); }
    if (row.protected_copy_path && row.protected_copy_path !== path) await client().storage.from(row.storage_bucket).remove([row.protected_copy_path]);
  }

  async function loadQueue() {
    const result = await client().rpc('admin_photo_stamp_queue');
    if (result.error) throw new Error(result.error.message);
    rows = result.data || [];
    return rows;
  }

  async function runQueue() {
    if (running || !client()) return;
    running = true;
    const failures = [];
    try {
      await loadQueue();
      const pending = rows.filter((row) => row.needs_copy);
      for (let i = 0; i < pending.length; i += 1) {
        status(`Preparando cópias carimbadas: ${i + 1} de ${pending.length}...`);
        try { await prepare(pending[i]); } catch (error) { failures.push(error.message); }
      }
      if (pending.length) await loadQueue();
      render();
      if (failures.length) status(`Algumas imagens não foram preparadas: ${failures.join('; ')}. Elas serão tentadas de novo na próxima abertura.`, 'erro');
      else if (pending.length) status(`${pending.length} cópia(s) carimbada(s) preparada(s).`, 'sucesso');
    } catch (error) {
      status(`Cópias carimbadas: ${error.message}`, 'erro');
    } finally { running = false; }
  }

  /* ---------- Painel na página Fotos ---------- */
  let panel = null;
  function status(text, type = 'info') {
    const el = panel?.querySelector('[data-ap-status]');
    if (el) { el.textContent = text; el.dataset.type = type; }
  }

  function render() {
    if (!panel) return;
    const authored = rows.filter((r) => r.protection_mode === 'authored_photo');
    const ready = authored.filter((r) => !r.needs_copy).length;
    panel.querySelector('[data-ap-summary]').textContent =
      `${authored.length} imagem(ns) autoral(is) • ${ready} com cópia carimbada pronta • ${rows.length - authored.length} comum(ns)`;
    const groups = new Map();
    rows.forEach((r) => { const key = r.client_name || 'Sem cliente'; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(r); });
    panel.querySelector('[data-ap-list]').innerHTML = [...groups.entries()].map(([name, items]) => `
      <details class="ap-group"><summary><strong>${esc(name)}</strong> <span>${items.length} imagem(ns)</span></summary>
        <div class="ap-bulk"><button type="button" data-ap-bulk="authored_photo" data-ap-ids="${esc(items.map((i) => i.id).join(','))}">Todas autorais</button><button type="button" data-ap-bulk="administrative" data-ap-ids="${esc(items.map((i) => i.id).join(','))}">Todas comuns</button></div>
        <ul>${items.map((r) => `<li>
          <span class="ap-name">${esc(r.nome || r.arquivo.split('/').pop())}</span>
          <select data-ap-mode="${esc(r.id)}" aria-label="Tipo da imagem">
            <option value="authored_photo"${r.protection_mode === 'authored_photo' ? ' selected' : ''}>Autoral (cliente vê cópia carimbada)</option>
            <option value="administrative"${r.protection_mode !== 'authored_photo' ? ' selected' : ''}>Comum (cliente vê sem carimbo)</option>
          </select>
          ${r.protection_mode === 'authored_photo' ? (r.needs_copy ? '<span class="ap-chip is-pending">Preparando</span>' : `<button type="button" class="ap-chip" data-ap-view="${esc(r.id)}">Ver cópia do cliente</button>`) : ''}
        </li>`).join('')}</ul>
      </details>`).join('') || '<p>Nenhuma imagem cadastrada.</p>';
  }

  async function setMode(ids, mode) {
    const result = await client().rpc('admin_photo_set_protection', { p_ids: ids, p_mode: mode });
    if (result.error) { status(result.error.message, 'erro'); return; }
    status(mode === 'authored_photo' ? 'Marcada(s) como autoral(is); preparando as cópias carimbadas...' : 'Marcada(s) como comum(ns). O cliente não foi avisado.', 'sucesso');
    await runQueue();
    if (!running) { await loadQueue(); render(); }
  }

  async function viewCopy(id) {
    const row = rows.find((r) => r.id === id);
    if (!row?.protected_copy_path) return;
    const signed = await client().storage.from(row.storage_bucket).createSignedUrl(row.protected_copy_path, 120);
    if (signed.data?.signedUrl) window.open(signed.data.signedUrl, '_blank', 'noopener');
  }

  function mountPanel() {
    const gallery = document.getElementById('galeriaFotos');
    if (!gallery) return;
    panel = document.createElement('section');
    panel.className = 'card-grande ap-panel';
    panel.innerHTML = `
      <details class="ap-root"><summary><strong>Imagens autorais</strong> <span data-ap-summary>Carregando...</span></summary>
        <p class="ap-help">Imagens autorais (renders, projetos, pranchas) chegam ao cliente como cópia com o nome dele, o contrato (ou o projeto) e um código gravados na própria imagem. Fotos comuns de obra chegam sem carimbo. Ao enviar em Documentos, a caixa "Arquivo autoral" define o tipo; aqui você pode trocar depois, sem avisar o cliente.</p>
        <p class="ap-status" data-ap-status role="status" aria-live="polite"></p>
        <div data-ap-list></div>
      </details>`;
    gallery.parentElement.insertBefore(panel, gallery);
    panel.addEventListener('change', (event) => {
      const select = event.target.closest('[data-ap-mode]');
      if (select) setMode([select.dataset.apMode], select.value);
    });
    panel.addEventListener('click', (event) => {
      const bulk = event.target.closest('[data-ap-bulk]');
      if (bulk) { setMode(bulk.dataset.apIds.split(','), bulk.dataset.apBulk); return; }
      const view = event.target.closest('[data-ap-view]');
      if (view) viewCopy(view.dataset.apView);
    });
  }

  async function start() {
    if (!client()) return;
    const { data } = await client().auth.getUser();
    if (!data?.user) return;
    const admin = await client().rpc('is_portal_admin');
    if (admin.error || admin.data !== true) return;
    mountPanel();
    await runQueue();
    // Imagens enviadas com a página aberta também ganham cópia (consulta leve a cada minuto).
    setInterval(runQueue, 60_000);
  }

  window.CMEAuthoredPhotos = { drawStamp, photoCode, runQueue };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
}());
