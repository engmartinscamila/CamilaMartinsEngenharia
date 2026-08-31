(function () {
    "use strict";

    if ((location.pathname.split("/").pop() || "").toLowerCase() !== "agenda.html") return;

    const criarOriginal = window.dbCriarEventoAgenda;
    const editarOriginal = window.dbEditarEventoAgenda;
    const excluirOriginal = window.dbExcluirEventoAgenda;

    if (
        typeof criarOriginal !== "function" ||
        typeof editarOriginal !== "function" ||
        typeof excluirOriginal !== "function"
    ) return;

    async function sincronizar(acao, agendaId) {
        if (!agendaId || !window.supabaseClient?.functions?.invoke) {
            return { sincronizado: false, ignorado: true };
        }

        try {
            const { data, error } = await window.supabaseClient.functions.invoke(
                "google-calendar-sync",
                { body: { acao, agenda_id: agendaId } }
            );

            if (error) {
                console.warn("Google Calendar: sincronização indisponível.", error);
                return { sincronizado: false, error };
            }

            window.CME_GOOGLE_CALENDAR_LAST_SYNC = data || null;
            return data || { sincronizado: false };
        } catch (error) {
            console.warn("Google Calendar: falha de sincronização.", error);
            return { sincronizado: false, error };
        }
    }

    const criarWrapper = async function (dados) {
        const resultado = await criarOriginal(dados);
        const criado = Array.isArray(resultado) ? resultado[0] : resultado;

        if (criado?.id) {
            await sincronizar("criar", criado.id);
        }

        return resultado;
    };

    const editarWrapper = async function (id, dados) {
        const resultado = await editarOriginal(id, dados);
        await sincronizar("atualizar", id);
        return resultado;
    };

    const excluirWrapper = async function (id) {
        await sincronizar("excluir", id);
        return excluirOriginal(id);
    };

    criarWrapper.__cmeGoogleCalendar = true;
    editarWrapper.__cmeGoogleCalendar = true;
    excluirWrapper.__cmeGoogleCalendar = true;

    window.dbCriarEventoAgenda = criarWrapper;
    window.dbEditarEventoAgenda = editarWrapper;
    window.dbExcluirEventoAgenda = excluirWrapper;
}());
