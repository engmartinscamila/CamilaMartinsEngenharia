/* Capas de projetos: reprodução nativa fluida com início conjunto.
   Evitar playbackRate diferente de 1 e seeks periódicos (causam travamentos).
   A sincronização acontece somente no início da entrada da galeria. */
(() => {
  'use strict';
  const videos = Array.from(document.querySelectorAll('video[data-portfolio-video]'));
  if (!videos.length) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = Boolean(navigator.connection?.saveData);
  if (reduced || saveData) return;

  const grid = document.querySelector('.featured-projects-grid');
  if (!grid) return;

  let visible = false;
  let started = false;

  const card = video => video.closest('.featured-project-card');
  const modelActive = video => Boolean(card(video)?.classList.contains('is-model-ready'));

  function ensureLoaded(video) {
    if (video.dataset.initialized === 'true') return;
    video.dataset.initialized = 'true';
    video.autoplay = false;
    video.muted = true;
    video.playbackRate = 1;
    video.preload = 'auto';
    video.src = video.dataset.src;
    video.load();
  }

  function ready(video) {
    return video.readyState >= 2 || video.error;
  }

  function stopAll() {
    videos.forEach(video => video.pause());
    started = false;
  }

  function startAll() {
    if (started || !visible || document.hidden) return;
    if (!videos.every(ready)) return;

    started = true;
    videos.forEach(video => {
      if (video.error || modelActive(video)) return;
      // Um único alinhamento no início: nenhuma busca de frames durante o loop.
      video.playbackRate = 1;
      try { video.currentTime = 0; } catch (_) { /* Browser ainda preparando */ }
      const attempt = video.play();
      if (attempt?.catch) attempt.catch(() => {
        // Autoplay pode ser bloqueado; manter fotografia de fallback.
        card(video)?.classList.remove('is-video-ready');
      });
    });
  }

  videos.forEach(video => {
    video.autoplay = false;
    video.muted = true;
    video.addEventListener('loadeddata', startAll);
    video.addEventListener('canplay', startAll);
    video.addEventListener('error', () => {
      card(video)?.classList.remove('is-video-ready');
      startAll(); // Se um vídeo falhar, os demais continuam.
    });

    // A mídia só cobre a foto depois que a reprodução de fato começou.
    video.addEventListener('playing', () => {
      if (visible && !document.hidden && !modelActive(video)) {
        card(video)?.classList.add('is-video-ready');
      }
    });

    video.addEventListener('waiting', () => {
      // Manter o último frame durante buffers curtos sem forçar seek/reload.
    });
  });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      const entering = entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.08);
      if (entering && !visible) {
        visible = true;
        videos.forEach(ensureLoaded);
        startAll();
      } else if (!entering && visible) {
        visible = false;
        stopAll();
      }
    }, { threshold: [0, 0.08, 0.25], rootMargin: '100px 0px' });
    observer.observe(grid);
  } else {
    visible = true;
    videos.forEach(ensureLoaded);
    startAll();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopAll();
    else if (visible) startAll();
  });
})();