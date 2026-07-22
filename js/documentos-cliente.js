/*
==========================================================
CAMILA MARTINS ENGENHARIA
PORTAL DO CLIENTE — DOCUMENTOS
==========================================================
*/

let documentosCarregados = [];
let clienteLogado = null;

document.addEventListener("DOMContentLoaded", iniciarPaginaDocumentos);

/*
==========================================================
INICIAR PÁGINA
==========================================================
*/

async function iniciarPaginaDocumentos() {

    atualizarAno();

    configurarEventos();

    const usuario = await verificarSessaoCliente();

    if (!usuario) {
        return;
    }

    clienteLogado = await localizarClienteLogado(usuario);

    if (!clienteLogado) {

        mostrarEstadoErro(
            "Não foi possível localizar o cadastro vinculado ao seu acesso."
        );

        return;
    }

    await carregarDocumentosCliente();
}

/*
==========================================================
VERIFICAR LOGIN
==========================================================
*/

async function verificarSessaoCliente() {

    try {

        const {
            data: { session },
            error
        } = await supabase.auth.getSession();

        if (error) {
            throw error;
        }

        if (!session?.user) {

            window.location.href = "login.html";

            return null;
        }

        return session.user;

    } catch (erro) {

        console.error("Erro ao verificar login:", erro);

        window.location.href = "login.html";

        return null;
    }
}

/*
==========================================================
LOCALIZAR CLIENTE LOGADO
==========================================================
*/

async function localizarClienteLogado(usuario) {

    /*
    Primeiro procura o cliente diretamente pelo e-mail usado no login.
    Esse método evita confundir o ID do usuário autenticado com o ID
    existente na tabela clientes.
    */

    if (!usuario?.email) {
        return null;
    }

    const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, email")
        .ilike("email", usuario.email)
        .maybeSingle();

    if (error) {

        console.error("Erro ao localizar cliente:", error);

        return null;
    }

    return data || null;
}

/*
==========================================================
CONFIGURAR EVENTOS
==========================================================
*/

function configurarEventos() {

    const campoPesquisa = document.getElementById("searchInput");
    const campoCategoria = document.getElementById("categorySelect");
    const botaoSair = document.getElementById("logoutButton");

    if (campoPesquisa) {

        campoPesquisa.addEventListener("input", aplicarFiltros);

    }

    if (campoCategoria) {

        campoCategoria.addEventListener("change", aplicarFiltros);

    }

    if (botaoSair) {

        botaoSair.addEventListener("click", realizarLogout);

    }
}

/*
==========================================================
CARREGAR DOCUMENTOS DO CLIENTE
==========================================================
*/

async function carregarDocumentosCliente() {

    mostrarCarregamento();

    try {

        const { data, error } = await supabase
            .from("documentos")
            .select(`
                id,
                titulo,
                categoria,
                descricao,
                arquivo,
                cliente_id,
                projeto_id,
                created_at,
                projetos (
                    nome
                )
            `)
            .eq("cliente_id", clienteLogado.id)
            .order("created_at", {
                ascending: false
            });

        if (error) {
            throw error;
        }

        documentosCarregados = data || [];

        renderizarDocumentos(documentosCarregados);

    } catch (erro) {

        console.error("Erro ao carregar documentos:", erro);

        mostrarEstadoErro(
            "Não foi possível carregar seus documentos. Tente novamente."
        );
    }
}

/*
==========================================================
FILTRAR DOCUMENTOS
==========================================================
*/

function aplicarFiltros() {

    const campoPesquisa = document.getElementById("searchInput");
    const campoCategoria = document.getElementById("categorySelect");

    const pesquisa = normalizarTexto(
        campoPesquisa?.value || ""
    );

    const categoriaSelecionada =
        campoCategoria?.value || "todos";

    const documentosFiltrados = documentosCarregados.filter(documento => {

        const titulo = normalizarTexto(documento.titulo);
        const descricao = normalizarTexto(documento.descricao);
        const projeto = normalizarTexto(documento.projetos?.nome);
        const categoria = documento.categoria || "";

        const correspondePesquisa =
            !pesquisa ||
            titulo.includes(pesquisa) ||
            descricao.includes(pesquisa) ||
            projeto.includes(pesquisa);

        const correspondeCategoria =
            categoriaSelecionada === "todos" ||
            normalizarTexto(categoria) ===
            normalizarTexto(categoriaSelecionada);

        return correspondePesquisa && correspondeCategoria;
    });

    renderizarDocumentos(documentosFiltrados);
}

