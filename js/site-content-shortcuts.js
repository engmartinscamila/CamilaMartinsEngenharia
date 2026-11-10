/* Atalhos do "Conteúdo do site": um botão para cada coisa que se atualiza (Portfólio, Guia de
   níveis, imagens e vídeos dos projetos) e a marca timbrada nas imagens já publicadas. */
(function () {
  'use strict';
  const $ = (sel) => document.querySelector(sel);

  function openTab(name) {
    const tab = document.querySelector(`[data-site-tab="${name}"]`);
    if (tab && tab.getAttribute('aria-selected') !== 'true') tab.click();
    // Garante a troca mesmo se o controle das abas ainda não carregou.
    document.querySelectorAll('[data-site-tab]').forEach((t) => { const on = t.dataset.siteTab === name; t.classList.toggle('ativo', on); t.setAttribute('aria-selected', String(on)); });
    document.querySelectorAll('[data-site-panel]').forEach((p) => { p.hidden = p.dataset.sitePanel !== name; });
  }

  function hint(text) { const el = $('#siteQuickHint'); if (el) el.textContent = text; }

  function go(action) {
    if (action === 'portfolio' || action === 'experiencias') {
      openTab('pdfs');
      const form = document.querySelector(`form[data-pdf-upload][data-slug="${action}"]`);
      form?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      form?.classList.add('site-quick-focus');
      setTimeout(() => form?.classList.remove('site-quick-focus'), 2400);
      hint(action === 'portfolio'
        ? 'Escolha o novo PDF do Portfólio e clique em "Enviar original para proteção". A versão anterior fica no histórico.'
        : 'Escolha o novo PDF do Guia de níveis e clique em "Enviar original para proteção". A versão anterior fica no histórico.');
      setTimeout(() => form?.querySelector('input[type="file"]')?.click(), 450);
      return;
    }
    openTab('galeria');
    $('#portfolioProjectsTitle')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    hint(action === 'imagens'
      ? 'Abra o projeto abaixo e use "Adicionar mídia" com o tipo "Fotos". Cada imagem já sai com a marca timbrada; para trocar uma imagem, exclua a antiga e envie a nova.'
      : 'Abra o projeto abaixo e use "Adicionar mídia" com o tipo "Vídeo" (com a imagem de capa). A marca timbrada é gravada no vídeo antes do envio; vídeos longos podem levar alguns minutos. Para trocar um vídeo, exclua o antigo e envie o novo.');
  }

  async function restamp(button) {
    const status = $('#portfolioRestampStatus');
    if (!window.CMEPortfolioRestamp) return;
    if (!window.confirm('Aplicar a marca timbrada (repetida no quadro inteiro) em todas as imagens e vídeos publicados da galeria?\n\nCada arquivo é regravado com a marca e a versão antiga, que só tinha a marca no canto, é removida. Pode levar alguns minutos; não feche a página.')) return;
    button.disabled = true;
    try {
      const result = await window.CMEPortfolioRestamp.restampAll((i, n) => { status.textContent = `Aplicando a marca: arquivo ${i} de ${n}...`; });
      if (!result.total) status.textContent = 'Todas as imagens e vídeos publicados já estão com a marca timbrada.';
      else status.textContent = `${result.done} de ${result.total} arquivo(s) com marca timbrada.${result.failed.length ? ` Não foi possível: ${result.failed.join('; ')}.` : ''} Atualizando a lista...`;
      if (result.done) setTimeout(() => window.location.reload(), 2500);
    } catch (error) {
      status.textContent = `Nada foi alterado: ${error.message}`;
    } finally { button.disabled = false; }
  }

  function start() {
    document.querySelectorAll('[data-quick]').forEach((button) => button.addEventListener('click', () => go(button.dataset.quick)));
    $('#portfolioRestamp')?.addEventListener('click', (event) => restamp(event.currentTarget));
    const initial = new URLSearchParams(location.search).get('atualizar');
    if (initial) go(initial);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
}());
