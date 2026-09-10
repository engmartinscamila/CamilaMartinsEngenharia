(function iniciarSitePublico() {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    configurarMenuMobile();
    configurarHeaderScroll();
    configurarAnimacaoReveal();
    configurarAcoesFlutuantes();
    configurarAvaliacoesGoogle();
  });

  function configurarMenuMobile() {
    const botao = document.querySelector('.menu-toggle');
    const menu = document.querySelector('.nav-links');
    if (!botao || !menu) return;

    function definirEstado(aberto) {
      menu.classList.toggle('open', aberto);
      botao.setAttribute('aria-expanded', String(aberto));
      botao.setAttribute('aria-label', aberto ? 'Fechar menu' : 'Abrir menu');
      const icone = botao.querySelector('i');
      if (icone) {
        icone.classList.toggle('bi-list', !aberto);
        icone.classList.toggle('bi-x-lg', aberto);
      }
    }

    botao.addEventListener('click', () => {
      definirEstado(!menu.classList.contains('open'));
    });

    menu.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => definirEstado(false));
    });

    document.addEventListener('keydown', (evento) => {
      if (evento.key === 'Escape') definirEstado(false);
    });

    document.addEventListener('click', (evento) => {
      if (!menu.classList.contains('open')) return;
      if (!menu.contains(evento.target) && !botao.contains(evento.target)) definirEstado(false);
    });
  }

  function configurarHeaderScroll() {
    const cabecalho = document.querySelector('.site-header');
    if (!cabecalho) return;

    const atualizar = () => {
      cabecalho.classList.toggle('scrolled', window.scrollY > 10);
    };

    atualizar();
    window.addEventListener('scroll', atualizar, { passive: true });
  }

  function configurarAnimacaoReveal() {
    const elementos = document.querySelectorAll('.reveal');
    if (elementos.length === 0) return;

    if (!('IntersectionObserver' in window)) {
      elementos.forEach((elemento) => elemento.classList.add('visible'));
      return;
    }

    const observador = new IntersectionObserver((entradas) => {
      entradas.forEach((entrada) => {
        if (!entrada.isIntersecting) return;
        entrada.target.classList.add('visible');
        observador.unobserve(entrada.target);
      });
    }, { threshold: 0.15 });

    elementos.forEach((elemento) => observador.observe(elemento));
  }

  function configurarAcoesFlutuantes() {
    const container = document.getElementById('floatingActions');
    const botao = container?.querySelector('.float-menu-toggle');
    if (!container || !botao) return;

    function definirEstado(aberto) {
      container.classList.toggle('is-open', aberto);
      botao.setAttribute('aria-expanded', String(aberto));
      botao.setAttribute('aria-label', aberto ? 'Ocultar outros atalhos' : 'Mostrar outros atalhos');
    }

    botao.addEventListener('click', () => {
      definirEstado(!container.classList.contains('is-open'));
    });

    container.querySelectorAll('.float-secondary a').forEach((link) => {
      link.addEventListener('click', () => definirEstado(false));
    });

    document.addEventListener('keydown', (evento) => {
      if (evento.key === 'Escape') definirEstado(false);
    });

    document.addEventListener('click', (evento) => {
      if (!container.classList.contains('is-open')) return;
      if (!container.contains(evento.target)) definirEstado(false);
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 760) definirEstado(false);
    }, { passive: true });
  }

  function configurarAvaliacoesGoogle() {
    const cards = document.querySelectorAll('#avaliacoes .review-card');
    if (cards.length < 4) return;

    const avaliacoes = [
      {
        autor: 'Higor Luiz',
        texto: 'Excelente profissional! Muito atenciosa, competente e comprometida com a qualidade do trabalho. Demonstra muito conhecimento técnico, esclarece todas as dúvidas com paciência e entrega um serviço confiável. Recomendo para quem procura uma engenheira civil séria e dedicada.'
      },
      {
        autor: 'Gabriel Lima',
        texto: 'Serviço de excelência. Todo o processo do serviço, desde o começo na criação do projeto até a entrega foi realizado com extremo profissionalismo e atenção aos detalhes. Recomendo de olhos fechados.'
      },
      {
        autor: 'expedito Batista',
        texto: 'A Camila é muito competente e uma profissional ímpar, muito obrigado por nos ajudar no nosso maior sonho.'
      },
      {
        autor: 'Li Alencar',
        texto: 'Camila montou um projeto que amamos. Obrigada pela dedicação e competência em realizar nosso maior sonho.'
      }
    ];

    cards.forEach((card, indice) => {
      const avaliacao = avaliacoes[indice];
      if (!avaliacao) return;
      const texto = card.querySelector('blockquote');
      const autor = card.querySelector('.review-person strong');
      const origem = card.querySelector('.review-person small');
      if (texto) texto.textContent = avaliacao.texto;
      if (autor) autor.textContent = avaliacao.autor;
      if (origem) origem.textContent = 'Avaliação no Google';
    });
  }
}());
