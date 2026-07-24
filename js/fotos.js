/*
=====================================================
CAMILA MARTINS ENGENHARIA
FOTOS.JS - CRUD ADMINISTRATIVO
=====================================================
*/

(function moduloFotos() {
    "use strict";

    let fotos = [];
    let clientes = [];
    let projetos = [];
    let fotoSelecionadaId = null;

    document.addEventListener("DOMContentLoaded", iniciar);

    async function iniciar() {
        configurarEventos();
        mostrarLoading(true);

        try {
            [fotos, clientes, projetos] = await Promise.all([
                dbBuscarFotos(),
                dbBuscarClientes(),
                dbBuscarProjetos()
            ]);

            preencherSelect("fotoCliente", clientes);
            preencherProjetos();
            renderizar();
        }
        catch (error) {
            tratarErro("Não foi possível carregar as fotos.", error);
        }
        finally {
            mostrarLoading(false);
        }
    }

    function configurarEventos() {
        document.getElementById("novaFoto")?.addEventListener("click", novaFoto);
        document.getElementById("fecharModalFoto")?.addEventListener("click", fecharModal);
        document.getElementById("cancelarFoto")?.addEventListener("click", fecharModal);
        document.getElementById("formFoto")?.addEventListener("submit", salvarFoto);
        document.getElementById("fotoCliente")?.addEventListener("change", preencherProjetos);
        document.getElementById("pesquisaFoto")?.addEventListener("input", pesquisar);
        document.getElementById("btnPesquisarFoto")?.addEventListener("click", pesquisar);
        document.getElementById("galeriaFotos")?.addEventListener("click", tratarAcao);
        document.getElementById("detalhesFoto")?.addEventListener("click", tratarAcao);
        document.getElementById("modalFoto")?.addEventListener("click", event => {
            if (event.target.id === "modalFoto") fecharModal();
        });
    }

    function renderizar(lista = fotos) {
        const galeria = document.getElementById("galeriaFotos");
        if (!galeria) return;

        if (!lista.length) {
            galeria.innerHTML = `<div class="estado-vazio">Nenhuma foto cadastrada.</div>`;
            return;
        }

        galeria.innerHTML = lista.map(foto => `
            <article class="foto-item" data-acao-foto="abrir" data-id="${escapar(foto.id)}">
                ${foto.url
                    ? `<img src="${escapar(foto.url)}" alt="${escapar(foto.nome)}">`
                    : `<div class="arquivo-indisponivel">
                        Imagem indisponível${foto.urlErro ? `: ${escapar(foto.urlErro)}` : ""}
                    </div>`}
                <span>${escapar(foto.nome || "Foto sem título")}</span>
                <div class="foto-acoes">
                    ${botao("editar", foto.id, "fa-pen", "Editar foto", "edit")}
                    ${botao("excluir", foto.id, "fa-trash", "Excluir foto", "delete")}
                </div>
            </article>
        `).join("");
    }

    function tratarAcao(event) {
        const alvo = event.target.closest("[data-acao-foto]");
        if (!alvo) return;

        event.stopPropagation();
        const { acaoFoto: acao, id } = alvo.dataset;
        if (acao === "abrir") mostrarDetalhes(id);
        if (acao === "editar") editarFoto(id);
        if (acao === "excluir") excluirFoto(id);
    }

    function novaFoto() {
        fotoSelecionadaId = null;
        document.getElementById("formFoto")?.reset();
        preencherProjetos();
        atualizarModal("Adicionar Foto", "Salvar Foto", true);
        abrirModal();
    }

    function editarFoto(id) {
        const foto = localizar(id);
        if (!foto) return;

        fotoSelecionadaId = foto.id;
        preencher("fotoCliente", foto.cliente_id);
        preencherProjetos(foto.projeto_id);
        preencher("fotoTitulo", foto.nome);
        preencher("fotoDescricao", foto.descricao);
        atualizarModal("Editar Foto", "Salvar Alterações", false);
        abrirModal();
    }

    async function salvarFoto(event) {
        event.preventDefault();

        const dados = {
            nome: valor("fotoTitulo"),
            descricao: valor("fotoDescricao"),
            cliente_id: valor("fotoCliente") || null,
            projeto_id: valor("fotoProjeto") || null
        };

        const arquivo = document.getElementById("arquivoFoto")?.files?.[0];
        const anterior = localizar(fotoSelecionadaId);

        if (!dados.nome || !dados.cliente_id) {
            alert("Informe o título e selecione o cliente.");
            return;
        }

        if (!fotoSelecionadaId && !arquivo) {
            alert("Selecione uma imagem.");
            return;
        }

        if (!projetoPertenceAoCliente(dados.projeto_id, dados.cliente_id)) {
            alert("O projeto selecionado não pertence a esse cliente.");
            return;
        }

        const botaoSalvar = document.getElementById("salvarFoto");
        alternarSalvamento(botaoSalvar, true);
        let novoCaminho = anterior?.arquivo || null;

        try {
            if (arquivo) {
                novoCaminho = `${dados.cliente_id}/${Date.now()}-${normalizarNome(arquivo.name)}`;
                await dbUploadArquivo(BUCKETS.FOTOS, novoCaminho, arquivo);
            }

            dados.arquivo = novoCaminho;

            if (fotoSelecionadaId) {
                await dbEditarFoto(fotoSelecionadaId, dados);
            }
            else {
                await dbCriarFoto(dados);
            }

            if (arquivo && anterior?.arquivo && anterior.arquivo !== novoCaminho) {
                await dbExcluirArquivoStorage(BUCKETS.FOTOS, anterior.arquivo).catch(() => {});
            }

            const editando = Boolean(fotoSelecionadaId);
            fecharModal();
            await recarregar();
            alert(editando ? "Foto atualizada com sucesso." : "Foto cadastrada com sucesso.");
        }
        catch (error) {
            if (arquivo && novoCaminho && novoCaminho !== anterior?.arquivo) {
                await dbExcluirArquivoStorage(BUCKETS.FOTOS, novoCaminho).catch(() => {});
            }
            tratarErro("Não foi possível salvar a foto.", error);
        }
        finally {
            alternarSalvamento(botaoSalvar, false);
        }
    }

    function mostrarDetalhes(id) {
        const foto = localizar(id);
        const painel = document.getElementById("detalhesFoto");
        if (!foto || !painel) return;

        fotoSelecionadaId = foto.id;
        painel.innerHTML = `
            <h3>${escapar(foto.nome)}</h3>
            ${foto.url
                ? `<img src="${escapar(foto.url)}" alt="${escapar(foto.nome)}" style="max-width:100%;border-radius:2px;">`
                : `<div class="arquivo-indisponivel">
                    Imagem indisponível${foto.urlErro ? `: ${escapar(foto.urlErro)}` : ""}
                </div>`}
            <p><strong>Cliente:</strong> ${escapar(nomeCliente(foto.cliente_id))}</p>
            <p><strong>Projeto:</strong> ${escapar(nomeProjeto(foto.projeto_id))}</p>
            <p>${escapar(foto.descricao || "Sem descrição.")}</p>
            <div class="detalhes-acoes">
                ${botao("editar", foto.id, "fa-pen", "Editar foto", "edit")}
                ${botao("excluir", foto.id, "fa-trash", "Excluir foto", "delete")}
            </div>
        `;
    }

    async function excluirFoto(id) {
        const foto = localizar(id);
        if (!foto || !confirm(`Excluir a foto "${foto.nome}"?`)) return;

        try {
            await dbExcluirFoto(foto.id);
            if (foto.arquivo) {
                await dbExcluirArquivoStorage(BUCKETS.FOTOS, foto.arquivo).catch(() => {});
            }
            limparDetalhes();
            await recarregar();
            alert("Foto excluída com sucesso.");
        }
        catch (error) {
            tratarErro("Não foi possível excluir a foto.", error);
        }
    }

    async function recarregar() {
        fotos = await dbBuscarFotos();
        renderizar();
    }

    function pesquisar() {
        const termo = valor("pesquisaFoto").toLocaleLowerCase("pt-BR");
        if (!termo) return renderizar();

        renderizar(fotos.filter(foto =>
            [foto.nome, foto.descricao, nomeCliente(foto.cliente_id), nomeProjeto(foto.projeto_id)]
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
        const clienteId = valor("fotoCliente");
        const lista = clienteId
            ? projetos.filter(projeto => String(projeto.cliente_id) === String(clienteId))
            : projetos;
        preencherSelect("fotoProjeto", lista);
        preencher("fotoProjeto", valorSelecionado);
    }

    function projetoPertenceAoCliente(projetoId, clienteId) {
        if (!projetoId) return true;
        return projetos.some(projeto =>
            String(projeto.id) === String(projetoId) &&
            String(projeto.cliente_id) === String(clienteId)
        );
    }

    function abrirModal() {
        const modal = document.getElementById("modalFoto");
        if (!modal) return;
        modal.style.display = "flex";
        modal.classList.add("show");
    }

    function fecharModal() {
        const modal = document.getElementById("modalFoto");
        modal?.classList.remove("show");
        if (modal) modal.style.display = "none";
        document.getElementById("formFoto")?.reset();
    }

    function atualizarModal(titulo, textoBotao, arquivoObrigatorio) {
        const tituloModal = document.querySelector("#modalFoto .modal-header h2");
        const botaoSalvar = document.getElementById("salvarFoto");
        const inputArquivo = document.getElementById("arquivoFoto");
        if (tituloModal) tituloModal.textContent = titulo;
        if (botaoSalvar) botaoSalvar.textContent = textoBotao;
        if (inputArquivo) inputArquivo.required = arquivoObrigatorio;
    }

    function alternarSalvamento(botao, salvando) {
        if (!botao) return;
        botao.disabled = salvando;
        if (salvando) botao.textContent = "Salvando...";
        else botao.textContent = fotoSelecionadaId ? "Salvar Alterações" : "Salvar Foto";
    }

    function limparDetalhes() {
        fotoSelecionadaId = null;
        const painel = document.getElementById("detalhesFoto");
        if (painel) painel.innerHTML = "<p>Selecione uma imagem para visualizar os detalhes.</p>";
    }

    function botao(acao, id, icone, titulo, classe = "") {
        return `
            <button type="button" class="btn-icon ${classe}" data-acao-foto="${acao}"
                data-id="${escapar(id)}" title="${titulo}" aria-label="${titulo}">
                <i class="fa-solid ${icone}"></i>
            </button>
        `;
    }

    function localizar(id) {
        return fotos.find(foto => String(foto.id) === String(id));
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
