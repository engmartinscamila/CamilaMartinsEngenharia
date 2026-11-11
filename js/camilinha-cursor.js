/* Camilinha que acompanha o cursor — somente no admin (computador com mouse).
   Reage ao que acontece na tela: anda junto do mouse, observa o que pode ser clicado,
   pula no clique, trabalha enquanto a página carrega, acena em avisos e descansa parada.
   Não intercepta cliques (pointer-events: none) nem requisições, e respeita "reduzir movimento".
   Liga/desliga: Alt+C (fica salvo neste navegador). */
(function () {
  'use strict';
  if (window.__CME_CAMILINHA_CURSOR__) return;
  if (window.top !== window) return; // dentro do iframe do portal, a janela principal já tem a Camilinha
  if (!window.matchMedia || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  window.__CME_CAMILINHA_CURSOR__ = true;

  var STORAGE_KEY = 'cme.camilinha.cursor';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SIZE = 38;
  var OFFSET_X = 16, OFFSET_Y = 18;
  var CLICKABLE = 'a[href],button,[role="button"],[role="tab"],[role="link"],input[type="submit"],input[type="button"],input[type="checkbox"],input[type="radio"],select,summary,label[for]';
  var TYPING = 'input:not([type]),input[type="text"],input[type="search"],input[type="email"],input[type="tel"],input[type="number"],input[type="date"],textarea,[contenteditable="true"]';
  var BUSY = '[role="progressbar"],[aria-busy="true"],.loading:not([hidden]),.loading-spinner';

  function enabled() {
    try { return localStorage.getItem(STORAGE_KEY) !== 'off'; } catch (_) { return true; }
  }
  function adminPage() {
    // No portal React, só nas rotas do admin; nas páginas clássicas o script só é carregado no admin.
    var path = location.pathname;
    return path.indexOf('/portal/') !== 0 || path.indexOf('/portal/admin') === 0;
  }

  function ensureStyles() {
    if (!document.querySelector('link[href*="css/camilinha.css"]')) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/css/camilinha.css?v=cursor';
      document.head.appendChild(link);
    }
    if (document.getElementById('cmeCamilinhaCursorStyle')) return;
    var style = document.createElement('style');
    style.id = 'cmeCamilinhaCursorStyle';
    style.textContent = '#cmeCamilinhaCursor{position:fixed;left:0;top:0;z-index:2147483000;pointer-events:none;' +
      'width:' + SIZE + 'px;opacity:0;transition:opacity .25s ease;will-change:transform;filter:drop-shadow(0 3px 6px rgba(0,0,0,.35))}' +
      '#cmeCamilinhaCursor.is-visible{opacity:1}' +
      '#cmeCamilinhaCursor.is-pressing{filter:drop-shadow(0 1px 2px rgba(0,0,0,.4)) brightness(1.08)}' +
      '#cmeCamilinhaCursorToast{position:fixed;right:18px;bottom:18px;z-index:2147483001;padding:10px 14px;border-radius:8px;' +
      'background:#07111F;color:#D8DADD;border:1px solid #B89A63;font:13px/1.4 "Century Gothic",Arial,sans-serif;opacity:0;transition:opacity .25s;pointer-events:none}' +
      '#cmeCamilinhaCursorToast.is-visible{opacity:1}';
    document.head.appendChild(style);
  }

  var el = null, state = '', x = -100, y = -100, tx = -100, ty = -100, lastMove = 0, lastX = 0;
  var hoverClickable = false, typing = false, pressing = false, busy = false, waveUntil = 0, jumpUntil = 0, inside = false;

  function setState(next) {
    if (!el || next === state) return;
    state = next;
    el.dataset.state = next;
    // reinicia a animação do primeiro quadro
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.removeProperty('animation');
    if (reduceMotion) el.style.animation = 'none';
  }

  function decide(now) {
    if (busy) return 'running';
    if (now < jumpUntil) return 'jumping';
    if (now < waveUntil) return 'waving';
    if (typing) return 'waiting';
    if (hoverClickable) return 'review';
    var moving = now - lastMove < 160;
    if (moving) return x < lastX - 0.5 ? 'running-left' : 'running-right';
    return 'idle';
  }

  function frame(now) {
    if (!el) return;
    // segue o mouse com leve atraso, como um companheiro
    x += (tx - x) * (reduceMotion ? 1 : 0.22);
    y += (ty - y) * (reduceMotion ? 1 : 0.22);
    el.style.transform = 'translate3d(' + Math.round(x + OFFSET_X) + 'px,' + Math.round(y + OFFSET_Y) + 'px,0)';
    setState(decide(now));
    lastX = x;
    requestAnimationFrame(frame);
  }

  function create() {
    if (el) return;
    ensureStyles();
    el = document.createElement('span');
    el.id = 'cmeCamilinhaCursor';
    el.className = 'camilinha-work';
    el.setAttribute('aria-hidden', 'true');
    el.style.setProperty('--camilinha-size', SIZE + 'px');
    document.body.appendChild(el);
    setState('waving');
    waveUntil = performance.now() + 900;
    requestAnimationFrame(frame);
  }

  function destroy() {
    if (el) { el.remove(); el = null; state = ''; }
  }

  function toast(text) {
    var box = document.getElementById('cmeCamilinhaCursorToast');
    if (!box) { box = document.createElement('div'); box.id = 'cmeCamilinhaCursorToast'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
    box.textContent = text;
    box.classList.add('is-visible');
    clearTimeout(box._t);
    box._t = setTimeout(function () { box.classList.remove('is-visible'); }, 2200);
  }

  function sync() {
    if (enabled() && adminPage()) create(); else destroy();
  }

  function updateBusy() {
    var found = false;
    var nodes = document.querySelectorAll(BUSY);
    for (var i = 0; i < nodes.length && !found; i++) {
      var r = nodes[i].getBoundingClientRect();
      if (r.width > 0 && r.height > 0) found = true;
    }
    busy = found || document.readyState === 'loading';
  }

  document.addEventListener('mousemove', function (event) {
    tx = event.clientX; ty = event.clientY; lastMove = performance.now();
    if (el && !inside) { inside = true; el.classList.add('is-visible'); x = tx; y = ty; }
    var target = event.target instanceof Element ? event.target : null;
    hoverClickable = !!(target && target.closest(CLICKABLE));
    typing = !!(target && target.closest(TYPING)) || !!(document.activeElement && document.activeElement.matches && document.activeElement.matches(TYPING));
  }, { passive: true });
  // sobre um iframe a janela principal deixa de receber o mouse: esconde até voltar
  document.addEventListener('mouseover', function (event) { if (event.target && event.target.tagName === 'IFRAME') { inside = false; if (el) el.classList.remove('is-visible'); } }, { passive: true });
  document.addEventListener('mouseleave', function () { inside = false; if (el) el.classList.remove('is-visible'); });
  window.addEventListener('blur', function () { inside = false; if (el) el.classList.remove('is-visible'); });
  document.addEventListener('mousedown', function () {
    pressing = true;
    if (el) el.classList.add('is-pressing');
    if (hoverClickable) jumpUntil = performance.now() + 900;
  }, { passive: true });
  document.addEventListener('mouseup', function () { pressing = false; if (el) el.classList.remove('is-pressing'); }, { passive: true });
  document.addEventListener('keydown', function (event) {
    if (event.altKey && !event.ctrlKey && !event.metaKey && (event.key === 'c' || event.key === 'C')) {
      var on = !enabled();
      try { localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off'); } catch (_) {}
      sync();
      toast(on ? 'Camilinha ligada (Alt+C para desligar)' : 'Camilinha desligada (Alt+C para ligar)');
    }
  });
  // páginas clássicas: ao sair para outra página, ela fica "trabalhando" até a próxima carregar
  window.addEventListener('beforeunload', function () { busy = true; });

  // carregamentos e avisos aparecem/somem no DOM: observa sem interceptar requisições
  var pending = false;
  new MutationObserver(function (mutations) {
    if (!pending) { pending = true; requestAnimationFrame(function () { pending = false; updateBusy(); }); }
    for (var i = 0; i < mutations.length; i++) {
      var added = mutations[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        var node = added[j];
        if (node.nodeType === 1 && (node.matches('[role="alert"],[role="status"]') || node.querySelector('[role="alert"]'))) {
          waveUntil = performance.now() + 1200;
        }
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-busy', 'hidden'] });

  // portal React: troca de rota sem recarregar a página
  var lastPath = location.pathname;
  setInterval(function () { if (location.pathname !== lastPath) { lastPath = location.pathname; sync(); } }, 500);

  if (document.body) sync(); else document.addEventListener('DOMContentLoaded', sync, { once: true });
  updateBusy();
})();
