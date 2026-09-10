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

/* Experiência premium progressiva da página pública.
   Este bloco apenas acrescenta comportamento visual aos elementos existentes.
   Se ele não executar, os links, conteúdos e funções originais continuam intactos. */
(() => {
  'use strict';

  const reduzirMovimento = window.matchMedia('(prefers-reduced-motion: reduce)');
  const suporteMouse = window.matchMedia('(hover:hover) and (pointer:fine)');

  const iniciarPremium = () => {
    configurarServicosExploraveis();
    configurarLinhaProcesso();
    configurarBlueprint();
    configurarHaloCursor();
    configurarEntradaEmCamadas();
  };

  function configurarServicosExploraveis() {
    const cards = Array.from(document.querySelectorAll('#servicos .cards > .card'));
    if (!cards.length) return;

    const detalhes = [
      'Ideal para novos projetos, reformas e estudos de layout.',
      'Detalhamento pensado para reduzir dúvidas e improvisos na obra.',
      'Compatibilização dos pontos com a arquitetura e as necessidades de uso.',
      'Distribuição técnica organizada para funcionamento e manutenção.',
      'Visualização antecipada para validar volumes, materiais e iluminação.',
      'Orientação técnica conforme o processo e a documentação aplicável.'
    ];

    const fecharOutros = (atual) => {
      cards.forEach((card) => {
        if (card === atual) return;
        card.classList.remove('is-service-active');
        card.setAttribute('aria-expanded', 'false');
      });
    };

    cards.forEach((card, indice) => {
      if (!card.querySelector('.service-insight')) {
        const complemento = document.createElement('div');
        complemento.className = 'service-insight';
        complemento.setAttribute('aria-hidden', 'true');
        complemento.textContent = detalhes[indice] || 'Solução técnica desenvolvida de acordo com as necessidades do projeto.';
        card.appendChild(complemento);
      }

      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'button');
      card.setAttribute('aria-expanded', 'false');

      const alternar = () => {
        const abrir = !card.classList.contains('is-service-active');
        fecharOutros(card);
        card.classList.toggle('is-service-active', abrir);
        card.setAttribute('aria-expanded', String(abrir));
      };

      card.addEventListener('click', alternar);
      card.addEventListener('keydown', (evento) => {
        if (evento.key !== 'Enter' && evento.key !== ' ') return;
        evento.preventDefault();
        alternar();
      });
    });
  }

  function configurarLinhaProcesso() {
    const passos = document.querySelector('#processo .steps');
    const etapas = Array.from(passos?.querySelectorAll(':scope > article') || []);
    if (!passos || etapas.length < 2) return;

    if (reduzirMovimento.matches) {
      passos.style.setProperty('--process-progress', '1');
      etapas.forEach((etapa) => etapa.classList.add('is-step-active'));
      return;
    }

    let quadro = 0;
    const atualizar = () => {
      quadro = 0;
      const primeiroNumero = etapas[0].querySelector('span');
      const ultimoNumero = etapas[etapas.length - 1].querySelector('span');
      if (!primeiroNumero || !ultimoNumero) return;

      const inicioRect = primeiroNumero.getBoundingClientRect();
      const fimRect = ultimoNumero.getBoundingClientRect();
      const inicio = inicioRect.top + inicioRect.height / 2;
      const fim = fimRect.top + fimRect.height / 2;
      const ancora = window.innerHeight * 0.58;
      const intervalo = Math.max(1, fim - inicio);
      const progresso = Math.max(0, Math.min(1, (ancora - inicio) / intervalo));

      passos.style.setProperty('--process-progress', progresso.toFixed(3));

      etapas.forEach((etapa) => {
        const numero = etapa.querySelector('span');
        if (!numero) return;
        const rect = numero.getBoundingClientRect();
        const centro = rect.top + rect.height / 2;
        etapa.classList.toggle('is-step-active', centro <= ancora + 2);
      });
    };

    const solicitarAtualizacao = () => {
      if (quadro) return;
      quadro = requestAnimationFrame(atualizar);
    };

    atualizar();
    window.addEventListener('scroll', solicitarAtualizacao, { passive: true });
    window.addEventListener('resize', solicitarAtualizacao, { passive: true });
  }

  function configurarBlueprint() {
    if (!suporteMouse.matches || reduzirMovimento.matches) return;

    document.querySelectorAll('#servicos, #processo').forEach((secao) => {
      let quadro = 0;
      let x = 0;
      let y = 0;

      const aplicar = () => {
        quadro = 0;
        secao.style.setProperty('--blueprint-x', `${x}px`);
        secao.style.setProperty('--blueprint-y', `${y}px`);
      };

      secao.addEventListener('pointermove', (evento) => {
        if (evento.pointerType && evento.pointerType !== 'mouse') return;
        const rect = secao.getBoundingClientRect();
        x = evento.clientX - rect.left;
        y = evento.clientY - rect.top;
        if (!quadro) quadro = requestAnimationFrame(aplicar);
      }, { passive: true });

      secao.addEventListener('pointerleave', () => {
        secao.style.setProperty('--blueprint-x', '50%');
        secao.style.setProperty('--blueprint-y', '50%');
      });
    });
  }

  function configurarHaloCursor() {
    if (!suporteMouse.matches || reduzirMovimento.matches) return;
    if (document.getElementById('cursorGoldHalo')) return;

    const halo = document.createElement('div');
    halo.id = 'cursorGoldHalo';
    halo.setAttribute('aria-hidden', 'true');
    document.body.appendChild(halo);

    let quadro = 0;
    let x = -120;
    let y = -120;

    const aplicar = () => {
      quadro = 0;
      halo.style.setProperty('--halo-x', `${x}px`);
      halo.style.setProperty('--halo-y', `${y}px`);
    };

    document.addEventListener('pointermove', (evento) => {
      if (evento.pointerType && evento.pointerType !== 'mouse') return;
      x = evento.clientX;
      y = evento.clientY;
      halo.classList.add('is-visible');
      if (!quadro) quadro = requestAnimationFrame(aplicar);
    }, { passive: true });

    document.addEventListener('pointerover', (evento) => {
      if (!(evento.target instanceof Element)) return;
      halo.classList.toggle('is-interactive', Boolean(evento.target.closest('a,button,#servicos .card')));
    }, { passive: true });

    document.addEventListener('pointerout', (evento) => {
      if (!(evento.relatedTarget instanceof Element)) {
        halo.classList.remove('is-interactive');
      }
    }, { passive: true });

    document.addEventListener('mouseleave', () => halo.classList.remove('is-visible'));
    window.addEventListener('blur', () => halo.classList.remove('is-visible'));
  }

  function configurarEntradaEmCamadas() {
    const grupos = [
      ['#sobre .about-grid.reveal', '.portrait-wrap, .about-copy > *'],
      ['#projetos-destaque .reveal', '.section-heading > *, .featured-project-card, .featured-projects-action'],
      ['#servicos .reveal', '.section-heading > *, .cards > .card'],
      ['#processo .process-grid.reveal', '> div:first-child > *, .steps > article'],
      ['#portfolio-chamada .showcase-calls.reveal', '> .call-card'],
      ['#avaliacoes .reveal', '.reviews-heading, .reviews-summary, .reviews-grid > .review-card, .reviews-action'],
      ['#contato .contact-grid.reveal', '> *']
    ];

    grupos.forEach(([seletorPai, seletorFilhos]) => {
      const pai = document.querySelector(seletorPai);
      if (!pai) return;

      let filhos = [];
      try {
        filhos = Array.from(pai.querySelectorAll(`:scope ${seletorFilhos}`));
      } catch (_) {
        filhos = [];
      }

      filhos.forEach((filho, indice) => {
        filho.classList.add('premium-stagger-item');
        filho.style.setProperty('--premium-delay', `${Math.min(indice * 72, 360)}ms`);
      });
    });

    requestAnimationFrame(() => document.body.classList.add('premium-ui-ready'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciarPremium, { once: true });
  } else {
    iniciarPremium();
  }
})();
