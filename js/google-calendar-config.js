(function () {
    "use strict";

    const FUNCTION_NAME = "google-calendar-oauth";

    async function chamar(action, extras = {}) {
        if (!window.supabaseClient?.functions?.invoke) {
            throw new Error("Supabase indisponível.");
        }

        const { data, error } = await window.supabaseClient.functions.invoke(
            FUNCTION_NAME,
            { body: { action, ...extras } }
        );

        if (error) throw error;
        if (data?.erro) throw new Error(data.erro);
        return data || {};
    }

    function definirStatus(texto, conectado = false) {
        const el = document.getElementById("googleCalendarStatus");
        if (!el) return;
        el.textContent = texto;
        el.dataset.status = conectado ? "conectado" : "pendente";
    }

    async function carregarStatus() {
        try {
            const status = await chamar("status");

            const callback = document.getElementById("googleCalendarCallback");
            if (callback && status.callback_url) {
                callback.value = status.callback_url;
            }

            if (status.conectado) {
                definirStatus("Google Calendar conectado", true);
            } else if (status.credenciais_configuradas) {
                definirStatus("Credenciais salvas. Falta autorizar a conta Google.");
            } else {
                definirStatus("Google Calendar ainda não conectado.");
            }

            const conectar = document.getElementById("conectarGoogleCalendar");
            if (conectar) {
                conectar.disabled = !status.credenciais_configuradas;
            }
        } catch (error) {
            console.warn("Não foi possível consultar a integração Google Calendar.", error);
            definirStatus("Não foi possível consultar o status da integração.");
        }
    }

    async function salvarCredenciais() {
        const clientId = document.getElementById("googleCalendarClientId")?.value?.trim() || "";
        const clientSecret = document.getElementById("googleCalendarClientSecret")?.value?.trim() || "";

        if (!clientId || !clientSecret) {
            alert("Informe o Client ID e o Client Secret criados no Google Cloud.");
            return;
        }

        const botao = document.getElementById("salvarGoogleCalendar");
        if (botao) botao.disabled = true;

        try {
            await chamar("salvar_credenciais", {
                client_id: clientId,
                client_secret: clientSecret
            });

            const secretInput = document.getElementById("googleCalendarClientSecret");
            if (secretInput) secretInput.value = "";

            alert("Credenciais do Google Calendar salvas com segurança.");
            await carregarStatus();
        } catch (error) {
            console.error("Falha ao salvar credenciais do Google Calendar.", error);
            alert("Não foi possível salvar as credenciais do Google Calendar.");
        } finally {
            if (botao) botao.disabled = false;
        }
    }

    async function conectar() {
        const botao = document.getElementById("conectarGoogleCalendar");
        if (botao) botao.disabled = true;

        try {
            const data = await chamar("auth_url");
            if (!data.url) throw new Error("URL de autorização ausente.");
            location.href = data.url;
        } catch (error) {
            console.error("Falha ao iniciar OAuth do Google Calendar.", error);
            alert("Não foi possível iniciar a autorização do Google Calendar.");
            if (botao) botao.disabled = false;
        }
    }

    function tratarRetornoOAuth() {
        const params = new URLSearchParams(location.search);
        const status = params.get("google_calendar");
        if (!status) return;

        if (status === "conectado") {
            alert("Google Calendar conectado com sucesso.");
        } else {
            alert("A autorização do Google Calendar não foi concluída. Verifique as credenciais e tente novamente.");
        }

        params.delete("google_calendar");
        const novaUrl = location.pathname + (params.toString() ? "?" + params.toString() : "") + location.hash;
        history.replaceState({}, "", novaUrl);
    }

    document.addEventListener("DOMContentLoaded", () => {
        document.getElementById("salvarGoogleCalendar")?.addEventListener("click", salvarCredenciais);
        document.getElementById("conectarGoogleCalendar")?.addEventListener("click", conectar);
        tratarRetornoOAuth();
        carregarStatus();
    });
}());
