(function iniciarVisualizadorPdfProtegido() {
  'use strict';
  const client = window.supabaseClient;
  const params = new URLSearchParams(location.search);
  const frame = document.getElementById('protectedPdfFrame');
  const loading = document.getElementById('pdfProtectionLoading');
  const errorBox = document.getElementById('pdfProtectionError');
  const title = document.getElementById('protectedPdfTitle');
  const code = document.getElementById('pdfIssueCode');
  const download = document.getElementById('protectedPdfDownload');
  let expiresAt = 0;
  let downloadAllowed = false;
  let pending = false;
  if (params.get('embed') === '1') document.body.classList.add('embedded-viewer');

  function source() {
    const slug = params.get('slug');
    if (slug && /^[a-z0-9-]{2,64}$/.test(slug)) return {siteSlug: slug};
    const bucket = params.get('bucket'), path = params.get('path');
    if (['documentos','biblioteca'].includes(bucket) && path && path.length <= 700 &&
        !path.includes('..') && !path.includes('\\') && /\.pdf$/i.test(path)) return {bucket, path};
    throw new Error('Documento inválido.');
  }

  function temporaryUrl(value) {
    if (typeof value !== 'string') return null;
    try {
      const url = new URL(value);
      const origin = new URL(window.CM_CONFIG?.url || client.supabaseUrl).origin;
      if (url.protocol !== 'https:' || url.origin !== origin ||
          !url.pathname.startsWith('/storage/v1/object/sign/') || !url.searchParams.has('token')) return null;
      return url.href;
    } catch { return null; }
  }

  async function issue(autoDownload = false) {
    if (pending) return;
    pending = true;
    loading.hidden = false; errorBox.hidden = true;
    frame.hidden = true; download.hidden = true;
    let timer;
    try {
      const response = await Promise.race([
        client.functions.invoke('proteger-pdf', {body: source()}),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Tempo esgotado.')), 45000); })
      ]);
      const {data, error} = response;
      const viewUrl = temporaryUrl(data?.viewUrl);
      if (error || !viewUrl) throw new Error('Não foi possível liberar este documento. Tente novamente em alguns instantes.');
      const downloadUrl = temporaryUrl(data.downloadUrl);
      downloadAllowed = data.downloadAllowed === true && Boolean(downloadUrl);
      expiresAt = Date.now() + Math.max(0, Number(data.expiresInSeconds || 0) - 15) * 1000;
      title.textContent = data.title || 'Documento protegido';
      code.textContent = data.issueCode ? `Código da cópia: ${data.issueCode}` : 'Documento disponibilizado com acesso controlado';
      frame.src = viewUrl + '#toolbar=0&navpanes=0&scrollbar=1&view=FitH';
      frame.hidden = false;
      if (downloadAllowed) {
        download.href = downloadUrl;
        download.download = data.fileName || 'documento.pdf';
        download.hidden = false;
      } else download.removeAttribute('href');
      if (autoDownload && downloadAllowed) download.click();
    } catch (error) {
      errorBox.hidden = false;
      errorBox.querySelector('span').textContent = error.message || 'Documento temporariamente indisponível.';
    } finally { clearTimeout(timer); loading.hidden = true; pending = false; }
  }
  download.addEventListener('click', event => {
    if (!downloadAllowed || Date.now() >= expiresAt) {
      event.preventDefault();
      if (downloadAllowed) void issue(true);
    }
  });
  void issue(params.get('download') === '1');
}());
