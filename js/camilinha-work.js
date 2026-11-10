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

  window.CamilinhaWork = Object.freeze({
    estados,
    criar,
    aplicar
  });
})();
