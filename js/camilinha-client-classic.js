/* Camilinha no Portal do Cliente clássico.
   Reutiliza exclusivamente o atlas e os nove estados originais do ChatGPT Work.
   Não intercepta formulários, requisições ou autenticação. */
(() => {
  'use strict';
  const start = () => {
    const owl = window.CamilinhaWork;
    if (!owl || !document.body) return;
    const watched = new WeakSet();
    const failures = new WeakSet();
    const delay = 500;

    function isVisible(el) {
      return el.isConnected && !el.hidden && el.getClientRects().length > 0 &&
        getComputedStyle(el).visibility !== 'hidden';
    }

    function isWaiting(el) {
      return el.id !== 'projectName' || /carregando/i.test(el.textContent || '');
    }

    function add(el, state, size) {
      const mascot = owl.criar(state, size);
      mascot.setAttribute('aria-hidden', 'true');
      el.prepend(mascot);
      return mascot;
    }

    function watchLoading(el) {
      if (watched.has(el)) return;
      watched.add(el);
      const timer = setTimeout(() => {
        if (!isVisible(el) || !isWaiting(el) || el.querySelector(':scope > .camilinha-work')) return;
        el.classList.add('camilinha-classic-active');
        add(el, el.id === 'projectName' ? 'review' : 'waiting', el.id === 'loadingScreen' ? 48 : 36);
      }, delay);
      // Se a tela terminar antes da espera, o timer não injeta nada.
      // O nó removido torna-se coletável e a condição isConnected evita resíduos.
      void timer;
    }

    function watchFeedback(el) {
      const message = (el.textContent || '').trim();
      const state = /^(solicita[cç][aã]o enviada|resposta enviada|enviado com sucesso)/i.test(message)
        ? 'jumping'
        : /^n[aã]o foi poss[ií]vel/i.test(message)
          ? 'failed'
          : null;
      if (!state) return;
      const existing = el.querySelector(':scope > .camilinha-work');
      if (existing) {
        if (existing.dataset.state !== state) owl.aplicar(existing, state);
      } else {
        add(el, state, 30);
      }
    }

    function scan() {
      document.querySelectorAll('.loading, #loadingScreen, #projectName').forEach(watchLoading);
      document.querySelectorAll('.error-state').forEach((el) => {
        if (failures.has(el)) return;
        failures.add(el);
        add(el, 'failed', 38);
      });
      document.querySelectorAll('.form-message').forEach(watchFeedback);
    }

    let queued = false;
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => { queued = false; scan(); });
    });
    scan();
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
