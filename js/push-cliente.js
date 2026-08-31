(function () {
    "use strict";

    const config = window.CME_FIREBASE_PUSH_CONFIG;
    if (!config?.enabled || !config.projectId || !config.vapidKey) return;

    let tokenAtual = "";
    let inicializando = false;
    let clienteDiagnosticoId = "";

    async function registrarDiagnostico(etapa, error) {
        if (!clienteDiagnosticoId || !window.supabaseClient?.rpc) return;
        const codigo = String(error?.cmeCode || error?.code || error?.name || "").slice(0, 120);
        const mensagem = String(error?.message || error || "").slice(0, 300);
        try {
            await window.supabaseClient.rpc("registrar_push_diagnostico", {
                p_cliente_id: clienteDiagnosticoId,
                p_etapa: String(etapa || "desconhecida").slice(0, 80),
                p_codigo: codigo || null,
                p_mensagem: mensagem || null,
                p_permissao: ("Notification" in window) ? Notification.permission : "indisponivel",
                p_navegador: navigator.userAgent || ""
            });
        } catch (diagnosticoError) {
            console.warn("Falha ao registrar diagnóstico de push.", diagnosticoError);
        }
    }

    function criarErro(codigo, mensagem) {
        const erro = new Error(mensagem);
        erro.cmeCode = codigo;
        return erro;
    }

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
        if (!window.isSecureContext) {
            throw criarErro("contexto-inseguro", "As notificações exigem uma conexão HTTPS segura.");
        }
        if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
            throw criarErro("navegador-sem-push", "Este navegador não oferece suporte completo a notificações Web Push.");
        }

        if (!window.firebase?.messaging) {
            await carregarScript("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
            await carregarScript("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");
        }

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

        if (typeof window.firebase.messaging.isSupported === "function") {
            const suportado = await window.firebase.messaging.isSupported();
            if (!suportado) {
                throw criarErro(
                    "firebase-nao-suportado",
                    "O Firebase Push não é compatível com este navegador."
                );
            }
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

        if (!("Notification" in window)) {
            botao.innerHTML = '<i class="bi bi-bell-slash"></i><span>Indisponível</span>';
            botao.disabled = false;
            botao.title = "Abra o portal em um navegador compatível para ativar avisos";
            botao.setAttribute("aria-label", botao.title);
            return;
        }

        if (Notification.permission === "granted") {
            botao.innerHTML = '<i class="bi bi-bell-fill"></i><span>Avisos ativos</span>';
            botao.classList.add("is-active");
            botao.disabled = false;
            botao.title = "Notificações ativadas neste dispositivo";
        } else if (Notification.permission === "denied") {
            botao.innerHTML = '<i class="bi bi-bell-slash"></i><span>Avisos bloqueados</span>';
            botao.classList.remove("is-active");
            botao.disabled = false;
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
        if (!session?.user) throw criarErro("sem-sessao", "Sessão não encontrada.");

        const contexto = await window.obterContextoPortal(session);
        if (contexto?.redirecionar) throw criarErro("sem-acesso", "Sessão sem acesso ao portal.");
        if (contexto?.modoPreview) {
            throw criarErro(
                "modo-preview",
                "As notificações não podem ser ativadas no modo de pré-visualização."
            );
        }
        if (!contexto?.cliente?.id) throw criarErro("sem-cliente", "Cliente não encontrado.");
        clienteDiagnosticoId = contexto.cliente.id;
        return { session, cliente: contexto.cliente };
    }

    async function registrarToken() {
        if (inicializando) return;
        if (!("Notification" in window) || Notification.permission !== "granted") return;

        inicializando = true;
        let etapa = "inicio-token";
        try {
            etapa = "contexto-cliente";
            const { cliente } = await contextoCliente();

            etapa = "firebase-sdk";
            await carregarFirebase();

            etapa = "service-worker";
            const sw = await navigator.serviceWorker.register(
                "/firebase-messaging-sw.js?v=20260831-3",
                {
                    scope: "/",
                    updateViaCache: "none"
                }
            );
            await sw.update().catch(() => {});
            await navigator.serviceWorker.ready;

            etapa = "token-fcm";
            const messaging = window.firebase.messaging();
            const token = await messaging.getToken({
                vapidKey: config.vapidKey,
                serviceWorkerRegistration: sw
            });

            if (!token) {
                const erroSemToken = criarErro(
                    "sem-token",
                    "O navegador autorizou notificações, mas não gerou o token do dispositivo."
                );
                erroSemToken.cmeStage = etapa;
                throw erroSemToken;
            }

            etapa = "gravar-token";
            const { error } = await window.supabaseClient.rpc("registrar_push_token", {
                p_cliente_id: cliente.id,
                p_token: token,
                p_plataforma: navigator.platform || "web",
                p_user_agent: navigator.userAgent || ""
            });
            if (error) {
                error.cmeStage = etapa;
                throw error;
            }

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
            await registrarDiagnostico("ativacao-concluida", { message: "Token FCM registrado com sucesso." });
            return token;
        } catch (error) {
            if (!error.cmeStage) error.cmeStage = etapa;
            await registrarDiagnostico(error.cmeStage || etapa, error);
            throw error;
        } finally {
            inicializando = false;
        }
    }

    function mensagemDeErro(error) {
        const codigo = error?.cmeCode || error?.code || "";
        const texto = String(error?.message || "");

        if (
            codigo === "firebase-nao-suportado" ||
            codigo === "navegador-sem-push" ||
            /unsupported-browser|not supported|not supported in this browser/i.test(texto)
        ) {
            return "Este navegador não oferece suporte completo às notificações. Abra o portal diretamente no Chrome (fora do navegador interno do WhatsApp/Google) e toque novamente em “Ativar avisos”.";
        }

        if (codigo === "modo-preview") {
            return "As notificações precisam ser ativadas entrando normalmente com a conta do cliente, e não pelo modo de pré-visualização do administrador.";
        }

        if (Notification.permission === "denied") {
            return "As notificações estão bloqueadas para este site. Abra as permissões do navegador, permita Notificações para camilamartinsengenharia.com.br e tente novamente.";
        }

        const detalhe = codigo || error?.code || "";
        return "Não foi possível concluir a ativação neste navegador." +
            (detalhe ? " Código: " + detalhe + "." : "") +
            " Tente abrir o portal diretamente no Chrome e repetir a ativação.";
    }

    async function ativarPush() {
        const botao = document.getElementById("cmePushToggle");
        if (botao) botao.disabled = true;

        let etapa = "contexto-cliente";
        try {
            await contextoCliente();

            etapa = "firebase-sdk";
            await carregarFirebase();

            etapa = "permissao";
            const permissao = await Notification.requestPermission();
            atualizarBotao(botao);

            if (permissao !== "granted") {
                const erroPermissao = criarErro(
                    "permissao-" + permissao,
                    "Permissão de notificações: " + permissao
                );
                erroPermissao.cmeStage = etapa;
                await registrarDiagnostico(etapa, erroPermissao);
                if (permissao === "denied") {
                    alert("As notificações foram bloqueadas. Permita notificações para este site nas configurações do navegador e tente novamente.");
                }
                return;
            }

            etapa = "registrar-token";
            await registrarToken();
            alert("Avisos ativados com sucesso neste dispositivo.");
        } catch (error) {
            if (!error.cmeStage) error.cmeStage = etapa;
            await registrarDiagnostico(error.cmeStage || etapa, error);
            console.error("Não foi possível ativar as notificações do portal.", error);
            alert(mensagemDeErro(error));
        } finally {
            if (botao) botao.disabled = false;
        }
    }

    async function iniciar() {
        criarBotao();
        if ("Notification" in window && Notification.permission === "granted") {
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
