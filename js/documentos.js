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
    let salvando = false;
    const concluidos = new WeakSet();
    const contexto = new URLSearchParams(location.search);
    const visao = contexto.get('visao') || '';
    const projetoContexto = contexto.get('projectId') || contexto.get('projeto') || '';
    const clienteContexto = contexto.get('clientId') || '';
    const contextoValido = row => (!projetoContexto || String(row.projeto_id) === projetoContexto) && (!clienteContexto || String(row.cliente_id) === clienteContexto) && (visao !== 'biblioteca' || row.source === 'biblioteca') && (visao !== 'fotos' || window.CMEProjectFiles.image(row.arquivo));

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
            abrirDocumentoDaUrl();
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

    function renderizar(lista = documentos, abrirPastas = false) {
        lista = lista.filter(contextoValido);
        const container = document.getElementById("listaDocumentos");
        const recentes = document.getElementById("arquivosDocumento");
        if (!container) return;

        if (!lista.length) {
            container.innerHTML = '<div class="estado-vazio">Nenhum documento cadastrado.</div>';
            if (recentes) recentes.innerHTML = '<div class="estado-vazio">Nenhum arquivo recente.</div>';
            return;
        }

        const porCliente = lista.reduce((mapa, item) => {
            const chave = String(item.cliente_id || "sem-cliente");
            (mapa[chave] ||= []).push(item);
            return mapa;
        }, {});

        container.innerHTML = Object.values(porCliente).map(grupoCliente => {
            const primeiro = grupoCliente[0];

            const porProjeto = grupoCliente.reduce((mapa, item) => {
                const chave = String(item.projeto_id || "sem-projeto");
                (mapa[chave] ||= []).push(item);
                return mapa;
            }, {});

            const conteudo = Object.values(porProjeto).map(grupoProjeto => {
                const referencia = grupoProjeto[0];

                return `
                    <section class="cme-subpasta-projeto">
                        <h4>${escapar(rotuloProjeto(referencia.projeto_id))}</h4>
                        ${grupoProjeto.map(documento => `
                            <article class="item-lista documento-item">
                                <div class="item-info">
                                    <h3>${escapar(documento.nome)}</h3>
                                    <span>${escapar(categoriaExibida(documento))}</span>
                                </div>
                                <div class="item-acoes">
                                    ${botao("abrir", documento.id, "fa-eye", "Abrir detalhes")}
                                    ${botao("editar", documento.id, "fa-pen", "Editar documento", "edit")}
                                    ${botao("excluir", documento.id, "fa-trash", "Excluir documento", "delete")}
                                </div>
                            </article>
                        `).join("")}
                    </section>
                `;
            }).join("");

            return `
                <details class="pasta-cliente cme-pasta-cliente" ${abrirPastas ? "open" : ""}>
                    <summary>
                        <span><i class="fa-solid fa-folder"></i> ${escapar(nomeCliente(primeiro.cliente_id))}</span>
                        <span class="cme-pasta-contagem">${grupoCliente.length} ${grupoCliente.length === 1 ? "documento" : "documentos"}</span>
                    </summary>
                    <div class="cme-pasta-corpo">${conteudo}</div>
                </details>
            `;
        }).join("");

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
        preencher('documentoDestino', visao === 'biblioteca' ? 'biblioteca' : 'automatico');
        document.getElementById('documentoDestino').disabled = false;
        if (projetoContexto) { const p=projetos.find(item=>String(item.id)===projetoContexto); if(p){preencher('documentoCliente',p.cliente_id);preencherProjetos(p.id);} }
        atualizarModal("Cadastrar Documento", "Salvar Documento", true);
        abrirModal();
    }

    function editarDocumento(id) {
        const documento = localizar(id);
        if (!documento) return;

        documentoSelecionadoId = documento.id;
        const autoria = document.getElementById('documentoAutoral');
        if (autoria) { autoria.checked = documento.autoral === true; autoria.dataset.touched = 'false'; }
        preencher('documentoDestino', documento.source === 'biblioteca' ? 'biblioteca' : 'automatico');
        document.getElementById('documentoDestino').disabled = true;
        preencher("documentoNome", documento.nome);
        preencher("documentoCliente", documento.cliente_id);
        preencherProjetos(documento.projeto_id);
        const categoriaAtual=categoriaExibida(documento,true), selectCategoria=document.getElementById('documentoCategoria');
        if(categoriaAtual && !Array.from(selectCategoria.options).some(option=>option.value===categoriaAtual))selectCategoria.add(new Option(categoriaAtual,categoriaAtual));
        preencher("documentoCategoria", categoriaAtual);
        preencher("documentoDescricao", documento.descricao);
        atualizarModal("Editar Documento", "Salvar Alterações", false);
        abrirModal();
    }

    async function salvarDocumento(event) {
        event.preventDefault();
        if (salvando) return;
        const anterior = localizar(documentoSelecionadoId);
        const dados = {nome:valor('documentoNome'),tipo:valor('documentoCategoria'),cliente_id:valor('documentoCliente'),projeto_id:valor('documentoProjeto'),descricao:valor('documentoDescricao'),source:anterior?.source || (valor('documentoDestino')==='biblioteca'?'biblioteca':undefined),autoral:Boolean(document.getElementById('documentoAutoral')?.checked)};
        const arquivos = Array.from(document.getElementById('documentoArquivo')?.files || []);
        if (!dados.nome || !projetoPertenceAoCliente(dados.projeto_id,dados.cliente_id)) {alert('Informe nome, cliente e um projeto vinculado.');return;}
        if (!anterior && !arquivos.length) {alert('Selecione um arquivo.');return;}
        if (anterior && arquivos.length>1) {alert('Edite apenas um arquivo por vez.');return;}
        try {for(const arquivo of arquivos) window.CMEProjectFiles.validate(arquivo,dados.autoral);}catch(error){alert(error.message);return;}
        salvando=true;
        const botaoSalvar=document.getElementById('salvarDocumento');alternarSalvamento(botaoSalvar,true);
        let publicados=0;
        try {
            for(const [indice,arquivo] of (arquivos.length?arquivos:[null]).entries()){
                if(arquivo && concluidos.has(arquivo))continue;
                const nomeLote=document.querySelectorAll('.documento-nome-lote')[indice]?.value?.trim();
                const tipoLote=document.querySelectorAll('.documento-categoria-lote')[indice]?.value;
                const item={...dados,nome:arquivos.length>1?(nomeLote||arquivo.name):dados.nome,tipo:tipoLote||dados.tipo};
                const bucket=arquivo?window.CMEProjectFiles.bucket(arquivo):anterior.storage_bucket;
                const caminho=arquivo?`${dados.cliente_id}/${dados.projeto_id}/${crypto.randomUUID()}-${normalizarNome(arquivo.name)}`:anterior.arquivo;
                let persistido=false;
                try{
                    if(arquivo)await dbUploadArquivo(bucket,caminho,arquivo);
                    item.arquivo=caminho;item.storage_bucket=bucket;
                    if(anterior)await dbEditarDocumento(anterior.id,item);else await dbCriarDocumento(item);
                    persistido=true;publicados++;
                    if(arquivo)concluidos.add(arquivo);
                }catch(error){
                    if(!persistido && arquivo)await dbExcluirArquivoStorage(bucket,caminho).catch(()=>{});
                    throw error;
                }
                if(arquivo&&anterior?.arquivo&&anterior.arquivo!==caminho){
                    try{await dbExcluirArquivoStorage(anterior.storage_bucket,anterior.arquivo);}catch{alert('Arquivo salvo. A limpeza do arquivo anterior ficou pendente em Armazenamento e auditoria.');}
                }
            }
            let notificacao;
            try{notificacao=await dbNotificarAtualizacao({tipo:dados.source==='biblioteca'?'biblioteca_atualizada':anterior?'documento_atualizado':'documento_publicado',cliente_id:dados.cliente_id,projeto_id:dados.projeto_id,titulo:dados.nome,mensagem:anterior?'Um arquivo do seu projeto foi atualizado.':'Novos arquivos foram disponibilizados no seu portal.'});}catch{notificacao={enviado:false,motivo:'Falha na solicitação de notificação.'};}
            salvando=false;fecharModal();
            try{await recarregar();}catch{alert('Os arquivos foram salvos. Não foi possível atualizar a lista; recarregue a página.');}
            alert('Arquivo(s) confirmado(s).'+avisoNotificacao(notificacao));
        } catch(error){tratarErro(`${publicados} arquivo(s) confirmado(s) nesta tentativa. O formulário foi preservado; repetir o envio ignora os arquivos já confirmados.`,error);}
        finally{salvando=false;alternarSalvamento(botaoSalvar,false);}
    }

    function mostrarDetalhes(id) {
        const documento = localizar(id);
        const painel = document.getElementById("detalhesDocumento");
        if (!documento || !painel) return;

        documentoSelecionadoId = documento.id;
        const visualizacao = criarVisualizacao(documento);

        painel.innerHTML = `
            <h3>${escapar(documento.nome)}</h3>
            <p><strong>Cliente:</strong> ${escapar(nomeCliente(documento.cliente_id))}</p>
            <p><strong>Projeto:</strong> ${escapar(nomeProjeto(documento.projeto_id))}</p>
            <p><strong>Categoria:</strong> ${escapar(documento.tipo || "-")}</p>
            <p><strong>Origem:</strong> ${escapar(documento.source)}${documento.references?.length>1?' · arquivo compartilhado por '+documento.references.length+' cadastros':''}</p>
            <p>${escapar(documento.descricao || "Sem descrição.")}</p>
            ${documento.url
                ? `${visualizacao}
                    ${window.CMEProjectFiles.image(documento.arquivo) ? `<p><a href="fotos.html?foto=${encodeURIComponent(documento.id)}">Ver no álbum do projeto</a></p>` : ''}
                    <p class="arquivo-links">
                        <a href="${escapar(documento.url)}" target="_blank" rel="noopener">
                            Abrir em nova guia
                        </a>
                        <a href="${escapar(documento.url)}" download>
                            Baixar arquivo
                        </a>
                    </p>`
                : `<div class="arquivo-indisponivel">
                    Arquivo indisponível${documento.urlErro ? `: ${escapar(documento.urlErro)}` : ""}
                </div>`}
            <div class="detalhes-acoes">
                ${botao("editar", documento.id, "fa-pen", "Editar documento", "edit")}
                ${botao("excluir", documento.id, "fa-trash", "Excluir documento", "delete")}
            </div>
        `;
    }

    function criarVisualizacao(documento) {
        if (!documento.url) return "";

        const extensao = String(documento.arquivo || "")
            .split("?")[0]
            .split(".")
            .pop()
            .toLocaleLowerCase("pt-BR");
        const url = escapar(documento.url);
        const titulo = escapar(documento.nome || "Documento");

        if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(extensao)) {
            return `
                <div class="arquivo-preview">
                    <img src="${url}" alt="Visualização de ${titulo}">
                </div>
            `;
        }

        if (extensao === "pdf") {
            return `
                <div class="arquivo-preview">
                    <iframe src="${url}" title="Visualização de ${titulo}"></iframe>
                </div>
            `;
        }

        return `
            <div class="arquivo-preview arquivo-preview-generico">
                <i class="fa-solid fa-file-arrow-down"></i>
                <span>Use os botões abaixo para abrir ou baixar este arquivo.</span>
            </div>
        `;
    }

    function abrirDocumentoDaUrl() {
        const parametros = new URLSearchParams(window.location.search);
        if (parametros.get("novo") === "1") { novoDocumento(); return; }
        const id = parametros.get("documento");
        const acao = parametros.get("acao");

        if (!id) return;
        if (!localizar(id)) { alert('O arquivo do link não foi encontrado ou seu acesso não foi autorizado.'); return; }

        if (acao === "editar") {
            editarDocumento(id);
        }
        else {
            mostrarDetalhes(id);
            document
                .getElementById("detalhesDocumento")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }

        parametros.delete('documento');parametros.delete('acao');window.history.replaceState({}, '', window.location.pathname + (parametros.size?'?'+parametros:''));
    }

    function avisoNotificacao(resultado) { return window.CMEEmailNotice(resultado); }

    async function excluirDocumento(id) {
        const documento = localizar(id);
        if (!documento || !confirm(`Excluir o cadastro "${documento.nome}"?${documento.references?.length>1?" Este arquivo possui outros vínculos. Eles e o arquivo compartilhado serão preservados.":""}`)) return;

        try {
            await dbExcluirDocumento(documento.id);
            if (documento.arquivo) {
                try{await dbExcluirArquivoStorage(documento.storage_bucket || BUCKETS.DOCUMENTOS, documento.arquivo);}catch{alert('Cadastro removido. A limpeza física ficou pendente em Armazenamento e auditoria.');}
            }
            limparDetalhes();
            await recarregar();
            alert("Cadastro removido. Arquivos ainda compartilhados foram preservados.");
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
            [documento.nome, categoriaExibida(documento), documento.descricao, nomeCliente(documento.cliente_id), nomeProjeto(documento.projeto_id)]
                .some(campo => String(campo || "").toLocaleLowerCase("pt-BR").includes(termo))
        ), true);
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
        if (!projetoId) return false;
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
        if(salvando && !confirm('Há um envio em andamento. Aguarde sua confirmação antes de fechar.'))return;
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
        return documentos.find(documento => String(documento.id) === String(id)) || documentos.find(documento => ['foto:'+id,'biblioteca:'+id].includes(String(documento.id)));
    }

    function categoriaExibida(documento, valorSelect = false) {
        const atual = String(documento?.tipo || "").trim();

        if (atual && atual !== "outros" && atual !== "automatico") {
            return atual;
        }

        const detectada = window.CMEClassificarDocumento?.(
            documento?.nome_original ||
            documento?.arquivo ||
            documento?.nome ||
            ""
        );

        if (detectada && detectada !== "outros") return detectada;
        return valorSelect ? "outros" : "outros";
    }

    function nomeCliente(id) {
        return clientes.find(cliente => String(cliente.id) === String(id))?.nome || "Não informado";
    }

    function nomeProjeto(id) {
        return projetos.find(projeto => String(projeto.id) === String(id))?.nome || "Não informado";
    }

    function rotuloProjeto(id) {
        const projeto = projetos.find(item => String(item.id) === String(id));
        return projeto ? (window.cmRotuloContrato?.(projeto) || projeto.nome) : "Contrato não informado";
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
