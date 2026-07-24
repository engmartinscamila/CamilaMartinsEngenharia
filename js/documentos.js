/*
=====================================================
CAMILA MARTINS ENGENHARIA
DOCUMENTOS.JS - CRUD ADMINISTRATIVO
=====================================================
*/

(function moduloDocumentos() {
    "use strict";

    let documentos = [];
    let clientes = [];
    let projetos = [];
    let documentoSelecionadoId = null;

    document.addEventListener("DOMContentLoaded", iniciar);

    async function iniciar() {
        configurarEventos();
        mostrarLoading(true);

        try {
            [documentos, clientes, projetos] = await Promise.all([
                dbBuscarDocumentos(),
                dbBuscarClientes(),
                dbBuscarProjetos()
            ]);

            preencherSelect("documentoCliente", clientes);
            preencherProjetos();
            renderizar();
        }
        catch (error) {
            tratarErro("Não foi possível carregar os documentos.", error);
        }
        finally {
            mostrarLoading(false);
        }
    }

    function configurarEventos() {
        document.getElementById("novoDocumento")?.addEventListener("click", novoDocumento);
        document.getElementById("fecharModalDocumento")?.addEventListener("click", fecharModal);
        document.getElementById("cancelarDocumento")?.addEventListener("click", fecharModal);
        document.getElementById("formDocumento")?.addEventListener("submit", salvarDocumento);
        document.getElementById("documentoCliente")?.addEventListener("change", preencherProjetos);
        document.getElementById("pesquisaDocumento")?.addEventListener("input", pesquisar);
        document.getElementById("btnPesquisarDocumento")?.addEventListener("click", pesquisar);
        document.getElementById("listaDocumentos")?.addEventListener("click", tratarAcao);
        document.getElementById("detalhesDocumento")?.addEventListener("click", tratarAcao);
        document.getElementById("modalDocumento")?.addEventListener("click", event => {
            if (event.target.id === "modalDocumento") fecharModal();
        });
    }

    function renderizar(lista = documentos) {
        const container = document.getElementById("listaDocumentos");
        const recentes = document.getElementById("arquivosDocumento");
        if (!container) return;

        if (!lista.length) {
            container.innerHTML = `<div class="estado-vazio">Nenhum documento cadastrado.</div>`;
            if (recentes) recentes.innerHTML = `<div class="estado-vazio">Nenhum arquivo recente.</div>`;
            return;
        }

        container.innerHTML = lista.map(documento => `
            <article class="item-lista documento-item">
                <div class="item-info">
                    <h3>${escapar(documento.nome)}</h3>
                    <span>${escapar(documento.tipo || "Sem categoria")}</span>
                    <span>${escapar(nomeCliente(documento.cliente_id))}</span>
                </div>
                <div class="item-acoes">
                    ${botao("abrir", documento.id, "fa-eye", "Abrir detalhes")}
                    ${botao("editar", documento.id, "fa-pen", "Editar documento", "edit")}
                    ${botao("excluir", documento.id, "fa-trash", "Excluir documento", "delete")}
                </div>
            </article>
        `).join("");

        if (recentes) {
            recentes.innerHTML = lista.slice(0, 5).map(documento => `
                <div class="item-lista">
                    <span>${escapar(documento.nome)}</span>
                    ${documento.url
                        ? `<a href="${escapar(documento.url)}" target="_blank" rel="noopener">Abrir</a>`
                        : `<span class="arquivo-indisponivel">
                            Arquivo indisponível${documento.urlErro ? `: ${escapar(documento.urlErro)}` : ""}
                        </span>`}
                </div>
            `).join("");
        }
    }

    function tratarAcao(event) {
        const alvo = event.target.closest("[data-acao-documento]");
        if (!alvo) return;

        const { acaoDocumento: acao, id } = alvo.dataset;
        if (acao === "abrir") mostrarDetalhes(id);
        if (acao === "editar") editarDocumento(id);
        if (acao === "excluir") excluirDocumento(id);
    }

    function novoDocumento() {
        documentoSelecionadoId = null;
        document.getElementById("formDocumento")?.reset();
        preencherProjetos();
        atualizarModal("Cadastrar Documento", "Salvar Documento", true);
        abrirModal();
    }

    function editarDocumento(id) {
        const documento = localizar(id);
        if (!documento) return;

        documentoSelecionadoId = documento.id;
        preencher("documentoNome", documento.nome);
        preencher("documentoCliente", documento.cliente_id);
        preencherProjetos(documento.projeto_id);
        preencher("documentoCategoria", documento.tipo);
        preencher("documentoDescricao", documento.descricao);
        atualizarModal("Editar Documento", "Salvar Alterações", false);
        abrirModal();
    }

    async function salvarDocumento(event) {
        event.preventDefault();

        const dados = {
            nome: valor("documentoNome"),
            tipo: valor("documentoCategoria"),
            cliente_id: valor("documentoCliente") || null,
            projeto_id: valor("documentoProjeto") || null,
            descricao: valor("documentoDescricao")
        };

        const arquivo = document.getElementById("documentoArquivo")?.files?.[0];
        const anterior = localizar(documentoSelecionadoId);

        if (!dados.nome || !dados.cliente_id) {
            alert("Informe o nome e selecione o cliente.");
            return;
        }

        if (!documentoSelecionadoId && !arquivo) {
            alert("Selecione o arquivo do documento.");
            return;
        }

        if (!projetoPertenceAoCliente(dados.projeto_id, dados.cliente_id)) {
            alert("O projeto selecionado não pertence a esse cliente.");
            return;
        }

        const botaoSalvar = document.getElementById("salvarDocumento");
        alternarSalvamento(botaoSalvar, true);
        let novoCaminho = anterior?.arquivo || null;

        try {
            if (arquivo) {
                novoCaminho = `${dados.cliente_id}/${Date.now()}-${normalizarNome(arquivo.name)}`;
                await dbUploadArquivo(BUCKETS.DOCUMENTOS, novoCaminho, arquivo);
            }

            dados.arquivo = novoCaminho;

            if (documentoSelecionadoId) {
                await dbEditarDocumento(documentoSelecionadoId, dados);
            }
            else {
                await dbCriarDocumento(dados);
            }

            if (arquivo && anterior?.arquivo && anterior.arquivo !== novoCaminho) {
                await dbExcluirArquivoStorage(BUCKETS.DOCUMENTOS, anterior.arquivo).catch(() => {});
            }

            const editando = Boolean(documentoSelecionadoId);
            fecharModal();
            await recarregar();
            alert(editando ? "Documento atualizado com sucesso." : "Documento cadastrado com sucesso.");
        }
        catch (error) {
            if (arquivo && novoCaminho && novoCaminho !== anterior?.arquivo) {
                await dbExcluirArquivoStorage(BUCKETS.DOCUMENTOS, novoCaminho).catch(() => {});
            }
            tratarErro("Não foi possível salvar o documento.", error);
        }
        finally {
            alternarSalvamento(botaoSalvar, false);
        }
    }

    function mostrarDetalhes(id) {
        const documento = localizar(id);
        const painel = document.getElementById("detalhesDocumento");
        if (!documento || !painel) return;

        documentoSelecionadoId = documento.id;
        painel.innerHTML = `
            <h3>${escapar(documento.nome)}</h3>
            <p><strong>Cliente:</strong> ${escapar(nomeCliente(documento.cliente_id))}</p>
            <p><strong>Projeto:</strong> ${escapar(nomeProjeto(documento.projeto_id))}</p>
            <p><strong>Categoria:</strong> ${escapar(documento.tipo || "-")}</p>
            <p>${escapar(documento.descricao || "Sem descrição.")}</p>
            ${documento.url
                ? `<p><a href="${escapar(documento.url)}" target="_blank" rel="noopener">Baixar arquivo</a></p>`
                : `<div class="arquivo-indisponivel">
                    Arquivo indisponível${documento.urlErro ? `: ${escapar(documento.urlErro)}` : ""}
                </div>`}
            <div class="detalhes-acoes">
                ${botao("editar", documento.id, "fa-pen", "Editar documento", "edit")}
                ${botao("excluir", documento.id, "fa-trash", "Excluir documento", "delete")}
            </div>
        `;
    }

    async function excluirDocumento(id) {
        const documento = localizar(id);
        if (!documento || !confirm(`Excluir o documento "${documento.nome}"?`)) return;

        try {
            await dbExcluirDocumento(documento.id);
            if (documento.arquivo) {
                await dbExcluirArquivoStorage(BUCKETS.DOCUMENTOS, documento.arquivo).catch(() => {});
            }
            limparDetalhes();
            await recarregar();
            alert("Documento excluído com sucesso.");
        }
        catch (error) {
            tratarErro("Não foi possível excluir o documento.", error);
        }
    }

    async function recarregar() {
        documentos = await dbBuscarDocumentos();
        renderizar();
    }

    function pesquisar() {
        const termo = valor("pesquisaDocumento").toLocaleLowerCase("pt-BR");
        if (!termo) return renderizar();

        renderizar(documentos.filter(documento =>
            [documento.nome, documento.tipo, documento.descricao, nomeCliente(documento.cliente_id)]
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
        const clienteId = valor("documentoCliente");
        const lista = clienteId
            ? projetos.filter(projeto => String(projeto.cliente_id) === String(clienteId))
            : projetos;
        preencherSelect("documentoProjeto", lista);
        preencher("documentoProjeto", valorSelecionado);
    }

    function projetoPertenceAoCliente(projetoId, clienteId) {
        if (!projetoId) return true;
        return projetos.some(projeto =>
            String(projeto.id) === String(projetoId) &&
            String(projeto.cliente_id) === String(clienteId)
        );
    }

    function abrirModal() {
        const modal = document.getElementById("modalDocumento");
        if (!modal) return;
        modal.style.display = "flex";
        modal.classList.add("show");
    }

    function fecharModal() {
        const modal = document.getElementById("modalDocumento");
        modal?.classList.remove("show");
        if (modal) modal.style.display = "none";
        document.getElementById("formDocumento")?.reset();
    }

    function atualizarModal(titulo, textoBotao, arquivoObrigatorio) {
        const tituloModal = document.querySelector("#modalDocumento .modal-header h2");
        const botaoSalvar = document.getElementById("salvarDocumento");
        const inputArquivo = document.getElementById("documentoArquivo");
        if (tituloModal) tituloModal.textContent = titulo;
        if (botaoSalvar) botaoSalvar.textContent = textoBotao;
        if (inputArquivo) inputArquivo.required = arquivoObrigatorio;
    }

    function alternarSalvamento(botao, salvando) {
        if (!botao) return;
        botao.disabled = salvando;
        if (salvando) botao.textContent = "Salvando...";
        else botao.textContent = documentoSelecionadoId ? "Salvar Alterações" : "Salvar Documento";
    }

    function limparDetalhes() {
        documentoSelecionadoId = null;
        const painel = document.getElementById("detalhesDocumento");
        if (painel) painel.innerHTML = "<p>Selecione um documento para visualizar os detalhes.</p>";
    }

    function botao(acao, id, icone, titulo, classe = "") {
        return `
            <button type="button" class="btn-icon ${classe}" data-acao-documento="${acao}"
                data-id="${escapar(id)}" title="${titulo}" aria-label="${titulo}">
                <i class="fa-solid ${icone}"></i>
            </button>
        `;
    }

    function localizar(id) {
        return documentos.find(documento => String(documento.id) === String(id));
    }

    function nomeCliente(id) {
        return clientes.find(cliente => String(cliente.id) === String(id))?.nome || "Não informado";
    }

    function nomeProjeto(id) {
        return projetos.find(projeto => String(projeto.id) === String(id))?.nome || "Não informado";
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
        if (campo) campo.value = conteudo || "";
    }

    function normalizarNome(nome) {
        return nome.replace(/[^a-zA-Z0-9._-]+/g, "-");
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
