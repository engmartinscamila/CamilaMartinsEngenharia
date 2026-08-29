/*
=====================================================
CAMILA MARTINS ENGENHARIA
FOTOS.JS — ÁLBUNS + VISUALIZADOR DE IMAGENS
=====================================================
*/

(function moduloFotos() {
    "use strict";

    let fotos = [];
    let clientes = [];
    let projetos = [];
    let fotoSelecionadaId = null;
    let albumAtualKey = null;
    let visualizadorIds = [];
    let visualizadorIndex = -1;

    document.addEventListener("DOMContentLoaded", iniciar, { once: true });

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
            renderizarAlbuns();
        } catch (error) {
            tratarErro("Não foi possível carregar as fotos.", error);
        } finally {
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
        document.getElementById("albumFotos")?.addEventListener("click", tratarAcao);
        document.getElementById("visualizadorFoto")?.addEventListener("click", tratarAcao);

        document.getElementById("modalFoto")?.addEventListener("click", event => {
            if (event.target.id === "modalFoto") fecharModal();
        });

        document.getElementById("visualizadorFoto")?.addEventListener("click", event => {
            if (event.target.id === "visualizadorFoto") fecharVisualizador();
        });

        document.addEventListener("keydown", tratarTecladoVisualizador);
    }

    function agruparAlbuns(lista = fotos) {
        const mapa = new Map();

        for (const foto of lista) {
            const clienteId = String(foto.cliente_id || "sem-cliente");
            const projetoId = String(foto.projeto_id || "sem-projeto");
            const key = clienteId + "::" + projetoId;

            if (!mapa.has(key)) {
                mapa.set(key, {
                    key,
                    cliente_id: foto.cliente_id || null,
                    projeto_id: foto.projeto_id || null,
                    fotos: []
                });
            }

            mapa.get(key).fotos.push(foto);
        }

        return [...mapa.values()].sort((a, b) => {
            const cliente = nomeCliente(a.cliente_id).localeCompare(
                nomeCliente(b.cliente_id),
                "pt-BR",
                { sensitivity: "base" }
            );
            if (cliente !== 0) return cliente;

            return nomeProjeto(a.projeto_id).localeCompare(
                nomeProjeto(b.projeto_id),
                "pt-BR",
                { sensitivity: "base" }
            );
        });
    }

    function renderizarAlbuns(lista = fotos) {
        const galeria = document.getElementById("galeriaFotos");
        const albumView = document.getElementById("albumFotos");
        if (!galeria) return;

        albumAtualKey = null;
        if (albumView) albumView.hidden = true;
        galeria.hidden = false;

        const albuns = agruparAlbuns(lista);

        if (!albuns.length) {
            galeria.innerHTML = '<div class="estado-vazio">Nenhuma foto encontrada.</div>';
            return;
        }

        galeria.innerHTML = albuns.map(album => {
            const projeto = obterProjeto(album.projeto_id);
            const contrato = numeroContrato(projeto);
            const parceria = Boolean(projeto?.parceria);
            const quantidade = album.fotos.length;
            const capas = album.fotos.filter(foto => Boolean(foto.url)).slice(0, 4);

            return `
                <button type="button"
                    class="foto-album-card"
                    data-acao-foto="abrir-album"
                    data-album="${escapar(album.key)}"
                    aria-label="Abrir álbum ${escapar(nomeProjeto(album.projeto_id))} de ${escapar(nomeCliente(album.cliente_id))}">
                    <div class="foto-album-capa">
                        ${renderizarMosaico(capas)}
                        <span class="foto-album-quantidade">
                            ${quantidade} ${quantidade === 1 ? "foto" : "fotos"}
                        </span>
                    </div>
                    <div class="foto-album-info">
                        <span class="foto-album-cliente">${escapar(nomeCliente(album.cliente_id))}</span>
                        <strong>${escapar(nomeProjeto(album.projeto_id))}</strong>
                        <div class="foto-album-meta">
                            ${contrato ? `<span><i class="fa-solid fa-file-signature"></i> Contrato ${escapar(contrato)}</span>` : ""}
                            ${parceria ? '<span><i class="fa-solid fa-handshake"></i> Parceria</span>' : ""}
                        </div>
                        <span class="foto-album-abrir">
                            Abrir álbum <i class="fa-solid fa-chevron-right"></i>
                        </span>
                    </div>
                </button>
            `;
        }).join("");
    }

    function renderizarMosaico(capas) {
        if (!capas.length) {
            return `
                <div class="foto-album-vazio">
                    <i class="fa-regular fa-images"></i>
                    <span>Sem prévia</span>
                </div>
            `;
        }

        const classe = "foto-album-mosaico foto-album-mosaico-" + Math.min(capas.length, 4);

        return `
            <div class="${classe}">
                ${capas.map(foto => `
                    <img src="${escapar(foto.url)}"
                        alt=""
                        loading="lazy"
                        decoding="async">
                `).join("")}
            </div>
        `;
    }

    function abrirAlbum(key, lista = null) {
        const galeria = document.getElementById("galeriaFotos");
        const albumView = document.getElementById("albumFotos");
        if (!galeria || !albumView) return;

        const album = agruparAlbuns(fotos).find(item => item.key === String(key));
        if (!album) {
            renderizarAlbuns();
            return;
        }

        albumAtualKey = album.key;
        galeria.hidden = true;
        albumView.hidden = false;

        const projeto = obterProjeto(album.projeto_id);
        const contrato = numeroContrato(projeto);
        const fotosDoAlbum = Array.isArray(lista) ? lista : album.fotos;

        preencherTexto("albumTitulo", nomeProjeto(album.projeto_id));
        preencherTexto("albumCliente", nomeCliente(album.cliente_id));
        preencherTexto(
            "albumContrato",
            contrato
                ? "Contrato " + contrato
                : (projeto?.parceria ? "Parceria" : "")
        );
        preencherTexto(
            "albumQuantidade",
            fotosDoAlbum.length + " " + (fotosDoAlbum.length === 1 ? "foto" : "fotos")
        );

        const grade = document.getElementById("albumGrade");
        if (!grade) return;

        if (!fotosDoAlbum.length) {
            grade.innerHTML = '<div class="estado-vazio">Nenhuma foto corresponde à pesquisa neste álbum.</div>';
            return;
        }

        grade.innerHTML = fotosDoAlbum.map(foto => `
            <article class="foto-miniatura-card">
                <button type="button"
                    class="foto-miniatura-imagem"
                    data-acao-foto="visualizar"
                    data-id="${escapar(foto.id)}"
                    aria-label="Visualizar ${escapar(foto.nome || "foto")}">
                    ${foto.url
                        ? `<img src="${escapar(foto.url)}" alt="${escapar(foto.nome || "Foto")}" loading="lazy" decoding="async">`
                        : `<span class="foto-miniatura-indisponivel">
                            <i class="fa-regular fa-image"></i>
                            Imagem indisponível
                           </span>`}
                </button>
                <div class="foto-miniatura-rodape">
                    <span title="${escapar(foto.nome || "Foto sem título")}">
                        ${escapar(foto.nome || "Foto sem título")}
                    </span>
                    <div class="foto-miniatura-acoes">
                        ${botao("editar", foto.id, "fa-pen", "Editar foto", "edit")}
                        ${botao("excluir", foto.id, "fa-trash", "Excluir foto", "delete")}
                    </div>
                </div>
            </article>
        `).join("");
    }

    function voltarAlbuns() {
        fecharVisualizador();
        const termo = valor("pesquisaFoto").toLocaleLowerCase("pt-BR");
        if (!termo) {
            renderizarAlbuns();
            return;
        }

        const filtradas = filtrarFotos(termo);
        renderizarAlbuns(filtradas);
    }

    function tratarAcao(event) {
        const alvo = event.target.closest("[data-acao-foto]");
        if (!alvo) return;

        event.preventDefault();
        event.stopPropagation();

        const acao = alvo.dataset.acaoFoto;
        const id = alvo.dataset.id;
        const album = alvo.dataset.album;

        if (acao === "abrir-album") abrirAlbum(album);
        if (acao === "voltar-albuns") voltarAlbuns();
        if (acao === "visualizar") abrirVisualizador(id);
        if (acao === "editar") editarFoto(id);
        if (acao === "excluir") excluirFoto(id);
        if (acao === "viewer-anterior") navegarVisualizador(-1);
        if (acao === "viewer-proxima") navegarVisualizador(1);
        if (acao === "viewer-fechar") fecharVisualizador();
        if (acao === "viewer-miniatura") abrirVisualizador(id, true);
    }

    function abrirVisualizador(id, manterLista = false) {
        const foto = localizar(id);
        if (!foto) return;

        if (!manterLista) {
            const album = albumAtualKey
                ? agruparAlbuns(fotos).find(item => item.key === albumAtualKey)
                : null;

            visualizadorIds = (album?.fotos || [foto]).map(item => String(item.id));
        }

        const indice = visualizadorIds.findIndex(item => item === String(id));
        visualizadorIndex = indice >= 0 ? indice : 0;

        const viewer = document.getElementById("visualizadorFoto");
        if (!viewer) return;

        viewer.hidden = false;
        viewer.classList.add("show");
        document.body.classList.add("foto-viewer-aberto");

        renderizarVisualizador();
    }

    function renderizarVisualizador() {
        if (visualizadorIndex < 0 || visualizadorIndex >= visualizadorIds.length) return;

        const foto = localizar(visualizadorIds[visualizadorIndex]);
        if (!foto) return;

        fotoSelecionadaId = foto.id;

        preencherTexto("viewerTitulo", foto.nome || "Foto");
        preencherTexto(
            "viewerMeta",
            nomeCliente(foto.cliente_id) + " · " + nomeProjeto(foto.projeto_id)
        );
        preencherTexto(
            "viewerContador",
            (visualizadorIndex + 1) + " / " + visualizadorIds.length
        );
        preencherTexto("viewerDescricao", foto.descricao || "");

        const imagem = document.getElementById("viewerImagem");
        const indisponivel = document.getElementById("viewerIndisponivel");

        if (imagem && indisponivel) {
            if (foto.url) {
                imagem.src = foto.url;
                imagem.alt = foto.nome || "Foto";
                imagem.hidden = false;
                indisponivel.hidden = true;
            } else {
                imagem.removeAttribute("src");
                imagem.hidden = true;
                indisponivel.hidden = false;
            }
        }

        const anterior = document.getElementById("viewerAnterior");
        const proxima = document.getElementById("viewerProxima");
        const unica = visualizadorIds.length <= 1;
        if (anterior) anterior.disabled = unica;
        if (proxima) proxima.disabled = unica;

        const editar = document.getElementById("viewerEditar");
        const excluir = document.getElementById("viewerExcluir");
        if (editar) editar.dataset.id = String(foto.id);
        if (excluir) excluir.dataset.id = String(foto.id);

        renderizarFilmstrip();
    }

    function renderizarFilmstrip() {
        const faixa = document.getElementById("viewerMiniaturas");
        if (!faixa) return;

        faixa.innerHTML = visualizadorIds.map((id, indice) => {
            const foto = localizar(id);
            if (!foto) return "";

            return `
                <button type="button"
                    class="viewer-miniatura ${indice === visualizadorIndex ? "ativo" : ""}"
                    data-acao-foto="viewer-miniatura"
                    data-id="${escapar(foto.id)}"
                    aria-label="Abrir ${escapar(foto.nome || "foto")}">
                    ${foto.url
                        ? `<img src="${escapar(foto.url)}" alt="" loading="lazy">`
                        : '<span><i class="fa-regular fa-image"></i></span>'}
                </button>
            `;
        }).join("");

        faixa.querySelector(".viewer-miniatura.ativo")
            ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }

    function navegarVisualizador(delta) {
        if (visualizadorIds.length <= 1) return;

        visualizadorIndex =
            (visualizadorIndex + delta + visualizadorIds.length) % visualizadorIds.length;

        renderizarVisualizador();
    }

    function fecharVisualizador() {
        const viewer = document.getElementById("visualizadorFoto");
        if (!viewer || viewer.hidden) return;

        viewer.classList.remove("show");
        viewer.hidden = true;
        document.body.classList.remove("foto-viewer-aberto");
        visualizadorIndex = -1;
    }

    function tratarTecladoVisualizador(event) {
        const viewer = document.getElementById("visualizadorFoto");
        if (!viewer || viewer.hidden) return;

        if (event.key === "Escape") fecharVisualizador();
        if (event.key === "ArrowLeft") navegarVisualizador(-1);
        if (event.key === "ArrowRight") navegarVisualizador(1);
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

        fecharVisualizador();
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

        if (!dados.nome || !dados.cliente_id || !dados.projeto_id) {
            alert("Informe o título, o cliente e o projeto.");
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
                novoCaminho =
                    dados.cliente_id + "/" +
                    dados.projeto_id + "/" +
                    Date.now() + "-" +
                    normalizarNome(arquivo.name);

                await dbUploadArquivo(BUCKETS.FOTOS, novoCaminho, arquivo);
            }

            dados.arquivo = novoCaminho;
            const editando = Boolean(fotoSelecionadaId);

            if (editando) {
                await dbEditarFoto(fotoSelecionadaId, dados);
            } else {
                await dbCriarFoto(dados);
            }

            if (arquivo && anterior?.arquivo && anterior.arquivo !== novoCaminho) {
                await dbExcluirArquivoStorage(BUCKETS.FOTOS, anterior.arquivo).catch(() => {});
            }

            const notificacao = await dbNotificarAtualizacao({
                tipo: editando ? "foto_atualizada" : "foto_publicada",
                cliente_id: dados.cliente_id,
                projeto_id: dados.projeto_id,
                titulo: dados.nome,
                mensagem: editando
                    ? "Uma foto do acompanhamento do seu projeto foi atualizada."
                    : "Uma nova foto do acompanhamento foi publicada no portal."
            });

            fecharModal();
            await recarregar();

            alert(
                (editando ? "Foto atualizada" : "Foto cadastrada") + " com sucesso." +
                (notificacao.enviado
                    ? "\nO cliente também recebeu um aviso por e-mail."
                    : "\nO registro foi salvo, mas o aviso por e-mail ainda não está configurado.")
            );
        } catch (error) {
            if (arquivo && novoCaminho && novoCaminho !== anterior?.arquivo) {
                await dbExcluirArquivoStorage(BUCKETS.FOTOS, novoCaminho).catch(() => {});
            }

            tratarErro("Não foi possível salvar a foto.", error);
        } finally {
            alternarSalvamento(botaoSalvar, false);
        }
    }

    async function excluirFoto(id) {
        const foto = localizar(id);
        if (!foto || !confirm('Excluir a foto "' + (foto.nome || "Sem título") + '"?')) return;

        const albumAnterior = chaveAlbum(foto);

        try {
            fecharVisualizador();
            await dbExcluirFoto(foto.id);

            if (foto.arquivo) {
                await dbExcluirArquivoStorage(BUCKETS.FOTOS, foto.arquivo).catch(() => {});
            }

            await recarregar(albumAnterior);
            alert("Foto excluída com sucesso.");
        } catch (error) {
            tratarErro("Não foi possível excluir a foto.", error);
        }
    }

    async function recarregar(preferirAlbum = albumAtualKey) {
        fotos = await dbBuscarFotos();

        if (preferirAlbum) {
            const album = agruparAlbuns(fotos).find(item => item.key === preferirAlbum);
            if (album?.fotos?.length) {
                abrirAlbum(preferirAlbum);
                return;
            }
        }

        renderizarAlbuns();
    }

    function pesquisar() {
        const termo = valor("pesquisaFoto").toLocaleLowerCase("pt-BR");

        if (!termo) {
            if (albumAtualKey) abrirAlbum(albumAtualKey);
            else renderizarAlbuns();
            return;
        }

        const filtradas = filtrarFotos(termo);

        if (albumAtualKey) {
            const somenteAlbum = filtradas.filter(foto => chaveAlbum(foto) === albumAtualKey);
            abrirAlbum(albumAtualKey, somenteAlbum);
            return;
        }

        renderizarAlbuns(filtradas);
    }

    function filtrarFotos(termo) {
        return fotos.filter(foto => {
            const projeto = obterProjeto(foto.projeto_id);
            return [
                foto.nome,
                foto.descricao,
                nomeCliente(foto.cliente_id),
                nomeProjeto(foto.projeto_id),
                numeroContrato(projeto)
            ].some(campo =>
                String(campo || "").toLocaleLowerCase("pt-BR").includes(termo)
            );
        });
    }

    function preencherSelect(id, itens) {
        const select = document.getElementById(id);
        if (!select) return;

        select.innerHTML =
            '<option value="">Selecione</option>' +
            itens.map(item =>
                '<option value="' + escapar(item.id) + '">' +
                escapar(item.nome) +
                "</option>"
            ).join("");
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
        if (!projetoId) return false;

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

    function botao(acao, id, icone, titulo, classe = "") {
        return `
            <button type="button"
                class="btn-icon ${classe}"
                data-acao-foto="${acao}"
                data-id="${escapar(id)}"
                title="${titulo}"
                aria-label="${titulo}">
                <i class="fa-solid ${icone}"></i>
            </button>
        `;
    }

    function localizar(id) {
        return fotos.find(foto => String(foto.id) === String(id));
    }

    function chaveAlbum(foto) {
        return String(foto?.cliente_id || "sem-cliente") + "::" +
            String(foto?.projeto_id || "sem-projeto");
    }

    function nomeCliente(id) {
        return clientes.find(cliente => String(cliente.id) === String(id))?.nome || "Cliente não informado";
    }

    function obterProjeto(id) {
        return projetos.find(projeto => String(projeto.id) === String(id)) || null;
    }

    function nomeProjeto(id) {
        return obterProjeto(id)?.nome || "Projeto sem nome";
    }

    function numeroContrato(projeto) {
        return String(projeto?.numero_contrato || "").trim();
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

    function preencherTexto(id, conteudo) {
        const elemento = document.getElementById(id);
        if (elemento) elemento.textContent = conteudo || "";
    }

    function normalizarNome(nome) {
        return String(nome || "imagem").replace(/[^a-zA-Z0-9._-]+/g, "-");
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
        alert(mensagem + (error?.message ? "\n" + error.message : ""));
    }
})();
