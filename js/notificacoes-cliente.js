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

        let tipoOriginal = String(dados.tipo || configuracao.tipoCriacao);
        const acaoAgenda = pagina === "agenda.html"
            ? (window.CME_AGENDA_ACAO_ATUAL || (tipoOriginal === configuracao.tipoCriacao ? "criar" : "atualizar"))
            : null;

        if (pagina === "agenda.html" && acaoAgenda === "atualizar") {
            tipoOriginal = "agenda_atualizada";
        }

        const ehCriacao = tipoOriginal === configuracao.tipoCriacao;
        const habilitado =
            document.getElementById(configuracao.checkbox)?.checked !== false;

        const agendaDados = pagina === "agenda.html" && ehCriacao
            ? {
                data: document.getElementById("eventoData")?.value || "",
                horario: document.getElementById("eventoHorario")?.value || "",
                descricao: document.getElementById("eventoDescricao")?.value || "",
                duracao_minutos: 60
            }
            : undefined;

        return original({
            ...dados,
            tipo: tipoOriginal,
            notificar_push: ehCriacao && habilitado,
            portal_path: configuracao.caminho,
            agenda_dados: agendaDados,
            agenda_id: pagina === "agenda.html" ? (window.CME_AGENDA_ID_ATUAL || null) : null,
            agenda_action: pagina === "agenda.html" ? (acaoAgenda || "criar") : undefined
        });
    };

    wrapper.__cmePush = true;
    window.dbNotificarAtualizacao = wrapper;
}());
