/*
=====================================================
CAMILA MARTINS ENGENHARIA
FINANCEIRO.JS - CRUD ADMINISTRATIVO
=====================================================
*/

(function moduloFinanceiro() {
    "use strict";

    let lancamentos = [];
    let projetos = [];
    let lancamentoSelecionadoId = null;

    document.addEventListener("DOMContentLoaded", iniciar);

    async function iniciar() {
        configurarEventos();
        mostrarLoading(true);

        try {
            [lancamentos, projetos] = await Promise.all([
                dbBuscarFinanceiro(),
                dbBuscarProjetos()
            ]);

            preencherProjetos();
            renderizar();
            atualizarResumo();
        }
        catch (error) {
            tratarErro("Não foi possível carregar os lançamentos.", error);
        }
        finally {
            mostrarLoading(false);
        }
    }

    function configurarEventos() {
        document.getElementById("novoLancamento")?.addEventListener("click", novoLancamento);
        document.getElementById("fecharModalFinanceiro")?.addEventListener("click", fecharModal);
        document.getElementById("cancelarLancamento")?.addEventListener("click", fecharModal);
        document.getElementById("formFinanceiro")?.addEventListener("submit", salvarLancamento);
        document.getElementById("pesquisaFinanceiro")?.addEventListener("input", pesquisar);
        document.getElementById("btnPesquisarFinanceiro")?.addEventListener("click", pesquisar);
        document.getElementById("listaFinanceiro")?.addEventListener("click", tratarAcao);
        document.getElementById("detalhesFinanceiro")?.addEventListener("click", tratarAcao);
        document.getElementById("modalFinanceiro")?.addEventListener("click", event => {
            if (event.target.id === "modalFinanceiro") fecharModal();
        });
    }

    function preencherProjetos() {
        const select = document.getElementById("financeiroProjeto");
        if (!select) return;

        select.innerHTML = `<option value="">Selecione o projeto</option>` +
            projetos.map(projeto => `
                <option value="${escapar(projeto.id)}">${escapar(projeto.nome)}</option>
            `).join("");
    }

    function renderizar(lista = lancamentos) {
        const container = document.getElementById("listaFinanceiro");
        if (!container) return;

        if (!lista.length) {
            container.innerHTML = `<div class="estado-vazio">Nenhum lançamento cadastrado.</div>`;
            return;
        }

        container.innerHTML = lista.map(lancamento => `
            <article class="item-lista financeiro-item">
                <div class="item-info">
                    <h3>${escapar(lancamento.descricao)}</h3>
                    <span>${escapar(nomeProjeto(lancamento.projeto_id))} · ${escapar(formatarData(lancamento.data))}</span>
                    <span class="badge ${lancamento.tipo === "entrada" ? "ativo" : "pausado"}">
                        ${lancamento.tipo === "entrada" ? "Entrada" : "Saída"} · ${escapar(formatarMoeda(lancamento.valor))}
                    </span>
                </div>
                <div class="item-acoes">
                    ${botao("abrir", lancamento.id, "fa-eye", "Abrir detalhes")}
                    ${botao("editar", lancamento.id, "fa-pen", "Editar lançamento", "edit")}
                    ${botao("excluir", lancamento.id, "fa-trash", "Excluir lançamento", "delete")}
                </div>
            </article>
        `).join("");
    }

    function tratarAcao(event) {
        const alvo = event.target.closest("[data-acao-financeiro]");
        if (!alvo) return;

        const { acaoFinanceiro: acao, id } = alvo.dataset;
        if (acao === "abrir") mostrarDetalhes(id);
        if (acao === "editar") editarLancamento(id);
        if (acao === "excluir") excluirLancamento(id);
    }

    function novoLancamento() {
        lancamentoSelecionadoId = null;
        document.getElementById("formFinanceiro")?.reset();
        preencher("financeiroData", new Date().toISOString().slice(0, 10));
        atualizarModal("Novo Lançamento", "Salvar Lançamento");
        abrirModal();
    }

    function editarLancamento(id) {
        const lancamento = localizar(id);
        if (!lancamento) return;

        lancamentoSelecionadoId = lancamento.id;
        preencher("financeiroDescricao", lancamento.descricao);
        preencher("financeiroTipo", lancamento.tipo);
        preencher("financeiroValor", lancamento.valor);
        preencher("financeiroData", lancamento.data);
        preencher("financeiroProjeto", lancamento.projeto_id);
        preencher("financeiroObservacoes", lancamento.observacoes);
        atualizarModal("Editar Lançamento", "Salvar Alterações");
        abrirModal();
    }

    async function salvarLancamento(event) {
        event.preventDefault();

        const dados = {
            descricao: valor("financeiroDescricao"),
            tipo: valor("financeiroTipo"),
            valor: Number(valor("financeiroValor")),
            data: valor("financeiroData") || null,
            projeto_id: valor("financeiroProjeto") || null,
            observacoes: valor("financeiroObservacoes")
        };

        if (!dados.descricao || !Number.isFinite(dados.valor) || dados.valor <= 0) {
            alert("Informe a descrição e um valor maior que zero.");
            return;
        }

        const botaoSalvar = document.getElementById("salvarLancamento");
        alternarSalvamento(botaoSalvar, true);

        try {
            if (lancamentoSelecionadoId) {
                await dbEditarLancamentoFinanceiro(lancamentoSelecionadoId, dados);
            }
            else {
                await dbCriarLancamentoFinanceiro(dados);
            }

            const editando = Boolean(lancamentoSelecionadoId);
            fecharModal();
            await recarregar();
            alert(editando ? "Lançamento atualizado com sucesso." : "Lançamento cadastrado com sucesso.");
        }
        catch (error) {
            tratarErro("Não foi possível salvar o lançamento.", error);
        }
        finally {
            alternarSalvamento(botaoSalvar, false);
        }
    }

    function mostrarDetalhes(id) {
        const lancamento = localizar(id);
        const painel = document.getElementById("detalhesFinanceiro");
        if (!lancamento || !painel) return;

        lancamentoSelecionadoId = lancamento.id;
        painel.innerHTML = `
            <h3>${escapar(lancamento.descricao)}</h3>
            <p><strong>Tipo:</strong> ${lancamento.tipo === "entrada" ? "Entrada" : "Saída"}</p>
            <p><strong>Valor:</strong> ${escapar(formatarMoeda(lancamento.valor))}</p>
            <p><strong>Data:</strong> ${escapar(formatarData(lancamento.data))}</p>
            <p><strong>Projeto:</strong> ${escapar(nomeProjeto(lancamento.projeto_id))}</p>
            <p>${escapar(lancamento.observacoes || "Sem observações.")}</p>
            <div class="detalhes-acoes">
                ${botao("editar", lancamento.id, "fa-pen", "Editar lançamento", "edit")}
                ${botao("excluir", lancamento.id, "fa-trash", "Excluir lançamento", "delete")}
            </div>
        `;
    }

    async function excluirLancamento(id) {
        const lancamento = localizar(id);
        if (!lancamento || !confirm(`Excluir o lançamento "${lancamento.descricao}"?`)) return;

        try {
            await dbExcluirLancamentoFinanceiro(lancamento.id);
            limparDetalhes();
            await recarregar();
            alert("Lançamento excluído com sucesso.");
        }
        catch (error) {
            tratarErro("Não foi possível excluir o lançamento.", error);
        }
    }

    async function recarregar() {
        lancamentos = await dbBuscarFinanceiro();
        renderizar();
        atualizarResumo();
    }

    function atualizarResumo() {
        const entradas = lancamentos
            .filter(item => item.tipo === "entrada")
            .reduce((total, item) => total + Number(item.valor || 0), 0);
        const saidas = lancamentos
            .filter(item => item.tipo === "saida")
            .reduce((total, item) => total + Number(item.valor || 0), 0);

        definirTexto("totalEntradas", formatarMoeda(entradas));
        definirTexto("totalSaidas", formatarMoeda(saidas));
        definirTexto("saldoAtual", formatarMoeda(entradas - saidas));
    }

    function pesquisar() {
        const termo = valor("pesquisaFinanceiro").toLocaleLowerCase("pt-BR");
        if (!termo) return renderizar();

        renderizar(lancamentos.filter(item =>
            [item.descricao, item.tipo, item.observacoes, nomeProjeto(item.projeto_id)]
                .some(campo => String(campo || "").toLocaleLowerCase("pt-BR").includes(termo))
        ));
    }

    function abrirModal() {
        const modal = document.getElementById("modalFinanceiro");
        if (!modal) return;
        modal.style.display = "flex";
        modal.classList.add("show");
    }

    function fecharModal() {
        const modal = document.getElementById("modalFinanceiro");
        modal?.classList.remove("show");
        if (modal) modal.style.display = "none";
        document.getElementById("formFinanceiro")?.reset();
    }

    function atualizarModal(titulo, textoBotao) {
        const tituloModal = document.querySelector("#modalFinanceiro .modal-header h2");
        const botaoSalvar = document.getElementById("salvarLancamento");
        if (tituloModal) tituloModal.textContent = titulo;
        if (botaoSalvar) botaoSalvar.textContent = textoBotao;
    }

    function alternarSalvamento(botao, salvando) {
        if (!botao) return;
        botao.disabled = salvando;
        if (salvando) botao.textContent = "Salvando...";
        else botao.textContent = lancamentoSelecionadoId ? "Salvar Alterações" : "Salvar Lançamento";
    }

    function limparDetalhes() {
        lancamentoSelecionadoId = null;
        const painel = document.getElementById("detalhesFinanceiro");
        if (painel) painel.innerHTML = "<p>Selecione um lançamento para visualizar os detalhes.</p>";
    }

    function botao(acao, id, icone, titulo, classe = "") {
        return `
            <button type="button" class="btn-icon ${classe}" data-acao-financeiro="${acao}"
                data-id="${escapar(id)}" title="${titulo}" aria-label="${titulo}">
                <i class="fa-solid ${icone}"></i>
            </button>
        `;
    }

    function localizar(id) {
        return lancamentos.find(item => String(item.id) === String(id));
    }

    function nomeProjeto(id) {
        return projetos.find(projeto => String(projeto.id) === String(id))?.nome || "Não informado";
    }

    function formatarMoeda(valor) {
        return (Number(valor) || 0).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL"
        });
    }

    function formatarData(data) {
        if (!data) return "Não informada";
        return new Date(`${data}T12:00:00`).toLocaleDateString("pt-BR");
    }

    function definirTexto(id, texto) {
        const elemento = document.getElementById(id);
        if (elemento) elemento.textContent = texto;
    }

    function mostrarLoading(mostrar) {
        const elemento = document.getElementById("loading");
        if (elemento) elemento.style.display = mostrar ? "flex" : "none";
    }

    function valor(id) {
        return document.getElementById(id)?.value?.trim() || "";
    }

    function preencher(id, conteudo) {
        const campo = document.getElementById(id);
        if (campo) campo.value = conteudo ?? "";
    }

    function escapar(valor) {
        return String(valor ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function tratarErro(mensagem, error) {
        console.error(mensagem, error);
        alert(`${mensagem}${error?.message ? `\n${error.message}` : ""}`);
    }
})();
