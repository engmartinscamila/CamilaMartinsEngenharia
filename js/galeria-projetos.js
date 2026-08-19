(function iniciarGaleriaProjetos() {
  'use strict';

  const dadosUrl = 'assets/projetos/galeria.json?v=20260819-5';
  const projetosContainer = document.getElementById('galleryProjects');
  const navegacaoContainer = document.getElementById('galleryProjectNav');
  const carregamento = document.getElementById('galleryLoading');
  const lightbox = document.getElementById('galleryLightbox');
  const lightboxImage = document.getElementById('galleryLightboxImage');
  const lightboxTitle = document.getElementById('galleryLightboxTitle');
  const lightboxClose = document.getElementById('galleryLightboxClose');
  const lightboxPrev = document.getElementById('galleryLightboxPrev');
  const lightboxNext = document.getElementById('galleryLightboxNext');
  const movimentoReduzido = window.matchMedia('(prefers-reduced-motion: reduce)');

  let projetos = [];
  let imagensAtivas = [];
  let projetoAtual = 0;
  let imagemAtual = 0;
  let focoAnterior = null;
  let arraste = null;
  let ignorarCliqueAte = 0;

  function criarElemento(tag, classe, texto) {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (texto !== undefined) elemento.textContent = texto;
    return elemento;
  }

  function numeroComZero(numero) {
    return String(numero).padStart(2, '0');
  }

  function indiceCircular(indice, quantidade) {
    return ((indice % quantidade) + quantidade) % quantidade;
  }

  function distanciaCircular(indice, ativo, quantidade) {
    let distancia = indice - ativo;
    if (distancia > quantidade / 2) distancia -= quantidade;
    if (distancia < -quantidade / 2) distancia += quantidade;
    return distancia;
  }

  function renderizarNavegacao() {
    const fragmento = document.createDocumentFragment();

    projetos.forEach((projeto) => {
      const link = criarElemento('a', '', projeto.nome);
      link.href = `#${projeto.slug}`;
      fragmento.appendChild(link);
    });

    navegacaoContainer.replaceChildren(fragmento);
  }

  function criarControle(direcao, indiceProjeto, projetoNome) {
    const anterior = direcao === 'anterior';
    const botao = criarElemento(
      'button',
      `gallery-carousel-control gallery-carousel-${anterior ? 'prev' : 'next'}`
    );
    botao.type = 'button';
    botao.dataset.projeto = String(indiceProjeto);
    botao.dataset.direcao = anterior ? '-1' : '1';
    botao.setAttribute('aria-label', `${anterior ? 'Imagem anterior' : 'Próxima imagem'} de ${projetoNome}`);
    botao.innerHTML = `<i class="bi bi-chevron-${anterior ? 'left' : 'right'}" aria-hidden="true"></i>`;
    return botao;
  }

  function renderizarProjetos() {
    const fragmento = document.createDocumentFragment();

    projetos.forEach((projeto, indiceProjeto) => {
      const secao = criarElemento('section', 'gallery-project-section');
      secao.id = projeto.slug;

      const container = criarElemento('div', 'container');
      const cabecalho = criarElemento('header', 'gallery-project-heading');
      const textos = criarElemento('div');
      const categoria = criarElemento('p', 'eyebrow', projeto.categoria);
      const titulo = criarElemento('h2', '', projeto.nome);
      const descricao = criarElemento('p', '', projeto.descricao);
      const quantidade = criarElemento(
        'span',
        'gallery-project-count',
        `${projeto.imagens.length} ${projeto.imagens.length === 1 ? 'imagem' : 'imagens'}`
      );

      textos.append(categoria, titulo, descricao);
      cabecalho.append(textos, quantidade);

      const carrossel = criarElemento('div', 'gallery-carousel');
      carrossel.dataset.projeto = String(indiceProjeto);
      carrossel.setAttribute('role', 'region');
      carrossel.setAttribute('aria-roledescription', 'carrossel');
      carrossel.setAttribute('aria-label', `Imagens de ${projeto.nome}`);

      const palco = criarElemento('div', 'gallery-carousel-stage');
      const viewport = criarElemento('div', 'gallery-carousel-viewport');
      viewport.dataset.projeto = String(indiceProjeto);
      viewport.tabIndex = 0;
      viewport.setAttribute('role', 'group');
      viewport.setAttribute('aria-label', `Carrossel de ${projeto.nome}. Use as setas do teclado ou arraste para navegar.`);

      const trilho = criarElemento('div', 'gallery-carousel-track');

      projeto.imagens.forEach((imagem, indiceImagem) => {
        const botao = criarElemento('button', 'gallery-carousel-slide');
        botao.type = 'button';
        botao.dataset.projeto = String(indiceProjeto);
        botao.dataset.imagem = String(indiceImagem);
        botao.setAttribute('aria-roledescription', 'slide');

        const moldura = criarElemento('span', 'gallery-carousel-frame');
        const foto = document.createElement('img');
        foto.dataset.src = imagem.src;
        foto.alt = imagem.alt;
        foto.loading = 'lazy';
        foto.decoding = 'async';
        foto.draggable = false;

        const numero = criarElemento(
          'span',
          'gallery-slide-number',
          `${numeroComZero(indiceImagem + 1)} / ${numeroComZero(projeto.imagens.length)}`
        );
        const acao = criarElemento('span', 'gallery-slide-action', 'Clique para ampliar');

        moldura.append(foto, numero, acao);
        botao.appendChild(moldura);
        trilho.appendChild(botao);
      });

      viewport.appendChild(trilho);
      palco.append(
        viewport,
        criarControle('anterior', indiceProjeto, projeto.nome),
        criarControle('proxima', indiceProjeto, projeto.nome)
      );

      const status = criarElemento('div', 'gallery-carousel-status');
      const copia = criarElemento('div', 'gallery-carousel-copy');
      const contador = criarElemento('span', 'gallery-carousel-counter');
      contador.setAttribute('aria-live', 'polite');
      const legenda = criarElemento('span', 'gallery-carousel-caption');
      copia.append(contador, legenda);

      const progresso = criarElemento('div', 'gallery-carousel-progress');
      progresso.setAttribute('role', 'progressbar');
      progresso.setAttribute('aria-label', `Progresso das imagens de ${projeto.nome}`);
      progresso.setAttribute('aria-valuemin', '1');
      progresso.setAttribute('aria-valuemax', String(projeto.imagens.length));
      progresso.appendChild(criarElemento('span', 'gallery-carousel-progress-bar'));

      const instrucao = criarElemento('span', 'gallery-carousel-instruction');
      instrucao.innerHTML = '<i class="bi bi-arrow-left-right" aria-hidden="true"></i> Setas ou arraste';

      status.append(copia, progresso, instrucao);
      carrossel.append(palco, status);
      container.append(cabecalho, carrossel);
      secao.appendChild(container);
      fragmento.appendChild(secao);
    });

    projetosContainer.replaceChildren(fragmento);
    projetos.forEach((projeto, indiceProjeto) => atualizarCarrossel(indiceProjeto, 0, false));
  }

  function posicionarProjetoDaUrl() {
    const slug = decodeURIComponent(window.location.hash.replace(/^#/, ''));
    if (!slug) return;
    const projeto = projetos.find((item) => item.slug === slug);
    if (!projeto) return;

    window.requestAnimationFrame(() => {
      document.getElementById(slug)?.scrollIntoView({ block: 'start' });
    });
  }

  function atualizarCarrossel(indiceProjeto, novoIndice, anunciar = true) {
    const projeto = projetos[indiceProjeto];
    if (!projeto || projeto.imagens.length === 0) return;

    const quantidade = projeto.imagens.length;
    const indiceAtivo = indiceCircular(novoIndice, quantidade);
    imagensAtivas[indiceProjeto] = indiceAtivo;

    const carrossel = projetosContainer.querySelector(`.gallery-carousel[data-projeto="${indiceProjeto}"]`);
    if (!carrossel) return;

    carrossel.querySelectorAll('.gallery-carousel-slide').forEach((slide, indiceImagem) => {
      const distancia = distanciaCircular(indiceImagem, indiceAtivo, quantidade);
      const visivel = Math.abs(distancia) <= 3;
      const ativo = distancia === 0;
      const foto = slide.querySelector('img');

      slide.dataset.offset = visivel ? String(distancia) : 'hidden';
      slide.classList.toggle('is-active', ativo);
      slide.tabIndex = ativo ? 0 : -1;
      slide.setAttribute('aria-hidden', ativo ? 'false' : 'true');
      slide.setAttribute(
        'aria-label',
        ativo
          ? `Ampliar imagem ${indiceImagem + 1} de ${quantidade}: ${projeto.imagens[indiceImagem].alt}`
          : `Mostrar imagem ${indiceImagem + 1} de ${quantidade}`
      );
      slide.style.setProperty('--tilt-x', '0deg');
      slide.style.setProperty('--tilt-y', '0deg');

      if (visivel && foto && !foto.src) {
        foto.loading = Math.abs(distancia) <= 1 ? 'eager' : 'lazy';
        foto.src = foto.dataset.src;
      }
    });

    const contador = carrossel.querySelector('.gallery-carousel-counter');
    const legenda = carrossel.querySelector('.gallery-carousel-caption');
    const progresso = carrossel.querySelector('.gallery-carousel-progress');
    contador.textContent = `${numeroComZero(indiceAtivo + 1)} / ${numeroComZero(quantidade)}`;
    legenda.textContent = projeto.imagens[indiceAtivo].alt;
    progresso.setAttribute('aria-valuenow', String(indiceAtivo + 1));
    carrossel.style.setProperty('--carousel-progress', `${((indiceAtivo + 1) / quantidade) * 100}%`);

    if (anunciar) contador.setAttribute('aria-label', `Imagem ${indiceAtivo + 1} de ${quantidade}`);
  }

  function navegarCarrossel(indiceProjeto, direcao) {
    atualizarCarrossel(indiceProjeto, imagensAtivas[indiceProjeto] + direcao);
  }

  function atualizarLightbox() {
    const projeto = projetos[projetoAtual];
    const imagem = projeto.imagens[imagemAtual];
    lightboxImage.src = imagem.src;
    lightboxImage.alt = imagem.alt;
    lightboxTitle.textContent = `${projeto.nome} • ${imagemAtual + 1} de ${projeto.imagens.length} • ${imagem.alt}`;
  }

  function abrirLightbox(indiceProjeto, indiceImagem, acionador) {
    projetoAtual = indiceProjeto;
    imagemAtual = indiceImagem;
    focoAnterior = acionador;
    atualizarLightbox();
    lightbox.hidden = false;
    document.body.classList.add('no-scroll');
    lightboxClose.focus();
  }

  function fecharLightbox() {
    lightbox.hidden = true;
    lightboxImage.src = '';
    document.body.classList.remove('no-scroll');
    if (focoAnterior) focoAnterior.focus();
  }

  function navegarLightbox(direcao) {
    const quantidade = projetos[projetoAtual].imagens.length;
    imagemAtual = indiceCircular(imagemAtual + direcao, quantidade);
    imagensAtivas[projetoAtual] = imagemAtual;
    atualizarCarrossel(projetoAtual, imagemAtual, false);
    atualizarLightbox();
  }

  projetosContainer.addEventListener('click', (evento) => {
    const controle = evento.target.closest('.gallery-carousel-control');
    if (controle) {
      navegarCarrossel(Number(controle.dataset.projeto), Number(controle.dataset.direcao));
      return;
    }

    const slide = evento.target.closest('.gallery-carousel-slide');
    if (!slide || Date.now() < ignorarCliqueAte) return;

    const indiceProjeto = Number(slide.dataset.projeto);
    const indiceImagem = Number(slide.dataset.imagem);
    if (imagensAtivas[indiceProjeto] === indiceImagem) {
      abrirLightbox(indiceProjeto, indiceImagem, slide);
    } else {
      atualizarCarrossel(indiceProjeto, indiceImagem);
    }
  });

  projetosContainer.addEventListener('keydown', (evento) => {
    const carrossel = evento.target.closest('.gallery-carousel');
    if (!carrossel) return;

    const indiceProjeto = Number(carrossel.dataset.projeto);
    if (evento.key === 'ArrowLeft') {
      evento.preventDefault();
      navegarCarrossel(indiceProjeto, -1);
    }
    if (evento.key === 'ArrowRight') {
      evento.preventDefault();
      navegarCarrossel(indiceProjeto, 1);
    }
    if (evento.key === 'Home') {
      evento.preventDefault();
      atualizarCarrossel(indiceProjeto, 0);
    }
    if (evento.key === 'End') {
      evento.preventDefault();
      atualizarCarrossel(indiceProjeto, projetos[indiceProjeto].imagens.length - 1);
    }
  });

  projetosContainer.addEventListener('pointerdown', (evento) => {
    const viewport = evento.target.closest('.gallery-carousel-viewport');
    if (!viewport || (evento.pointerType === 'mouse' && evento.button !== 0)) return;

    arraste = {
      pointerId: evento.pointerId,
      inicioX: evento.clientX,
      inicioY: evento.clientY,
      viewport,
      indiceProjeto: Number(viewport.dataset.projeto)
    };
    viewport.setPointerCapture(evento.pointerId);
  });

  projetosContainer.addEventListener('pointermove', (evento) => {
    if (arraste && arraste.pointerId === evento.pointerId) {
      const deslocamentoX = evento.clientX - arraste.inicioX;
      const deslocamentoY = evento.clientY - arraste.inicioY;
      if (Math.abs(deslocamentoX) > 8 && Math.abs(deslocamentoX) > Math.abs(deslocamentoY)) {
        arraste.viewport.classList.add('is-dragging');
        const trilho = arraste.viewport.querySelector('.gallery-carousel-track');
        trilho.style.transform = `translateX(${deslocamentoX * 0.12}px)`;
      }
      return;
    }

    const slide = evento.target.closest('.gallery-carousel-slide[data-offset="0"]');
    if (!slide || evento.pointerType !== 'mouse' || movimentoReduzido.matches) return;
    const limites = slide.getBoundingClientRect();
    const horizontal = (evento.clientX - limites.left) / limites.width - 0.5;
    const vertical = (evento.clientY - limites.top) / limites.height - 0.5;
    slide.style.setProperty('--tilt-y', `${horizontal * 5}deg`);
    slide.style.setProperty('--tilt-x', `${vertical * -3.5}deg`);
  });

  function finalizarArraste(evento) {
    if (!arraste || arraste.pointerId !== evento.pointerId) return;

    const deslocamentoX = evento.clientX - arraste.inicioX;
    const deslocamentoY = evento.clientY - arraste.inicioY;
    const houveArraste = Math.abs(deslocamentoX) > 46 && Math.abs(deslocamentoX) > Math.abs(deslocamentoY);
    const trilho = arraste.viewport.querySelector('.gallery-carousel-track');
    trilho.style.transform = '';
    arraste.viewport.classList.remove('is-dragging');

    if (houveArraste) {
      navegarCarrossel(arraste.indiceProjeto, deslocamentoX < 0 ? 1 : -1);
      ignorarCliqueAte = Date.now() + 320;
    }

    arraste = null;
  }

  projetosContainer.addEventListener('pointerup', finalizarArraste);
  projetosContainer.addEventListener('pointercancel', (evento) => {
    if (!arraste || arraste.pointerId !== evento.pointerId) return;
    const trilho = arraste.viewport.querySelector('.gallery-carousel-track');
    trilho.style.transform = '';
    arraste.viewport.classList.remove('is-dragging');
    arraste = null;
  });

  projetosContainer.addEventListener('pointerout', (evento) => {
    const slide = evento.target.closest('.gallery-carousel-slide[data-offset="0"]');
    if (!slide || (evento.relatedTarget && slide.contains(evento.relatedTarget))) return;
    slide.style.setProperty('--tilt-x', '0deg');
    slide.style.setProperty('--tilt-y', '0deg');
  });

  lightboxClose.addEventListener('click', fecharLightbox);
  lightboxPrev.addEventListener('click', () => navegarLightbox(-1));
  lightboxNext.addEventListener('click', () => navegarLightbox(1));

  lightbox.addEventListener('click', (evento) => {
    if (evento.target === lightbox) fecharLightbox();
  });

  document.addEventListener('keydown', (evento) => {
    if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 's') {
      evento.preventDefault();
      return;
    }

    if (lightbox.hidden) return;
    if (evento.key === 'Escape') fecharLightbox();
    if (evento.key === 'ArrowLeft') navegarLightbox(-1);
    if (evento.key === 'ArrowRight') navegarLightbox(1);
  });

  document.addEventListener('contextmenu', (evento) => {
    if (evento.target.closest('.gallery-carousel, .gallery-lightbox')) evento.preventDefault();
  });

  document.addEventListener('dragstart', (evento) => {
    if (evento.target.matches('img')) evento.preventDefault();
  });

  fetch(dadosUrl, { cache: 'no-cache' })
    .then((resposta) => {
      if (!resposta.ok) throw new Error('Não foi possível carregar os projetos.');
      return resposta.json();
    })
    .then((dados) => {
      projetos = Array.isArray(dados.projetos) ? dados.projetos : [];
      imagensAtivas = projetos.map(() => 0);
      renderizarNavegacao();
      renderizarProjetos();
      carregamento.hidden = true;
      posicionarProjetoDaUrl();
    })
    .catch((erro) => {
      console.error(erro);
      carregamento.innerHTML = '<i class="bi bi-exclamation-circle"></i><span>Não foi possível carregar a galeria agora.</span>';
    });
}());
