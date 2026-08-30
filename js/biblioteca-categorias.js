/*
==========================================================
CAMILA MARTINS ENGENHARIA
BIBLIOTECA CONSOLIDADA + UPLOAD INTELIGENTE
==========================================================
Admin: Documentos + Fotos + Biblioteca em um único acervo.
Organização: Cliente > Contrato/Projeto > categorias existentes.
Nenhuma categoria vazia é renderizada.
*/

(function () {
    "use strict";

    const CATEGORIAS = [
        ["contrato", "Contratos"],
        ["orcamento", "Orçamentos e Propostas"],
        ["projeto", "Projetos"],
        ["art", "ART e RRT"],
        ["guia_estilos", "Guias de Estilos Arquitetônicos"],
        ["guia_obras", "Guias de Obra"],
        ["laudo", "Laudos e Pareceres"],
        ["memorial", "Memoriais Descritivos"],
        ["norma", "Normas Técnicas"],
        ["modelo", "Modelos"],
        ["imagens", "Imagens"],
        ["outros", "Outros"]
    ];

    const ROTULOS = Object.fromEntries(CATEGORIAS);
    let estadoAdmin = null;

    function normalizar(texto) {
        return String(texto || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[_-]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function classificar(nomeArquivo, categoriaInformada = "") {
        const informada = normalizar(categoriaInformada);

        for (const [id, label] of CATEGORIAS) {
            if (
                id !== "outros" &&
                (
                    informada === normalizar(id) ||
                    informada === normalizar(label)
                )
            ) {
                return id;
            }
        }

        const nome = normalizar(nomeArquivo);
        const regras = [
            ["art", /(^|\s)(art|rrt)(\s|$)|anotacao de responsabilidade|registro de responsabilidade/],
            ["laudo", /laudo|parecer|vistoria|inspecao|relatorio tecnico|diagnostico/],
            ["guia_estilos", /guia.*estilo|estilo.*arquitet|interiores|moodboard|paleta|conceito visual|tecidos|moveis|iluminacao|lampadas|pisos.*revestimentos|banheiros.*cozinhas/],
            ["guia_obras", /guia.*obra|manual.*obra|caderno.*obra|execucao.*obra|concretagem|armaduras|cobrimento|alvenaria|vergas|contravergas|impermeabilizacao|cobertura|telhas|rufos|calhas|agua.*esgoto|esgoto.*pluvial|eletrica|eletrodutos|circuitos|ar condicionado|ventilacao|exaustao|chapisco|emboco|reboco|drywall|contrapiso|caimentos|pintura.*patologias|loucas.*metais.*tomadas/],
            ["contrato", /contrato|aditivo|distrato|termo de aceite/],
            ["orcamento", /orcamento|proposta|cotacao|estimativa de custo/],
            ["memorial", /memorial|caderno de especifica|especificacao tecnica/],
            ["norma", /(^|\s)(nbr|abnt|norma)(\s|$)/],
            ["modelo", /modelo|template|padrao de documento/],
            ["projeto", /projeto|planta|corte|fachada|detalhamento|layout|levantamento|implantacao/]
        ];

        for (const [categoria, regra] of regras) {
            if (regra.test(nome)) return categoria;
        }

        if (/\.(?:png|jpe?g|webp|gif|svg|heic)$/i.test(String(nomeArquivo || ""))) {
            return "imagens";
        }

        return "outros";
    }

    function rotulo(categoria) {
        return ROTULOS[categoria] || "Outros";
    }

    function escapar(valor) {
        return String(valor ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function nomeAmigavel(nomeArquivo) {
        return String(nomeArquivo || "Arquivo")
            .replace(/\.[^.]+$/, "")
            .replace(/[_-]+/g, " ")
            .replace(/\s+/g, " ")
            .trim() || "Arquivo";
    }

    function nomeSeguro(nomeArquivo) {
        const texto = String(nomeArquivo || "arquivo");
        const indice = texto.lastIndexOf(".");
        const extensao = indice > -1
            ? texto.slice(indice + 1).toLowerCase().replace(/[^a-z0-9]/g, "")
            : "";
        const base = (indice > -1 ? texto.slice(0, indice) : texto)
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || "arquivo";

        return extensao ? `${base}.${extensao}` : base;
    }

    function formatarTamanho(size) {
        const bytes = Number(size) || 0;
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1024 ** 3) return `${(bytes / (1024 ** 2)).toFixed(1)} MB`;
        return `${(bytes / (1024 ** 3)).toFixed(2)} GB`;
    }

    function nomeCliente(id) {
        return estadoAdmin?.clientes.find(item => String(item.id) === String(id))?.nome
            || "Cliente não informado";
    }

    function nomeProjeto(id) {
        const projeto = estadoAdmin?.projetos.find(item => String(item.id) === String(id));
        if (!projeto) return "Contrato não informado";
        return window.cmRotuloContrato?.(projeto)
            || projeto.numero_contrato
            || projeto.nome
            || "Projeto";
    }

    function unificarItens(biblioteca, documentos, fotos) {
        return [
            ...biblioteca.map(item => ({
                origem: "biblioteca",
                id: item.id,
                cliente_id: item.cliente_id,
                projeto_id: item.projeto_id,
                nome: item.nome || "Arquivo",
                descricao: item.descricao || "",
                categoria: classificar(item.nome_original || item.nome, item.categoria || item.tipo),
                tamanho: item.tamanho || "",
                url: item.url || "",
                urlErro: item.urlErro || "",
                arquivo: item.arquivo || "",
                autoral: item.autoral === true
            })),
            ...documentos.map(item => ({
                origem: "documento",
                id: item.id,
                cliente_id: item.cliente_id,
                projeto_id: item.projeto_id,
                nome: item.nome || item.titulo || "Documento",
                descricao: item.descricao || "",
                categoria: classificar(item.nome_original || item.arquivo || item.nome, item.tipo),
                tamanho: item.tamanho || "",
                url: item.url || "",
                urlErro: item.urlErro || "",
                arquivo: item.arquivo || "",
                autoral: item.autoral === true
            })),
            ...fotos.map(item => ({
                origem: "foto",
                id: item.id,
                cliente_id: item.cliente_id,
                projeto_id: item.projeto_id,
                nome: item.nome || item.titulo || "Imagem",
                descricao: item.descricao || "",
                categoria: "imagens",
                tamanho: item.tamanho || "",
                url: item.url || "",
                urlErro: item.urlErro || "",
                arquivo: item.arquivo || ""
            }))
        ];
    }

    function cardItem(item) {
        if (item.origem === "foto") {
            return `
                <article class="cm-file-card cm-photo-card" data-categoria="${escapar(item.categoria)}">
                    ${item.url
                        ? `<img class="cm-library-thumb" src="${escapar(item.url)}" alt="${escapar(item.nome)}" loading="lazy">`
                        : '<div class="cm-file-icon"><i class="fa-solid fa-image"></i></div>'}
                    <div class="cm-file-copy">
                        <h5>${escapar(item.nome)}</h5>
                        <p>${escapar(item.descricao || "Imagem do projeto")}</p>
                        <div class="cm-file-actions">
                            <a class="cm-file-action" href="fotos.html">
                                <i class="fa-solid fa-images"></i> Ver em Fotos
                            </a>
                        </div>
                    </div>
                </article>
            `;
        }

        if (item.origem === "documento") {
            return `
                <article class="cm-file-card" data-categoria="${escapar(item.categoria)}">
                    <div class="cm-file-icon"><i class="fa-solid fa-file-lines"></i></div>
                    <div class="cm-file-copy">
                        <h5>${escapar(item.nome)}</h5>
                        <p>${escapar(item.descricao || rotulo(item.categoria))}</p>
                        ${item.autoral ? '<span class="cme-authorship-badge"><i class="fa-solid fa-shield-halved"></i> PDF autoral rastreável</span>' : ""}
                        <div class="cm-file-actions">
                            <a class="cm-file-action" href="documentos.html?documento=${encodeURIComponent(item.id)}">
                                <i class="fa-solid fa-eye"></i> Abrir
                            </a>
                            <a class="cm-file-action" href="documentos.html?documento=${encodeURIComponent(item.id)}&acao=editar">
                                <i class="fa-solid fa-pen"></i> Editar
                            </a>
                        </div>
                    </div>
                </article>
            `;
        }

        return `
            <article class="cm-file-card arquivo-item" data-categoria="${escapar(item.categoria)}">
                <div class="cm-file-icon"><i class="fa-solid fa-file"></i></div>
                <div class="cm-file-copy item-info">
                    <h5>${escapar(item.nome)}</h5>
                    <span hidden>${escapar(item.categoria)}</span>
                    <p>${escapar(item.descricao || rotulo(item.categoria))}</p>
                    ${item.autoral ? '<span class="cme-authorship-badge"><i class="fa-solid fa-shield-halved"></i> PDF autoral rastreável</span>' : ""}
                    ${item.tamanho ? `<small>${escapar(item.tamanho)}</small>` : ""}
                    <div class="cm-file-actions">
                        ${item.url
                            ? `<a class="cm-file-action" href="${escapar(item.url)}" target="_blank" rel="noopener">
                                <i class="fa-solid fa-arrow-up-right-from-square"></i> Abrir
                               </a>`
                            : ""}
                        <button type="button" class="cm-file-action"
                            data-acao-biblioteca="editar" data-id="${escapar(item.id)}">
                            <i class="fa-solid fa-pen"></i> Editar
                        </button>
                        <button type="button" class="cm-file-action cm-file-delete"
                            data-acao-biblioteca="excluir" data-id="${escapar(item.id)}">
                            <i class="fa-solid fa-trash"></i> Excluir
                        </button>
                    </div>
                </div>
            </article>
        `;
    }

    function renderizarAdmin(itens = estadoAdmin?.itens || [], abrir = false) {
        const raiz = document.getElementById("listaBiblioteca");
        if (!raiz || !estadoAdmin) return;

        if (!itens.length) {
            raiz.innerHTML = '<div class="estado-vazio">Nenhum arquivo cadastrado.</div>';
            return;
        }

        const porCliente = new Map();

        for (const item of itens) {
            const cliente = String(item.cliente_id || "sem-cliente");
            const projeto = String(item.projeto_id || "sem-projeto");

            if (!porCliente.has(cliente)) porCliente.set(cliente, new Map());
            const projetos = porCliente.get(cliente);
            if (!projetos.has(projeto)) projetos.set(projeto, []);
            projetos.get(projeto).push(item);
        }

        raiz.innerHTML = [...porCliente.entries()].map(([clienteId, projetos]) => {
            const totalCliente = [...projetos.values()]
                .reduce((soma, lista) => soma + lista.length, 0);

            const projetosHtml = [...projetos.entries()].map(([projetoId, lista]) => {
                const porCategoria = new Map();

                for (const item of lista) {
                    if (!porCategoria.has(item.categoria)) porCategoria.set(item.categoria, []);
                    porCategoria.get(item.categoria).push(item);
                }

                const categoriasHtml = CATEGORIAS
                    .filter(([id]) => porCategoria.has(id))
                    .map(([id]) => {
                        const categoriaItens = porCategoria.get(id);
                        return `
                            <details class="cm-category-folder" data-categoria="${id}">
                                <summary>
                                    <span class="cm-folder-title">${escapar(rotulo(id))}</span>
                                    <span class="cm-folder-count">${categoriaItens.length}</span>
                                </summary>
                                <div class="cm-file-grid">
                                    ${categoriaItens.map(cardItem).join("")}
                                </div>
                            </details>
                        `;
                    }).join("");

                return `
                    <section class="cme-subpasta-projeto">
                        <h4>${escapar(nomeProjeto(projetoId))}</h4>
                        <div class="cm-category-list">${categoriasHtml}</div>
                    </section>
                `;
            }).join("");

            return `
                <details class="cme-pasta-cliente cm-client-folder" ${abrir ? "open" : ""}>
                    <summary>
                        <span><i class="fa-solid fa-folder"></i> ${escapar(nomeCliente(clienteId))}</span>
                        <span class="cme-pasta-contagem">${totalCliente} ${totalCliente === 1 ? "item" : "itens"}</span>
                    </summary>
                    <div class="cme-pasta-corpo">${projetosHtml}</div>
                </details>
            `;
        }).join("");
    }

    async function carregarAdmin() {
        if (!document.getElementById("listaBiblioteca")) return;

        try {
            const [biblioteca, documentos, fotos, clientes, projetos] = await Promise.all([
                window.dbBuscarBiblioteca(),
                window.dbBuscarDocumentos(),
                window.dbBuscarFotos(),
                window.dbBuscarClientes(),
                window.dbBuscarProjetos()
            ]);

            estadoAdmin = {
                biblioteca,
                documentos,
                fotos,
                clientes,
                projetos,
                itens: unificarItens(biblioteca, documentos, fotos)
            };

            renderizarAdmin();
            // A tela antiga também carrega dados; reafirma a estrutura final sem observer.
            window.setTimeout(() => renderizarAdmin(), 650);
        } catch (erro) {
            console.error("Não foi possível consolidar a Biblioteca.", erro);
        }
    }

    function configurarPesquisaAdmin() {
        const campo = document.getElementById("pesquisaBiblioteca");
        const botao = document.getElementById("btnPesquisarBiblioteca");
        if (!campo || !document.getElementById("listaBiblioteca")) return;

        const pesquisar = evento => {
            if (evento) {
                evento.preventDefault();
                evento.stopImmediatePropagation();
            }

            if (!estadoAdmin) return;
            const termo = normalizar(campo.value);

            if (!termo) {
                renderizarAdmin();
                return;
            }

            const filtrados = estadoAdmin.itens.filter(item =>
                [
                    item.nome,
                    item.descricao,
                    rotulo(item.categoria),
                    nomeCliente(item.cliente_id),
                    nomeProjeto(item.projeto_id)
                ].some(valor => normalizar(valor).includes(termo))
            );

            renderizarAdmin(filtrados, true);
        };

        campo.addEventListener("input", pesquisar, true);
        botao?.addEventListener("click", pesquisar, true);
    }

    function estaEditando() {
        const titulo = document.querySelector("#modalArquivo .modal-header h2")?.textContent || "";
        const botao = document.getElementById("salvarArquivo")?.textContent || "";
        return /editar|altera[cç][oõ]es/i.test(`${titulo} ${botao}`);
    }

    function renderizarDeteccao() {
        const input = document.getElementById("arquivoUpload");
        const preview = document.getElementById("cmDeteccaoCategorias");
        if (!input || !preview) return;

        const arquivos = Array.from(input.files || []);
        if (!arquivos.length) {
            preview.replaceChildren();
            return;
        }

        const categoriaManual = document.getElementById("arquivoCategoria")?.value || "automatico";
        const titulo = document.createElement("strong");
        titulo.textContent = arquivos.length === 1
            ? "Categoria detectada"
            : `${arquivos.length} arquivos selecionados`;

        const lista = document.createElement("ul");

        for (const arquivo of arquivos) {
            const categoria = categoriaManual === "automatico"
                ? classificar(arquivo.name)
                : categoriaManual;
            const li = document.createElement("li");
            const nome = document.createElement("span");
            const classe = document.createElement("strong");
            nome.textContent = arquivo.name;
            classe.textContent = rotulo(categoria);
            li.append(nome, classe);
            lista.append(li);
        }

        preview.replaceChildren(titulo, lista);
    }

    async function salvarNovosArquivos(evento) {
        const formulario = document.getElementById("formArquivo");
        const input = document.getElementById("arquivoUpload");

        if (!formulario || evento.target !== formulario || !input || estaEditando()) return;

        const arquivos = Array.from(input.files || []);
        if (!arquivos.length) return;

        evento.preventDefault();
        evento.stopImmediatePropagation();

        const clienteId = document.getElementById("arquivoCliente")?.value || "";
        const projetoId = document.getElementById("arquivoProjeto")?.value || "";
        const categoriaSelecionada = document.getElementById("arquivoCategoria")?.value || "automatico";
        const descricao = document.getElementById("arquivoDescricao")?.value.trim() || "";
        const nomeDigitado = document.getElementById("arquivoNome")?.value.trim() || "";
        const botao = document.getElementById("salvarArquivo");
        const status = document.getElementById("uploadLoteStatus");
        const bucket = window.BUCKETS?.BIBLIOTECA || "biblioteca";

        if (!clienteId || !projetoId) {
            window.alert("Selecione o cliente e o contrato.");
            return;
        }

        if (
            typeof window.dbUploadArquivo !== "function" ||
            typeof window.dbSalvarArquivoBiblioteca !== "function"
        ) {
            window.alert("O serviço de upload da Biblioteca não foi carregado.");
            return;
        }

        if (botao) {
            botao.disabled = true;
            botao.dataset.originalText = botao.textContent || "Salvar Arquivo";
        }
        if (status) {
            status.hidden = false;
            status.removeAttribute("data-type");
        }

        let concluidos = 0;

        try {
            for (let indice = 0; indice < arquivos.length; indice += 1) {
                const arquivo = arquivos[indice];
                const categoria = categoriaSelecionada === "automatico"
                    ? classificar(arquivo.name)
                    : categoriaSelecionada;
                const token = window.crypto?.randomUUID?.()
                    || `${Date.now()}-${indice}-${Math.random().toString(36).slice(2, 8)}`;
                const caminho = [
                    clienteId,
                    projetoId,
                    categoria,
                    `${token}-${nomeSeguro(arquivo.name)}`
                ].join("/");

                if (botao) botao.textContent = `Enviando ${indice + 1} de ${arquivos.length}`;
                if (status) status.textContent = `Enviando ${indice + 1} de ${arquivos.length}: ${arquivo.name}`;

                await window.dbUploadArquivo(bucket, caminho, arquivo);

                try {
                    await window.dbSalvarArquivoBiblioteca({
                        nome: arquivos.length === 1 && nomeDigitado
                            ? nomeDigitado
                            : nomeAmigavel(arquivo.name),
                        descricao,
                        categoria,
                        tipo: arquivo.type || "application/octet-stream",
                        tamanho: formatarTamanho(arquivo.size),
                        arquivo: caminho,
                        cliente_id: clienteId,
                        projeto_id: projetoId,
                        autoral: Boolean(window.CMEArquivoAutoralSelecionado?.())
                    });
                } catch (erroRegistro) {
                    await window.dbExcluirArquivoStorage?.(bucket, caminho).catch(() => {});
                    throw erroRegistro;
                }

                concluidos += 1;
            }

            if (status) {
                status.dataset.type = "sucesso";
                status.textContent = `${concluidos} arquivo(s) enviados e classificados com sucesso.`;
            }

            await carregarAdmin();

            window.setTimeout(() => location.reload(), 900);
        } catch (erro) {
            console.error("Erro no upload da Biblioteca.", erro);
            if (status) {
                status.dataset.type = "erro";
                status.textContent = `O envio parou após ${concluidos} de ${arquivos.length} arquivo(s).`;
            }
        } finally {
            if (botao) {
                botao.disabled = false;
                botao.textContent = botao.dataset.originalText || "Salvar Arquivo";
            }
        }
    }

    function iniciar() {
        const input = document.getElementById("arquivoUpload");
        const categoria = document.getElementById("arquivoCategoria");
        const formulario = document.getElementById("formArquivo");

        if (input) {
            input.multiple = true;
            input.addEventListener("change", renderizarDeteccao);
        }
        categoria?.addEventListener("change", renderizarDeteccao);
        formulario?.addEventListener("submit", salvarNovosArquivos, true);

        configurarPesquisaAdmin();

        const raiz = document.getElementById("listaBiblioteca");
        raiz?.addEventListener("click", evento => {
            const acao = evento.target.closest("[data-acao-biblioteca]");
            if (acao?.dataset.acaoBiblioteca === "excluir") {
                window.setTimeout(carregarAdmin, 1400);
            }
        }, true);

        formulario?.addEventListener("submit", () => {
            if (estaEditando()) {
                window.setTimeout(carregarAdmin, 1600);
            }
        });

        carregarAdmin();
    }

    window.CMEClassificarBiblioteca = classificar;
    window.CMERotuloCategoriaBiblioteca = rotulo;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciar, { once: true });
    } else {
        iniciar();
    }
}());
