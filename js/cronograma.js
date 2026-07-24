/*
=====================================================
CAMILA MARTINS ENGENHARIA
CRONOGRAMA.JS - CRUD ADMINISTRATIVO
=====================================================
*/

(function moduloCronograma() {
    "use strict";

    let etapas = [];
    let clientes = [];
    let projetos = [];
    let etapaSelecionadaId = null;

    document.addEventListener("DOMContentLoaded", iniciar);

    async function iniciar() {
        configurarEventos();

        try {
            [etapas, clientes, projetos] = await Promise.all([
                dbBuscarCronograma(),
                dbBuscarClientes(),
                dbBuscarProjetos()
            ]);

            preencherSelect("clienteCronograma", clientes);
            preencherProjetos();
            renderizar();
            atualizarResumo();
        }
        catch (error) {
            tratarErro("Não foi possível carregar o cronograma.", error);
        }
        finally {
            ocultarCarregamentoPagina();
        }
    }

    function configurarEventos() {
        const botaoNovo = document.getElementById("novaEtapa");
        if (botaoNovo) {
            botaoNovo.removeAttribute("onclick");
            botaoNovo.addEventListener("click", novaEtapa);
        }

        document.getElementById("formCronograma")?.addEventListener("submit", salvarEtapa);
        document.getElementById("clienteCronograma")?.addEventListener("change", preencherProjetos);
        document.getElementById("pesquisaCronograma")?.addEventListener("input", pesquisar);
        document.getElementById("listaCronograma")?.addEventListener("click", tratarAcao);

        document.querySelectorAll("#modalCronograma .close, #modalCronograma .btn-secondary")
            .forEach(botao => {
                botao.removeAttribute("onclick");
                botao.addEventListener("click", fecharModal);
            });

        document.getElementById("modalCronograma")?.addEventListener("click", event => {
            if (event.target.id === "modalCronograma") fecharModal();
        });
    }

    function renderizar(lista = etapas) {
        const corpo = document.getElementById("listaCronograma");
        if (!corpo) return;

        if (!lista.length) {
            corpo.innerHTML = `<tr><td colspan="7" class="estado-vazio">Nenhuma etapa cadastrada.</td></tr>`;
            return;
        }

        corpo.innerHTML = lista.map(etapa => `
            <tr>
                <td>${escapar(etapa.nome)}</td>
                <td>${escapar(nomeCliente(etapa.cliente_id))}</td>
                <td>${escapar(nomeProjeto(etapa.projeto_id))}</td>
                <td>${escapar(formatarData(etapa.data_inicio))}</td>
                <td>${escapar(formatarData(etapa.data_fim))}</td>
                <td><span class="status ${classeStatus(etapa.status)}">${escapar(etapa.status || "Pendente")}</span></td>
                <td>
                    ${botao("editar", etapa.id, "fa-pen", "Editar etapa")}
                    ${botao("excluir", etapa.id, "fa-trash", "Excluir etapa", "delete")}
                </td>
            </tr>
        `).join("");
    }

    function tratarAcao(event) {
        const alvo = event.target.closest("[data-acao-cronograma]");
        if (!alvo) return;

        const { acaoCronograma: acao, id } = alvo.dataset;
        if (acao === "editar") editarEtapa(id);
        if (acao === "excluir") excluirEtapa(id);
    }

    function novaEtapa() {
        etapaSelecionadaId = null;
        document.getElementById("formCronograma")?.reset();
        preencherProjetos();
        atualizarModal("Nova Etapa", "Salvar");
        abrirModal();
    }

    function editarEtapa(id) {
        const etapa = localizar(id);
        if (!etapa) return;

        etapaSelecionadaId = etapa.id;
        preencher("nomeEtapa", etapa.nome);
        preencher("clienteCronograma", etapa.cliente_id);
        preencherProjetos(etapa.projeto_id);
        preencher("inicioEtapa", etapa.data_inicio);
        preencher("fimEtapa", etapa.data_fim);
        preencher("statusEtapa", etapa.status);
        preencher("descricaoEtapa", etapa.descricao);
        atualizarModal("Editar Etapa", "Salvar Alterações");
        abrirModal();
    }

    async function salvarEtapa(event) {
        event.preventDefault();

        const dados = {
            nome: valor("nomeEtapa"),
            cliente_id: valor("clienteCronograma") || null,
            projeto_id: valor("projetoCronograma") || null,
            data_inicio: valor("inicioEtapa") || null,
            data_fim: valor("fimEtapa") || null,
            status: valor("statusEtapa") || "Pendente",
            descricao: valor("descricaoEtapa")
        };

        if (!dados.nome || !dados.cliente_id || !dados.projeto_id) {
            alert("Informe a etapa, o cliente e o projeto.");
            return;
        }

        if (!projetoPertenceAoCliente(dados.projeto_id, dados.cliente_id)) {
            alert("O projeto selecionado não pertence a esse cliente.");
            return;
        }

        if (dados.data_inicio && dados.data_fim && dados.data_fim < dados.data_inicio) {
            alert("A data final não pode ser anterior à data inicial.");
            return;
        }

        const botaoSalvar = document.querySelector("#formCronograma button[type='submit']");
        alternarSalvamento(botaoSalvar, true);

        try {
            const editando = Boolean(etapaSelecionadaId);

            if (editando) {
                await dbEditarEtapaCronograma(etapaSelecionadaId, dados);
            }
            else {
                await dbCriarEtapaCronograma(dados);
            }

            const notificacao = await dbNotificarAtualizacao({
                tipo: editando ? "cronograma_atualizado" : "cronograma_publicado",
                cliente_id: dados.cliente_id,
                projeto_id: dados.projeto_id,
                titulo: dados.nome,
                mensagem: editando
                    ? "Uma etapa do cronograma do seu projeto foi atualizada."
                    : "Uma nova etapa foi incluída no cronograma do seu projeto."
            });
            fecharModal();
            await recarregar();
            alert(
                `${editando ? "Etapa atualizada" : "Etapa cadastrada"} com sucesso.` +
                (notificacao.enviado
                    ? "\nO cliente também recebeu um aviso por e-mail."
                    : "\nO registro foi salvo, mas o aviso por e-mail ainda não está configurado.")
            );
        }
        catch (error) {
            tratarErro("Não foi possível salvar a etapa.", error);
        }
        finally {
            alternarSalvamento(botaoSalvar, false);
        }
    }

    async function excluirEtapa(id) {
        const etapa = localizar(id);
        if (!etapa || !confirm(`Excluir a etapa "${etapa.nome}"?`)) return;

        try {
            await dbExcluirEtapaCronograma(etapa.id);
            await recarregar();
            alert("Etapa excluída com sucesso.");
        }
        catch (error) {
            tratarErro("Não foi possível excluir a etapa.", error);
        }
    }

    async function recarregar() {
        etapas = await dbBuscarCronograma();
        renderizar();
        atualizarResumo();
    }

    function atualizarResumo() {
        const total = etapas.length;
        const pendentes = etapas.filter(item => normalizarStatus(item.status) === "pendente").length;
        const andamento = etapas.filter(item => normalizarStatus(item.status) === "em andamento").length;
        const concluidas = etapas.filter(item => normalizarStatus(item.status) === "concluido").length;
        const percentual = total ? Math.round((concluidas / total) * 100) : 0;

        definirTexto("totalEtapas", total);
        definirTexto("pendentes", pendentes);
        definirTexto("andamento", andamento);
        definirTexto("concluidas", concluidas);
        definirTexto("percentualObra", `${percentual}%`);

        const barra = document.getElementById("barraProgresso");
        if (barra) barra.style.width = `${percentual}%`;
    }

    function pesquisar() {
        const termo = valor("pesquisaCronograma").toLocaleLowerCase("pt-BR");
        if (!termo) return renderizar();

        renderizar(etapas.filter(etapa =>
            [etapa.nome, etapa.status, etapa.descricao, nomeCliente(etapa.cliente_id), nomeProjeto(etapa.projeto_id)]
                .some(campo => String(campo || "").toLocaleLowerCase("pt-BR").includes(termo))
        ));
    }

    function preencherSelect(id, itens) {
        const select = document.getElementById(id);
        if (!select) return;
        select.innerHTML = `<option value="">Selecione</option>` +
            itens.map(item => `<option value="${escapar(item.id)}">${escapar(item.nome)}</option>`).join("");
    }

    function preencherProjetos(valorSelecionado = "") {
        const clienteId = valor("clienteCronograma");
        const lista = clienteId
            ? projetos.filter(projeto => String(projeto.cliente_id) === String(clienteId))
            : projetos;
        preencherSelect("projetoCronograma", lista);
        preencher("projetoCronograma", valorSelecionado);
    }

    function projetoPertenceAoCliente(projetoId, clienteId) {
        return projetos.some(projeto =>
            String(projeto.id) === String(projetoId) &&
            String(projeto.cliente_id) === String(clienteId)
        );
    }

    function abrirModal() {
        document.getElementById("modalCronograma")?.classList.add("show");
    }

    function fecharModal() {
        document.getElementById("modalCronograma")?.classList.remove("show");
        document.getElementById("formCronograma")?.reset();
    }

    function atualizarModal(titulo, textoBotao) {
        const tituloModal = document.querySelector("#modalCronograma .modal-header h2");
        const botaoSalvar = document.querySelector("#formCronograma button[type='submit']");
        if (tituloModal) tituloModal.textContent = titulo;
        if (botaoSalvar) botaoSalvar.textContent = textoBotao;
    }

    function alternarSalvamento(botao, salvando) {
        if (!botao) return;
        botao.disabled = salvando;
        if (salvando) botao.textContent = "Salvando...";
        else botao.textContent = etapaSelecionadaId ? "Salvar Alterações" : "Salvar";
    }

    function botao(acao, id, icone, titulo, classe = "") {
        return `
            <button type="button" class="btn-icon ${classe}" data-acao-cronograma="${acao}"
                data-id="${escapar(id)}" title="${titulo}" aria-label="${titulo}">
                <i class="fa-solid ${icone}"></i>
            </button>
        `;
    }

    function localizar(id) {
        return etapas.find(etapa => String(etapa.id) === String(id));
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
        if (normalizado === "concluido") return "success";
        if (normalizado === "em andamento") return "warning";
        return "pending";
    }

    function formatarData(data) {
        if (!data) return "-";
        return new Date(`${data}T12:00:00`).toLocaleDateString("pt-BR");
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
