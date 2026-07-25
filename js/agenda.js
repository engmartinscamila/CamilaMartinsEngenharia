/*
==========================================================
CAMILA MARTINS ENGENHARIA
AGENDA.JS - CRUD ADMINISTRATIVO
==========================================================
*/

(function moduloAgenda() {
    "use strict";

    let eventos = [];
    let clientes = [];
    let projetos = [];
    let eventoSelecionadoId = null;

    document.addEventListener("DOMContentLoaded", iniciar);

    async function iniciar() {
        configurarEventos();

        try {
            [eventos, clientes, projetos] = await Promise.all([
                dbBuscarAgenda(),
                dbBuscarClientes(),
                dbBuscarProjetos()
            ]);

            preencherSelect("eventoCliente", clientes);
            preencherProjetos();
            renderizar();
        }
        catch (error) {
            tratarErro("Não foi possível carregar a agenda.", error);
        }
        finally {
            ocultarCarregamentoPagina();
        }
    }

    function configurarEventos() {
        document.getElementById("novoEvento")?.addEventListener("click", novoEvento);
        document.getElementById("fecharModalEvento")?.addEventListener("click", fecharModal);
        document.getElementById("cancelarEvento")?.addEventListener("click", fecharModal);
        document.getElementById("formEvento")?.addEventListener("submit", salvarEvento);
        document.getElementById("eventoCliente")?.addEventListener("change", preencherProjetos);
        document.getElementById("pesquisaAgenda")?.addEventListener("input", pesquisar);
        document.getElementById("btnPesquisarAgenda")?.addEventListener("click", pesquisar);
        document.getElementById("listaAgenda")?.addEventListener("click", tratarAcao);
        document.getElementById("detalhesAgenda")?.addEventListener("click", tratarAcao);
        document.getElementById("modalEvento")?.addEventListener("click", event => {
            if (event.target.id === "modalEvento") fecharModal();
        });
    }

    function renderizar(lista = eventos) {
        const container = document.getElementById("listaAgenda");
        if (!container) return;

        if (!lista.length) {
            container.innerHTML = `<div class="estado-vazio">Nenhum evento cadastrado.</div>`;
            return;
        }

        container.innerHTML = lista.map(evento => `
            <article class="item-lista evento-item">
                <div class="item-info">
                    <h3>${escapar(evento.titulo)}</h3>
                    <span>${escapar(formatarData(evento.data))} ${escapar(evento.horario || "")}</span>
                    <span>${escapar(rotuloTipo(evento.tipo))}</span>
                </div>
                <div class="item-acoes">
                    ${botao("abrir", evento.id, "fa-eye", "Abrir detalhes")}
                    ${botao("editar", evento.id, "fa-pen", "Editar evento", "edit")}
                    ${botao("excluir", evento.id, "fa-trash", "Excluir evento", "delete")}
                </div>
            </article>
        `).join("");
    }

    function tratarAcao(event) {
        const alvo = event.target.closest("[data-acao-agenda]");
        if (!alvo) return;

        const { acaoAgenda: acao, id } = alvo.dataset;
        if (acao === "abrir") mostrarDetalhes(id);
        if (acao === "editar") editarEvento(id);
        if (acao === "excluir") excluirEvento(id);
    }

    function novoEvento() {
        eventoSelecionadoId = null;
        document.getElementById("formEvento")?.reset();
        preencherProjetos();
        preencher("eventoData", new Date().toISOString().slice(0, 10));
        atualizarModal("Novo Evento", "Salvar Evento");
        abrirModal();
    }

    function editarEvento(id) {
        const evento = localizar(id);
        if (!evento) return;

        eventoSelecionadoId = evento.id;
        preencher("eventoTitulo", evento.titulo);
        preencher("eventoTipo", evento.tipo);
        preencher("eventoData", evento.data);
        preencher("eventoHorario", evento.horario);
        preencher("eventoCliente", evento.cliente_id);
        preencherProjetos(evento.projeto_id);
        preencher("eventoDescricao", evento.descricao);
        atualizarModal("Editar Evento", "Salvar Alterações");
        abrirModal();
    }

    async function salvarEvento(event) {
        event.preventDefault();

        const dados = {
            titulo: valor("eventoTitulo"),
            tipo: valor("eventoTipo"),
            data: valor("eventoData") || null,
            horario: valor("eventoHorario") || null,
            cliente_id: valor("eventoCliente") || null,
            projeto_id: valor("eventoProjeto") || null,
            descricao: valor("eventoDescricao")
        };

        if (!dados.titulo || !dados.data) {
            alert("Informe o título e a data do evento.");
            return;
        }

        if (!projetoPertenceAoCliente(dados.projeto_id, dados.cliente_id)) {
            alert("O projeto selecionado não pertence a esse cliente.");
            return;
        }

        const botaoSalvar = document.getElementById("salvarEvento");
        alternarSalvamento(botaoSalvar, true);

        try {
            if (eventoSelecionadoId) {
                await dbEditarEventoAgenda(eventoSelecionadoId, dados);
            }
            else {
                await dbCriarEventoAgenda(dados);
            }

            const editando = Boolean(eventoSelecionadoId);
            const notificacao = dados.cliente_id ? await dbNotificarAtualizacao({
                tipo: editando ? "agenda_atualizada" : "agenda_criada",
                cliente_id: dados.cliente_id,
                projeto_id: dados.projeto_id,
                titulo: dados.titulo,
                mensagem: `${editando ? "Compromisso atualizado" : "Novo compromisso"} para ${formatarData(dados.data)}${dados.horario ? ` às ${dados.horario}` : ""}.`
            }) : { enviado: false };
            fecharModal();
            await recarregar();
            alert((editando ? "Evento atualizado com sucesso." : "Evento cadastrado com sucesso.") +
                (notificacao.enviado ? "\nO cliente recebeu um aviso por e-mail." : ""));
        }
        catch (error) {
            tratarErro("Não foi possível salvar o evento.", error);
        }
        finally {
            alternarSalvamento(botaoSalvar, false);
        }
    }

    function mostrarDetalhes(id) {
        const evento = localizar(id);
        const painel = document.getElementById("detalhesAgenda");
        if (!evento || !painel) return;

        eventoSelecionadoId = evento.id;
        painel.innerHTML = `
            <h3>${escapar(evento.titulo)}</h3>
            <p><strong>Tipo:</strong> ${escapar(rotuloTipo(evento.tipo))}</p>
            <p><strong>Data:</strong> ${escapar(formatarData(evento.data))} ${escapar(evento.horario || "")}</p>
            <p><strong>Cliente:</strong> ${escapar(nomeCliente(evento.cliente_id))}</p>
            <p><strong>Projeto:</strong> ${escapar(nomeProjeto(evento.projeto_id))}</p>
            <p>${escapar(evento.descricao || "Sem descrição.")}</p>
            <div class="detalhes-acoes">
                ${botao("editar", evento.id, "fa-pen", "Editar evento", "edit")}
                ${botao("excluir", evento.id, "fa-trash", "Excluir evento", "delete")}
            </div>
        `;
    }

    async function excluirEvento(id) {
        const evento = localizar(id);
        if (!evento || !confirm(`Excluir o evento "${evento.titulo}"?`)) return;

        try {
            await dbExcluirEventoAgenda(evento.id);
            limparDetalhes();
            await recarregar();
            alert("Evento excluído com sucesso.");
        }
        catch (error) {
            tratarErro("Não foi possível excluir o evento.", error);
        }
    }

    async function recarregar() {
        eventos = await dbBuscarAgenda();
        renderizar();
    }

    function pesquisar() {
        const termo = valor("pesquisaAgenda").toLocaleLowerCase("pt-BR");
        if (!termo) return renderizar();

        renderizar(eventos.filter(evento =>
            [evento.titulo, evento.tipo, evento.descricao, nomeCliente(evento.cliente_id), nomeProjeto(evento.projeto_id)]
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
        const clienteId = valor("eventoCliente");
        const lista = clienteId
            ? projetos.filter(projeto => String(projeto.cliente_id) === String(clienteId))
            : projetos;
        preencherSelect("eventoProjeto", lista);
        preencher("eventoProjeto", valorSelecionado);
    }

    function projetoPertenceAoCliente(projetoId, clienteId) {
        if (!projetoId) return true;
        if (!clienteId) return false;
        return projetos.some(projeto =>
            String(projeto.id) === String(projetoId) &&
            String(projeto.cliente_id) === String(clienteId)
        );
    }

    function abrirModal() {
        const modal = document.getElementById("modalEvento");
        if (!modal) return;
        modal.style.display = "flex";
        modal.classList.add("show");
    }

    function fecharModal() {
        const modal = document.getElementById("modalEvento");
        modal?.classList.remove("show");
        if (modal) modal.style.display = "none";
        document.getElementById("formEvento")?.reset();
    }

    function atualizarModal(titulo, textoBotao) {
        const tituloModal = document.querySelector("#modalEvento .modal-header h2");
        const botaoSalvar = document.getElementById("salvarEvento");
        if (tituloModal) tituloModal.textContent = titulo;
        if (botaoSalvar) botaoSalvar.textContent = textoBotao;
    }

    function alternarSalvamento(botao, salvando) {
        if (!botao) return;
        botao.disabled = salvando;
        if (salvando) botao.textContent = "Salvando...";
        else botao.textContent = eventoSelecionadoId ? "Salvar Alterações" : "Salvar Evento";
    }

    function limparDetalhes() {
        eventoSelecionadoId = null;
        const painel = document.getElementById("detalhesAgenda");
        if (painel) painel.innerHTML = "<p>Selecione um evento para visualizar os detalhes.</p>";
    }

    function botao(acao, id, icone, titulo, classe = "") {
        return `
            <button type="button" class="btn-icon ${classe}" data-acao-agenda="${acao}"
                data-id="${escapar(id)}" title="${titulo}" aria-label="${titulo}">
                <i class="fa-solid ${icone}"></i>
            </button>
        `;
    }

    function localizar(id) {
        return eventos.find(evento => String(evento.id) === String(id));
    }

    function nomeCliente(id) {
        return clientes.find(cliente => String(cliente.id) === String(id))?.nome || "Não informado";
    }

    function nomeProjeto(id) {
        return projetos.find(projeto => String(projeto.id) === String(id))?.nome || "Não informado";
    }

    function rotuloTipo(tipo) {
        return {
            reuniao: "Reunião",
            visita: "Visita técnica",
            prazo: "Prazo",
            outro: "Outro"
        }[tipo] || tipo || "Não informado";
    }

    function formatarData(data) {
        if (!data) return "Não informada";
        return new Date(`${data}T12:00:00`).toLocaleDateString("pt-BR");
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
