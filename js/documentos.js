import { supabase } from "./config/supabase.js";

/* ============================
   ELEMENTOS DA TELA
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
   VERIFICAR LOGIN
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
        .eq("auth_id", session.user.id)
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
   BUSCAR DOCUMENTOS
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

        .eq("cliente_id", cliente.id)

        .order("created_at", {
            ascending: false
        });

    if (error) {

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
   FILTRAR
============================ */

function atualizarLista() {

    const texto =
        searchInput.value
            .trim()
            .toLowerCase();

    const categoria =
        categorySelect.value;

    let lista =
        documentos.filter(function (doc) {

            const nome =
                (doc.nome || "")
                .toLowerCase();

            const passouTexto =
                nome.includes(texto);

            const passouCategoria =

                categoria === "todos"

                ||

                doc.categoria === categoria;

            return (
                passouTexto &&
                passouCategoria
            );

        });

    renderizar(lista);
}
/* ============================
   RENDERIZAR DOCUMENTOS
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

    lista.forEach(function (doc) {

        const card =
            document.createElement("div");

        card.className =
            "document-card";

        const icone =
            obterIcone(doc.nome);

        const data =
            doc.created_at
                ? new Date(doc.created_at)
                    .toLocaleDateString("pt-BR")
                : "-";

        card.innerHTML = `

            <div class="document-icon">

                <i class="${icone}"></i>

            </div>

            <div>

                <div class="document-name">

                    ${doc.nome}

                </div>

                <div class="document-meta">

                    ${doc.categoria || "Sem categoria"}
                    •
                    ${data}

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
            .querySelector(".visualizar")
            .addEventListener("click", function () {

                visualizarDocumento(doc);

            });

        card
            .querySelector(".baixar")
            .addEventListener("click", function () {

                baixarDocumento(doc);

            });

        documentsList.appendChild(card);

    });

}

/* ============================
   ÍCONE
============================ */

function obterIcone(nome) {

    const arquivo =
        (nome || "").toLowerCase();

    if (arquivo.endsWith(".pdf"))
        return "bi bi-file-earmark-pdf";

    if (
        arquivo.endsWith(".doc") ||
        arquivo.endsWith(".docx")
    )
        return "bi bi-file-earmark-word";

    if (
        arquivo.endsWith(".xls") ||
        arquivo.endsWith(".xlsx")
    )
        return "bi bi-file-earmark-excel";

    if (
        arquivo.endsWith(".zip") ||
        arquivo.endsWith(".rar")
    )
        return "bi bi-file-earmark-zip";

    if (
        arquivo.endsWith(".jpg") ||
        arquivo.endsWith(".jpeg") ||
        arquivo.endsWith(".png")
    )
        return "bi bi-image";

    return "bi bi-file-earmark";

/* ============================
   VISUALIZAR
============================ */

}

function visualizarDocumento(doc) {

    if (!doc.url) {

        alert("Arquivo indisponível.");

        return;

    }

    window.open(
        doc.url,
        "_blank"
    );

}

/* ============================
   DOWNLOAD
============================ */

function baixarDocumento(doc) {

    if (!doc.url) {

        alert("Arquivo indisponível.");

        return;

    }

    const a =
        document.createElement("a");

    a.href = doc.url;

    a.download = "";

    a.click();

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

logoutButton.addEventListener(
    "click",
    async function () {

        await supabase.auth.signOut();

        window.location.href =
            "login.html";

    }
);

/* ============================
   INICIAR
============================ */

verificarLogin();
