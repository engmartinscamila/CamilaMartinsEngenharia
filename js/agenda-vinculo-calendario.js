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

    function primeiroRegistro(resultado) {
        return Array.isArray(resultado) ? resultado[0] : resultado;
    }

    window.dbCriarEventoAgenda = async function (dados) {
        const resultado = await criarOriginal(dados);
        const registro = primeiroRegistro(resultado);
        window.CME_AGENDA_ID_ATUAL = registro?.id || null;
        window.CME_AGENDA_ACAO_ATUAL = "criar";
        return resultado;
    };

    window.dbEditarEventoAgenda = async function (id, dados) {
        const resultado = await editarOriginal(id, dados);
        window.CME_AGENDA_ID_ATUAL = id;
        window.CME_AGENDA_ACAO_ATUAL = "atualizar";
        return resultado;
    };

    window.dbExcluirEventoAgenda = async function (id) {
        const evento = await window.supabaseClient
            ?.from("agenda")
            .select("id,titulo,tipo,data,horario,descricao,cliente_id,projeto_id")
            .eq("id", id)
            .maybeSingle();

        const item = evento?.data || null;

        if (item?.tipo === "reuniao" && item?.cliente_id) {
            try {
                await window.supabaseClient.functions.invoke("notificar-atualizacao", {
                    body: {
                        tipo: "agenda_cancelada",
                        cliente_id: item.cliente_id,
                        projeto_id: item.projeto_id || null,
                        titulo: item.titulo || "Reunião",
                        mensagem: "Reunião cancelada.",
                        notificar_push: false,
                        portal_path: "agenda-cliente.html",
                        agenda_id: item.id,
                        agenda_action: "cancelar",
                        agenda_dados: {
                            data: item.data || "",
                            horario: item.horario || "",
                            descricao: item.descricao || "",
                            duracao_minutos: 60
                        }
                    }
                });
            } catch (error) {
                console.warn("Não foi possível enviar o cancelamento à agenda administrativa.", error);
            }
        }

        return excluirOriginal(id);
    };
}());