/*
==========================================================
RENDERIZAR DOCUMENTOS
==========================================================
*/

function renderizarDocumentos(documentos) {

    const lista = document.getElementById("documentsList");

    if (!lista) {
        return;
    }

    if (!documentos.length) {

        lista.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-folder2-open"></i>

                <p>
                    Nenhum documento foi encontrado.
                </p>
            </div>
        `;

        return;
    }

    lista.innerHTML = documentos.map(documento => {

        const titulo = escaparHTML(
            documento.titulo || "Documento"
        );

        const categoria = escaparHTML(
            documento.categoria || "Outros"
        );

        const projeto = escaparHTML(
            documento.projetos?.nome || "Projeto"
        );

        const data = formatarDataDocumento(
            documento.created_at
        );

        const icone = obterIconeArquivo(
            documento.arquivo
        );

        return `
            <article class="document-card">

                <div class="document-icon">
                    <i class="bi ${icone}"></i>
                </div>

                <div class="document-info">

                    <h3 class="document-name">
                        ${titulo}
                    </h3>

                    <p class="document-meta">
                        ${categoria}
                        •
                        ${projeto}
                        •
                        ${data}
                    </p>

                </div>

                <div class="document-actions">

                    <button
                        type="button"
                        class="document-button"
                        data-action="visualizar"
                        data-id="${documento.id}"
                    >
                        <i class="bi bi-eye"></i>
                        <span>Visualizar</span>
                    </button>

                    <button
                        type="button"
                        class="document-button"
                        data-action="baixar"
                        data-id="${documento.id}"
                    >
                        <i class="bi bi-download"></i>
                        <span>Baixar</span>
                    </button>

                </div>

            </article>
        `;

    }).join("");

    configurarBotoesDocumentos();
}

/*
==========================================================
BOTÕES DOS DOCUMENTOS
==========================================================
*/

function configurarBotoesDocumentos() {

    const botoes = document.querySelectorAll(
        "[data-action][data-id]"
    );

    botoes.forEach(botao => {

        botao.addEventListener("click", async () => {

            const id = botao.dataset.id;
            const acao = botao.dataset.action;

            const documento = documentosCarregados.find(
                item => String(item.id) === String(id)
            );

            if (!documento) {

                alert("Documento não encontrado.");

                return;
            }

            botao.disabled = true;

            try {

                if (acao === "visualizar") {

                    await visualizarDocumento(documento);

                }

                if (acao === "baixar") {

                    await baixarDocumento(documento);

                }

            } finally {

                botao.disabled = false;

            }
        });
    });
}

/*
==========================================================
CRIAR LINK SEGURO DO DOCUMENTO
==========================================================
*/

async function criarLinkDocumento(caminhoArquivo) {

    if (!caminhoArquivo) {

        throw new Error(
            "O documento não possui um arquivo vinculado."
        );
    }

    /*
    O bucket documentos deve ser privado.

    A URL assinada dura 10 minutos e permite que somente
    o cliente autenticado visualize ou baixe o arquivo.
    */

    const { data, error } = await supabase
        .storage
        .from("documentos")
        .createSignedUrl(
            caminhoArquivo,
            600
        );

    if (error) {
        throw error;
    }

    if (!data?.signedUrl) {

        throw new Error(
            "Não foi possível gerar o endereço do documento."
        );
    }

    return data.signedUrl;
}

/*
==========================================================
VISUALIZAR DOCUMENTO
==========================================================
*/

async function visualizarDocumento(documento) {

    try {

        const link = await criarLinkDocumento(
            documento.arquivo
        );

        window.open(
            link,
            "_blank",
            "noopener,noreferrer"
        );

    } catch (erro) {

        console.error("Erro ao visualizar documento:", erro);

        alert(
            "Não foi possível abrir este documento."
        );
    }
}

/*
==========================================================
BAIXAR DOCUMENTO
==========================================================
*/

async function baixarDocumento(documento) {

    try {

        const link = await criarLinkDocumento(
            documento.arquivo
        );

        const resposta = await fetch(link);

        if (!resposta.ok) {

            throw new Error(
                "Falha ao baixar o arquivo."
            );
        }

        const arquivoBlob = await resposta.blob();

        const enderecoTemporario =
            URL.createObjectURL(arquivoBlob);

        const linkDownload =
            document.createElement("a");

        linkDownload.href = enderecoTemporario;

        linkDownload.download =
            obterNomeArquivo(documento);

        document.body.appendChild(linkDownload);

        linkDownload.click();

        linkDownload.remove();

        URL.revokeObjectURL(enderecoTemporario);

    } catch (erro) {

        console.error("Erro ao baixar documento:", erro);

        alert(
            "Não foi possível baixar este documento."
        );
    }
}

/*
==========================================================
NOME DO ARQUIVO
==========================================================
*/

function obterNomeArquivo(documento) {

    const caminho = documento.arquivo || "";

    const nomeOriginal = caminho
        .split("/")
        .pop();

    if (nomeOriginal) {

        return nomeOriginal.replace(
            /^\d+[_-]/,
            ""
        );
    }

    const titulo = normalizarNomeArquivo(
        documento.titulo || "documento"
    );

    return `${titulo}.pdf`;
}

/*
==========================================================
ÍCONE DO ARQUIVO
==========================================================
*/

function obterIconeArquivo(caminho) {

    const extensao = String(caminho || "")
        .split(".")
        .pop()
        .toLowerCase();

    const icones = {

        pdf: "bi-file-earmark-pdf",

        doc: "bi-file-earmark-word",
        docx: "bi-file-earmark-word",

        xls: "bi-file-earmark-excel",
        xlsx: "bi-file-earmark-excel",

        ppt: "bi-file-earmark-slides",
        pptx: "bi-file-earmark-slides",

        jpg: "bi-file-earmark-image",
        jpeg: "bi-file-earmark-image",
        png: "bi-file-earmark-image",
        webp: "bi-file-earmark-image",

        zip: "bi-file-earmark-zip",
        rar: "bi-file-earmark-zip",

        dwg: "bi-file-earmark",
        rvt: "bi-file-earmark"
    };

    return icones[extensao] ||
        "bi-file-earmark-text";
}

/*
==========================================================
CARREGAMENTO E ERROS
==========================================================
*/

function mostrarCarregamento() {

    const lista = document.getElementById("documentsList");

    if (!lista) {
        return;
    }

    lista.innerHTML = `
        <div class="loading">
            <i class="bi bi-arrow-repeat"></i>
            Carregando documentos...
        </div>
    `;
}

function mostrarEstadoErro(mensagem) {

    const lista = document.getElementById("documentsList");

    if (!lista) {
        return;
    }

    lista.innerHTML = `
        <div class="error-state">
            <i class="bi bi-exclamation-circle"></i>

            <p>
                ${escaparHTML(mensagem)}
            </p>
        </div>
    `;
}

/*
==========================================================
LOGOUT
==========================================================
*/

async function realizarLogout() {

    try {

        const { error } =
            await supabase.auth.signOut();

        if (error) {
            throw error;
        }

    } catch (erro) {

        console.error("Erro ao sair:", erro);

    } finally {

        window.location.href = "login.html";

    }
}

/*
==========================================================
UTILITÁRIOS
==========================================================
*/

function atualizarAno() {

    const campoAno =
        document.getElementById("currentYear");

    if (campoAno) {

        campoAno.textContent =
            new Date().getFullYear();

    }
}

function formatarDataDocumento(data) {

    if (!data) {
        return "Data não informada";
    }

    const dataConvertida = new Date(data);

    if (Number.isNaN(dataConvertida.getTime())) {

        return "Data não informada";

    }

    return dataConvertida.toLocaleDateString(
        "pt-BR"
    );
}

function normalizarTexto(texto) {

    return String(texto || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function normalizarNomeArquivo(texto) {

    return normalizarTexto(texto)
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function escaparHTML(texto) {

    return String(texto || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
