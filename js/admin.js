/*
==========================================================
CAMILA MARTINS ENGENHARIA
ADMIN.JS — DASHBOARD ESTÁVEL
==========================================================
*/

document.addEventListener("DOMContentLoaded", () => {
    configurarEventosAdmin();
    carregarFraseDoDiaAdmin();
    iniciarDashboard();
});

let carregandoDashboard = false;

function carregarFraseDoDiaAdmin() {
    if (window.__CME_FRASE_DO_DIA__ || document.getElementById("cmeFraseDoDiaScript")) return;
    const script = document.createElement("script");
    script.id = "cmeFraseDoDiaScript";
    script.src = "js/frase-do-dia.js?v=20260901-3";
    script.defer = true;
    document.head.appendChild(script);
}

async function iniciarDashboard() {
    if (carregandoDashboard) return;
    carregandoDashboard = true;

    try {
        await Promise.allSettled([
            carregarTotaisAdmin(),
            carregarClientesAdmin(),
            carregarProjetosAdmin(),
            carregarDocumentosAdmin(),
            carregarBibliotecaAdmin(),
            carregarArmazenamentoAdmin()
        ]);

        const atividades = document.getElementById("atividadeRecentes");
        if (atividades) {
            atividades.innerHTML = '<div class="atividade">Sistema iniciado.</div>';
        }
    } catch (erro) {
        console.error("Erro ao carregar dashboard:", erro);
    } finally {
        carregandoDashboard = false;
        ocultarLoadingAdmin();
    }
}

function ocultarLoadingAdmin() {
    const loading = document.getElementById("loading");
    if (loading) {
        loading.style.display = "none";
        loading.style.pointerEvents = "none";
        loading.setAttribute("aria-hidden", "true");
    }
}

function configurarEventosAdmin() {
    if (window.__CME_ADMIN_EVENTOS__) return;
    window.__CME_ADMIN_EVENTOS__ = true;

    const navegacao = {
        abrirClientes: "clientes.html",
        abrirProjetos: "projetos.html",
        abrirDocumentos: "documentos.html",
        abrirBiblioteca: "biblioteca.html",
        abrirFotos: "fotos.html",
        abrirFinanceiro: "financeiro.html",
        abrirAgenda: "agenda.html",
        abrirConfiguracoes: "configuracoes.html",
        novoProjeto: "projetos.html",
        verTodosProjetos: "projetos.html",
        verTodosDocumentos: "documentos.html"
    };

    Object.entries(navegacao).forEach(([id, destino]) => {
        document.getElementById(id)?.addEventListener("click", () => {
            window.location.href = destino;
        });
    });

    const pesquisar = document.getElementById("btnPesquisarCliente");
    const campo = document.getElementById("pesquisaCliente");

    pesquisar?.addEventListener("click", pesquisarClientesAdmin);
    campo?.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            pesquisarClientesAdmin();
        }
    });
}

async function buscarSeguro(funcao) {
    try {
        if (typeof funcao !== "function") return [];
        const resultado = await funcao();
        return Array.isArray(resultado) ? resultado : [];
    } catch (erro) {
        console.warn("Consulta do dashboard falhou:", erro);
        return [];
    }
}

async function carregarTotaisAdmin() {
    const [clientes, projetos, documentos, fotos] = await Promise.all([
        buscarSeguro(window.dbBuscarClientes),
        buscarSeguro(window.dbBuscarProjetos),
        buscarSeguro(window.dbBuscarDocumentos),
        buscarSeguro(window.dbBuscarFotos)
    ]);

    atualizarNumeroAdmin("totalClientes", clientes.length);
    atualizarNumeroAdmin("totalProjetos", projetos.length);
    atualizarNumeroAdmin("totalDocumentos", documentos.length);
    atualizarNumeroAdmin("totalFotos", fotos.length);
}

async function carregarClientesAdmin() {
    const clientes = await buscarSeguro(window.dbBuscarClientes);
    renderizarClientesAdmin(clientes);
}

function renderizarClientesAdmin(clientes) {
    const lista = document.getElementById("listaClientes");
    if (!lista) return;

    if (!clientes.length) {
        lista.innerHTML = '<div class="estado-vazio">Nenhum cliente cadastrado.</div>';
        return;
    }

    lista.innerHTML = clientes.map(cliente => `
        <div class="item-dashboard">
            <strong>${escaparAdmin(cliente.nome || "Cliente")}</strong>
            <span>${escaparAdmin(cliente.email || "")}</span>
        </div>
    `).join("");
}

