/*
==========================================================
CAMILA MARTINS ENGENHARIA
SOLICITACOES.JS - CADASTRO E GERENCIAMENTO
==========================================================
*/

(function moduloSolicitacoes() {
    "use strict";

    let solicitacoes = [];
    let clientes = [];
    let projetos = [];
    let solicitacaoSelecionadaId = null;
    let usuarioAdministrador = false;

    document.addEventListener("DOMContentLoaded", iniciar);

    async function iniciar() {
        configurarEventos();

        try {
            const sessao = await supabaseClient.auth.getSession();
            usuarioAdministrador = sessao.data?.session?.user?.id === window.ADMIN_UID;

            [solicitacoes, clientes, projetos] = await Promise.all([
                dbBuscarSolicitacoes(),
                dbBuscarClientes(),
                dbBuscarProjetos()
            ]);

            preencherSelect("clienteSolicitacao", clientes);
            preencherProjetos();
            selecionarClienteUnico();
            renderizar();
            atualizarResumo();
        }
        catch (error) {
            tratarErro("Não foi possível carregar as solicitações.", error);
        }
        finally {
            ocultarCarregamentoPagina();
        }
    }

    function configurarEventos() {
        const botaoNovo = document.getElementById("novaSolicitacao");
        if (botaoNovo) {
            botaoNovo.removeAttribute("onclick");
            botaoNovo.addEventListener("click", novaSolicitacao);
        }

        document.getElementById("formSolicitacao")?.addEventListener("submit", salvarSolicitacao);
        document.getElementById("clienteSolicitacao")?.addEventListener("change", preencherProjetos);
        document.querySelector("#modalSolicitacao .close")?.addEventListener("click", fecharModal);
        document.querySelector("#modalSolicitacao .btn-secondary")?.addEventListener("click", fecharModal);
        document.querySelectorAll("#modalSolicitacao [onclick]").forEach(elemento => elemento.removeAttribute("onclick"));
        document.querySelector(".toolbar input")?.addEventListener("input", pesquisar);
        document.getElementById("listaSolicitacoes")?.addEventListener("click", tratarAcao);
        document.getElementById("modalSolicitacao")?.addEventListener("click", event => {
            if (event.target.id === "modalSolicitacao") fecharModal();
        });
    }

    function renderizar(lista = solicitacoes) {
        const corpo = document.getElementById("listaSolicitacoes");
        if (!corpo) return;

        if (!lista.length) {
            corpo.innerHTML = `<tr><td colspan="6" class="estado-vazio">Nenhuma solicitação cadastrada.</td></tr>`;
            return;
        }

        corpo.innerHTML = lista.map(item => `
            <tr>
                <td>${escapar(item.titulo)}</td>
                <td>${escapar(item.clientes?.nome || nomeCliente(item.cliente_id))}</td>
                <td>${escapar(item.projetos?.nome || nomeProjeto(item.projeto_id))}</td>
                <td><span class="status ${classeStatus(item.status)}">${escapar(item.status || "Aberta")}</span></td>
                <td>${escapar(formatarData(item.created_at))}</td>
                <td>
                    ${botao("abrir", item.id, "fa-eye", "Ver mensagem")}
                    ${usuarioAdministrador ? botao("editar", item.id, "fa-pen", "Editar solicitação") : ""}
                    ${usuarioAdministrador ? botao("excluir", item.id, "fa-trash", "Excluir solicitação", "delete") : ""}
                </td>
            </tr>
        `).join("");
    }

    function tratarAcao(event) {
        const alvo = event.target.closest("[data-acao-solicitacao]");
        if (!alvo) return;

        const { acaoSolicitacao: acao, id } = alvo.dataset;
        if (acao === "abrir") abrirMensagem(id);
        if (acao === "editar" && usuarioAdministrador) editarSolicitacao(id);
        if (acao === "excluir" && usuarioAdministrador) excluirSolicitacao(id);
    }

    function novaSolicitacao() {
        solicitacaoSelecionadaId = null;
        document.getElementById("formSolicitacao")?.reset();
        selecionarClienteUnico();
        preencherProjetos();
        atualizarModal("Nova Solicitação", "Enviar");
        abrirModal();
    }

    function editarSolicitacao(id) {
        const item = localizar(id);
        if (!item) return;

        solicitacaoSelecionadaId = item.id;
        preencher("tituloSolicitacao", item.titulo);
        preencher("clienteSolicitacao", item.cliente_id);
        preencherProjetos(item.projeto_id);
        preencher("statusSolicitacao", item.status);
        preencher("mensagemSolicitacao", item.mensagem);
        atualizarModal("Editar Solicitação", "Salvar Alterações");
        abrirModal();
    }

    async function salvarSolicitacao(event) {
        event.preventDefault();

        const dados = {
            titulo: valor("tituloSolicitacao"),
            cliente_id: valor("clienteSolicitacao") || null,
            projeto_id: valor("projetoSolicitacao") || null,
            status: valor("statusSolicitacao") || "Aberta",
            mensagem: valor("mensagemSolicitacao")
        };

        if (!dados.titulo || !dados.mensagem || !dados.cliente_id) {
            alert("Informe o título, a mensagem e o cliente.");
            return;
        }

        if (!projetoPertenceAoCliente(dados.projeto_id, dados.cliente_id)) {
            alert("O projeto selecionado não pertence a esse cliente.");
            return;
        }

        if (solicitacaoSelecionadaId && !usuarioAdministrador) {
            alert("Somente a administradora pode editar solicitações.");
            return;
        }

        const botaoSalvar = document.querySelector("#formSolicitacao button[type='submit']");
        alternarSalvamento(botaoSalvar, true);

        try {
            if (solicitacaoSelecionadaId) {
                await dbEditarSolicitacao(solicitacaoSelecionadaId, dados);
            }
            else {
                await dbCriarSolicitacao(dados);
            }

            const editando = Boolean(solicitacaoSelecionadaId);
            fecharModal();
            await recarregar();
            alert(editando ? "Solicitação atualizada com sucesso." : "Solicitação enviada com sucesso.");
        }
        catch (error) {
            tratarErro("Não foi possível salvar a solicitação.", error);
        }
        finally {
            alternarSalvamento(botaoSalvar, false);
        }
    }

    function abrirMensagem(id) {
        const item = localizar(id);
        if (!item) return;
        alert(`${item.titulo}\n\n${item.mensagem || "Sem mensagem."}`);
    }

    async function excluirSolicitacao(id) {
        const item = localizar(id);
        if (!item || !confirm(`Excluir a solicitação "${item.titulo}"?`)) return;

        try {
            await dbExcluirSolicitacao(item.id);
            await recarregar();
            alert("Solicitação excluída com sucesso.");
        }
        catch (error) {
            tratarErro("Não foi possível excluir a solicitação.", error);
        }
    }

    async function recarregar() {
        solicitacoes = await dbBuscarSolicitacoes();
        renderizar();
        atualizarResumo();
    }

    function atualizarResumo() {
        definirTexto("totalSolicitacoes", solicitacoes.length);
        definirTexto("abertas", solicitacoes.filter(item => normalizarStatus(item.status) === "aberta").length);
        definirTexto("andamento", solicitacoes.filter(item => normalizarStatus(item.status) === "em andamento").length);
        definirTexto("concluidas", solicitacoes.filter(item => normalizarStatus(item.status) === "concluida").length);
    }

    function pesquisar(event) {
        const termo = String(event?.target?.value || "").trim().toLocaleLowerCase("pt-BR");
        if (!termo) return renderizar();

        renderizar(solicitacoes.filter(item =>
            [item.titulo, item.mensagem, item.status, nomeCliente(item.cliente_id), nomeProjeto(item.projeto_id)]
                .some(campo => String(campo || "").toLocaleLowerCase("pt-BR").includes(termo))
        ));
    }

    function preencherSelect(id, itens) {
        const select = document.getElementById(id);
        if (!select) return;
        select.innerHTML = `<option value="">Selecione</option>` +
            itens.map(item => `<option value="${escapar(item.id)}">${escapar(item.nome)}</option>`).join("");
    }

    function selecionarClienteUnico() {
        if (clientes.length !== 1 || usuarioAdministrador) return;
        preencher("clienteSolicitacao", clientes[0].id);
        preencherProjetos();
    }

    function preencherProjetos(valorSelecionado = "") {
        const clienteId = valor("clienteSolicitacao");
        const lista = clienteId
            ? projetos.filter(projeto => String(projeto.cliente_id) === String(clienteId))
            : projetos;
        preencherSelect("projetoSolicitacao", lista);
        preencher("projetoSolicitacao", valorSelecionado);
    }

    function projetoPertenceAoCliente(projetoId, clienteId) {
        if (!projetoId) return true;
        return projetos.some(projeto =>
            String(projeto.id) === String(projetoId) &&
            String(projeto.cliente_id) === String(clienteId)
        );
    }

    function abrirModal() {
        document.getElementById("modalSolicitacao")?.classList.add("show");
    }

    function fecharModal() {
        document.getElementById("modalSolicitacao")?.classList.remove("show");
        document.getElementById("formSolicitacao")?.reset();
    }

    function atualizarModal(titulo, textoBotao) {
        const tituloModal = document.querySelector("#modalSolicitacao .modal-header h2");
        const botaoSalvar = document.querySelector("#formSolicitacao button[type='submit']");
        if (tituloModal) tituloModal.textContent = titulo;
        if (botaoSalvar) botaoSalvar.textContent = textoBotao;
    }

    function alternarSalvamento(botao, salvando) {
        if (!botao) return;
        botao.disabled = salvando;
        if (salvando) botao.textContent = "Salvando...";
        else botao.textContent = solicitacaoSelecionadaId ? "Salvar Alterações" : "Enviar";
    }

    function botao(acao, id, icone, titulo, classe = "") {
        return `
            <button type="button" class="btn-icon ${classe}" data-acao-solicitacao="${acao}"
                data-id="${escapar(id)}" title="${titulo}" aria-label="${titulo}">
                <i class="fa-solid ${icone}"></i>
            </button>
        `;
    }

    function localizar(id) {
        return solicitacoes.find(item => String(item.id) === String(id));
    }

    function nomeCliente(id) {
        return clientes.find(cliente => String(cliente.id) === String(id))?.nome || "Não informado";
    }

    function nomeProjeto(id) {
        return projetos.find(projeto => String(projeto.id) === String(id))?.nome || "Não informado";
    }

    function normalizarStatus(status) {
        return String(status || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLocaleLowerCase("pt-BR");
    }

    function classeStatus(status) {
        const normalizado = normalizarStatus(status);
        if (normalizado === "concluida") return "success";
        if (normalizado === "em andamento") return "warning";
        return "pending";
    }

    function formatarData(data) {
        if (!data) return "-";
        return new Date(data).toLocaleDateString("pt-BR");
    }

    function definirTexto(id, texto) {
        const elemento = document.getElementById(id);
        if (elemento) elemento.textContent = texto;
    }

    function valor(id) {
        return document.getElementById(id)?.value?.trim() || "";
    }

    function preencher(id, conteudo) {
        const campo = document.getElementById(id);
        if (campo) campo.value = conteudo || "";
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
