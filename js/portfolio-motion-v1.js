/* Videos de portfolio: carregamento progressivo sem comprometer navegacao. */
(() => {
  'use strict';
  const videos = Array.from(document.querySelectorAll('video[data-portfolio-video]'));
  if (!videos.length) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = Boolean(navigator.connection && navigator.connection.saveData);
  if (reducedMotion || saveData) return;
  const inView = new Set();

  function ensureLoaded(video) {
    if (video.dataset.initialized === 'true') return;
    video.dataset.initialized = 'true';
    video.src = video.dataset.src;
    video.preload = 'metadata';
    video.load();
  }

  function playVideo(video) {
    if (video.closest('.featured-project-card')?.classList.contains('is-model-ready')) {
      video.pause();
      return;
    }
    ensureLoaded(video);
    if (video.readyState >= 2) {
      const attempt = video.play();
      if (attempt && typeof attempt.catch === 'function') attempt.catch(() => {});
    }
  }

  videos.forEach(video => {
    video.addEventListener('loadeddata', () => {
      video.closest('.featured-project-card')?.classList.add('is-video-ready');
      if (inView.has(video) && !document.hidden) playVideo(video);
    }, {once:true});
    video.addEventListener('error', () => {
      video.closest('.featured-project-card')?.classList.remove('is-video-ready');
    });
  });

  if (!('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const video = entry.target;
      if (entry.isIntersecting && entry.intersectionRatio >= 0.25) {
        inView.add(video);
        if (!document.hidden) playVideo(video);
      } else {
        inView.delete(video);
        video.pause();
      }
    });
  }, {threshold:[0,0.25,0.5],rootMargin:'80px 0px'});
  videos.forEach(video => observer.observe(video));
  document.addEventListener('visibilitychange', () => {
    videos.forEach(video => {
      if (document.hidden || !inView.has(video)) video.pause();
      else playVideo(video);
    });
  });
})();
