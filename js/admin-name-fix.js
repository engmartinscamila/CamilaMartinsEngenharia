(function () {
    "use strict";

    function aplicarNome() {
        const alvo = document.querySelector("#adminName, #nomeAdministrador, #topUserName");
        if (!alvo) return;
        alvo.textContent = "Camila";
        alvo.dataset.cmeNomeFixo = "true";
    }

    function observar() {
        const alvo = document.querySelector("#adminName, #nomeAdministrador, #topUserName");
        if (!alvo || alvo.dataset.cmeObserver === "true") return;
        alvo.dataset.cmeObserver = "true";
        new MutationObserver(() => {
            if (alvo.textContent.trim() !== "Camila") alvo.textContent = "Camila";
        }).observe(alvo, { childList: true, characterData: true, subtree: true });
    }

    function iniciar() {
        aplicarNome();
        observar();
        window.setTimeout(aplicarNome, 120);
        window.setTimeout(aplicarNome, 600);
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
    else iniciar();
}());
