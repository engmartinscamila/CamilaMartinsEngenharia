(function () {
    "use strict";

    let lancamentos = [];
    let projetos = [];

    const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
    const texto = id => document.getElementById(id)?.value?.trim() || "";
    const valor = item => Number(item?.valor) || 0;
    const normalizar = value => String(value ?? "").toLocaleLowerCase("pt-BR");
    const dataReferencia = item => item.data_vencimento || item.data || "";
    const hojeIso = () => new Date().toISOString().slice(0, 10);

    function camposAdicionais() {
        const status = texto("financeiroStatus") || "pendente";
        let pagamento = texto("financeiroPagamento") || null;
        if (status === "pago" && !pagamento) pagamento = hojeIso();
        return {
            status,
            categoria: texto("financeiroCategoria") || "outros",
            data_vencimento: texto("financeiroVencimento") || null,
            data_pagamento: pagamento,
            forma_pagamento: texto("financeiroFormaPagamento") || null
        };
    }

    function envolverBusca() {
        const original = window.dbBuscarFinanceiro;
        if (typeof original !== "function" || original.__cmeAvancado) return;
        const wrapper = async function (...args) {
            const resultado = await original.apply(this, args);
            lancamentos = Array.isArray(resultado) ? resultado : [];
            window.setTimeout(renderizar, 0);
            return resultado;
        };
        wrapper.__cmeAvancado = true;
        window.dbBuscarFinanceiro = wrapper;
    }

    function envolverGravacao(nome, indicePayload, indiceId = -1) {
        const original = window[nome];
        if (typeof original !== "function" || original.__cmeAvancado) return;
        const wrapper = async function (...args) {
            const atual = indiceId >= 0
                ? lancamentos.find(item => String(item.id) === String(args[indiceId]))
                : null;
            const formulario = document.getElementById("formFinanceiro");
            const formularioDoRegistro = indiceId < 0
                || formulario?.dataset.cmeFinanceiroId === String(args[indiceId]);
            const extras = formularioDoRegistro
                ? camposAdicionais()
                : {
                    status: atual?.status || "pago",
                    categoria: atual?.categoria || "outros",
                    data_vencimento: atual?.data_vencimento || null,
                    data_pagamento: atual?.data_pagamento || null,
                    forma_pagamento: atual?.forma_pagamento || null
                };
            args[indicePayload] = { ...(args[indicePayload] || {}), ...extras };
            const resposta = await original.apply(this, args);
            window.setTimeout(atualizarDados, 80);
            return resposta;
        };
        wrapper.__cmeAvancado = true;
        window[nome] = wrapper;
    }

    function situacaoEfetiva(item) {
        if (["pago", "cancelado"].includes(item.status)) return item.status;
        if (item.data_vencimento && item.data_vencimento < hojeIso()) return "atrasado";
        return item.status || "pendente";
    }

    function filtrados() {
        const projeto = texto("filtroFinanceiroProjeto");
        const status = texto("filtroFinanceiroStatus");
        const mes = texto("filtroFinanceiroMes");
        return lancamentos.filter(item => {
            if (projeto && String(item.projeto_id || "") !== projeto) return false;
            if (status && situacaoEfetiva(item) !== status) return false;
            if (mes && !dataReferencia(item).startsWith(mes)) return false;
            return true;
        });
    }

    function total(itens, tipo) {
        return itens
            .filter(item => !tipo || item.tipo === tipo)
            .reduce((soma, item) => soma + valor(item), 0);
    }

    function nomeProjeto(id) {
        return projetos.find(item => String(item.id) === String(id))?.nome || "Sem projeto";
    }

    function escapar(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function renderizar() {
        if (!document.getElementById("financeiroResumoProjetos")) return;
        const itens = filtrados();
        const ativos = itens.filter(item => situacaoEfetiva(item) !== "cancelado");
        const aReceber = ativos.filter(item => item.tipo === "entrada" && situacaoEfetiva(item) !== "pago");
        const atrasados = ativos.filter(item => situacaoEfetiva(item) === "atrasado");
        const limite = new Date();
        limite.setDate(limite.getDate() + 30);
        const limiteIso = limite.toISOString().slice(0, 10);
        const proximos = ativos.filter(item => {
            const data = dataReferencia(item);
            return situacaoEfetiva(item) !== "pago" && data >= hojeIso() && data <= limiteIso;
        });

        document.getElementById("financeiroAReceber").textContent = moeda.format(total(aReceber));
        document.getElementById("financeiroEmAtraso").textContent = moeda.format(total(atrasados));
        document.getElementById("financeiroResultadoPrevisto").textContent = moeda.format(total(ativos, "entrada") - total(ativos, "saida"));
        document.getElementById("financeiroProximos30").textContent = moeda.format(total(proximos, "entrada") - total(proximos, "saida"));

        const grupos = new Map();
        ativos.forEach(item => {
            const chave = item.projeto_id || "sem-projeto";
            const grupo = grupos.get(chave) || { entradas: 0, saidas: 0, pendencias: 0 };
            if (item.tipo === "entrada") grupo.entradas += valor(item);
            if (item.tipo === "saida") grupo.saidas += valor(item);
            if (!["pago", "cancelado"].includes(situacaoEfetiva(item))) grupo.pendencias += 1;
            grupos.set(chave, grupo);
        });

        const corpo = document.getElementById("financeiroResumoProjetos");
        if (!grupos.size) {
            corpo.innerHTML = '<tr><td colspan="5">Nenhum lançamento corresponde aos filtros.</td></tr>';
            return;
        }
        corpo.innerHTML = [...grupos.entries()].map(([id, grupo]) => `
            <tr>
                <td>${escapar(id === "sem-projeto" ? "Sem projeto" : nomeProjeto(id))}</td>
                <td>${moeda.format(grupo.entradas)}</td>
                <td>${moeda.format(grupo.saidas)}</td>
                <td class="${grupo.entradas - grupo.saidas < 0 ? "valor-negativo" : "valor-positivo"}">${moeda.format(grupo.entradas - grupo.saidas)}</td>
                <td>${grupo.pendencias}</td>
            </tr>`).join("");
    }

    function preencherProjetos() {
        const select = document.getElementById("filtroFinanceiroProjeto");
        if (!select) return;
        const atual = select.value;
        select.innerHTML = '<option value="">Todos os projetos</option>' + projetos
            .map(projeto => `<option value="${escapar(projeto.id)}">${escapar(projeto.nome || "Projeto")}</option>`)
            .join("");
        select.value = atual;
    }

    function preencherEdicao(item) {
        if (!item) return;
        const form = document.getElementById("formFinanceiro");
        if (form) form.dataset.cmeFinanceiroId = String(item.id);
        const valores = {
            financeiroStatus: item.status || "pago",
            financeiroCategoria: item.categoria || "outros",
            financeiroVencimento: item.data_vencimento || "",
            financeiroPagamento: item.data_pagamento || "",
            financeiroFormaPagamento: item.forma_pagamento || ""
        };
        Object.entries(valores).forEach(([id, value]) => {
            const campo = document.getElementById(id);
            if (campo) campo.value = value;
        });
    }

    function detectarEdicao(evento) {
        const botao = evento.target.closest("button[data-id], [data-acao][data-id], [data-action][data-id]");
        if (!botao) return;
        const acao = normalizar(`${botao.dataset.acao || ""} ${botao.dataset.action || ""} ${botao.title || ""} ${botao.textContent || ""} ${botao.innerHTML || ""}`);
        if (!acao.includes("edit") && !acao.includes("pen") && !acao.includes("alterar")) return;
        const item = lancamentos.find(registro => String(registro.id) === String(botao.dataset.id));
        preencherEdicao(item);
        window.setTimeout(() => preencherEdicao(item), 30);
    }

    function exportarCsv() {
        const cabecalho = ["Descrição", "Tipo", "Valor", "Data", "Vencimento", "Situação", "Categoria", "Projeto", "Forma de pagamento"];
        const linhas = filtrados().map(item => [
            item.descricao, item.tipo, valor(item).toFixed(2).replace(".", ","), item.data,
            item.data_vencimento, situacaoEfetiva(item), item.categoria,
            nomeProjeto(item.projeto_id), item.forma_pagamento
        ]);
        const csv = [cabecalho, ...linhas]
            .map(linha => linha.map(campo => `"${String(campo ?? "").replaceAll('"', '""')}"`).join(";"))
            .join("\r\n");
        const link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
        link.download = `financeiro-${hojeIso()}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
    }

    async function atualizarDados() {
        try {
            [lancamentos, projetos] = await Promise.all([
                window.dbBuscarFinanceiro(),
                typeof window.dbBuscarProjetos === "function" ? window.dbBuscarProjetos() : Promise.resolve([])
            ]);
            preencherProjetos();
            renderizar();
        } catch (erro) {
            console.warn("Não foi possível atualizar a visão financeira.", erro);
        }
    }

    function iniciar() {
        ["filtroFinanceiroProjeto", "filtroFinanceiroStatus", "filtroFinanceiroMes"]
            .forEach(id => document.getElementById(id)?.addEventListener("change", renderizar));
        document.getElementById("limparFiltrosFinanceiros")?.addEventListener("click", () => {
            ["filtroFinanceiroProjeto", "filtroFinanceiroStatus", "filtroFinanceiroMes"]
                .forEach(id => { const campo = document.getElementById(id); if (campo) campo.value = ""; });
            renderizar();
        });
        document.getElementById("exportarFinanceiroCsv")?.addEventListener("click", exportarCsv);
        document.addEventListener("click", detectarEdicao, true);
        document.getElementById("novoLancamento")?.addEventListener("click", () => {
            const form = document.getElementById("formFinanceiro");
            if (form) delete form.dataset.cmeFinanceiroId;
            window.setTimeout(() => {
                const status = document.getElementById("financeiroStatus");
                const categoria = document.getElementById("financeiroCategoria");
                if (status) status.value = "pendente";
                if (categoria) categoria.value = "honorarios";
            }, 30);
        }, true);
        document.getElementById("financeiroStatus")?.addEventListener("change", evento => {
            const pagamento = document.getElementById("financeiroPagamento");
            if (evento.target.value === "pago" && pagamento && !pagamento.value) pagamento.value = hojeIso();
        });
        window.setTimeout(atualizarDados, 250);
    }

    envolverBusca();
    envolverGravacao("dbCriarLancamentoFinanceiro", 0);
    envolverGravacao("dbEditarLancamentoFinanceiro", 1, 0);

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
    else iniciar();
}());
