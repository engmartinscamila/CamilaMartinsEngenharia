/*
==========================================================
CAMILA MARTINS ENGENHARIA
BIBLIOTECA.JS - CRUD ADMINISTRATIVO
==========================================================
*/

(function moduloBiblioteca() {
    "use strict";

    let arquivos = [];
    let clientes = [];
    let projetos = [];
    let arquivoSelecionadoId = null;

    document.addEventListener("DOMContentLoaded", iniciar);

    async function iniciar() {
        configurarEventos();

        try {
            [arquivos, clientes, projetos] = await Promise.all([dbBuscarBiblioteca(), dbBuscarClientes(), dbBuscarProjetos()]);
            preencherClientes();
            preencherProjetos();
            renderizar();
        }
        catch (error) {
            tratarErro("Não foi possível carregar a biblioteca.", error);
        }
        finally {
            ocultarCarregamentoPagina();
        }
    }

    function configurarEventos() {
        document.getElementById("novoArquivo")?.addEventListener("click", novoArquivo);
        document.getElementById("fecharModalArquivo")?.addEventListener("click", fecharModal);
        document.getElementById("cancelarArquivo")?.addEventListener("click", fecharModal);
        document.getElementById("formArquivo")?.addEventListener("submit", salvarArquivo);
        document.getElementById("arquivoCliente")?.addEventListener("change", () => preencherProjetos());
        document.getElementById("pesquisaBiblioteca")?.addEventListener("input", pesquisar);
        document.getElementById("btnPesquisarBiblioteca")?.addEventListener("click", pesquisar);
        document.getElementById("listaBiblioteca")?.addEventListener("click", tratarAcao);
        document.getElementById("detalhesBiblioteca")?.addEventListener("click", tratarAcao);
        document.getElementById("modalArquivo")?.addEventListener("click", event => {
            if (event.target.id === "modalArquivo") fecharModal();
        });
    }

    function renderizar(lista = arquivos) {
        const container = document.getElementById("listaBiblioteca");
        if (!container) return;

        if (!lista.length) {
            container.innerHTML = `<div class="estado-vazio">Nenhum arquivo cadastrado.</div>`;
            return;
        }

        const grupos = lista.reduce((mapa,item) => {
            const chave = `${item.cliente_id || ""}|${item.projeto_id || ""}`;
            (mapa[chave] ||= []).push(item); return mapa;
        },{});
        container.innerHTML = Object.values(grupos).map(grupo => {
            const primeiro = grupo[0];
            return `<section class="pasta-cliente"><h3><i class="fa-solid fa-folder-open"></i> ${escapar(nomeCliente(primeiro.cliente_id))}</h3>
            <p>${escapar(rotuloProjeto(primeiro.projeto_id))}</p><div class="subpasta"><h4>Arquivos</h4>` + grupo.map(arquivo => `
            <article class="item-lista arquivo-item">
                <div class="item-info">
                    <h3>${escapar(arquivo.nome)}</h3>
                    <span>${escapar(arquivo.categoria || "Sem categoria")}</span>
                    <span>${escapar(arquivo.tamanho || "")}</span>
                </div>
                <div class="item-acoes">
                    ${botao("abrir", arquivo.id, "fa-eye", "Abrir detalhes")}
                    ${botao("editar", arquivo.id, "fa-pen", "Editar arquivo", "edit")}
                    ${botao("excluir", arquivo.id, "fa-trash", "Excluir arquivo", "delete")}
                </div>
            </article>
        `).join("") + `</div></section>`}).join("");
    }

    function tratarAcao(event) {
        const alvo = event.target.closest("[data-acao-biblioteca]");
        if (!alvo) return;

        const { acaoBiblioteca: acao, id } = alvo.dataset;
        if (acao === "abrir") mostrarDetalhes(id);
        if (acao === "editar") editarArquivo(id);
        if (acao === "excluir") excluirArquivo(id);
    }

    function novoArquivo() {
        arquivoSelecionadoId = null;
        document.getElementById("formArquivo")?.reset();
        atualizarModal("Adicionar Arquivo", "Salvar Arquivo", true);
        abrirModal();
    }

    function editarArquivo(id) {
        const arquivo = localizar(id);
        if (!arquivo) return;

        arquivoSelecionadoId = arquivo.id;
        preencher("arquivoNome", arquivo.nome);
        preencher("arquivoCategoria", arquivo.categoria);
        preencher("arquivoCliente", arquivo.cliente_id);
        preencherProjetos(arquivo.projeto_id);
        preencher("arquivoDescricao", arquivo.descricao);
        atualizarModal("Editar Arquivo", "Salvar Alterações", false);
        abrirModal();
    }

    async function salvarArquivo(event) {
        event.preventDefault();

        const dados = {
            nome: valor("arquivoNome"),
            categoria: valor("arquivoCategoria"),
            descricao: valor("arquivoDescricao")
            ,cliente_id: valor("arquivoCliente") || null
            ,projeto_id: valor("arquivoProjeto") || null
        };

        const upload = document.getElementById("arquivoUpload")?.files?.[0];
        const anterior = localizar(arquivoSelecionadoId);

        if (!dados.nome || !dados.cliente_id || !dados.projeto_id) {
            alert("Informe o nome, o cliente e o contrato.");
            return;
        }

        if (!arquivoSelecionadoId && !upload) {
            alert("Selecione um arquivo.");
            return;
        }

        const botaoSalvar = document.getElementById("salvarArquivo");
        alternarSalvamento(botaoSalvar, true);
        let novoCaminho = anterior?.arquivo || null;

        try {
            if (upload) {
                novoCaminho = `${dados.cliente_id}/${dados.projeto_id}/${Date.now()}-${normalizarNome(upload.name)}`;
                await dbUploadArquivo(BUCKETS.BIBLIOTECA, novoCaminho, upload);
                dados.tipo = upload.type || "application/octet-stream";
                dados.tamanho = formatarTamanho(upload.size);
            }
            else {
                dados.tipo = anterior?.tipo || "application/octet-stream";
                dados.tamanho = anterior?.tamanho || "";
            }

            dados.arquivo = novoCaminho;

            if (arquivoSelecionadoId) {
                await dbEditarArquivoBiblioteca(arquivoSelecionadoId, dados);
            }
            else {
                await dbSalvarArquivoBiblioteca(dados);
            }

            if (upload && anterior?.arquivo && anterior.arquivo !== novoCaminho) {
                await dbExcluirArquivoStorage(BUCKETS.BIBLIOTECA, anterior.arquivo).catch(() => {});
            }

            const editando = Boolean(arquivoSelecionadoId);
            fecharModal();
            await recarregar();
            alert(editando ? "Arquivo atualizado com sucesso." : "Arquivo adicionado com sucesso.");
        }
        catch (error) {
            if (upload && novoCaminho && novoCaminho !== anterior?.arquivo) {
                await dbExcluirArquivoStorage(BUCKETS.BIBLIOTECA, novoCaminho).catch(() => {});
            }
            tratarErro("Não foi possível salvar o arquivo.", error);
        }
        finally {
            alternarSalvamento(botaoSalvar, false);
        }
    }

    function mostrarDetalhes(id) {
        const arquivo = localizar(id);
        const painel = document.getElementById("detalhesBiblioteca");
        if (!arquivo || !painel) return;

        arquivoSelecionadoId = arquivo.id;
        painel.innerHTML = `
            <h3>${escapar(arquivo.nome)}</h3>
            <p><strong>Categoria:</strong> ${escapar(arquivo.categoria || "-")}</p>
            <p><strong>Tipo:</strong> ${escapar(arquivo.tipo || "-")}</p>
            <p><strong>Tamanho:</strong> ${escapar(arquivo.tamanho || "-")}</p>
            <p>${escapar(arquivo.descricao || "Sem descrição.")}</p>
            ${arquivo.url
                ? `<p><a href="${escapar(arquivo.url)}" target="_blank" rel="noopener">Abrir arquivo</a></p>`
                : `<div class="arquivo-indisponivel">
                    Arquivo indisponível${arquivo.urlErro ? `: ${escapar(arquivo.urlErro)}` : ""}
                </div>`}
            <div class="detalhes-acoes">
                ${botao("editar", arquivo.id, "fa-pen", "Editar arquivo", "edit")}
                ${botao("excluir", arquivo.id, "fa-trash", "Excluir arquivo", "delete")}
            </div>
        `;
    }

    async function excluirArquivo(id) {
        const arquivo = localizar(id);
        if (!arquivo || !confirm(`Excluir o arquivo "${arquivo.nome}"?`)) return;

        try {
            await dbExcluirArquivoBiblioteca(arquivo.id);
            if (arquivo.arquivo) {
                await dbExcluirArquivoStorage(BUCKETS.BIBLIOTECA, arquivo.arquivo).catch(() => {});
            }
            limparDetalhes();
            await recarregar();
            alert("Arquivo excluído com sucesso.");
        }
        catch (error) {
            tratarErro("Não foi possível excluir o arquivo.", error);
        }
    }

    async function recarregar() {
        arquivos = await dbBuscarBiblioteca();
        renderizar();
    }

    function pesquisar() {
        const termo = valor("pesquisaBiblioteca").toLocaleLowerCase("pt-BR");
        if (!termo) return renderizar();

        renderizar(arquivos.filter(arquivo =>
            [arquivo.nome, arquivo.categoria, arquivo.descricao, arquivo.tipo]
                .some(campo => String(campo || "").toLocaleLowerCase("pt-BR").includes(termo))
        ));
    }

    function preencherClientes() {
        const campo = document.getElementById("arquivoCliente");
        if (campo) campo.innerHTML = `<option value="">Selecione</option>` + clientes.map(item =>
            `<option value="${escapar(item.id)}">${escapar(item.nome)} — cad. ${escapar(String(item.id).slice(0,8).toUpperCase())}</option>`).join("");
    }

    function preencherProjetos(selecionado = "") {
        const campo = document.getElementById("arquivoProjeto");
        if (!campo) return;
        const lista = projetos.filter(item => String(item.cliente_id) === valor("arquivoCliente"));
        campo.innerHTML = `<option value="">Selecione o contrato</option>` + lista.map(item =>
            `<option value="${escapar(item.id)}">${escapar(window.cmRotuloContrato?.(item) || item.nome)}</option>`).join("");
        preencher("arquivoProjeto", selecionado);
    }

    function nomeCliente(id) {
        return clientes.find(item => String(item.id) === String(id))?.nome || "Cliente não informado";
    }

    function rotuloProjeto(id) {
        const item = projetos.find(projeto => String(projeto.id) === String(id));
        return item ? (window.cmRotuloContrato?.(item) || item.nome) : "Contrato não informado";
    }

    function abrirModal() {
        const modal = document.getElementById("modalArquivo");
        if (!modal) return;
        modal.style.display = "flex";
        modal.classList.add("show");
    }

    function fecharModal() {
        const modal = document.getElementById("modalArquivo");
        modal?.classList.remove("show");
        if (modal) modal.style.display = "none";
        document.getElementById("formArquivo")?.reset();
    }

    function atualizarModal(titulo, textoBotao, arquivoObrigatorio) {
        const tituloModal = document.querySelector("#modalArquivo .modal-header h2");
        const botaoSalvar = document.getElementById("salvarArquivo");
        const inputArquivo = document.getElementById("arquivoUpload");
        if (tituloModal) tituloModal.textContent = titulo;
        if (botaoSalvar) botaoSalvar.textContent = textoBotao;
        if (inputArquivo) inputArquivo.required = arquivoObrigatorio;
    }

    function alternarSalvamento(botao, salvando) {
        if (!botao) return;
        botao.disabled = salvando;
        if (salvando) botao.textContent = "Salvando...";
        else botao.textContent = arquivoSelecionadoId ? "Salvar Alterações" : "Salvar Arquivo";
    }

    function limparDetalhes() {
        arquivoSelecionadoId = null;
        const painel = document.getElementById("detalhesBiblioteca");
        if (painel) painel.innerHTML = "<p>Selecione um arquivo para visualizar os detalhes.</p>";
    }

    function botao(acao, id, icone, titulo, classe = "") {
        return `
            <button type="button" class="btn-icon ${classe}" data-acao-biblioteca="${acao}"
                data-id="${escapar(id)}" title="${titulo}" aria-label="${titulo}">
                <i class="fa-solid ${icone}"></i>
            </button>
        `;
    }

    function localizar(id) {
        return arquivos.find(arquivo => String(arquivo.id) === String(id));
    }

    function formatarTamanho(bytes) {
        if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
        const unidades = ["B", "KB", "MB", "GB"];
        const indice = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), unidades.length - 1);
        return `${(bytes / (1024 ** indice)).toFixed(indice ? 1 : 0)} ${unidades[indice]}`;
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
