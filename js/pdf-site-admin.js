/* PDFs protegidos do site (Portfólio e Menu de Experiências).
   Cada troca guarda o original novo em uma pasta própria e mantém o histórico, com opção
   de voltar a uma versão anterior. O site continua emitindo cópia protegida a cada visita,
   sempre a partir do original vigente. */
(function () {
  'use strict';
  const BUCKET = 'materiais-protegidos';
  const MAX_BYTES = 25 * 1024 * 1024;
  const LABELS = { portfolio: 'Portfólio', experiencias: 'Guia de níveis de experiência' };
  const client = () => window.supabaseClient;
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = (v) => (v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
  const fmtSize = (n) => (Number(n) > 0 ? `${(Number(n) / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB` : '—');

  function status(text, type = 'info') {
    const el = $('pdfAdminStatus');
    if (!el) return;
    el.textContent = text;
    el.dataset.type = type;
  }

  async function sha256(file) {
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  }

  async function isPdf(file) {
    const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    return String.fromCharCode(...head) === '%PDF-';
  }

  async function requireAdmin() {
    const { data, error } = await client().auth.getUser();
    if (error || !data?.user) { window.location.href = 'login.html'; return null; }
    const { data: admin, error: adminError } = await client().from('pdf_admins').select('user_id').eq('user_id', data.user.id).maybeSingle();
    if (adminError || !admin) {
      status('Acesso permitido somente à administradora.', 'erro');
      document.querySelectorAll('form[data-pdf-upload] input, form[data-pdf-upload] button').forEach((el) => { el.disabled = true; });
      return null;
    }
    return data.user;
  }

  async function render() {
    const list = $('pdfAdminList');
    if (!list) return;
    const [current, versions] = await Promise.all([
      client().from('protected_site_pdfs').select('slug,title,original_storage_path,original_sha256,updated_at,active').order('slug'),
      client().from('protected_site_pdf_versions').select('id,slug,version,storage_path,sha256,size_bytes,original_name,note,created_at').order('version', { ascending: false })
    ]);
    if (current.error || versions.error) { list.innerHTML = '<li>Não foi possível consultar os PDFs.</li>'; return; }
    const bySlug = new Map((current.data || []).map((row) => [row.slug, row]));
    list.innerHTML = ['portfolio', 'experiencias'].map((slug) => {
      const row = bySlug.get(slug);
      const history = (versions.data || []).filter((v) => v.slug === slug);
      const live = history.find((v) => v.storage_path === row?.original_storage_path) || history[0];
      const items = history.map((v) => {
        const isLive = live && v.id === live.id;
        return `<li class="pdf-version${isLive ? ' is-live' : ''}">
          <span><strong>v${v.version}</strong> • ${esc(fmtDate(v.created_at))} • ${esc(fmtSize(v.size_bytes))}${v.original_name ? ` • ${esc(v.original_name)}` : ''}${v.note ? ` <em>(${esc(v.note)})</em>` : ''}</span>
          ${isLive ? '<span class="pdf-version-live">No ar</span>' : `<button type="button" class="site-admin-secondary" data-pdf-restore="${esc(v.id)}" data-pdf-label="${esc(LABELS[slug])} v${v.version}">Voltar para esta versão</button>`}
        </li>`;
      }).join('');
      return `<li class="pdf-admin-current" data-pdf-slug="${slug}">
        <strong>${esc(LABELS[slug])}</strong>
        <span>${row?.active ? `No ar: <b>v${live?.version ?? 1}</b> • atualizado em ${esc(fmtDate(row.updated_at))} • ${esc(fmtSize(live?.size_bytes))}` : 'Aguardando envio do PDF original'}</span>
        ${row?.active ? `<a class="site-admin-secondary" href="pdf-protegido.html?slug=${slug}" target="_blank" rel="noopener" data-pdf-check="${slug}">Conferir cópia protegida</a>` : ''}
        ${items ? `<details><summary>Histórico (${history.length})</summary><ul class="pdf-version-list">${items}</ul></details>` : ''}
      </li>`;
    }).join('');
  }

  async function upload(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const slug = form.dataset.slug;
    const label = LABELS[slug] || form.dataset.title;
    const input = form.querySelector('input[type="file"]');
    const button = form.querySelector('button[type="submit"]');
    const file = input?.files?.[0];
    if (!(file instanceof File) || !/\.pdf$/i.test(file.name) || !(await isPdf(file))) { status('Selecione um arquivo PDF válido.', 'erro'); return; }
    if (file.size <= 0 || file.size > MAX_BYTES) { status('O PDF deve ter no máximo 25 MB.', 'erro'); return; }
    if (!window.confirm(`Substituir o ${label} do site por "${file.name}"?\n\nA versão atual fica guardada no histórico e pode ser restaurada.`)) return;
    button.disabled = true;
    const original = button.innerHTML;
    button.textContent = 'Enviando com segurança...';
    status(`Protegendo o novo original de ${label}...`);
    try {
      const hash = await sha256(file);
      const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
      const path = `site-originais/${slug}/${stamp}-${hash.slice(0, 8)}.pdf`;
      const sent = await client().storage.from(BUCKET).upload(path, file, { contentType: 'application/pdf', cacheControl: '0', upsert: false });
      if (sent.error) throw sent.error;
      const published = await client().rpc('admin_site_pdf_publish', { p_slug: slug, p_path: path, p_sha: hash, p_size: file.size, p_name: file.name, p_note: null });
      if (published.error) throw published.error;
      form.reset();
      status(`${label} v${published.data} no ar. As próximas visitas já recebem a cópia protegida do novo arquivo.`, 'sucesso');
      await render();
    } catch (error) {
      console.error(error);
      status(error?.message || 'Não foi possível enviar o PDF.', 'erro');
    } finally {
      button.disabled = false;
      button.innerHTML = original;
    }
  }

  async function restore(button) {
    if (!window.confirm(`Colocar ${button.dataset.pdfLabel} de volta no ar?`)) return;
    button.disabled = true;
    const { data, error } = await client().rpc('admin_site_pdf_restore', { p_version: button.dataset.pdfRestore });
    if (error) { status(error.message || 'Não foi possível restaurar a versão.', 'erro'); button.disabled = false; return; }
    status(`Versão restaurada (registrada como v${data}).`, 'sucesso');
    await render();
  }

  async function start() {
    if (!client()) { status('Cliente Supabase indisponível.', 'erro'); return; }
    if (!(await requireAdmin())) return;
    document.querySelectorAll('form[data-pdf-upload]').forEach((form) => form.addEventListener('submit', upload));
    $('pdfAdminList')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-pdf-restore]');
      if (button) restore(button);
    });
    $('pdfAdminLogout')?.addEventListener('click', async () => { await client().auth.signOut(); window.location.href = 'login.html'; });
    await render();
    status('Área segura pronta para receber os originais.', 'sucesso');
  }

  start();
}());
