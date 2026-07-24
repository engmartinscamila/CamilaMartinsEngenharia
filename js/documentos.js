/*
=====================================================
CAMILA MARTINS ENGENHARIA
DOCUMENTOS.JS
=====================================================
*/

let documentos = [];
let clientesDocumentos = [];
let projetosDocumentos = [];

document.addEventListener("DOMContentLoaded", () => {
    iniciarDocumentos();
});

async function iniciarDocumentos() {
    try {
        mostrarLoading(true);

        const [docs, clientes, projetos] = await Promise.all([
            dbBuscarDocumentos(),
            dbBuscarClientes().catch(() => []),
            dbBuscarProjetos().catch(() => [])
        ]);

        documentos = docs;
        clientesDocumentos = clientes;
        projetosDocumentos = projetos;

        preencherSelect("documentoCliente", clientes, "nome");
        preencherSelect("documentoProjeto", projetos, "nome");

        renderizarDocumentos();
        configurarEventosDocumentos();
    }
    catch (error) {
        console.error("Erro ao iniciar documentos:", error);
    }
    finally {
        mostrarLoading(false);
    }
}

function mostrarLoading(mostrar) {
    const el = document.getElementById("loading");
    if (el) el.style.display = mostrar ? "flex" : "none";
}

function preencherSelect(id, itens, campoLabel) {
    const select = document.getElementById(id);
    if (!select) return;

    const atual = select.innerHTML.match(/<option[^>]*value=""[^>]*>[^<]*<\/option>/);
    select.innerHTML = (atual ? atual[0] : `<option value="">Selecione</option>`) +
        itens.map(item => `<option value="${item.id}">${item[campoLabel] ?? ""}</option>`).join("");
}

function renderizarDocumentos(lista = documentos) {
    const container = document.getElementById("listaDocumentos");
    if (!container) return;

    if (!lista || lista.length === 0) {
        container.innerHTML = `<div class="vazio">Nenhum documento cadastrado.</div>`;
        return;
    }

    container.innerHTML = lista.map(doc => `
        <div class="documento-item" data-id="${doc.id}">
            <i class="fa-solid fa-file"></i>
            <div class="documento-info">
                <strong>${doc.nome ?? ""}</strong>
                <span>${doc.categoria ?? ""}</span>
            </div>
            <div class="documento-acoes">
                <button type="button" class="btn-abrir-documento" data-id="${doc.id}">Abrir</button>
                <button type="button" class="btn-excluir-documento" data-id="${doc.id}">Excluir</button>
            </div>
        </div>
    `).join("");

    container.querySelectorAll(".btn-abrir-documento").forEach(btn => {
        btn.addEventListener("click", () => mostrarDetalhesDocumento(btn.dataset.id));
    });

    container.querySelectorAll(".btn-excluir-documento").forEach(btn => {
        btn.addEventListener("click", () => excluirDocumento(btn.dataset.id));
    });
}

function configurarEventosDocumentos() {
    document.getElementById("novoDocumento")?.addEventListener("click", abrirModalDocumento);
    document.getElementById("cancelarDocumento")?.addEventListener("click", fecharModalDocumento);
    document.getElementById("fecharModalDocumento")?.addEventListener("click", fecharModalDocumento);

    document.getElementById("formDocumento")?.addEventListener("submit", salvarDocumento);

    document.getElementById("pesquisaDocumento")?.addEventListener("input", pesquisarDocumentos);
    document.getElementById("btnPesquisarDocumento")?.addEventListener("click", pesquisarDocumentos);
}

function abrirModalDocumento() {
    document.getElementById("formDocumento")?.reset();
    const modal = document.getElementById("modalDocumento");
    if (modal) modal.style.display = "flex";
}

function fecharModalDocumento() {
    const modal = document.getElementById("modalDocumento");
    if (modal) modal.style.display = "none";
}

async function salvarDocumento(e) {
    e.preventDefault();

    const nome = document.getElementById("documentoNome")?.value.trim();
    const categoria = document.getElementById("documentoCategoria")?.value || "";
    const clienteId = document.getElementById("documentoCliente")?.value || null;
    const projetoId = document.getElementById("documentoProjeto")?.value || null;
    const descricao = document.getElementById("documentoDescricao")?.value.trim() || "";
    const arquivoInput = document.getElementById("documentoArquivo");
    const arquivo = arquivoInput?.files?.[0];

    if (!nome) {
        alert("Informe o nome do documento.");
        return;
    }

    try {
        let caminho = null;

        if (arquivo) {
            caminho = `${Date.now()}-${arquivo.name}`;
            await dbUploadArquivo(BUCKETS.DOCUMENTOS, caminho, arquivo);
        }

        await dbCriarDocumento({
            nome,
            categoria,
            cliente_id: clienteId || null,
            projeto_id: projetoId || null,
            descricao,
            caminho
        });

        fecharModalDocumento();

        documentos = await dbBuscarDocumentos();
        renderizarDocumentos();
    }
    catch (error) {
        console.error("Erro ao salvar documento:", error);
        alert("Não foi possível salvar o documento.");
    }
}

function mostrarDetalhesDocumento(id) {
    const doc = documentos.find(d => String(d.id) === String(id));
    const painel = document.getElementById("detalhesDocumento");
    if (!doc || !painel) return;

    let link = "";
    if (doc.caminho) {
        link = dbGerarUrlArquivo(BUCKETS.DOCUMENTOS, doc.caminho);
    }

    painel.innerHTML = `
        <h3>${doc.nome ?? ""}</h3>
        <p>${doc.descricao ?? ""}</p>
        ${link ? `<a href="${link}" target="_blank" rel="noopener">Baixar arquivo</a>` : ""}
    `;
}

async function excluirDocumento(id) {
    if (!confirm("Deseja realmente excluir este documento?")) return;

    try {
        const doc = documentos.find(d => String(d.id) === String(id));

        if (doc?.caminho) {
            await dbExcluirArquivoStorage(BUCKETS.DOCUMENTOS, doc.caminho).catch(() => {});
        }

        await dbExcluirDocumento(id);

        documentos = await dbBuscarDocumentos();
        renderizarDocumentos();
    }
    catch (error) {
        console.error("Erro ao excluir documento:", error);
        alert("Não foi possível excluir o documento.");
    }
}

function pesquisarDocumentos() {
    const termo = (document.getElementById("pesquisaDocumento")?.value || "").toLowerCase().trim();

    if (!termo) {
        renderizarDocumentos();
        return;
    }

    const filtrados = documentos.filter(doc =>
        (doc.nome || "").toLowerCase().includes(termo) ||
        (doc.categoria || "").toLowerCase().includes(termo)
    );

    renderizarDocumentos(filtrados);
}
