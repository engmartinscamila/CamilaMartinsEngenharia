(() => {
  'use strict';
  const cards = [...document.querySelectorAll('.featured-project-card')];
  const dialog = document.getElementById('portfolio3dDialog');
  const fullscreen = document.getElementById('portfolio3dFull');
  const title = document.getElementById('portfolio3dTitle');
  const close = dialog?.querySelector('.portfolio-3d-close');
  if (!cards.length || !dialog || !fullscreen || !title) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  cards.forEach(card => {
    const viewer = card.querySelector('.featured-project-3d');
    const video = card.querySelector('video[data-portfolio-video]');
    if (!viewer) return;

    if (prefersReducedMotion) viewer.removeAttribute('auto-rotate');
    viewer.addEventListener('load', () => {
      card.classList.add('is-model-ready');
      video?.pause();
    });
    viewer.addEventListener('error', () => {
      card.classList.remove('is-model-ready');
      // O poster e o video permanecem como alternativa.
    });
    const open = card.querySelector('.featured-3d-open');
    open?.addEventListener('click', e => {
      e.preventDefault();
      fullscreen.setAttribute('src', viewer.getAttribute('src'));
      fullscreen.setAttribute('poster', viewer.getAttribute('poster') || '');
      fullscreen.setAttribute('alt', viewer.getAttribute('alt') || 'Modelo tridimensional');
      title.textContent = open.dataset.title || 'Visualização 3D';
      if (prefersReducedMotion) fullscreen.removeAttribute('auto-rotate');
      else fullscreen.setAttribute('auto-rotate', '');
      dialog.showModal();
      close?.focus();
    });
  });
  function closeModal() {
    if (dialog.open) dialog.close();
  }
  close?.addEventListener('click', closeModal);
  dialog.addEventListener('click', e => {
    if (e.target === dialog) closeModal();
  });
  dialog.addEventListener('close', () => {
    fullscreen.removeAttribute('src'); // Libera a visualizacao extra.
  });
})();