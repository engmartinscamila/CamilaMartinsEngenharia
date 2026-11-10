/* Catálogo de guias autorais.
   - Cada guia é enviado uma vez (original em "autorais/", fora do alcance do cliente).
   - Liberar copia o original para a pasta do cliente; o cliente recebe a cópia protegida
     com o nome dele (proteger-pdf), como antes.
   - Substituir cria uma nova versão e atualiza a cópia de todos os clientes que têm o guia.
   - Nada avisa o cliente, a menos que "avisar" seja marcado. */
(function () {
  'use strict';
  const U = window.CMEAuthoredUtils;
  const BUCKET = 'documentos';
  const MAX_BYTES = 25 * 1024 * 1024;
  const client = () => window.supabaseClient;
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('pt-BR') : '—');
  const fmtSize = (n) => (Number(n) > 0 ? `${(Number(n) / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB` : '—');
  const state = { materials: [], versions: [], documents: [], clients: [], projects: [], pending: [] };

  function status(text, type = 'info') {
    const el = $('acStatus');
    if (!el) return;
    el.textContent = text;
    el.dataset.type = type;
  }

  async function sha256(file) {
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Imagem (render, prancha) vira PDF de uma página, que segue o fluxo protegido dos guias.
  const IMAGE_RE = /\.(jpe?g|png|webp)$/i;
  let pdfLibPromise = null;
  function loadPdfLib() {
    if (window.PDFLib) return Promise.resolve(window.PDFLib);
    pdfLibPromise = pdfLibPromise || new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
      script.onload = () => (window.PDFLib ? resolve(window.PDFLib) : reject(new Error('Conversor de PDF indisponível.')));
      script.onerror = () => { pdfLibPromise = null; reject(new Error('Não foi possível carregar o conversor de imagem para PDF.')); };
      document.head.appendChild(script);
    });
    return pdfLibPromise;
  }
  async function toPdfIfImage(file) {
    if (!(file instanceof File) || !IMAGE_RE.test(file.name)) return file;
    const PDFLib = await loadPdfLib();
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 3000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const jpeg = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    const doc = await PDFLib.PDFDocument.create();
    const image = await doc.embedJpg(new Uint8Array(await jpeg.arrayBuffer()));
    const page = doc.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    doc.setTitle(file.name.replace(IMAGE_RE, ''));
    const bytes = await doc.save();
    return new File([bytes], file.name.replace(IMAGE_RE, '.pdf'), { type: 'application/pdf' });
  }

  async function validPdf(file) {
    if (!(file instanceof File) || !/\.pdf$/i.test(file.name)) return 'Envie somente arquivos PDF.';
    if (file.size <= 0 || file.size > MAX_BYTES) return 'O PDF deve ter até 25 MB.';
    const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    if (String.fromCharCode(...head) !== '%PDF-') return 'O arquivo não é um PDF válido.';
    return '';
  }

  const must = (result, message) => { if (result.error) throw new Error(result.error.message || message); return result.data; };
  const storage = () => client().storage.from(BUCKET);
  const removable = (paths) => paths.filter((p) => p && !String(p).startsWith('autorais/'));
  const folderOf = (m) => (String(m.storage_path).match(/^autorais\/([^/]+)\//) || [])[1] || m.id;
  const docsOf = (materialId) => state.documents.filter((d) => d.authored_material_id === materialId);
  const projectsOf = (clientId) => state.projects.filter((p) => String(p.cliente_id) === String(clientId));
  const clientName = (id) => state.clients.find((c) => String(c.id) === String(id))?.nome || 'Cliente';

  async function load() {
    const [materials, versions, documents, clients, projects] = await Promise.all([
      client().from('authored_materials').select('*').eq('active', true).order('category').order('number', { nullsFirst: false }).order('title'),
      client().from('authored_material_versions').select('*').order('version', { ascending: false }),
      client().from('documentos').select('id,cliente_id,projeto_id,arquivo,nome,authored_material_id,authored_material_version').not('authored_material_id', 'is', null),
      client().from('clientes').select('id,nome,status').eq('status', 'ativo').order('nome'),
      client().from('projetos').select('id,nome,cliente_id,status').neq('status', 'arquivado').order('created_at', { ascending: false })
    ]);
    state.materials = must(materials, 'Não foi possível carregar o catálogo.') || [];
    state.versions = must(versions, 'Não foi possível carregar o histórico.') || [];
    state.documents = must(documents, 'Não foi possível carregar os documentos.') || [];
    state.clients = must(clients, 'Não foi possível carregar os clientes.') || [];
    state.projects = must(projects, 'Não foi possível carregar os projetos.') || [];
  }

  // Originais migrados ainda apontam para a cópia de um cliente: copia para a pasta interna.
  async function secureMasters() {
    const pending = state.materials.filter((m) => !String(m.storage_path).startsWith('autorais/'));
    for (const m of pending) {
      const target = U.masterPath(m.id, m.current_version, m.title);
      const copied = await storage().copy(m.storage_path, target);
      if (copied.error) throw new Error(`Não foi possível guardar o original de "${m.title}": ${copied.error.message}`);
      must(await client().rpc('admin_authored_material_set_master', { p_material: m.id, p_path: target }), 'Falha ao registrar o original.');
    }
    return pending.length;
  }

  // Atualiza a cópia de cada cliente para a versão vigente do material.
  async function propagate(materialId, notify) {
    const fresh = must(await client().from('authored_materials').select('*').eq('id', materialId).single(), 'Material não encontrado.');
    const docs = must(await client().from('documentos').select('id,cliente_id,projeto_id,arquivo').eq('authored_material_id', materialId), 'Falha ao listar clientes.') || [];
    const created = []; const items = [];
    try {
      for (const d of docs) {
        const target = U.clientCopyPath(d.cliente_id, d.projeto_id, fresh.title);
        const copied = await storage().copy(fresh.storage_path, target);
        if (copied.error) throw new Error(copied.error.message);
        created.push(target);
        items.push({ document_id: d.id, arquivo: target });
      }
      const applied = must(await client().rpc('admin_authored_material_apply', { p_material: materialId, p_items: items, p_notify: Boolean(notify) }), 'Falha ao atualizar os clientes.');
      const old = removable(applied?.old_paths || []);
      if (old.length) await storage().remove(old);
      return docs.length;
    } catch (error) {
      if (created.length) await storage().remove(created);
      throw error;
    }
  }

  async function newVersion(material, file, notify, note) {
    const problem = await validPdf(file);
    if (problem) throw new Error(problem);
    const hash = await sha256(file);
    if (hash === material.sha256) throw new Error('Este arquivo é idêntico à versão atual.');
    const path = U.masterPath(folderOf(material), Number(material.current_version) + 1, material.title);
    must(await storage().upload(path, file, { contentType: 'application/pdf', cacheControl: '0', upsert: false }), 'Falha ao enviar o arquivo.');
    const version = must(await client().rpc('admin_authored_material_new_version', {
      p_material: material.id, p_path: path, p_sha: hash, p_size: file.size, p_name: file.name, p_note: note || null
    }), 'Falha ao registrar a versão.');
    const updated = await propagate(material.id, notify);
    return { version, updated };
  }

  /* ---------- Envio de guias novos ---------- */
  function renderPending() {
    const list = $('acNewList');
    const options = state.materials.map((m) => `<option value="${esc(m.id)}">Nova versão de: ${esc(m.title)}</option>`).join('');
    list.innerHTML = state.pending.map((row, i) => `
      <div class="ac-new-row${row.error ? ' has-error' : ''}" data-row="${i}">
        <div class="ac-new-file"><i class="fa-solid fa-file-pdf"></i> ${esc(row.file.name)} <small>${esc(fmtSize(row.file.size))}</small></div>
        <label>Título<input data-field="title" value="${esc(row.title)}"></label>
        <label>Destino<select data-field="target"><option value="new">Guia novo</option>${options}</select></label>
        <label>Categoria<select data-field="category">${['Guias de Obra', 'Guias de Interiores', 'Guias de Estilos Arquitetônicos', 'Outros'].map((c) => `<option${c === row.category ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
        ${row.error ? `<p class="ac-row-error">${esc(row.error)}</p>` : ''}
        <button type="button" class="ac-ghost" data-remove-row="${i}" aria-label="Retirar da lista">×</button>
      </div>`).join('');
    state.pending.forEach((row, i) => { const sel = list.querySelector(`[data-row="${i}"] [data-field="target"]`); if (sel) sel.value = row.target; });
    $('acSaveNew').disabled = !state.pending.some((row) => !row.error);
  }

  async function pickNewFiles(files) {
    for (const picked of files) {
      let file = picked;
      try { file = await toPdfIfImage(picked); } catch (error) { state.pending.push({ file: picked, title: picked.name, category: 'Outros', target: 'new', error: error.message }); continue; }
      const s = U.suggestFromFilename(file.name);
      const match = state.materials.find((m) => m.code === s.code);
      const error = await validPdf(file);
      state.pending.push({ file, title: match ? match.title : s.title, category: match ? match.category : s.category, series: s.series, number: s.number, code: s.code, target: match ? match.id : 'new', error });
    }
    renderPending();
  }

  async function saveNew() {
    const button = $('acSaveNew'); button.disabled = true;
    const rows = state.pending.filter((row) => !row.error);
    let done = 0; const failures = [];
    for (const row of rows) {
      status(`Salvando ${done + 1} de ${rows.length}: ${row.title}...`);
      try {
        if (row.target !== 'new') {
          const material = state.materials.find((m) => m.id === row.target);
          await newVersion(material, row.file, false, 'Enviado pelo catálogo');
        } else {
          const hash = await sha256(row.file);
          const duplicate = state.materials.find((m) => m.sha256 && m.sha256 === hash);
          if (duplicate) throw new Error(`arquivo idêntico a "${duplicate.title}"`);
          const path = U.masterPath(crypto.randomUUID(), 1, row.title);
          must(await storage().upload(path, row.file, { contentType: 'application/pdf', cacheControl: '0', upsert: false }), 'Falha ao enviar o arquivo.');
          const code = state.materials.some((m) => m.code === row.code) ? `${row.code}-${Date.now().toString(36)}` : row.code;
          must(await client().rpc('admin_authored_material_save', { p: {
            title: row.title, code, series: row.series, number: row.number, category: row.category,
            storage_path: path, sha256: hash, size_bytes: row.file.size, original_name: row.file.name
          } }), 'Falha ao salvar o guia.');
        }
        done += 1; row.saved = true;
      } catch (error) { failures.push(`${row.title}: ${error.message}`); }
    }
    state.pending = state.pending.filter((row) => !row.saved);
    await refresh();
    renderPending();
    status(failures.length ? `${done} salvo(s). Não salvos: ${failures.join(' | ')}` : `${done} guia(s) salvo(s) no catálogo.`, failures.length ? 'erro' : 'sucesso');
  }

  /* ---------- Catálogo ---------- */
  function renderCatalog() {
    const needle = U.slugify($('acSearch')?.value || '').replace(/-/g, ' ');
    const rows = state.materials.filter((m) => !needle || U.slugify(`${m.title} ${m.category}`).replace(/-/g, ' ').includes(needle));
    const groups = [...new Set(rows.map((m) => m.category))];
    $('acCatalog').innerHTML = rows.length ? groups.map((group) => `
      <h4 class="ac-group">${esc(group)}</h4>
      ${rows.filter((m) => m.category === group).map((m) => {
        const docs = docsOf(m.id);
        const outdated = docs.filter((d) => Number(d.authored_material_version || 0) < Number(m.current_version)).length;
        return `<article class="ac-item" data-material="${esc(m.id)}">
          <div class="ac-item-main">
            <strong>${esc(m.title)}</strong>
            <span>v${esc(m.current_version)} • atualizado em ${esc(fmtDate(m.updated_at))} • ${esc(fmtSize(m.size_bytes))}</span>
            <span>${docs.length} cliente(s)${outdated ? ` • <b class="ac-warn">${outdated} com versão antiga</b>` : ''}</span>
          </div>
          <div class="ac-item-actions">
            <button type="button" class="ac-primary" data-action="replace"><i class="fa-solid fa-arrows-rotate"></i> Substituir arquivo</button>
            <button type="button" data-action="release"><i class="fa-solid fa-user-plus"></i> Liberar para clientes</button>
            ${outdated ? '<button type="button" data-action="sync"><i class="fa-solid fa-rotate"></i> Atualizar clientes</button>' : ''}
            <button type="button" data-action="history"><i class="fa-solid fa-clock-rotate-left"></i> Histórico</button>
            <button type="button" data-action="edit"><i class="fa-solid fa-pen"></i> Editar</button>
            <button type="button" data-action="open"><i class="fa-solid fa-eye"></i> Abrir original</button>
          </div>
        </article>`;
      }).join('')}`).join('') : '<p class="ac-empty">Nenhum guia encontrado.</p>';
  }

  function renderMatrix() {
    const total = state.materials.length;
    const rows = U.clientMatrix(state.materials, state.documents, state.clients)
      .sort((a, b) => b.has.length - a.has.length || String(a.client.nome).localeCompare(String(b.client.nome), 'pt-BR'));
    $('acMatrix').innerHTML = rows.map(({ client: c, has, missing }) => `
      <article class="ac-client">
        <header><strong>${esc(c.nome)}</strong><span>${has.length} de ${total} guias</span></header>
        <div class="ac-chips">${has.map((h) => `<span class="ac-chip${h.outdated ? ' is-outdated' : ''}" title="${h.outdated ? 'Cópia em versão antiga' : 'Versão atual'}">${esc(h.material.title)}${h.outdated ? ` (v${esc(h.document.authored_material_version)})` : ''}<button type="button" data-revoke="${esc(h.document.id)}" data-label="${esc(h.material.title)}" data-client="${esc(c.nome)}" aria-label="Retirar do cliente">×</button></span>`).join('') || '<em>Nenhum guia liberado.</em>'}</div>
        ${missing.length ? `<details><summary>Falta liberar (${missing.length})</summary><div class="ac-chips">${missing.map((m) => `<button type="button" class="ac-chip is-missing" data-release-one="${esc(m.id)}" data-client-id="${esc(c.id)}">+ ${esc(m.title)}</button>`).join('')}</div></details>` : ''}
      </article>`).join('') || '<p class="ac-empty">Nenhum cliente ativo.</p>';
  }

  async function refresh() { await load(); renderCatalog(); renderMatrix(); }

  /* ---------- Janelas ---------- */
  function modal(title, html) {
    $('acModalTitle').textContent = title;
    $('acModalBody').innerHTML = html;
    $('acModal').hidden = false;
    return $('acModalBody');
  }
  const closeModal = () => { $('acModal').hidden = true; $('acModalBody').innerHTML = ''; };

  function busy(button, text) { button.disabled = true; button.dataset.label = button.innerHTML; button.textContent = text; }
  function idle(button) { button.disabled = false; if (button.dataset.label) button.innerHTML = button.dataset.label; }

  function openReplace(m) {
    const count = docsOf(m.id).length;
    const body = modal(`Substituir: ${m.title}`, `
      <p>O novo PDF vira a versão ${Number(m.current_version) + 1}. ${count ? `As cópias de ${count} cliente(s) serão atualizadas.` : 'Nenhum cliente tem este guia ainda.'} A versão atual fica no histórico.</p>
      <label class="ac-file"><input id="acReplaceFile" type="file" accept="application/pdf,.pdf,image/jpeg,image/png,image/webp"><span><i class="fa-solid fa-file-arrow-up"></i> Escolher o arquivo novo (PDF ou imagem)</span></label>
      <p id="acReplaceName" class="ac-muted"></p>
      <label>O que mudou (opcional)<input id="acReplaceNote" maxlength="160" placeholder="Ex.: revisão de normas e novas fotos"></label>
      <label class="ac-check"><input id="acReplaceNotify" type="checkbox"> Avisar os clientes (e-mail e notificação no portal)</label>
      <div class="ac-actions"><button type="button" data-ac-close>Cancelar</button><button type="button" class="ac-primary" id="acReplaceGo" disabled>Substituir para todos</button></div>`);
    const input = body.querySelector('#acReplaceFile');
    input.addEventListener('change', () => { body.querySelector('#acReplaceName').textContent = input.files[0]?.name || ''; body.querySelector('#acReplaceGo').disabled = !input.files[0]; });
    body.querySelector('#acReplaceGo').addEventListener('click', async (event) => {
      const button = event.currentTarget; busy(button, 'Substituindo...');
      const notify = body.querySelector('#acReplaceNotify').checked;
      try {
        const result = await newVersion(m, await toPdfIfImage(input.files[0]), notify, body.querySelector('#acReplaceNote').value.trim());
        closeModal(); await refresh();
        status(`${m.title}: versão ${result.version} no ar; ${result.updated} cliente(s) atualizado(s)${notify ? ' e avisado(s)' : ' sem aviso'}.`, 'sucesso');
      } catch (error) { idle(button); status(`Não foi possível substituir: ${error.message}`, 'erro'); }
    });
  }

  function openRelease(m, preselectClientId = '') {
    const owned = new Set(docsOf(m.id).map((d) => String(d.cliente_id)));
    const rows = state.clients.map((c) => {
      const projects = projectsOf(c.id);
      const has = owned.has(String(c.id));
      const disabled = has || !projects.length;
      return `<div class="ac-release-row${disabled ? ' is-disabled' : ''}">
        <label class="ac-check"><input type="checkbox" data-client="${esc(c.id)}"${disabled ? ' disabled' : ''}${!disabled && String(c.id) === String(preselectClientId) ? ' checked' : ''}> ${esc(c.nome)}</label>
        ${has ? '<span class="ac-muted">já tem</span>' : !projects.length ? '<span class="ac-muted">sem projeto cadastrado</span>'
          : projects.length === 1 ? `<span class="ac-muted">${esc(projects[0].nome)}</span><input type="hidden" data-project-for="${esc(c.id)}" value="${esc(projects[0].id)}">`
          : `<select data-project-for="${esc(c.id)}">${projects.map((p) => `<option value="${esc(p.id)}">${esc(p.nome)}</option>`).join('')}</select>`}
      </div>`;
    }).join('');
    const body = modal(`Liberar: ${m.title}`, `
      <p>Cada cliente recebe a própria cópia protegida, com o nome dele no carimbo.</p>
      <div class="ac-release-list">${rows}</div>
      <label class="ac-check"><input id="acReleaseNotify" type="checkbox"> Avisar os clientes (e-mail e notificação no portal)</label>
      <div class="ac-actions"><button type="button" data-ac-close>Cancelar</button><button type="button" class="ac-primary" id="acReleaseGo">Liberar</button></div>`);
    body.querySelector('#acReleaseGo').addEventListener('click', async (event) => {
      const chosen = [...body.querySelectorAll('input[data-client]:checked')].map((el) => ({ cliente_id: el.dataset.client, projeto_id: body.querySelector(`[data-project-for="${el.dataset.client}"]`)?.value || null }));
      if (!chosen.length) { status('Selecione pelo menos um cliente.', 'erro'); return; }
      const button = event.currentTarget; busy(button, 'Liberando...');
      const created = [];
      try {
        const items = [];
        for (const item of chosen) {
          const target = U.clientCopyPath(item.cliente_id, item.projeto_id, m.title);
          const copied = await storage().copy(m.storage_path, target);
          if (copied.error) throw new Error(copied.error.message);
          created.push(target);
          items.push({ ...item, arquivo: target });
        }
        const result = must(await client().rpc('admin_authored_material_release', { p_material: m.id, p_items: items, p_notify: body.querySelector('#acReleaseNotify').checked }), 'Falha ao liberar.');
        const skipped = removable(result?.skipped_paths || []);
        if (skipped.length) await storage().remove(skipped);
        closeModal(); await refresh();
        status(`${m.title} liberado para ${(result?.created || []).length} cliente(s).`, 'sucesso');
      } catch (error) {
        if (created.length) await storage().remove(created);
        idle(button); status(`Não foi possível liberar: ${error.message}`, 'erro');
      }
    });
  }

  function openHistory(m) {
    const versions = state.versions.filter((v) => v.material_id === m.id);
    const body = modal(`Histórico: ${m.title}`, `<ul class="ac-history">${versions.map((v) => `
      <li><span><strong>v${esc(v.version)}</strong> • ${esc(fmtDate(v.created_at))} • ${esc(fmtSize(v.size_bytes))}${v.note ? ` • ${esc(v.note)}` : ''}</span>
      ${Number(v.version) === Number(m.current_version) ? '<span class="ac-live">Em uso</span>' : `<button type="button" data-restore="${esc(v.id)}">Voltar para esta versão</button>`}</li>`).join('')}</ul>
      <p class="ac-muted">Voltar uma versão atualiza a cópia de todos os clientes que têm o guia, sem aviso.</p>`);
    body.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-restore]');
      if (!button) return;
      const v = versions.find((item) => item.id === button.dataset.restore);
      if (!window.confirm(`Colocar a versão ${v.version} de "${m.title}" de volta para todos os clientes?`)) return;
      busy(button, 'Restaurando...');
      try {
        must(await client().rpc('admin_authored_material_new_version', { p_material: m.id, p_path: v.storage_path, p_sha: v.sha256, p_size: v.size_bytes, p_name: v.original_name, p_note: `Retorno à versão ${v.version}` }), 'Falha ao restaurar.');
        const updated = await propagate(m.id, false);
        closeModal(); await refresh();
        status(`${m.title}: versão ${v.version} restaurada para ${updated} cliente(s).`, 'sucesso');
      } catch (error) { idle(button); status(`Não foi possível restaurar: ${error.message}`, 'erro'); }
    });
  }

  function openEdit(m) {
    const body = modal(`Editar: ${m.title}`, `
      <label>Título (é o nome que o cliente vê)<input id="acEditTitle" value="${esc(m.title)}" maxlength="160"></label>
      <label>Categoria<select id="acEditCategory">${['Guias de Obra', 'Guias de Interiores', 'Guias de Estilos Arquitetônicos', 'Outros'].map((c) => `<option${c === m.category ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
      <label>Descrição (opcional)<textarea id="acEditDescription" rows="3">${esc(m.description || '')}</textarea></label>
      <div class="ac-actions"><button type="button" data-ac-close>Cancelar</button><button type="button" class="ac-primary" id="acEditGo">Salvar</button></div>`);
    body.querySelector('#acEditGo').addEventListener('click', async (event) => {
      const button = event.currentTarget; busy(button, 'Salvando...');
      try {
        const title = body.querySelector('#acEditTitle').value.trim();
        must(await client().rpc('admin_authored_material_save', { p: { id: m.id, title, code: m.code, series: m.series, number: m.number, category: body.querySelector('#acEditCategory').value, description: body.querySelector('#acEditDescription').value.trim() } }), 'Falha ao salvar.');
        // O nome visto pelo cliente acompanha o título, sem aviso e sem trocar o arquivo.
        const items = docsOf(m.id).map((d) => ({ document_id: d.id, arquivo: d.arquivo }));
        if (items.length && title !== m.title) must(await client().rpc('admin_authored_material_apply', { p_material: m.id, p_items: items, p_notify: false }), 'Falha ao atualizar o nome nos clientes.');
        closeModal(); await refresh(); status('Guia atualizado.', 'sucesso');
      } catch (error) { idle(button); status(`Não foi possível salvar: ${error.message}`, 'erro'); }
    });
  }

  async function openOriginal(m) {
    const signed = await storage().createSignedUrl(m.storage_path, 60);
    if (signed.error || !signed.data?.signedUrl) { status('Não foi possível abrir o original.', 'erro'); return; }
    window.open(signed.data.signedUrl, '_blank', 'noopener');
  }

  async function revoke(button) {
    if (!window.confirm(`Retirar "${button.dataset.label}" de ${button.dataset.client}? O cliente não é avisado.`)) return;
    button.disabled = true;
    try {
      const path = must(await client().rpc('admin_authored_material_revoke', { p_document: button.dataset.revoke }), 'Falha ao retirar.');
      if (removable([path]).length) await storage().remove([path]);
      await refresh(); status('Guia retirado do cliente.', 'sucesso');
    } catch (error) { button.disabled = false; status(`Não foi possível retirar: ${error.message}`, 'erro'); }
  }

  async function start() {
    if (!client() || !U) { status('Não foi possível iniciar o catálogo. Atualize a página.', 'erro'); return; }
    const { data } = await client().auth.getUser();
    if (!data?.user) { window.location.href = 'login.html'; return; }
    try {
      await load();
      const moved = await secureMasters();
      if (moved) await load();
      renderCatalog(); renderMatrix();
      status(`${state.materials.length} guia(s) no catálogo.`, 'sucesso');
    } catch (error) { status(error.message || 'Não foi possível carregar o catálogo.', 'erro'); }

    $('acNewFiles').addEventListener('change', async (event) => { await pickNewFiles([...event.target.files]); event.target.value = ''; });
    $('acNewList').addEventListener('input', (event) => {
      const row = state.pending[Number(event.target.closest('[data-row]')?.dataset.row)];
      if (row && event.target.dataset.field) row[event.target.dataset.field] = event.target.value;
    });
    $('acNewList').addEventListener('change', (event) => {
      const row = state.pending[Number(event.target.closest('[data-row]')?.dataset.row)];
      if (row && event.target.dataset.field) row[event.target.dataset.field] = event.target.value;
    });
    $('acNewList').addEventListener('click', (event) => {
      const button = event.target.closest('[data-remove-row]');
      if (button) { state.pending.splice(Number(button.dataset.removeRow), 1); renderPending(); }
    });
    $('acSaveNew').addEventListener('click', saveNew);
    $('acSearch').addEventListener('input', renderCatalog);
    $('acCatalog').addEventListener('click', (event) => {
      const button = event.target.closest('[data-action]');
      if (!button) return;
      const m = state.materials.find((item) => item.id === button.closest('[data-material]').dataset.material);
      if (!m) return;
      ({
        replace: () => openReplace(m),
        release: () => openRelease(m),
        history: () => openHistory(m),
        edit: () => openEdit(m),
        open: () => openOriginal(m),
        sync: async () => { busy(button, 'Atualizando...'); try { const n = await propagate(m.id, false); await refresh(); status(`${m.title}: ${n} cliente(s) na versão atual.`, 'sucesso'); } catch (error) { idle(button); status(error.message, 'erro'); } }
      })[button.dataset.action]?.();
    });
    $('acMatrix').addEventListener('click', (event) => {
      const revokeButton = event.target.closest('[data-revoke]');
      if (revokeButton) { revoke(revokeButton); return; }
      const add = event.target.closest('[data-release-one]');
      if (add) { const m = state.materials.find((item) => item.id === add.dataset.releaseOne); if (m) openRelease(m, add.dataset.clientId); }
    });
    $('acModal').addEventListener('click', (event) => { if (event.target === $('acModal') || event.target.closest('[data-ac-close]')) closeModal(); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !$('acModal').hidden) closeModal(); });
  }

  start();
}());
