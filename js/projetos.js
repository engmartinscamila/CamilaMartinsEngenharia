/*
==========================================================
CAMILA MARTINS ENGENHARIA
PROJETOS.JS - CRUD ADMINISTRATIVO
==========================================================
*/

(function moduloProjetos() {
    "use strict";

    let projetos = [];
    let clientes = [];
    let projetoSelecionadoId = null;

    document.addEventListener("DOMContentLoaded", iniciar);

    async function iniciar() {
        configurarEventos();

        try {
            [projetos, clientes] = await Promise.all([
                dbBuscarProjetos(),
                dbBuscarClientes()
            ]);

            preencherClientes();
            renderizarProjetos();
        }
        catch (error) {
            tratarErro("Não foi possível carregar os projetos.", error);
        }
        finally {
            ocultarCarregamentoPagina();
        }
    }

    function configurarEventos() {
        document.getElementById("novoProjeto")?.addEventListener("click", novoProjeto);
        document.getElementById("fecharModalProjeto")?.addEventListener("click", fecharModal);
        document.getElementById("cancelarProjeto")?.addEventListener("click", fecharModal);
        document.getElementById("formProjeto")?.addEventListener("submit", salvarProjeto);
        document.getElementById("pesquisaProjeto")?.addEventListener("input", pesquisar);
        document.getElementById("btnPesquisarProjeto")?.addEventListener("click", pesquisar);
        document.getElementById("listaProjetos")?.addEventListener("click", tratarAcao);
        document.getElementById("detalhesProjeto")?.addEventListener("click", tratarAcao);
        document.getElementById("modalProjeto")?.addEventListener("click", event => {
            if (event.target.id === "modalProjeto") fecharModal();
        });
    }

    function preencherClientes() {
        const select = document.getElementById("projetoCliente");
        if (!select) return;

        select.innerHTML = `<option value="">Selecione o cliente</option>` +
            clientes.map(cliente => `
                <option value="${escapar(cliente.id)}">${escapar(cliente.nome)}</option>
            `).join("");
    }

    function renderizarProjetos(lista = projetos) {
        const container = document.getElementById("listaProjetos");
        if (!container) return;

        if (!lista.length) {
            container.innerHTML = `<div class="estado-vazio">Nenhum projeto cadastrado.</div>`;
            return;
        }

        container.innerHTML = lista.map(projeto => `
            <article class="item-lista projeto-item" data-id="${escapar(projeto.id)}">
                <div class="item-info">
                    <h3>${escapar(projeto.nome || "Projeto sem nome")}</h3>
                    <span>Cliente: ${escapar(nomeCliente(projeto))}</span>
                    <span class="badge ${classeStatus(projeto.status)}">${escapar(rotuloStatus(projeto.status))}</span>
                </div>
                <div class="item-acoes">
                    ${botao("abrir", projeto.id, "fa-eye", "Abrir detalhes")}
                    ${botao("editar", projeto.id, "fa-pen", "Editar projeto", "edit")}
                    ${botao("excluir", projeto.id, "fa-trash", "Excluir projeto", "delete")}
                </div>
            </article>
        `).join("");
    }

    function botao(acao, id, icone, titulo, classe = "") {
        return `
            <button type="button" class="btn-icon ${classe}" data-acao="${acao}"
                data-id="${escapar(id)}" title="${titulo}" aria-label="${titulo}">
                <i class="fa-solid ${icone}"></i>
            </button>
        `;
    }

    function tratarAcao(event) {
        const alvo = event.target.closest("[data-acao]");
        if (!alvo) return;

        const { acao, id } = alvo.dataset;
        if (acao === "abrir") abrirDetalhes(id);
        if (acao === "editar") editarProjeto(id);
        if (acao === "excluir") excluirProjeto(id);
    }

    function novoProjeto() {
        projetoSelecionadoId = null;
        document.getElementById("formProjeto")?.reset();
        atualizarModal("Cadastrar Projeto", "Salvar Projeto");
        abrirModal();
    }

    function editarProjeto(id) {
        const projeto = localizar(id);
        if (!projeto) return;

        projetoSelecionadoId = projeto.id;
        preencher("projetoNome", projeto.nome);
        preencher("projetoCliente", projeto.cliente_id);
        preencher("projetoTipo", projeto.tipo);
        preencher("projetoStatus", projeto.status);
        preencher("projetoNumeroContrato", projeto.numero_contrato);
        preencher("projetoNumeroOrcamento", projeto.numero_orcamento);
        preencher("projetoDescricao", projeto.descricao);
        preencher("projetoDataInicio", projeto.data_inicio);
        preencher("projetoDataFim", projeto.data_fim);
        atualizarModal("Editar Projeto", "Salvar Alterações");
        abrirModal();
    }

    async function salvarProjeto(event) {
        event.preventDefault();

        const dados = {
            nome: valor("projetoNome"),
            cliente_id: valor("projetoCliente") || null,
            tipo: valor("projetoTipo"),
            status: valor("projetoStatus"),
            numero_contrato: valor("projetoNumeroContrato") || null,
            numero_orcamento: valor("projetoNumeroOrcamento") || null,
            descricao: valor("projetoDescricao"),
            data_inicio: valor("projetoDataInicio") || null,
            data_fim: valor("projetoDataFim") || null
        };

        if (!dados.nome || !dados.cliente_id) {
            alert("Informe o nome e selecione o cliente.");
            return;
        }

        const botaoSalvar = document.getElementById("salvarProjeto");
        alternarSalvamento(botaoSalvar, true);

        try {
            const editando = Boolean(projetoSelecionadoId);

            if (editando) {
                await dbEditarProjeto(projetoSelecionadoId, dados);
            }
            else {
                await dbCriarProjeto(dados);
            }

            const notificacao = await dbNotificarAtualizacao({
                tipo: editando ? "projeto_atualizado" : "projeto_criado",
                cliente_id: dados.cliente_id,
                projeto_id: projetoSelecionadoId || null,
                titulo: dados.nome,
                mensagem: editando
                    ? "As informações do seu projeto foram atualizadas."
                    : "Seu projeto foi cadastrado e já pode ser acompanhado no portal."
            });
            fecharModal();
            await recarregar();
            alert(
                `${editando ? "Projeto atualizado" : "Projeto cadastrado"} com sucesso.` +
                (notificacao.enviado
                    ? "\nO cliente também recebeu um aviso por e-mail."
                    : "\nO registro foi salvo, mas o aviso por e-mail ainda não está configurado.")
            );
        }
        catch (error) {
            tratarErro("Não foi possível salvar o projeto.", error);
        }
        finally {
            alternarSalvamento(botaoSalvar, false);
        }
    }

    async function excluirProjeto(id) {
        const projeto = localizar(id);
        if (!projeto || !confirm(`Excluir o projeto "${projeto.nome}"?`)) return;

        try {
            await dbExcluirProjeto(projeto.id);
            if (projetoSelecionadoId === projeto.id) limparDetalhes();
            await recarregar();
            alert("Projeto excluído com sucesso.");
        }
        catch (error) {
            const mensagem = error?.code === "23503"
                ? "O projeto possui registros vinculados. Exclua primeiro documentos, fotos, agenda, cronograma ou lançamentos relacionados."
                : "Não foi possível excluir o projeto.";
            tratarErro(mensagem, error);
        }
    }

    async function abrirDetalhes(id) {
        const projeto = localizar(id);
        const detalhes = document.getElementById("detalhesProjeto");
        if (!projeto || !detalhes) return;

        projetoSelecionadoId = projeto.id;
        detalhes.innerHTML = `
            <h3>${escapar(projeto.nome)}</h3>
            <p><strong>Cliente:</strong> ${escapar(nomeCliente(projeto))}</p>
            <p><strong>Tipo:</strong> ${escapar(projeto.tipo || "-")}</p>
            <p><strong>Status:</strong> ${escapar(rotuloStatus(projeto.status))}</p>
            <p><strong>Número do contrato:</strong> ${escapar(projeto.numero_contrato || "Não informado")}</p>
            <p><strong>Número do orçamento:</strong> ${escapar(projeto.numero_orcamento || "Não informado")}</p>
            <p><strong>Período:</strong> ${escapar(formatarData(projeto.data_inicio))} a ${escapar(formatarData(projeto.data_fim))}</p>
            <p>${escapar(projeto.descricao || "Sem descrição.")}</p>
            <div class="detalhes-acoes">
                ${botao("editar", projeto.id, "fa-pen", "Editar projeto", "edit")}
                ${botao("excluir", projeto.id, "fa-trash", "Excluir projeto", "delete")}
            </div>
        `;

        const documentos = document.getElementById("documentosProjeto");
        const fotos = document.getElementById("fotosProjeto");
        if (documentos) documentos.innerHTML = `<div class="estado-vazio">Carregando documentos...</div>`;
        if (fotos) fotos.innerHTML = `<div class="estado-vazio">Carregando fotos...</div>`;

        const [docsResultado, fotosResultado] = await Promise.allSettled([
            dbBuscarDocumentosProjeto(projeto.id),
            dbBuscarFotosProjeto(projeto.id)
        ]);

        if (documentos) {
            const docs = docsResultado.status === "fulfilled" ? docsResultado.value : [];
            documentos.innerHTML = docs.length
                ? docs.map(doc => `
                    <div class="item-lista">
                        <span>${escapar(doc.nome)}</span>
                        <div class="item-acoes">
                            ${doc.url ? `<a class="btn-icon" href="${escapar(doc.url)}" target="_blank" rel="noopener" title="Visualizar documento"><i class="fa-solid fa-eye"></i></a>` : ""}
                            <a class="btn-icon edit" href="documentos.html?documento=${encodeURIComponent(doc.id)}&acao=editar" title="Alterar documento"><i class="fa-solid fa-pen"></i></a>
                        </div>
                    </div>
                `).join("")
                : `<div class="estado-vazio">Nenhum documento vinculado.</div>`;
        }

        if (fotos) {
            const listaFotos = fotosResultado.status === "fulfilled" ? fotosResultado.value : [];
            fotos.innerHTML = listaFotos.length
                ? listaFotos.map(foto => foto.url
                    ? `<a href="${escapar(foto.url)}" target="_blank" rel="noopener"><img src="${escapar(foto.url)}" alt="${escapar(foto.nome)}"></a>`
                    : `<span>${escapar(foto.nome)}</span>`
                ).join("")
                : `<div class="estado-vazio">Nenhuma foto vinculada.</div>`;
        }
    }

    async function recarregar() {
        projetos = await dbBuscarProjetos();
        renderizarProjetos();
    }

    function pesquisar() {
        const termo = valor("pesquisaProjeto").toLocaleLowerCase("pt-BR");
        if (!termo) return renderizarProjetos();

        renderizarProjetos(projetos.filter(projeto =>
            [
                projeto.nome,
                projeto.tipo,
                projeto.status,
                projeto.numero_contrato,
                projeto.numero_orcamento,
                nomeCliente(projeto)
            ]
                .some(campo => String(campo || "").toLocaleLowerCase("pt-BR").includes(termo))
        ));
    }

    function abrirModal() {
        const modal = document.getElementById("modalProjeto");
        if (!modal) return;
        modal.style.display = "flex";
        modal.classList.add("show");
    }

    function fecharModal() {
        const modal = document.getElementById("modalProjeto");
        modal?.classList.remove("show");
        if (modal) modal.style.display = "none";
        document.getElementById("formProjeto")?.reset();
    }

    function atualizarModal(titulo, textoBotao) {
        const tituloModal = document.querySelector("#modalProjeto .modal-header h2");
        const botaoSalvar = document.getElementById("salvarProjeto");
        if (tituloModal) tituloModal.textContent = titulo;
        if (botaoSalvar) botaoSalvar.textContent = textoBotao;
    }

    function alternarSalvamento(botao, salvando) {
        if (!botao) return;
        botao.disabled = salvando;
        if (salvando) botao.textContent = "Salvando...";
        else botao.textContent = projetoSelecionadoId ? "Salvar Alterações" : "Salvar Projeto";
    }

    function limparDetalhes() {
        projetoSelecionadoId = null;
        const detalhes = document.getElementById("detalhesProjeto");
        const documentos = document.getElementById("documentosProjeto");
        const fotos = document.getElementById("fotosProjeto");
        if (detalhes) detalhes.innerHTML = "<p>Selecione um projeto para visualizar os detalhes.</p>";
        if (documentos) documentos.innerHTML = "";
        if (fotos) fotos.innerHTML = "";
    }

    function localizar(id) {
        return projetos.find(projeto => String(projeto.id) === String(id));
    }

    function nomeCliente(projeto) {
        return projeto.clientes?.nome ||
            clientes.find(cliente => String(cliente.id) === String(projeto.cliente_id))?.nome ||
            "Não informado";
    }

    function valor(id) {
        return document.getElementById(id)?.value?.trim() || "";
    }

    function preencher(id, conteudo) {
        const campo = document.getElementById(id);
        if (campo) campo.value = conteudo || "";
    }

    function classeStatus(status) {
        return status === "em_andamento" ? "andamento" :
            status === "orcamento" ? "orcamento" :
            status === "concluido" ? "finalizado" :
            status === "cancelado" ? "pausado" : "";
    }

    function rotuloStatus(status) {
        return {
            orcamento: "Orçamento",
            em_andamento: "Em andamento",
            concluido: "Concluído",
            cancelado: "Cancelado"
        }[status] || status || "Não informado";
    }

    function formatarData(data) {
        if (!data) return "não informada";
        return new Date(`${data}T12:00:00`).toLocaleDateString("pt-BR");
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
