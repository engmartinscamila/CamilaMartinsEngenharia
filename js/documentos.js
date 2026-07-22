import {
    supabase,
    BUCKETS
} from "./config/supabase.js";

/* ============================
   ELEMENTOS
============================ */

const documentsList =
    document.getElementById("documentsList");

const searchInput =
    document.getElementById("searchInput");

const categorySelect =
    document.getElementById("categorySelect");

const logoutButton =
    document.getElementById("logoutButton");

const currentYear =
    document.getElementById("currentYear");

currentYear.textContent =
    new Date().getFullYear();

/* ============================
   VARIÁVEIS
============================ */

let cliente = null;

let documentos = [];

/* ============================
   LOGIN
============================ */

async function verificarLogin() {

    const {
        data: { session }

    } = await supabase.auth.getSession();

    if (!session) {

        window.location.href =
            "login.html";

        return;

    }

    const {

        data,
        error

    } = await supabase

        .from("CLIENTES")

        .select("*")

        .eq(
            "auth_id",
            session.user.id
        )

        .single();

    if (error || !data) {

        alert("Cliente não encontrado.");

        window.location.href =
            "login.html";

        return;

    }

    cliente = data;

    carregarDocumentos();

}

/* ============================
   DOCUMENTOS
============================ */

async function carregarDocumentos() {

    documentsList.innerHTML = `

        <div class="loading">

            <i class="bi bi-arrow-repeat"></i>

            Carregando documentos...

        </div>

    `;

    const {

        data,
        error

    } = await supabase

        .from("DOCUMENTOS")

        .select("*")

        .eq(
            "cliente_id",
            cliente.id
        )

        .order(
            "created_at",
            {
                ascending: false
            }
        );

    if (error) {

        console.error(error);

        documentsList.innerHTML = `

            <div class="error-state">

                <i class="bi bi-x-circle"></i>

                Erro ao carregar documentos.

            </div>

        `;

        return;

    }

    documentos = data || [];

    atualizarLista();

}
/* ============================
   FILTROS
============================ */

function atualizarLista() {

    const texto =
        searchInput.value
            .trim()
            .toLowerCase();

    const tipoSelecionado =
        categorySelect.value;

    const lista = documentos.filter(

        function (doc) {

            const passouTexto =

                (doc.nome || "")

                .toLowerCase()

                .includes(texto);

            const passouTipo =

                tipoSelecionado === "todos"

                ||

                doc.tipo === tipoSelecionado;

            return (

                passouTexto

                &&

                passouTipo

            );

        }

    );

    renderizar(lista);

}

/* ============================
   RENDERIZAÇÃO
============================ */

function renderizar(lista) {

    if (lista.length === 0) {

        documentsList.innerHTML = `

            <div class="empty-state">

                <i class="bi bi-folder2-open"></i>

                Nenhum documento encontrado.

            </div>

        `;

        return;

    }

    documentsList.innerHTML = "";

    lista.forEach(

        function (doc) {

            const card =
                document.createElement("div");

            card.className =
                "document-card";

            const dataFormatada =

                doc.created_at

                ?

                new Date(
                    doc.created_at
                ).toLocaleDateString(
                    "pt-BR"
                )

                :

                "-";

            card.innerHTML = `

                <div class="document-icon">

                    <i class="${obterIcone(doc.arquivo)}"></i>

                </div>

                <div>

                    <div class="document-name">

                        ${doc.nome}

                    </div>

                    <div class="document-meta">

                        ${doc.tipo || "Sem categoria"}

                        •

                        ${dataFormatada}

                    </div>

                </div>

                <div class="document-actions">

                    <button
                        class="document-button visualizar"
                    >

                        <i class="bi bi-eye"></i>

                        Visualizar

                    </button>

                    <button
                        class="document-button baixar"
                    >

                        <i class="bi bi-download"></i>

                        Download

                    </button>

                </div>

            `;

            card

                .querySelector(
                    ".visualizar"
                )

                .addEventListener(

                    "click",

                    function () {

                        visualizarDocumento(doc);

                    }

                );

            card

                .querySelector(
                    ".baixar"
                )

                .addEventListener(

                    "click",

                    function () {

                        baixarDocumento(doc);

                    }

                );

            documentsList.appendChild(card);

        }

    );

}
/* ============================
   ÍCONES
============================ */

function obterIcone(nomeArquivo) {

    if (!nomeArquivo)
        return "bi bi-file-earmark";

    const nome =
        nomeArquivo.toLowerCase();

    if (nome.endsWith(".pdf"))
        return "bi bi-file-earmark-pdf";

    if (
        nome.endsWith(".doc") ||
        nome.endsWith(".docx")
    )
        return "bi bi-file-earmark-word";

    if (
        nome.endsWith(".xls") ||
        nome.endsWith(".xlsx")
    )
        return "bi bi-file-earmark-excel";

    if (
        nome.endsWith(".dwg")
    )
        return "bi bi-file-earmark-richtext";

    if (
        nome.endsWith(".zip") ||
        nome.endsWith(".rar")
    )
        return "bi bi-file-earmark-zip";

    if (
        nome.endsWith(".jpg") ||
        nome.endsWith(".jpeg") ||
        nome.endsWith(".png") ||
        nome.endsWith(".webp")
    )
        return "bi bi-image";

    return "bi bi-file-earmark";

}

/* ============================
   URL DO STORAGE
============================ */

function obterUrlArquivo(doc) {

    if (!doc.arquivo)
        return null;

    const {

        data

    } = supabase.storage

        .from(BUCKETS.DOCUMENTOS)

        .getPublicUrl(
            doc.arquivo
        );

    return data.publicUrl;

}

/* ============================
   VISUALIZAR
============================ */

function visualizarDocumento(doc) {

    const url =
        obterUrlArquivo(doc);

    if (!url) {

        alert(
            "Arquivo indisponível."
        );

        return;

    }

    window.open(
        url,
        "_blank"
    );

}

/* ============================
   DOWNLOAD
============================ */

function baixarDocumento(doc) {

    const url =
        obterUrlArquivo(doc);

    if (!url) {

        alert(
            "Arquivo indisponível."
        );

        return;

    }

    const link =
        document.createElement("a");

    link.href =
        url;

    link.download =
        doc.nome || "";

    document.body.appendChild(
        link
    );

    link.click();

    link.remove();

}
/* ============================
   EVENTOS
============================ */

searchInput.addEventListener(

    "input",

    atualizarLista

);

categorySelect.addEventListener(

    "change",

    atualizarLista

);

/* ============================
   LOGOUT
============================ */

logoutButton.addEventListener(

    "click",

    async function () {

        await supabase.auth.signOut();

        window.location.href =
            "login.html";

    }

);

/* ============================
   INICIALIZAÇÃO
============================ */

document.addEventListener(

    "DOMContentLoaded",

    function () {

        verificarLogin();

    }

);
