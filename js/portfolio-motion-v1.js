/* Capas de projetos em destaque: vídeos sincronizados no mesmo ciclo.
   Um relógio comum controla Tiny House, Vitalle e Casa Urben, mesmo com tempos
   diferentes para carregar ou com durações originais diferentes. */
(() => {
  'use strict';
  const videos = Array.from(document.querySelectorAll('video[data-portfolio-video]'));
  if (!videos.length) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = Boolean(navigator.connection && navigator.connection.saveData);
  if (reducedMotion || saveData) return;

  const inView = new Set();
  const BASE_CYCLE_SECONDS = 12;
  const DRIFT_TOLERANCE_SECONDS = 0.3;
  let cycleSeconds = BASE_CYCLE_SECONDS;
  let epoch = null;

  function projectCard(video) {
    return video.closest('.featured-project-card');
  }

  function showing3D(video) {
    return Boolean(projectCard(video)?.classList.contains('is-model-ready'));
  }

  function ensureLoaded(video) {
    if (video.dataset.initialized === 'true') return;
    video.dataset.initialized = 'true';
    video.autoplay = false;
    video.muted = true;
    video.src = video.dataset.src;
    video.preload = 'metadata';
    video.load();
  }

  // A duração comum é a do vídeo mais longo, no mínimo 12 s.
  // Assim não aceleramos as animações originais; as mais curtas são
  // desaceleradas de maneira uniforme para reiniciar junto às outras.
  function updateCycle() {
    const durations = videos
      .map(video => video.duration)
      .filter(duration => Number.isFinite(duration) && duration > 0);
    const next = Math.max(BASE_CYCLE_SECONDS, ...durations);
    if (Math.abs(next - cycleSeconds) > 0.05) {
      cycleSeconds = next;
      // Sempre reiniciar o mesmo relógio para todos quando a última
      // duração ficar conhecida, evitando pequenos offsets de carregamento.
      epoch = performance.now();
      return true;
    }
    return false;
  }

  function currentPhase() {
    if (epoch === null) epoch = performance.now();
    const elapsed = Math.max(0, (performance.now() - epoch) / 1000);
    return (elapsed % cycleSeconds) / cycleSeconds;
  }

  function synchronize(video, phase, force = false) {
    if (!inView.has(video) || document.hidden || showing3D(video)) {
      video.pause();
      return;
    }

    ensureLoaded(video);
    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0 || video.readyState < 1) return;

    const playbackRate = duration / cycleSeconds;
    if (Math.abs(video.playbackRate - playbackRate) > 0.001) {
      video.playbackRate = playbackRate;
    }

    const target = Math.min(Math.max(0, phase * duration), Math.max(0, duration - 0.04));
    const difference = Math.abs(video.currentTime - target);
    const circularDifference = Math.min(difference, Math.abs(duration - difference));

    // Reposicionar só quando houver um desvio perceptível para evitar
    // travamentos visuais por seeks contínuos.
    if (force || circularDifference > DRIFT_TOLERANCE_SECONDS) {
      try { video.currentTime = target; } catch (_) { /* metadados ainda indisponíveis */ }
    }

    if (video.readyState >= 2 && video.paused) {
      const attempt = video.play();
      if (attempt && typeof attempt.catch === 'function') attempt.catch(() => {});
    }
  }

  function synchronizeAll(force = false) {
    if (document.hidden || !inView.size) return;
    if (updateCycle()) force = true;
    const phase = currentPhase();
    videos.forEach(video => synchronize(video, phase, force));
  }

  videos.forEach(video => {
    video.autoplay = false;
    video.muted = true;

    video.addEventListener('loadedmetadata', () => synchronizeAll(true));
    video.addEventListener('loadeddata', () => {
      projectCard(video)?.classList.add('is-video-ready');
      synchronizeAll(true);
    });
    video.addEventListener('error', () => {
      projectCard(video)?.classList.remove('is-video-ready');
    });
  });

  if (!('IntersectionObserver' in window)) {
    videos.forEach(video => {
      inView.add(video);
      ensureLoaded(video);
    });
    synchronizeAll(true);
    return;
  }

  const observer = new IntersectionObserver(entries => {
    const previouslyVisible = inView.size;
    entries.forEach(entry => {
      const video = entry.target;
      if (entry.isIntersecting && entry.intersectionRatio >= 0.25) {
        inView.add(video);
      } else {
        inView.delete(video);
        video.pause();
      }
    });

    // Quando o conjunto entra novamente em tela, o ciclo recomeça
    // simultaneamente, e não a partir de tempos guardados separadamente.
    if (previouslyVisible === 0 && inView.size) epoch = performance.now();

    inView.forEach(ensureLoaded);
    synchronizeAll(true);
  }, { threshold: [0, 0.25, 0.5], rootMargin: '80px 0px' });

  videos.forEach(video => observer.observe(video));

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      videos.forEach(video => video.pause());
    } else {
      epoch = performance.now();
      synchronizeAll(true);
    }
  });

  // Resiliência a eventuais atrasos de decodificação e ao
  // carregamento progressivo do terceiro vídeo.
  window.setInterval(() => synchronizeAll(false), 1100);
})();
