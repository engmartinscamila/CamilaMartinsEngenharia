(() => {
  const suporteMouse = window.matchMedia('(hover:hover) and (pointer:fine)');
  const reduzirMovimento = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (!suporteMouse.matches || reduzirMovimento.matches) return;

  const iniciar = () => {
    if (document.getElementById('cursorGoldTrail')) return;

    const canvas = document.createElement('canvas');
    canvas.id = 'cursorGoldTrail';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) {
      canvas.remove();
      return;
    }

    let largura = 0;
    let altura = 0;
    let dpr = 1;
    let particulas = [];
    let quadro = 0;
    let ultimoSpawn = 0;

    const redimensionar = () => {
      largura = window.innerWidth;
      altura = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(largura * dpr);
      canvas.height = Math.round(altura * dpr);
      canvas.style.width = `${largura}px`;
      canvas.style.height = `${altura}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const adicionarParticula = (x, y, agora) => {
      if (agora - ultimoSpawn < 14) return;
      ultimoSpawn = agora;
      particulas.push({ x, y, vida: 1, raio: 3.4 });
      if (particulas.length > 28) particulas.shift();
    };

    const desenhar = () => {
      quadro = 0;
      ctx.clearRect(0, 0, largura, altura);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowColor = 'rgba(208,180,122,.72)';
      ctx.shadowBlur = 15;

      const ativas = [];
      for (const particula of particulas) {
        particula.vida -= 0.043;
        particula.raio *= 0.986;
        if (particula.vida <= 0.02) continue;

        ctx.beginPath();
        ctx.fillStyle = `rgba(208,180,122,${Math.max(0, particula.vida * 0.34)})`;
        ctx.arc(particula.x, particula.y, particula.raio, 0, Math.PI * 2);
        ctx.fill();
        ativas.push(particula);
      }

      ctx.restore();
      particulas = ativas;

      if (particulas.length) quadro = requestAnimationFrame(desenhar);
    };

    const aoMover = (evento) => {
      if (evento.pointerType && evento.pointerType !== 'mouse') return;
      adicionarParticula(evento.clientX, evento.clientY, performance.now());
      if (!quadro) quadro = requestAnimationFrame(desenhar);
    };

    const limpar = () => {
      particulas = [];
      ctx.clearRect(0, 0, largura, altura);
      if (quadro) {
        cancelAnimationFrame(quadro);
        quadro = 0;
      }
    };

    redimensionar();
    window.addEventListener('resize', redimensionar, { passive: true });
    window.addEventListener('blur', limpar);
    document.addEventListener('pointermove', aoMover, { passive: true });
    document.addEventListener('mouseleave', limpar);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  } else {
    iniciar();
  }
})();
