/*
==========================================================
CAMILA MARTINS ENGENHARIA
UI CORE — INTERFACE ADMINISTRATIVA COMPARTILHADA
==========================================================
*/

(function () {
    "use strict";

    const CHAVE_TEMA = "cme_admin_tema";
    const CHAVE_COR = "cme_admin_cor_principal";
    const CHAVE_NOTIFICACOES = "cme_admin_notificacoes";

    function carregarAjustesVisuais() {
        if (!document.getElementById("cmeAdminPolish")) {
            const link = document.createElement("link");
            link.id = "cmeAdminPolish";
            link.rel = "stylesheet";
            link.href = "css/admin-polish.css?v=20260901-1";
            document.head.appendChild(link);
        }
        if (!document.getElementById("cmeMobileLayoutFix")) {
            const mobile = document.createElement("link");
            mobile.id = "cmeMobileLayoutFix";
            mobile.rel = "stylesheet";
            mobile.href = "css/mobile-layout-fix.css?v=20260901-1";
            document.head.appendChild(mobile);
        }
    }

    function fixarNomeAdministradora() {
        const alvo = document.querySelector("#adminName, #nomeAdministrador");
        if (!alvo) return;
        alvo.textContent = "Camila";
        if (alvo.dataset.cmeNomeObserver === "true") return;
        alvo.dataset.cmeNomeObserver = "true";
        new MutationObserver(() => {
            if (alvo.textContent.trim() !== "Camila") alvo.textContent = "Camila";
        }).observe(alvo, { childList: true, characterData: true, subtree: true });
    }

    function elementosLoading() {
        return [
            document.getElementById("loading"),
            document.getElementById("loader"),
            document.getElementById("carregando")
        ].filter(Boolean);
    }

    function ocultarCarregamento() {
        for (const elemento of elementosLoading()) {
            elemento.style.setProperty("display", "none", "important");
            elemento.style.setProperty("pointer-events", "none", "important");
            elemento.setAttribute("aria-hidden", "true");
        }
    }

    function mostrarCarregamento() {
        for (const elemento of elementosLoading()) {
            elemento.style.removeProperty("display");
            elemento.style.removeProperty("pointer-events");
            elemento.setAttribute("aria-hidden", "false");
        }
    }

    function corValida(valor) {
        return /^#[0-9a-f]{6}$/i.test(String(valor || "").trim());
    }

    function aplicarPreferencias(preferencias = {}) {
        const tema = preferencias.tema || localStorage.getItem(CHAVE_TEMA) || "escuro";
        const cor = preferencias.cor_principal || localStorage.getItem(CHAVE_COR) || "#b89a63";
        const notificacoes = preferencias.notificacoes;

        document.documentElement.dataset.adminTheme = tema === "claro" ? "claro" : "escuro";

        if (corValida(cor)) {
            document.documentElement.style.setProperty("--dourado", cor);
            localStorage.setItem(CHAVE_COR, cor);
        }

        localStorage.setItem(CHAVE_TEMA, tema === "claro" ? "claro" : "escuro");

        if (typeof notificacoes === "boolean") {
            localStorage.setItem(CHAVE_NOTIFICACOES, notificacoes ? "ativo" : "inativo");
        }
    }

    function normalizarMenuAdministrativo() {
        const menu = document.querySelector(".menu-lateral");
        if (!menu) return;

        const hrefConteudo = "protecao-pdf-admin.html";
        let conteudo = Array.from(menu.querySelectorAll("a.menu-item"))
            .find(link => (link.getAttribute("href") || "").split("?")[0] === hrefConteudo);

        if (!conteudo) {
            conteudo = document.createElement("a");
            conteudo.href = hrefConteudo;
            conteudo.className = "menu-item";
            conteudo.innerHTML = '<i class="fa-solid fa-file-shield"></i><span>Conteúdo do site</span>';

            const biblioteca = Array.from(menu.querySelectorAll("a.menu-item"))
                .find(link => (link.getAttribute("href") || "").split("?")[0] === "biblioteca.html");

            if (biblioteca) biblioteca.insertAdjacentElement("afterend", conteudo);
            else menu.appendChild(conteudo);
        }

        const pagina = (location.pathname.split("/").filter(Boolean).pop() || "admin.html").toLowerCase();

        menu.querySelectorAll("a.menu-item").forEach(link => {
            const destino = (link.getAttribute("href") || "").split("?")[0].toLowerCase();
            const ativo = destino === pagina;
            link.classList.toggle("ativo", ativo);
            if (ativo) link.setAttribute("aria-current", "page");
            else link.removeAttribute("aria-current");
        });
    }

    async function sincronizarPreferenciasDoBanco() {
        if (typeof window.dbBuscarConfiguracoes !== "function") return;

        try {
            const config = await window.dbBuscarConfiguracoes();
            if (!config) return;

            aplicarPreferencias({
                tema: config.tema,
                cor_principal: config.cor_principal,
                notificacoes: config.notificacoes !== false
            });
        } catch (erro) {
            console.warn("Preferências administrativas não puderam ser sincronizadas.", erro);
        }
    }

    function protegerNotificacoes() {
        const original = window.dbNotificarAtualizacao;
        if (typeof original !== "function" || original.__cmeConfiguravel) return;

        const wrapper = async function (dados) {
            const estadoLocal = localStorage.getItem(CHAVE_NOTIFICACOES);

            if (estadoLocal === "inativo") {
                return {
                    enviado: false,
                    motivo: "Notificações desativadas nas Configurações."
                };
            }

            try {
                if (typeof window.dbBuscarConfiguracoes === "function") {
                    const config = await window.dbBuscarConfiguracoes();
                    if (config?.notificacoes === false) {
                        localStorage.setItem(CHAVE_NOTIFICACOES, "inativo");
                        return {
                            enviado: false,
                            motivo: "Notificações desativadas nas Configurações."
                        };
                    }
                }
            } catch (erro) {
                console.warn("Não foi possível consultar a preferência de notificações.", erro);
            }

            return original(dados);
        };

        wrapper.__cmeConfiguravel = true;
        wrapper.__cmeOriginal = original;
        window.dbNotificarAtualizacao = wrapper;
    }

    function iniciar() {
        carregarAjustesVisuais();
        normalizarMenuAdministrativo();
        aplicarPreferencias();
        protegerNotificacoes();
        fixarNomeAdministradora();

        window.setTimeout(fixarNomeAdministradora, 150);
        window.setTimeout(fixarNomeAdministradora, 700);
        window.setTimeout(ocultarCarregamento, 2500);
        window.setTimeout(sincronizarPreferenciasDoBanco, 0);
    }

    window.ocultarCarregamentoPagina = ocultarCarregamento;
    window.mostrarCarregamentoPagina = mostrarCarregamento;
    window.CMEAplicarPreferenciasAdmin = aplicarPreferencias;
    window.CMENormalizarMenuAdmin = normalizarMenuAdministrativo;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciar, { once: true });
    } else {
        iniciar();
    }

    window.addEventListener("load", () => {
        fixarNomeAdministradora();
        window.setTimeout(ocultarCarregamento, 400);
    }, { once: true });
}());
