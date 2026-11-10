/* API discreta da mascote Camilinha. Estados originais recuperados do ChatGPT Work.
   Nunca inicia animações sozinho; apenas quando chamado por uma ação da interface. */
(() => {
  'use strict';
  const estados = Object.freeze([
    'idle', 'running-right', 'running-left', 'waving', 'jumping',
    'failed', 'waiting', 'running', 'review', 'look-row-9', 'look-row-10'
  ]);
  const rotulos = Object.freeze({
    idle: 'Camilinha em repouso',
    'running-right': 'Camilinha caminhando para a direita',
    'running-left': 'Camilinha caminhando para a esquerda',
    waving: 'Camilinha acenando',
    jumping: 'Camilinha pulando',
    failed: 'Camilinha reagindo a uma falha',
    waiting: 'Camilinha aguardando',
    running: 'Camilinha trabalhando',
    review: 'Camilinha revisando o projeto',
    'look-row-9': 'Camilinha olhando em outras direções',
    'look-row-10': 'Camilinha olhando em outras direções'
  });

  function aplicar(elemento, estado) {
    if (!elemento || !elemento.classList || !estados.includes(estado)) return false;
    elemento.classList.add('camilinha-work');
    elemento.style.animation = 'none';
    elemento.dataset.state = estado;
    elemento.setAttribute('aria-label', rotulos[estado]);
    // Ao mudar para o mesmo movimento novamente, reinicia no primeiro quadro.
    void elemento.offsetWidth;
    elemento.style.removeProperty('animation');
    return true;
  }

  function criar(estado = 'idle', tamanho = 44) {
    const elemento = document.createElement('span');
    elemento.setAttribute('role', 'img');
    const px = Number(tamanho);
    if (Number.isFinite(px) && px >= 24 && px <= 144) {
      elemento.style.setProperty('--camilinha-size', px + 'px');
    }
    aplicar(elemento, estado);
    return elemento;
  }


  function prepararBotoes() {
    document.querySelectorAll('a[href]').forEach((link) => {
      if (link.classList.contains('camilinha-orcamento')) return;
      const url = new URL(link.getAttribute('href'), document.baseURI);
      const pagina = url.pathname.split('/').filter(Boolean).pop() || '';
      const social = ['wa.me', 'api.whatsapp.com', 'www.whatsapp.com',
        'instagram.com', 'www.instagram.com'].includes(url.hostname);
      const email = url.protocol === 'mailto:';
      const interno = url.origin === window.location.origin;
      const projetos = interno && (url.hash === '#projetos-destaque' ||
        pagina === 'galeria-projetos.html');
      const portfolio = interno && pagina === 'pdf-protegido.html' &&
        url.searchParams.get('slug') === 'portfolio';
      const cliente = interno && (pagina === 'login.html' ||
        url.pathname.endsWith('/portal/') || url.pathname.endsWith('/portal'));
      if (!social && !email && !projetos && !portfolio && !cliente) return;

      const estado = projetos || portfolio ? 'review' : 'waving';
      const mascote = criar(estado, 36);
      mascote.classList.add('camilinha-acao-mascote');
      mascote.removeAttribute('role');
      mascote.removeAttribute('aria-label');
      mascote.setAttribute('aria-hidden', 'true');
      link.classList.add('camilinha-acao');
      link.appendChild(mascote);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', prepararBotoes, { once: true });
  } else {
    prepararBotoes();
  }

  window.CamilinhaWork = Object.freeze({
    estados,
    criar,
    aplicar
  });
})();
