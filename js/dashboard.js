/*
=====================================================
CAMILA MARTINS ENGENHARIA
DASHBOARD.JS
=====================================================
*/

document.addEventListener("DOMContentLoaded", () => {
    iniciarDashboard();
});

async function iniciarDashboard() {
    try {
        const [clientes, projetos, documentos, fotos, financeiro, agenda] =
            await Promise.all([
                dbBuscarClientes().catch(() => []),
                dbBuscarProjetos().catch(() => []),
                dbBuscarDocumentos().catch(() => []),
                dbBuscarFotos().catch(() => []),
                dbBuscarFinanceiro().catch(() => []),
                dbBuscarAgenda().catch(() => [])
            ]);

        setTexto("totalClientes", clientes.length);
        setTexto("totalProjetos", projetos.length);
        setTexto("totalDocumentos", documentos.length);
        setTexto("totalFotos", fotos.length);

        renderizarResumoFinanceiro(financeiro);
        renderizarProjetosRecentes(projetos.slice(0, 5));
        renderizarProximosEventos(agenda);
    }
    catch (error) {
        console.error("Erro ao iniciar dashboard:", error);
    }
}

function setTexto(id, valor) {
    const el = document.getElementById(id);
    if (el) el.textContent = valor;
}

function formatarMoeda(valor) {
    return (Number(valor) || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

function renderizarResumoFinanceiro(lancamentos) {
    const entradas = lancamentos
        .filter(l => l.tipo === "entrada")
        .reduce((soma, l) => soma + Number(l.valor || 0), 0);

    const saidas = lancamentos
        .filter(l => l.tipo === "saida")
        .reduce((soma, l) => soma + Number(l.valor || 0), 0);

    setTexto("financeiroEntradas", formatarMoeda(entradas));
    setTexto("financeiroSaidas", formatarMoeda(saidas));
    setTexto("financeiroSaldo", formatarMoeda(entradas - saidas));
}

function renderizarProjetosRecentes(projetos) {
    const corpo = document.getElementById("listaProjetosRecentes");
    if (!corpo) return;

    if (!projetos || projetos.length === 0) {
        corpo.innerHTML = `<tr><td colspan="4">Nenhum projeto cadastrado.</td></tr>`;
        return;
    }

    corpo.innerHTML = projetos.map(projeto => `
        <tr>
            <td>${projeto.nome ?? ""}</td>
            <td>${projeto.clientes?.nome ?? ""}</td>
            <td>${projeto.tipo ?? ""}</td>
            <td>${projeto.status ?? ""}</td>
        </tr>
    `).join("");
}

function renderizarProximosEventos(eventos) {
    const lista = document.getElementById("listaAgenda");
    if (!lista) return;

    const hoje = new Date();
    const proximos = (eventos || [])
        .filter(e => new Date(e.data) >= hoje)
        .slice(0, 5);

    if (proximos.length === 0) {
        lista.innerHTML = `<p>Nenhum evento agendado.</p>`;
        return;
    }

    lista.innerHTML = proximos.map(evento => `
        <div class="agenda-item">
            <strong>${evento.titulo ?? ""}</strong>
            <span>${evento.data ? new Date(evento.data).toLocaleString("pt-BR") : ""}</span>
        </div>
    `).join("");
}
