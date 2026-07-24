/*
=====================================================
CAMILA MARTINS ENGENHARIA
SUPABASE - CONFIGURAÇÃO GLOBAL
=====================================================
*/

(function iniciarSupabase() {
    "use strict";

    const configuracao = {
        url: "https://hghtwlopqztfcosfxafd.supabase.co",
        chavePublica: "sb_publishable_-unXLR2NSSACLs01Sr60GA_uCFnJ74f",
        administradorId: "5c9d7a0e-0495-4e96-8561-1d7f220be154"
    };

    window.CM_CONFIG = window.CM_CONFIG || Object.freeze(configuracao);
    window.ADMIN_UID = window.ADMIN_UID || configuracao.administradorId;

    window.TABELAS = window.TABELAS || Object.freeze({
        CLIENTES: "clientes",
        AGENDA: "agenda",
        PROJETOS: "projetos",
        DOCUMENTOS: "documentos",
        FOTOS: "fotos",
        BIBLIOTECA: "biblioteca",
        FINANCEIRO: "financeiro",
        CONFIGURACOES: "configuracoes",
        CRONOGRAMA: "cronograma",
        SOLICITACOES: "solicitacoes"
    });

    /* Nomes exatos e sensíveis a maiúsculas dos buckets reais. */
    window.BUCKETS = window.BUCKETS || Object.freeze({
        DOCUMENTOS: "documentos",
        FOTOS: "fotos",
        BIBLIOTECA: "biblioteca"
    });

    if (!window.supabase || typeof window.supabase.createClient !== "function") {
        throw new Error("A biblioteca do Supabase não foi carregada.");
    }

    if (!window.supabaseClient) {
        window.supabaseClient = window.supabase.createClient(
            configuracao.url,
            configuracao.chavePublica
        );
    }

    function uuidValido(valor) {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
            .test(String(valor || ""));
    }

    window.obterContextoPortal = async function obterContextoPortal(session) {
        if (!session?.user) {
            return { redirecionar: "login.html" };
        }

        const parametros = new URLSearchParams(window.location.search);
        const clientePreviewId = parametros.get("cliente");
        const modoPreview =
            session.user.id === window.ADMIN_UID &&
            parametros.get("preview") === "1" &&
            uuidValido(clientePreviewId);

        if (session.user.id === window.ADMIN_UID && !modoPreview) {
            return { redirecionar: "admin.html" };
        }

        let consulta = window.supabaseClient
            .from(window.TABELAS.CLIENTES)
            .select("*");

        consulta = modoPreview
            ? consulta.eq("id", clientePreviewId)
            : consulta.eq("auth_id", session.user.id);

        const { data: cliente, error } = await consulta.maybeSingle();

        if (error) throw error;

        return {
            cliente,
            modoPreview,
            parametrosPreview: modoPreview
                ? `preview=1&cliente=${encodeURIComponent(clientePreviewId)}`
                : ""
        };
    };

    window.aplicarContextoPortal = function aplicarContextoPortal(contexto) {
        if (!contexto?.modoPreview || !contexto.cliente?.id) return;

        document.body.classList.add("modo-preview-admin");

        if (!document.getElementById("previewAdminBanner")) {
            const banner = document.createElement("div");
            banner.id = "previewAdminBanner";
            banner.className = "preview-admin-banner";

            const texto = document.createElement("span");
            texto.textContent =
                `Modo de teste: portal de ${contexto.cliente?.nome || "cliente"}`;

            const voltar = document.createElement("a");
            voltar.href = "clientes.html";
            voltar.textContent = "Voltar ao painel";

            banner.append(texto, voltar);
            document.body.prepend(banner);
        }

        const paginasPortal = new Set([
            "portal.html",
            "meu-projeto.html",
            "biblioteca-cliente.html",
            "documentos-cliente.html",
            "fotos-cliente.html",
            "cronograma-cliente.html",
            "solicitacoes-cliente.html"
        ]);

        document.querySelectorAll("a[href]").forEach(link => {
            const href = link.getAttribute("href");

            if (
                !href ||
                href.startsWith("#") ||
                href.startsWith("http") ||
                href.startsWith("mailto:") ||
                href.startsWith("tel:") ||
                !href.includes(".html")
            ) {
                return;
            }

            const url = new URL(href, window.location.href);
            const pagina = url.pathname.split("/").pop();

            if (!paginasPortal.has(pagina)) return;

            url.searchParams.set("preview", "1");
            url.searchParams.set("cliente", contexto.cliente.id);
            link.href = `${pagina}?${url.searchParams.toString()}`;
        });

        document
            .getElementById("logoutButton")
            ?.addEventListener("click", event => {
                event.preventDefault();
                event.stopImmediatePropagation();
                window.location.href = "clientes.html";
            }, true);
    };

    window.notificarAtualizacao = async function notificarAtualizacao(dados) {
        try {
            const { data, error } = await window.supabaseClient.functions.invoke(
                "notificar-atualizacao",
                { body: dados }
            );

            if (error) throw error;

            return {
                enviado: Boolean(data?.enviado),
                motivo: data?.motivo || "",
                data
            };
        }
        catch (error) {
            console.warn("Atualização salva, mas a notificação não foi enviada:", error);
            return {
                enviado: false,
                motivo: error?.message || "Serviço de e-mail indisponível.",
                error
            };
        }
    };
})();