async function pesquisarClientesAdmin() {
    const termo = (document.getElementById("pesquisaCliente")?.value || "")
        .trim()
        .toLowerCase();

    const clientes = await buscarSeguro(window.dbBuscarClientes);

    const filtrados = termo
        ? clientes.filter(cliente =>
            String(cliente.nome || "").toLowerCase().includes(termo) ||
            String(cliente.email || "").toLowerCase().includes(termo)
        )
        : clientes;

    renderizarClientesAdmin(filtrados);
}

async function carregarProjetosAdmin() {
    const projetos = await buscarSeguro(window.dbBuscarProjetos);
    const lista = document.getElementById("listaProjetos");
    if (!lista) return;

    const recentes = projetos.slice(0, 6);

    lista.innerHTML = recentes.length
        ? recentes.map(projeto => `
            <div class="item-dashboard">
                <strong>${escaparAdmin(projeto.nome || "Projeto")}</strong>
            </div>
        `).join("")
        : '<div class="estado-vazio">Nenhum projeto cadastrado.</div>';
}

async function carregarDocumentosAdmin() {
    const documentos = await buscarSeguro(window.dbBuscarDocumentos);
    const lista = document.getElementById("listaDocumentos");
    if (!lista) return;

    const recentes = documentos.slice(0, 6);

    lista.innerHTML = recentes.length
        ? recentes.map(documento => `
            <div class="item-dashboard">
                <strong>${escaparAdmin(documento.nome || documento.titulo || "Documento")}</strong>
                <span>${escaparAdmin(documento.tipo || "")}</span>
            </div>
        `).join("")
        : '<div class="estado-vazio">Nenhum documento cadastrado.</div>';
}

async function carregarBibliotecaAdmin() {
    const [biblioteca, documentos, fotos] = await Promise.all([
        buscarSeguro(window.dbBuscarBiblioteca),
        buscarSeguro(window.dbBuscarDocumentos),
        buscarSeguro(window.dbBuscarFotos)
    ]);

    atualizarNumeroAdmin(
        "totalBiblioteca",
        biblioteca.length + documentos.length + fotos.length
    );
}

async function carregarArmazenamentoAdmin() {
    const barra = document.getElementById("storageBar");
    const usado = document.getElementById("storageUsado");
    const limiteTexto = document.getElementById("storageLimite");
    const detalhes = document.getElementById("storageDetalhes");
    const trilho = barra?.parentElement;
    const limite = Number(window.CM_CONFIG?.limiteArmazenamentoBytes) || (1024 ** 3);

    if (limiteTexto) limiteTexto.textContent = formatarBytesAdmin(limite);

    try {
        const { data, error } = await window.supabaseClient.rpc("uso_armazenamento_portal");
        if (error) throw error;

        const bytes = Math.max(0, Number(data?.bytes_utilizados) || 0);
        const arquivos = Math.max(0, Number(data?.quantidade_arquivos) || 0);
        const percentual = limite > 0 ? Math.min(100, (bytes / limite) * 100) : 0;

        if (barra) barra.style.width = `${percentual}%`;
        trilho?.setAttribute("aria-valuenow", String(Math.round(percentual)));
        if (usado) usado.textContent = formatarBytesAdmin(bytes);
        if (detalhes) {
            detalhes.textContent = `${arquivos} ${arquivos === 1 ? "arquivo" : "arquivos"} • ${percentual.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% utilizado`;
        }
    } catch (erro) {
        console.warn("Não foi possível calcular o armazenamento:", erro);
        if (barra) barra.style.width = "0%";
        trilho?.setAttribute("aria-valuenow", "0");
        if (usado) usado.textContent = "Indisponível";
        if (detalhes) detalhes.textContent = "Armazenamento temporariamente indisponível.";
    }
}

function atualizarNumeroAdmin(id, valor) {
    const elemento = document.getElementById(id);
    if (elemento) elemento.textContent = String(Number(valor) || 0);
}

function formatarBytesAdmin(bytes) {
    const valor = Number(bytes) || 0;
    if (valor <= 0) return "0 B";

    const unidades = ["B", "KB", "MB", "GB", "TB"];
    const indice = Math.min(
        Math.floor(Math.log(valor) / Math.log(1024)),
        unidades.length - 1
    );

    const numero = valor / (1024 ** indice);
    return `${numero.toLocaleString("pt-BR", { maximumFractionDigits: indice === 0 ? 0 : 2 })} ${unidades[indice]}`;
}

function escaparAdmin(valor) {
    return String(valor ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

window.setTimeout(ocultarLoadingAdmin, 5000);
