(function () {
    "use strict";

    const pagina = (location.pathname.split("/").pop() || "").toLowerCase();
    const configuracao = pagina === "agenda.html"
        ? {
            checkbox: "notificarCelularAgenda",
            caminho: "agenda-cliente.html",
            tipoCriacao: "agenda_criada"
        }
        : pagina === "solicitacoes.html"
            ? {
                checkbox: "notificarCelularSolicitacao",
                caminho: "solicitacoes-cliente.html",
                tipoCriacao: "solicitacao_criada"
            }
            : null;

    if (!configuracao) return;

    const original = window.dbNotificarAtualizacao;
    if (typeof original !== "function" || original.__cmePush) return;

    const wrapper = async function (dados = {}) {
        // Na Agenda, apenas eventos do tipo Reunião podem notificar o cliente.
        if (
            pagina === "agenda.html" &&
            document.getElementById("eventoTipo")?.value !== "reuniao"
        ) {
            return {
                enviado: false,
                ignorado: true,
                motivo: "Apenas reuniões enviam notificação ao cliente."
            };
        }

        const tipoOriginal = String(dados.tipo || configuracao.tipoCriacao);
        const ehCriacao = tipoOriginal === configuracao.tipoCriacao;
        const habilitado =
            document.getElementById(configuracao.checkbox)?.checked !== false;

        return original({
            ...dados,
            tipo: tipoOriginal,
            notificar_push: ehCriacao && habilitado,
            portal_path: configuracao.caminho
        });
    };

    wrapper.__cmePush = true;
    window.dbNotificarAtualizacao = wrapper;
}());
