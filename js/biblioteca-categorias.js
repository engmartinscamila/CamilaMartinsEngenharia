/*
==========================================================
CAMILA MARTINS ENGENHARIA
BIBLIOTECA — CATEGORIAS E UPLOAD EM LOTE
==========================================================
- 1 ou vários arquivos no mesmo fluxo;
- classificação automática por nome;
- pastas de categoria somente quando há conteúdo;
- sem MutationObserver e sem bloquear o CRUD de edição.
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
        ["norma", "Normas"],
        ["modelo", "Modelos"],
        ["imagens", "Imagens"],
        ["outros", "Outros"]
    ];

    const ROTULOS = Object.fromEntries(CATEGORIAS);

    function normalizar(texto) {
        return String(texto || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[_-]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function classificar(nomeArquivo) {
        const nome = normalizar(nomeArquivo);

        const regras = [
            ["art", /(^|\s)(art|rrt)(\s|$)|anotacao de responsabilidade|registro de responsabilidade/],
            ["laudo", /laudo|parecer|vistoria|inspecao|relatorio tecnico|diagnostico/],
            ["guia_estilos", /guia.*estilo|estilo.*arquitet|moodboard|paleta|conceito visual/],
            ["guia_obras", /guia.*obra|manual.*obra|caderno.*obra|execucao.*obra/],
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

    function nomeAmigavel(nomeArquivo) {
        const semExtensao = String(nomeArquivo || "Arquivo").replace(/\.[^.]+$/, "");
        const limpo = semExtensao
            .replace(/[_-]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();

        return limpo || "Arquivo";
    }

    function nomeSeguro(nomeArquivo) {
        const texto = String(nomeArquivo || "arquivo");
        const indice = texto.lastIndexOf(".");
        const extensao = indice > -1 ? texto.slice(indice + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
        const base = (indice > -1 ? texto.slice(0, indice) : texto)
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || "arquivo";

        return extensao ? `${base}.${extensao}` : base;
    }

    function tamanho(size) {
        const bytes = Number(size) || 0;
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1024 ** 3) return `${(bytes / (1024 ** 2)).toFixed(1)} MB`;
        return `${(bytes / (1024 ** 3)).toFixed(2)} GB`;
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

            const item = document.createElement("li");
            const nome = document.createElement("span");
            const classe = document.createElement("strong");

            nome.textContent = arquivo.name;
            classe.textContent = rotulo(categoria);
            item.append(nome, classe);
            lista.append(item);
        }

        preview.replaceChildren(titulo, lista);
    }

    function validarFuncoes() {
        return [
            "dbUploadArquivo",
            "dbSalvarArquivoBiblioteca"
        ].every(nome => typeof window[nome] === "function");
    }

    async function salvarNovosArquivos(evento) {
        const formulario = document.getElementById("formArquivo");
        const input = document.getElementById("arquivoUpload");

        if (!formulario || !input || evento.target !== formulario) return;
        if (estaEditando()) return;

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

        if (!validarFuncoes()) {
            window.alert("O serviço de upload da Biblioteca não foi carregado. Atualize a página e tente novamente.");
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

                if (botao) {
                    botao.textContent = `Enviando ${indice + 1} de ${arquivos.length}`;
                }
                if (status) {
                    status.textContent = `Enviando ${indice + 1} de ${arquivos.length}: ${arquivo.name}`;
                }

                await window.dbUploadArquivo(bucket, caminho, arquivo);

                try {
                    await window.dbSalvarArquivoBiblioteca({
                        nome: arquivos.length === 1 && nomeDigitado
                            ? nomeDigitado
                            : nomeAmigavel(arquivo.name),
                        descricao,
                        categoria,
                        tipo: arquivo.type || "application/octet-stream",
                        tamanho: tamanho(arquivo.size),
                        arquivo: caminho,
                        cliente_id: clienteId,
                        projeto_id: projetoId
                    });
                } catch (erroRegistro) {
                    if (typeof window.dbExcluirArquivoStorage === "function") {
                        await window.dbExcluirArquivoStorage(bucket, caminho).catch(() => {});
                    }
                    throw erroRegistro;
                }

                concluidos += 1;
            }

            if (status) {
                status.dataset.type = "sucesso";
                status.textContent = arquivos.length === 1
                    ? "Arquivo enviado com sucesso."
                    : `${arquivos.length} arquivos enviados com sucesso.`;
            }

            if (botao) botao.textContent = "Concluído";

            window.alert(
                arquivos.length === 1
                    ? "Arquivo adicionado com sucesso."
                    : `${arquivos.length} arquivos adicionados com sucesso.`
            );

            window.setTimeout(() => window.location.reload(), 800);
        } catch (erro) {
            console.error("Erro no upload da Biblioteca.", erro);

            if (status) {
                status.dataset.type = "erro";
                status.textContent = `O envio parou após ${concluidos} de ${arquivos.length} arquivo(s).`;
            }

            window.alert(
                `Não foi possível concluir o envio. ${concluidos} de ${arquivos.length} arquivo(s) foram salvos.`
            );
        } finally {
            if (botao) {
                botao.disabled = false;
                botao.textContent = botao.dataset.originalText || "Salvar Arquivo";
            }
        }
    }

    function normalizarCategoriaExibida(texto) {
        const valor = normalizar(texto).replace(/^categoria\s*:?\s*/, "");

        for (const [id, label] of CATEGORIAS) {
            if (
                valor === normalizar(id) ||
                valor === normalizar(label) ||
                valor.includes(normalizar(label))
            ) {
                return id;
            }
        }

        if (/art|rrt/.test(valor)) return "art";
        if (/estilo/.test(valor)) return "guia_estilos";
        if (/obra/.test(valor)) return "guia_obras";
        if (/laudo|parecer/.test(valor)) return "laudo";
        if (/memorial/.test(valor)) return "memorial";
        if (/norma|abnt|nbr/.test(valor)) return "norma";
        if (/orcamento|proposta/.test(valor)) return "orcamento";
        if (/contrato/.test(valor)) return "contrato";
        if (/projeto/.test(valor)) return "projeto";
        if (/imagem|foto/.test(valor)) return "imagens";

        return "outros";
    }

    function criarPastaCategoria(categoria, itens) {
        const details = document.createElement("details");
        details.className = "cm-category-folder";
        details.open = true;

        const summary = document.createElement("summary");
        const titulo = document.createElement("span");
        titulo.className = "cm-folder-title";

        const icone = document.createElement("i");
        icone.className = "fa-solid fa-folder";

        const texto = document.createElement("span");
        texto.textContent = rotulo(categoria);

        titulo.append(icone, texto);

        const count = document.createElement("span");
        count.className = "cm-folder-count";
        count.textContent = String(itens.length);

        summary.append(titulo, count);

        const grid = document.createElement("div");
        grid.className = "cm-file-grid";
        for (const item of itens) grid.append(item);

        details.append(summary, grid);
        return details;
    }

    function organizarBibliotecaAdmin() {
        const raiz = document.getElementById("listaBiblioteca");
        if (!raiz) return;

        for (const pasta of raiz.querySelectorAll(".pasta-cliente")) {
            if (pasta.dataset.cmCategoriasOrganizadas === "true") continue;

            const subpasta = pasta.querySelector(".subpasta");
            if (!subpasta) continue;

            const arquivos = Array.from(subpasta.querySelectorAll(".arquivo-item"));
            if (!arquivos.length) continue;

            const grupos = new Map();

            for (const arquivo of arquivos) {
                const spans = arquivo.querySelectorAll(".item-info span");
                const categoria = normalizarCategoriaExibida(spans[0]?.textContent || "");
                if (!grupos.has(categoria)) grupos.set(categoria, []);
                grupos.get(categoria).push(arquivo);
            }

            const fragmento = document.createDocumentFragment();
            for (const [categoria, itens] of grupos) {
                fragmento.append(criarPastaCategoria(categoria, itens));
            }

            subpasta.replaceChildren(fragmento);
            pasta.dataset.cmCategoriasOrganizadas = "true";
        }
    }

    function organizarBibliotecaCliente() {
        if (document.body?.dataset.area !== "biblioteca") return;

        const raiz = document.getElementById("areaContent");
        const grid = raiz?.querySelector(":scope > .items-grid");
        if (!raiz || !grid || raiz.dataset.cmCategoriasOrganizadas === "true") return;

        const cards = Array.from(grid.querySelectorAll(":scope > .item-card"));
        if (!cards.length) return;

        const grupos = new Map();

        for (const card of cards) {
            const meta = card.querySelector(".item-meta span")?.textContent || "";
            const categoria = normalizarCategoriaExibida(meta);
            if (!grupos.has(categoria)) grupos.set(categoria, []);
            grupos.get(categoria).push(card);
        }

        const biblioteca = document.createElement("div");
        biblioteca.className = "cm-library";

        for (const [categoria, itens] of grupos) {
            biblioteca.append(criarPastaCategoria(categoria, itens));
        }

        raiz.replaceChildren(biblioteca);
        raiz.dataset.cmCategoriasOrganizadas = "true";
    }

    function organizarPastas() {
        organizarBibliotecaAdmin();
        organizarBibliotecaCliente();
    }

    function iniciar() {
        const formulario = document.getElementById("formArquivo");
        const input = document.getElementById("arquivoUpload");
        const categoria = document.getElementById("arquivoCategoria");

        if (input) {
            input.multiple = true;
            input.addEventListener("change", renderizarDeteccao);
        }

        categoria?.addEventListener("change", renderizarDeteccao);

        if (formulario) {
            formulario.addEventListener("submit", salvarNovosArquivos, true);
        }

        organizarPastas();
        window.setTimeout(organizarPastas, 500);
        window.setTimeout(organizarPastas, 1400);
        window.setTimeout(organizarPastas, 2800);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciar, { once: true });
    } else {
        iniciar();
    }

    window.CMEClassificarBiblioteca = classificar;
}());
