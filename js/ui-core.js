/*
==========================================================
CAMILA MARTINS ENGENHARIA
UI CORE — FUNÇÕES COMPARTILHADAS DE INTERFACE
==========================================================
Este arquivo NÃO registra ações de negócio e NÃO duplica
eventos das páginas. Apenas controla a camada de carregamento.
*/

(function () {
    "use strict";

    function elementosLoading() {
        return [
            document.getElementById("loading"),
            document.getElementById("loader"),
            document.getElementById("carregando")
        ].filter(Boolean);
    }

    function ocultar() {
        for (const elemento of elementosLoading()) {
            elemento.style.setProperty("display", "none", "important");
            elemento.style.setProperty("pointer-events", "none", "important");
            elemento.setAttribute("aria-hidden", "true");
        }
    }

    function mostrar() {
        for (const elemento of elementosLoading()) {
            elemento.style.removeProperty("display");
            elemento.style.removeProperty("pointer-events");
            elemento.setAttribute("aria-hidden", "false");
        }
    }

    window.ocultarCarregamentoPagina = ocultar;
    window.mostrarCarregamentoPagina = mostrar;

    // Segurança contra uma consulta que falhe antes de remover o overlay.
    // O conteúdo pode continuar carregando, mas a navegação nunca fica bloqueada.
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            window.setTimeout(ocultar, 2500);
        }, { once: true });
    } else {
        window.setTimeout(ocultar, 2500);
    }

    window.addEventListener("load", () => {
        window.setTimeout(ocultar, 400);
    }, { once: true });
}());
