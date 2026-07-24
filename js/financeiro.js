/*
=====================================================
CAMILA MARTINS ENGENHARIA
FINANCEIRO.JS
=====================================================
*/

let lancamentos = [];
let projetosFinanceiro = [];

document.addEventListener("DOMContentLoaded", () => {
    iniciarFinanceiro();
});

async function iniciarFinanceiro() {
    try {
        mostrarLoadingFinanceiro(true);

        const [dados, projetos] = await Promise.all([
            dbBuscarFinanceiro(),
            dbBuscarProjetos().catch(() => [])
        ]);

        lancamentos = dados;
        projetosFinanceiro = projetos;

        preencherSelectFinanceiro("financeiroProjeto", projetos, "nome");

        renderizarFinanceiro();
        atualizarResumoFinanceiro();
        configurarEventosFinanceiro();
    }
    catch (error) {
        console.error("Erro ao iniciar financeiro:", error);
    }
    finally {
        mostrarLoadingFinanceiro(false);
    }
}

function mostrarLoadingFinanceiro(mostrar) {
    const el = document.getElementById("loading");
    if (el) el.style.display = mostrar ? "flex" : "none";
}

function preencherSelectFinanceiro(id, itens, campoLabel) {
    const select = document.getElementById(id);
    if (!select) return;

    const atual = select.innerHTML.match(/<option[^>]*value=""[^>]*>[^<]*<\/option>/);
    select.innerHTML = (atual ? atual[0] : `<option value="">Selecione</option>`) +
        itens.map(item => `<option value="${item.id}">${item[campoLabel] ?? ""}</option>`).join("");
}

function formatarMoedaFinanceiro(valor) {
    return (Number(valor) || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

function atualizarResumoFinanceiro() {
    const entradas = lancamentos
        .filter(l => l.tipo === "entrada")
        .reduce((soma, l) => soma + Number(l.valor || 0), 0);

    const saidas = lancamentos
        .filter(l => l.tipo === "saida")
        .reduce((soma, l) => soma + Number(l.valor || 0), 0);

    const setTexto = (id, valor) => {
        const el = document.getElementById(id);
        if (el) el.textContent = valor;
    };

    setTexto("totalEntradas", formatarMoedaFinanceiro(entradas));
    setTexto("totalSaidas", formatarMoedaFinanceiro(saidas));
    setTexto("saldoAtual", formatarMoedaFinanceiro(entradas - saidas));
}

function renderizarFinanceiro(lista = lancamentos) {
    const container = document.getElementById("listaFinanceiro");
    if (!container) return;

    if (!lista || lista.length === 0) {
        container.innerHTML = `<div class="vazio">Nenhum lançamento cadastrado.</div>`;
        return;
    }

    container.innerHTML = lista.map(l => `
        <div class="financeiro-item ${l.tipo}" data-id="${l.id}">
            <div>
                <strong>${l.descricao ?? ""}</strong>
                <span>${l.data ? new Date(l.data).toLocaleDateString("pt-BR") : ""}</span>
            </div>
            <div class="financeiro-valor ${l.tipo === "entrada" ? "positivo" : "negativo"}">
                ${l.tipo === "saida" ? "- " : "+ "}${formatarMoedaFinanceiro(l.valor)}
            </div>
            <div class="financeiro-acoes">
                <button type="button" class="btn-ver-financeiro" data-id="${l.id}">Ver</button>
                <button type="button" class="btn-excluir-financeiro" data-id="${l.id}">Excluir</button>
            </div>
        </div>
    `).join("");

    container.querySelectorAll(".btn-ver-financeiro").forEach(btn => {
        btn.addEventListener("click", () => mostrarDetalhesFinanceiro(btn.dataset.id));
    });

    container.querySelectorAll(".btn-excluir-financeiro").forEach(btn => {
        btn.addEventListener("click", () => excluirLancamento(btn.dataset.id));
    });
}

function configurarEventosFinanceiro() {
    document.getElementById("novoLancamento")?.addEventListener("click", abrirModalFinanceiro);
    document.getElementById("cancelarLancamento")?.addEventListener("click", fecharModalFinanceiro);
    document.getElementById("fecharModalFinanceiro")?.addEventListener("click", fecharModalFinanceiro);

    document.getElementById("formFinanceiro")?.addEventListener("submit", salvarLancamento);

    document.getElementById("pesquisaFinanceiro")?.addEventListener("input", pesquisarFinanceiro);
    document.getElementById("btnPesquisarFinanceiro")?.addEventListener("click", pesquisarFinanceiro);
}

function abrirModalFinanceiro() {
    document.getElementById("formFinanceiro")?.reset();
    const modal = document.getElementById("modalFinanceiro");
    if (modal) modal.style.display = "flex";
}

function fecharModalFinanceiro() {
    const modal = document.getElementById("modalFinanceiro");
    if (modal) modal.style.display = "none";
}

async function salvarLancamento(e) {
    e.preventDefault();

    const tipo = document.getElementById("financeiroTipo")?.value;
    const descricao = document.getElementById("financeiroDescricao")?.value.trim();
    const valor = parseFloat(document.getElementById("financeiroValor")?.value);
    const data = document.getElementById("financeiroData")?.value;
    const projetoId = document.getElementById("financeiroProjeto")?.value || null;
    const observacoes = document.getElementById("financeiroObservacoes")?.value.trim() || "";

    if (!tipo || !descricao || isNaN(valor) || !data) {
        alert("Preencha tipo, descrição, valor e data.");
        return;
    }

    try {
        await dbCriarLancamentoFinanceiro({
            tipo,
            descricao,
            valor,
            data,
            projeto_id: projetoId || null,
            observacoes
        });

        fecharModalFinanceiro();

        lancamentos = await dbBuscarFinanceiro();
        renderizarFinanceiro();
        atualizarResumoFinanceiro();
    }
    catch (error) {
        console.error("Erro ao salvar lançamento:", error);
        alert("Não foi possível salvar o lançamento.");
    }
}

function mostrarDetalhesFinanceiro(id) {
    const l = lancamentos.find(item => String(item.id) === String(id));
    const painel = document.getElementById("detalhesFinanceiro");
    if (!l || !painel) return;

    painel.innerHTML = `
        <h3>${l.descricao ?? ""}</h3>
        <p>Tipo: ${l.tipo === "entrada" ? "Entrada" : "Saída"}</p>
        <p>Valor: ${formatarMoedaFinanceiro(l.valor)}</p>
        <p>Data: ${l.data ? new Date(l.data).toLocaleDateString("pt-BR") : ""}</p>
        ${l.observacoes ? `<p>${l.observacoes}</p>` : ""}
    `;
}

async function excluirLancamento(id) {
    if (!confirm("Deseja realmente excluir este lançamento?")) return;

    try {
        await dbExcluirLancamentoFinanceiro(id);

        lancamentos = await dbBuscarFinanceiro();
        renderizarFinanceiro();
        atualizarResumoFinanceiro();
    }
    catch (error) {
        console.error("Erro ao excluir lançamento:", error);
        alert("Não foi possível excluir o lançamento.");
    }
}

function pesquisarFinanceiro() {
    const termo = (document.getElementById("pesquisaFinanceiro")?.value || "").toLowerCase().trim();

    if (!termo) {
        renderizarFinanceiro();
        return;
    }

    renderizarFinanceiro(
        lancamentos.filter(l => (l.descricao || "").toLowerCase().includes(termo))
    );
}
