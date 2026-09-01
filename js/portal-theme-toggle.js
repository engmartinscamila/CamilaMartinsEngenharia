(function () {
    "use strict";

    const CHAVE = "cme_portal_tema";

    function temaSalvo() {
        return localStorage.getItem(CHAVE) === "claro" ? "claro" : "escuro";
    }

    function aplicar(tema) {
        const valor = tema === "claro" ? "claro" : "escuro";
        document.documentElement.dataset.portalTheme = valor;
        localStorage.setItem(CHAVE, valor);

        const botao = document.getElementById("portalThemeToggle");
        if (botao) {
            const claro = valor === "claro";
            botao.innerHTML = claro
                ? '<i class="bi bi-moon-stars"></i><span>Tema escuro</span>'
                : '<i class="bi bi-sun"></i><span>Tema claro</span>';
            botao.setAttribute("aria-label", claro ? "Ativar tema escuro" : "Ativar tema claro");
            botao.title = claro ? "Ativar tema escuro" : "Ativar tema claro";
        }
    }

    function criarBotao() {
        const acoes = document.querySelector(".topbar-actions");
        if (!acoes || document.getElementById("portalThemeToggle")) return;

        const botao = document.createElement("button");
        botao.type = "button";
        botao.id = "portalThemeToggle";
        botao.className = "portal-theme-toggle";
        botao.addEventListener("click", () => {
            aplicar(temaSalvo() === "claro" ? "escuro" : "claro");
        });

        const sair = acoes.querySelector(".logout-button");
        acoes.insertBefore(botao, sair || null);
        aplicar(temaSalvo());
    }

    function carregarFonteAssinatura() {
        if (document.getElementById("cmeBrittanyFont")) return;
        const style = document.createElement("style");
        style.id = "cmeBrittanyFont";
        style.textContent = '@font-face{font-family:"Brittany";src:url("assets/fonts/BrittanySignatureScript.ttf") format("truetype");font-weight:400;font-style:normal;font-display:swap}:root{--font-signature:"Brittany","Parisienne","Segoe Script",cursive}';
        document.head.appendChild(style);
    }

    function carregarFraseDoDia() {
        carregarFonteAssinatura();
        if (window.__CME_FRASE_DO_DIA__ || document.getElementById("cmeFraseDoDiaScript")) return;
        const script = document.createElement("script");
        script.id = "cmeFraseDoDiaScript";
        script.src = "js/frase-do-dia.js?v=20260901-3";
        script.defer = true;
        document.head.appendChild(script);
    }

    aplicar(temaSalvo());
    carregarFraseDoDia();
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", criarBotao, { once: true });
    } else {
        criarBotao();
    }
}());
