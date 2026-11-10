/* Página pública de verificação de cópia autenticada. */
(function () {
  'use strict';
  const form = document.getElementById('verifyForm');
  const input = document.getElementById('verifyCode');
  const out = document.getElementById('verifyResult');
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (v) => (v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }) : '—');

  function show(type, html) { out.hidden = false; out.className = `result ${type}`; out.innerHTML = html; }

  async function verify(code) {
    const clean = String(code || '').trim().toUpperCase();
    if (!/^(CME|CM)-[A-Z0-9-]{6,20}$/.test(clean)) { show('bad', '<h2>Código inválido</h2><p>Confira o código impresso na cópia (começa com CME- ou CM-).</p>'); return; }
    if (!window.supabaseClient) { show('bad', '<h2>Verificação indisponível</h2><p>Tente novamente em instantes.</p>'); return; }
    show('', '<p>Verificando...</p>');
    const { data, error } = await window.supabaseClient.rpc('public_verify_copy', { p_code: clean });
    if (error) { show('bad', '<h2>Verificação indisponível</h2><p>Tente novamente em instantes.</p>'); return; }
    if (!data?.valid) { show('bad', `<h2>Cópia não reconhecida</h2><p>O código <b>${esc(clean)}</b> não corresponde a nenhuma cópia emitida por Camila Martins Engenharia. O material pode ter sido adulterado ou copiado sem autorização.</p>`); return; }
    show('ok', `<h2>Cópia autêntica</h2><dl>
      <dt>Código</dt><dd>${esc(clean)}</dd>
      <dt>Material</dt><dd>${esc(data.title)}</dd>
      <dt>Tipo</dt><dd>${esc(data.kind)}</dd>
      <dt>Emitida para</dt><dd>${esc(data.licensed_to)}</dd>
      ${data.reference ? `<dt>Contrato/projeto</dt><dd>${esc(data.reference)}</dd>` : ''}
      <dt>Emitida em</dt><dd>${esc(fmt(data.issued_at))}</dd></dl>
      <p>Uso exclusivo do destinatário. Reprodução e redistribuição proibidas.</p>`);
    try { history.replaceState(null, '', `?c=${encodeURIComponent(clean)}`); } catch (_) { /* opcional */ }
  }

  form.addEventListener('submit', (event) => { event.preventDefault(); verify(input.value); });
  const initial = new URLSearchParams(location.search).get('c');
  if (initial) { input.value = initial; verify(initial); }
}());
