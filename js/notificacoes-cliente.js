(function () {
    "use strict";

    const pagina = (location.pathname.split("/").pop() || "").toLowerCase();
    const configuracao = pagina === "agenda.html"
        ? {
            checkbox: "notificarCelularAgenda",
            caminho: "agenda-cliente.html",
            tipo: "agenda_criada"
        }
        : pagina === "solicitacoes.html"
            ? {
                checkbox: "notificarCelularSolicitacao",
                caminho: "solicitacoes-cliente.html",
                tipo: "solicitacao_criada"
            }
            : null;

    if (!configuracao) return;

    const original = window.dbNotificarAtualizacao;
    if (typeof original !== "function" || original.__cmePush) return;

    const wrapper = async function (dados = {}) {
        const habilitado =
            document.getElementById(configuracao.checkbox)?.checked !== false;

        return original({
            ...dados,
            tipo: configuracao.tipo,
            notificar_push: habilitado,
            portal_path: configuracao.caminho
        });
    };

    wrapper.__cmePush = true;
    window.dbNotificarAtualizacao = wrapper;
}());
