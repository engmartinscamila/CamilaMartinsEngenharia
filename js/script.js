(function iniciarSitePublico() {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    configurarMenuMobile();
    configurarHeaderScroll();
    configurarAnimacaoReveal();
    configurarAcoesFlutuantes();
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
}());
