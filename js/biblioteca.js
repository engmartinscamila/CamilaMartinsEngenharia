/*
==========================================================
CAMILA MARTINS ENGENHARIA
BIBLIOTECA.JS - BIBLIOTECA CENTRAL POR CLIENTE E CONTRATO
==========================================================
*/

(function moduloBiblioteca() {
    "use strict";

    let arquivos = [];
    let documentos = [];
    let fotos = [];
    let clientes = [];
    let projetos = [];
    let arquivoSelecionadoId = null;
    let termoPesquisa = "";
    let objetosArmazenamento = [];

    document.addEventListener("DOMContentLoaded", iniciar);

    async function iniciar() {
        configurarEventos();

        try {
            [arquivos, documentos, fotos, clientes, projetos] =
                await Promise.all([
                    dbBuscarBiblioteca(),
                    dbBuscarDocumentos(),
                    dbBuscarFotos(),
                    dbBuscarClientes(),
                    dbBuscarProjetos()
                ]);

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
        document.getElementById("gerenciarArmazenamento")?.addEventListener(
            "click",
            abrirGerenciadorArmazenamento
        );
        document.getElementById("fecharGerenciadorStorage")?.addEventListener(
            "click",
            fecharGerenciadorArmazenamento
        );
        document.getElementById("cancelarGerenciadorStorage")?.addEventListener(
            "click",
            fecharGerenciadorArmazenamento
        );
        document.getElementById("selecionarTodosStorage")?.addEventListener(
            "change",
            alternarTodosStorage
        );
        document.getElementById("listaGerenciadorStorage")?.addEventListener(
            "change",
            atualizarSelecaoStorage
        );
        document.getElementById("excluirStorageSelecionado")?.addEventListener(
            "click",
            excluirStorageSelecionado
        );
        document.getElementById("listaBiblioteca")?.addEventListener("click", tratarAcao);
        document.getElementById("detalhesBiblioteca")?.addEventListener("click", tratarAcao);
        document.getElementById("modalArquivo")?.addEventListener("click", event => {
            if (event.target.id === "modalArquivo") fecharModal();
        });
        document.getElementById("modalGerenciarStorage")?.addEventListener(
            "click",
            event => {
                if (event.target.id === "modalGerenciarStorage") {
                    fecharGerenciadorArmazenamento();
                }
            }
        );
    }

    function renderizar() {
        const container = document.getElementById("listaBiblioteca");
        if (!container) return;

        const pastas = montarPastas().filter(pasta => correspondePesquisa(pasta));

        if (!pastas.length) {
            container.innerHTML = `
                <div class="estado-vazio">
                    ${termoPesquisa
                        ? "Nenhuma pasta ou arquivo corresponde à pesquisa."
                        : "Nenhum cliente ou contrato cadastrado."}
                </div>
            `;
            return;
        }

        container.innerHTML = pastas.map(renderizarPasta).join("");
    }

    function montarPastas() {
        const mapa = new Map();

        function garantirPasta(clienteId, projetoId) {
            const chave = `${clienteId || ""}|${projetoId || ""}`;
            if (!mapa.has(chave)) {
                mapa.set(chave, {
                    chave,
                    clienteId: clienteId || "",
                    projetoId: projetoId || "",
                    documentos: [],
                    fotos: [],
                    arquivos: []
                });
            }
            return mapa.get(chave);
        }

        projetos.forEach(projeto =>
            garantirPasta(projeto.cliente_id, projeto.id)
        );

        clientes.forEach(cliente => {
            const possuiContrato = projetos.some(
                projeto => String(projeto.cliente_id) === String(cliente.id)
            );
            if (!possuiContrato) garantirPasta(cliente.id, "");
        });

        documentos.forEach(item =>
            garantirPasta(item.cliente_id, item.projeto_id).documentos.push(item)
        );
        fotos.forEach(item =>
            garantirPasta(item.cliente_id, item.projeto_id).fotos.push(item)
        );
        arquivos.forEach(item =>
            garantirPasta(item.cliente_id, item.projeto_id).arquivos.push(item)
        );

        return [...mapa.values()].sort((a, b) =>
            tituloPasta(a).localeCompare(tituloPasta(b), "pt-BR")
        );
    }

    function renderizarPasta(pasta) {
        const total =
            pasta.documentos.length +
            pasta.fotos.length +
            pasta.arquivos.length;

        return `
            <details class="pasta-cliente biblioteca-pasta" open>
                <summary class="biblioteca-pasta-titulo">
                    <span>
                        <i class="fa-solid fa-folder-open"></i>
                        ${escapar(tituloPasta(pasta))}
                    </span>
                    <small>${total} ${total === 1 ? "item" : "itens"}</small>
                </summary>
                <div class="biblioteca-subpastas">
                    ${renderizarSubpasta(
                        "Documentos",
                        "fa-file-lines",
                        pasta.documentos,
                        renderizarDocumento
                    )}
                    ${renderizarSubpasta(
                        "Fotos",
                        "fa-images",
                        pasta.fotos,
                        renderizarFoto
                    )}
                    ${renderizarSubpasta(
                        "Outros arquivos",
                        "fa-folder-tree",
                        pasta.arquivos,
                        renderizarArquivoExtra
                    )}
                </div>
            </details>
        `;
    }

    function renderizarSubpasta(nome, icone, itens, renderizador) {
        return `
            <details class="subpasta biblioteca-subpasta">
                <summary>
                    <span><i class="fa-solid ${icone}"></i> ${nome}</span>
                    <small>${itens.length}</small>
                </summary>
                <div class="${nome === "Fotos" ? "biblioteca-fotos-grid" : "biblioteca-arquivos-grid"}">
                    ${itens.length
                        ? itens.map(renderizador).join("")
                        : `<p class="biblioteca-vazia">Pasta vazia.</p>`}
                </div>
            </details>
        `;
    }

    function renderizarDocumento(item) {
        return `
            <article class="biblioteca-arquivo-card">
                <i class="fa-solid fa-file-lines"></i>
                <div>
                    <strong>${escapar(item.nome || "Documento")}</strong>
                    <span>${escapar(item.tipo || item.categoria || "Documento")}</span>
                </div>
                ${linkAbrir(item.url, "Abrir documento")}
            </article>
        `;
    }

    function renderizarFoto(item) {
        const nome = item.nome || "Foto";
        return `
            <article class="biblioteca-foto-card">
                ${item.url
                    ? `<a href="${escapar(item.url)}" target="_blank" rel="noopener">
                        <img src="${escapar(item.url)}" alt="${escapar(nome)}" loading="lazy">
                    </a>`
                    : `<div class="biblioteca-sem-preview"><i class="fa-solid fa-image"></i></div>`}
                <strong>${escapar(nome)}</strong>
                ${linkAbrir(item.url, "Ampliar foto")}
            </article>
        `;
    }

    function renderizarArquivoExtra(arquivo) {
        return `
            <article class="biblioteca-arquivo-card">
                <i class="fa-solid fa-file"></i>
                <div>
                    <strong>${escapar(arquivo.nome || "Arquivo")}</strong>
                    <span>
                        ${escapar(arquivo.categoria || "Geral")}
                        ${arquivo.tamanho ? ` • ${escapar(arquivo.tamanho)}` : ""}
                    </span>
                </div>
                <div class="item-acoes">
                    ${botao("abrir", arquivo.id, "fa-eye", "Abrir detalhes")}
                    ${botao("editar", arquivo.id, "fa-pen", "Editar arquivo", "edit")}
                    ${botao("excluir", arquivo.id, "fa-trash", "Excluir arquivo", "delete")}
                </div>
            </article>
        `;
    }

    function linkAbrir(url, titulo) {
        return url
            ? `<a class="biblioteca-abrir" href="${escapar(url)}" target="_blank"
                rel="noopener" title="${escapar(titulo)}" aria-label="${escapar(titulo)}">
                <i class="fa-solid fa-arrow-up-right-from-square"></i>
            </a>`
            : `<span class="biblioteca-indisponivel" title="Arquivo indisponível">
                <i class="fa-solid fa-triangle-exclamation"></i>
            </span>`;
    }

    function correspondePesquisa(pasta) {
        if (!termoPesquisa) return true;

        const campos = [
            tituloPasta(pasta),
            ...pasta.documentos.flatMap(item => [item.nome, item.tipo, item.descricao]),
            ...pasta.fotos.flatMap(item => [item.nome, item.descricao]),
            ...pasta.arquivos.flatMap(item => [
                item.nome,
                item.categoria,
                item.descricao,
                item.tipo
            ])
        ];

        return campos.some(campo =>
            String(campo || "").toLocaleLowerCase("pt-BR").includes(termoPesquisa)
        );
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
        preencherProjetos();
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
            descricao: valor("arquivoDescricao"),
            cliente_id: valor("arquivoCliente") || null,
            projeto_id: valor("arquivoProjeto") || null
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

        if (!projetoPertenceAoCliente(dados.projeto_id, dados.cliente_id)) {
            alert("O contrato selecionado não pertence a esse cliente.");
            return;
        }

        const botaoSalvar = document.getElementById("salvarArquivo");
        alternarSalvamento(botaoSalvar, true);
        let novoCaminho = anterior?.arquivo || null;

        try {
            if (upload) {
                novoCaminho =
                    `${dados.cliente_id}/${dados.projeto_id}/` +
                    `${Date.now()}-${normalizarNome(upload.name)}`;
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
                await dbExcluirArquivoStorage(
                    BUCKETS.BIBLIOTECA,
                    anterior.arquivo
                ).catch(() => {});
            }

            const editando = Boolean(arquivoSelecionadoId);
            fecharModal();
            await recarregar();
            alert(editando
                ? "Arquivo atualizado com sucesso."
                : "Arquivo adicionado com sucesso.");
        }
        catch (error) {
            if (upload && novoCaminho && novoCaminho !== anterior?.arquivo) {
                await dbExcluirArquivoStorage(
                    BUCKETS.BIBLIOTECA,
                    novoCaminho
                ).catch(() => {});
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
            <p><strong>Cliente:</strong> ${escapar(nomeCliente(arquivo.cliente_id))}</p>
            <p><strong>Contrato:</strong> ${escapar(rotuloProjeto(arquivo.projeto_id))}</p>
            <p><strong>Categoria:</strong> ${escapar(arquivo.categoria || "-")}</p>
            <p><strong>Tipo:</strong> ${escapar(arquivo.tipo || "-")}</p>
            <p><strong>Tamanho:</strong> ${escapar(arquivo.tamanho || "-")}</p>
            <p>${escapar(arquivo.descricao || "Sem descrição.")}</p>
            ${arquivo.url
                ? `<p><a href="${escapar(arquivo.url)}" target="_blank"
                    rel="noopener">Abrir arquivo</a></p>`
                : `<div class="arquivo-indisponivel">
                    Arquivo indisponível${arquivo.urlErro
                        ? `: ${escapar(arquivo.urlErro)}`
                        : ""}
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
            if (arquivo.arquivo) {
                await dbExcluirArquivoStorage(
                    BUCKETS.BIBLIOTECA,
                    arquivo.arquivo
                );
            }
            await dbExcluirArquivoBiblioteca(arquivo.id);
            limparDetalhes();
            await recarregar();
            alert("Arquivo excluído com sucesso.");
        }
        catch (error) {
            tratarErro("Não foi possível excluir o arquivo.", error);
        }
    }

    async function recarregar() {
        [arquivos, documentos, fotos] = await Promise.all([
            dbBuscarBiblioteca(),
            dbBuscarDocumentos(),
            dbBuscarFotos()
        ]);
        renderizar();
    }

    function pesquisar() {
        termoPesquisa = valor("pesquisaBiblioteca").toLocaleLowerCase("pt-BR");
        renderizar();
    }

    async function abrirGerenciadorArmazenamento() {
        const modal = document.getElementById("modalGerenciarStorage");
        const lista = document.getElementById("listaGerenciadorStorage");
        if (!modal || !lista) return;

        modal.style.display = "flex";
        modal.classList.add("show");
        lista.innerHTML = `
            <div class="storage-gerenciador-carregando">
                <i class="fa-solid fa-spinner fa-spin"></i>
                Carregando arquivos do Supabase...
            </div>
        `;

        try {
            objetosArmazenamento = await dbListarObjetosArmazenamento();
            renderizarGerenciadorArmazenamento();
        }
        catch (error) {
            console.error("Erro ao listar armazenamento:", error);
            lista.innerHTML = `
                <div class="estado-vazio">
                    Não foi possível consultar o armazenamento. Execute a
                    nova migração do Supabase e tente novamente.
                </div>
            `;
        }
    }

    function fecharGerenciadorArmazenamento() {
        const modal = document.getElementById("modalGerenciarStorage");
        modal?.classList.remove("show");
        if (modal) modal.style.display = "none";
    }

    function renderizarGerenciadorArmazenamento() {
        const lista = document.getElementById("listaGerenciadorStorage");
        const resumo = document.getElementById("resumoGerenciadorStorage");
        const selecionarTodos = document.getElementById("selecionarTodosStorage");
        if (!lista) return;

        const totalBytes = objetosArmazenamento.reduce(
            (total, objeto) => total + (Number(objeto.tamanho_bytes) || 0),
            0
        );

        if (resumo) {
            resumo.innerHTML = `
                <strong>${formatarTamanho(totalBytes)} utilizados</strong>
                <span>
                    ${objetosArmazenamento.length}
                    ${objetosArmazenamento.length === 1 ? "arquivo" : "arquivos"}
                    nos buckets do site
                </span>
            `;
        }

        if (selecionarTodos) {
            selecionarTodos.checked = false;
            selecionarTodos.disabled = !objetosArmazenamento.length;
        }

        if (!objetosArmazenamento.length) {
            lista.innerHTML = `
                <div class="estado-vazio">
                    Nenhum arquivo ocupa espaço no Storage.
                </div>
            `;
            atualizarSelecaoStorage();
            return;
        }

        lista.innerHTML = objetosArmazenamento.map((objeto, indice) => {
            const referencia = referenciaObjeto(objeto);
            return `
                <label class="storage-gerenciador-item">
                    <input type="checkbox" data-storage-indice="${indice}">
                    <span class="storage-gerenciador-icone">
                        <i class="fa-solid ${iconeBucket(objeto.bucket_id)}"></i>
                    </span>
                    <span class="storage-gerenciador-info">
                        <strong>${escapar(referencia.nome)}</strong>
                        <small>
                            ${escapar(referencia.cliente)} —
                            ${escapar(referencia.contrato)}
                        </small>
                        <small>
                            ${escapar(rotuloBucket(objeto.bucket_id))} •
                            ${escapar(formatarDataStorage(objeto.criado_em))}
                        </small>
                    </span>
                    <strong class="storage-gerenciador-tamanho">
                        ${escapar(formatarTamanho(Number(objeto.tamanho_bytes) || 0))}
                    </strong>
                </label>
            `;
        }).join("");

        atualizarSelecaoStorage();
    }

    function referenciaObjeto(objeto) {
        const colecao = {
            [BUCKETS.DOCUMENTOS]: documentos,
            [BUCKETS.FOTOS]: fotos,
            [BUCKETS.BIBLIOTECA]: arquivos
        }[objeto.bucket_id] || [];
        const registro = colecao.find(
            item => String(item.arquivo) === String(objeto.caminho)
        );
        const partes = String(objeto.caminho || "").split("/");
        const clienteId = registro?.cliente_id || partes[0] || "";
        const projetoId = registro?.projeto_id || partes[1] || "";

        return {
            nome: registro?.nome || partes.at(-1) || "Arquivo sem nome",
            cliente: nomeCliente(clienteId),
            contrato: rotuloProjeto(projetoId)
        };
    }

    function alternarTodosStorage(event) {
        document
            .querySelectorAll("#listaGerenciadorStorage [data-storage-indice]")
            .forEach(campo => {
                campo.checked = event.target.checked;
            });
        atualizarSelecaoStorage();
    }

    function atualizarSelecaoStorage() {
        const selecionados = document.querySelectorAll(
            "#listaGerenciadorStorage [data-storage-indice]:checked"
        );
        const botao = document.getElementById("excluirStorageSelecionado");
        if (!botao) return;

        botao.disabled = !selecionados.length;
        botao.innerHTML = selecionados.length
            ? `<i class="fa-solid fa-trash"></i> Excluir ${selecionados.length}
                ${selecionados.length === 1 ? "arquivo" : "arquivos"} definitivamente`
            : `<i class="fa-solid fa-trash"></i> Excluir selecionados definitivamente`;
    }

    async function excluirStorageSelecionado() {
        const campos = [
            ...document.querySelectorAll(
                "#listaGerenciadorStorage [data-storage-indice]:checked"
            )
        ];
        const selecionados = campos
            .map(campo => objetosArmazenamento[Number(campo.dataset.storageIndice)])
            .filter(Boolean);
        if (!selecionados.length) return;

        const mensagem =
            `Excluir definitivamente ${selecionados.length} ` +
            `${selecionados.length === 1 ? "arquivo" : "arquivos"}?\n\n` +
            "Essa ação remove o arquivo do Supabase e não pode ser desfeita.";
        if (!confirm(mensagem)) return;

        const botao = document.getElementById("excluirStorageSelecionado");
        if (botao) {
            botao.disabled = true;
            botao.textContent = "Excluindo...";
        }

        let excluidos = 0;
        const falhas = [];

        for (const objeto of selecionados) {
            try {
                await dbExcluirArquivoStorage(
                    objeto.bucket_id,
                    objeto.caminho
                );
                await dbExcluirRegistroPorArquivo(
                    objeto.bucket_id,
                    objeto.caminho
                );
                excluidos += 1;
            }
            catch (error) {
                console.error("Erro ao excluir arquivo permanente:", objeto, error);
                falhas.push(objeto.caminho);
            }
        }

        await recarregar();
        objetosArmazenamento = await dbListarObjetosArmazenamento();
        renderizarGerenciadorArmazenamento();

        alert(
            `${excluidos} ${excluidos === 1 ? "arquivo excluído" : "arquivos excluídos"} ` +
            "definitivamente." +
            (falhas.length
                ? `\n${falhas.length} não puderam ser excluídos e permanecem listados.`
                : "")
        );
    }

    function rotuloBucket(bucket) {
        return {
            [BUCKETS.DOCUMENTOS]: "Documento",
            [BUCKETS.FOTOS]: "Foto",
            [BUCKETS.BIBLIOTECA]: "Outro arquivo"
        }[bucket] || bucket || "Arquivo";
    }

    function iconeBucket(bucket) {
        return {
            [BUCKETS.DOCUMENTOS]: "fa-file-lines",
            [BUCKETS.FOTOS]: "fa-image",
            [BUCKETS.BIBLIOTECA]: "fa-file"
        }[bucket] || "fa-file";
    }

    function formatarDataStorage(valorData) {
        if (!valorData) return "Data não informada";
        const data = new Date(valorData);
        return Number.isNaN(data.getTime())
            ? "Data não informada"
            : data.toLocaleDateString("pt-BR");
    }

    function preencherClientes() {
        const campo = document.getElementById("arquivoCliente");
        if (!campo) return;

        campo.innerHTML = `<option value="">Selecione</option>` +
            clientes.map(item => `
                <option value="${escapar(item.id)}">
                    ${escapar(item.nome)} — cad. ${escapar(String(item.id).slice(0, 8).toUpperCase())}
                </option>
            `).join("");
    }

    function preencherProjetos(selecionado = "") {
        const campo = document.getElementById("arquivoProjeto");
        if (!campo) return;

        const lista = projetos.filter(
            item => String(item.cliente_id) === valor("arquivoCliente")
        );
        campo.innerHTML = `<option value="">Selecione o contrato</option>` +
            lista.map(item => `
                <option value="${escapar(item.id)}">
                    ${escapar(window.cmRotuloContrato?.(item) || item.nome)}
                </option>
            `).join("");
        preencher(
            "arquivoProjeto",
            selecionado || (lista.length === 1 ? lista[0].id : "")
        );
    }

    function projetoPertenceAoCliente(projetoId, clienteId) {
        return projetos.some(projeto =>
            String(projeto.id) === String(projetoId) &&
            String(projeto.cliente_id) === String(clienteId)
        );
    }

    function nomeCliente(id) {
        return clientes.find(
            item => String(item.id) === String(id)
        )?.nome || "Cliente não informado";
    }

    function rotuloProjeto(id) {
        const item = projetos.find(
            projeto => String(projeto.id) === String(id)
        );
        return item
            ? (window.cmRotuloContrato?.(item) || item.nome)
            : "Sem contrato cadastrado";
    }

    function tituloPasta(pasta) {
        return `${nomeCliente(pasta.clienteId)} — ${rotuloProjeto(pasta.projetoId)}`;
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

    function alternarSalvamento(botaoSalvar, salvando) {
        if (!botaoSalvar) return;
        botaoSalvar.disabled = salvando;
        botaoSalvar.textContent = salvando
            ? "Salvando..."
            : (arquivoSelecionadoId ? "Salvar Alterações" : "Salvar Arquivo");
    }

    function limparDetalhes() {
        arquivoSelecionadoId = null;
        const painel = document.getElementById("detalhesBiblioteca");
        if (painel) {
            painel.innerHTML =
                "<p>Selecione um arquivo para visualizar os detalhes.</p>";
        }
    }

    function botao(acao, id, icone, titulo, classe = "") {
        return `
            <button type="button" class="btn-icon ${classe}"
                data-acao-biblioteca="${acao}" data-id="${escapar(id)}"
                title="${titulo}" aria-label="${titulo}">
                <i class="fa-solid ${icone}"></i>
            </button>
        `;
    }

    function localizar(id) {
        return arquivos.find(
            arquivo => String(arquivo.id) === String(id)
        );
    }

    function formatarTamanho(bytes) {
        if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
        const unidades = ["B", "KB", "MB", "GB"];
        const indice = Math.min(
            Math.floor(Math.log(bytes) / Math.log(1024)),
            unidades.length - 1
        );
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
