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

    if (pagina === "agenda.html") {
        const form = document.getElementById("formEvento");
        form?.addEventListener("submit", function (event) {
            const tipo = document.getElementById("eventoTipo")?.value || "";
            const horario = document.getElementById("eventoHorario")?.value || "";

            if (tipo === "reuniao" && !horario) {
                event.preventDefault();
                event.stopImmediatePropagation();
                alert("Informe o horário da reunião. Reuniões precisam de horário para gerar o convite de agenda.");
            }
        }, true);
    }

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
            agenda_dados: agendaDados
        });
    };

    wrapper.__cmePush = true;
    window.dbNotificarAtualizacao = wrapper;
}());
