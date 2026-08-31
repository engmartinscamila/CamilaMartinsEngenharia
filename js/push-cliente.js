(function () {
    "use strict";

    const config = window.CME_FIREBASE_PUSH_CONFIG;
    if (!config?.enabled || !config.projectId || !config.vapidKey) return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;

    let tokenAtual = "";
    let inicializando = false;

    function carregarScript(src) {
        return new Promise((resolve, reject) => {
            const existente = [...document.scripts].find(s => s.src === src);
            if (existente) {
                if (window.firebase) return resolve();
                existente.addEventListener("load", resolve, { once: true });
                existente.addEventListener("error", reject, { once: true });
                return;
            }
            const script = document.createElement("script");
            script.src = src;
            script.defer = true;
            script.addEventListener("load", resolve, { once: true });
            script.addEventListener("error", reject, { once: true });
            document.head.appendChild(script);
        });
    }

    async function carregarFirebase() {
        if (window.firebase?.messaging) return;
        await carregarScript("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
        await carregarScript("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");
        if (!window.firebase.apps?.length) {
            window.firebase.initializeApp({
                apiKey: config.apiKey,
                authDomain: config.authDomain,
                projectId: config.projectId,
                storageBucket: config.storageBucket,
                messagingSenderId: config.messagingSenderId,
                appId: config.appId
            });
        }
    }

    function criarBotao() {
        const acoes = document.querySelector(".topbar-actions");
        if (!acoes || document.getElementById("cmePushToggle")) return null;

        const botao = document.createElement("button");
        botao.type = "button";
        botao.id = "cmePushToggle";
        botao.className = "cme-push-toggle";
        botao.innerHTML = '<i class="bi bi-bell"></i><span>Ativar avisos</span>';
        botao.title = "Receber notificações do portal neste dispositivo";
        botao.setAttribute("aria-label", botao.title);

        const tema = document.getElementById("portalThemeToggle");
        const sair = acoes.querySelector(".logout-button");
        acoes.insertBefore(botao, tema || sair || null);

        botao.addEventListener("click", ativarPush);
        atualizarBotao(botao);
        return botao;
    }

    function atualizarBotao(botao = document.getElementById("cmePushToggle")) {
        if (!botao) return;
        if (Notification.permission === "granted") {
            botao.innerHTML = '<i class="bi bi-bell-fill"></i><span>Avisos ativos</span>';
            botao.classList.add("is-active");
            botao.disabled = false;
            botao.title = "Notificações ativadas neste dispositivo";
        } else if (Notification.permission === "denied") {
            botao.innerHTML = '<i class="bi bi-bell-slash"></i><span>Avisos bloqueados</span>';
            botao.classList.remove("is-active");
            botao.disabled = true;
            botao.title = "O navegador bloqueou as notificações para este site";
        } else {
            botao.innerHTML = '<i class="bi bi-bell"></i><span>Ativar avisos</span>';
            botao.classList.remove("is-active");
            botao.disabled = false;
            botao.title = "Receber notificações gratuitas do portal neste dispositivo";
        }
        botao.setAttribute("aria-label", botao.title);
    }

    async function contextoCliente() {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (!session?.user) throw new Error("Sessão não encontrada.");
        const contexto = await window.obterContextoPortal(session);
        if (contexto?.redirecionar) throw new Error("Sessão sem acesso ao portal.");
        if (contexto?.modoPreview) throw new Error("Notificações não são ativadas no modo de pré-visualização.");
        if (!contexto?.cliente?.id) throw new Error("Cliente não encontrado.");
        return { session, cliente: contexto.cliente };
    }

    async function registrarToken() {
        if (inicializando || Notification.permission !== "granted") return;
        inicializando = true;
        try {
            await carregarFirebase();
            const { cliente } = await contextoCliente();
            const sw = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
            await navigator.serviceWorker.ready;

            const messaging = window.firebase.messaging();
            const token = await messaging.getToken({
                vapidKey: config.vapidKey,
                serviceWorkerRegistration: sw
            });
            if (!token) throw new Error("O navegador não gerou um token de notificação.");

            const { error } = await window.supabaseClient.rpc("registrar_push_token", {
                p_cliente_id: cliente.id,
                p_token: token,
                p_plataforma: navigator.platform || "web",
                p_user_agent: navigator.userAgent || ""
            });
            if (error) throw error;

            tokenAtual = token;
            localStorage.setItem("cme_push_token", token);

            messaging.onMessage(payload => {
                const titulo = payload?.data?.title || "Camila Martins Engenharia";
                const corpo = payload?.data?.body || "Há uma nova atualização no seu portal.";
                if (Notification.permission === "granted") {
                    new Notification(titulo, {
                        body: corpo,
                        icon: "/assets/logo.png",
                        tag: payload?.data?.tag || "cme-portal"
                    });
                }
            });

            atualizarBotao();
        } finally {
            inicializando = false;
        }
    }

    async function ativarPush() {
        const botao = document.getElementById("cmePushToggle");
        if (botao) botao.disabled = true;
        try {
            const permissao = await Notification.requestPermission();
            atualizarBotao(botao);
            if (permissao !== "granted") return;
            await registrarToken();
        } catch (error) {
            console.error("Não foi possível ativar as notificações do portal.", error);
            alert("Não foi possível ativar os avisos neste dispositivo. Tente novamente mais tarde.");
        } finally {
            if (botao && Notification.permission !== "denied") botao.disabled = false;
        }
    }

    async function iniciar() {
        criarBotao();
        if (Notification.permission === "granted") {
            registrarToken().catch(error => {
                console.warn("Não foi possível atualizar o token de push.", error);
            });
        }
    }

    window.addEventListener("beforeunload", () => {
        if (!tokenAtual) tokenAtual = localStorage.getItem("cme_push_token") || "";
    });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciar, { once: true });
    } else {
        iniciar();
    }
}());
