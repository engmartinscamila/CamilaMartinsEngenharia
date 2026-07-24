/*
=====================================================
CAMILA MARTINS ENGENHARIA
CRONOGRAMA.JS
=====================================================
*/

let etapas = [];
let projetosCronograma = [];

document.addEventListener("DOMContentLoaded", () => {
    iniciarCronograma();
});

async function iniciarCronograma() {
    try {
        const [listaEtapas, clientes, projetos] = await Promise.all([
            buscarEtapas(),
            buscarClientesCronograma(),
            buscarProjetosCronograma()
        ]);

        etapas = listaEtapas;
        projetosCronograma = projetos;

        preencherSelectCronograma("clienteCronograma", clientes, "nome");
        preencherSelectCronograma("projetoCronograma", projetos, "nome");

        renderizarCronograma();
        atualizarResumoCronograma();
        configurarEventosCronograma();
    }
    catch (error) {
        console.error("Erro ao iniciar cronograma:", error);
    }
}

async function buscarEtapas() {
    const { data, error } = await supabaseClient
        .from(TABELAS.CRONOGRAMA)
        .select("*, clientes(nome), projetos(nome)")
        .order("data_inicio", { ascending: true });

    if (error) throw error;
    return data;
}

async function buscarClientesCronograma() {
    const { data, error } = await supabaseClient
        .from(TABELAS.CLIENTES)
        .select("*");

    if (error) return [];
    return data;
}

async function buscarProjetosCronograma() {
    const { data, error } = await supabaseClient
        .from(TABELAS.PROJETOS)
        .select("*");

    if (error) return [];
    return data;
}

function preencherSelectCronograma(id, itens, campoLabel) {
    const select = document.getElementById(id);
    if (!select) return;

    select.innerHTML = `<option value="">Selecione</option>` +
        itens.map(item => `<option value="${item.id}">${textoOuVazio(item[campoLabel])}</option>`).join("");
}

function renderizarCronograma(lista = etapas) {
    const corpo = document.getElementById("listaCronograma");
    if (!corpo) return;

    if (!lista || lista.length === 0) {
        corpo.innerHTML = `<tr><td colspan="7">Nenhuma etapa cadastrada.</td></tr>`;
        return;
    }

    corpo.innerHTML = lista.map(etapa => `
        <tr data-id="${etapa.id}">
            <td>${textoOuVazio(etapa.nome)}</td>
            <td>${textoOuVazio(etapa.clientes?.nome)}</td>
            <td>${textoOuVazio(etapa.projetos?.nome)}</td>
            <td>${formatarData(etapa.data_inicio)}</td>
            <td>${formatarData(etapa.data_fim)}</td>
            <td>${textoOuVazio(etapa.status)}</td>
            <td>
                <button type="button" class="btn-excluir-etapa" data-id="${etapa.id}">Excluir</button>
            </td>
        </tr>
    `).join("");

    corpo.querySelectorAll(".btn-excluir-etapa").forEach(btn => {
        btn.addEventListener("click", () => excluirEtapa(btn.dataset.id));
    });
}

function atualizarResumoCronograma() {
    const total = etapas.length;
    const pendentes = etapas.filter(e => e.status === "Pendente").length;
    const andamento = etapas.filter(e => e.status === "Em andamento").length;
    const concluidas = etapas.filter(e => e.status === "Concluído").length;

    const setTexto = (id, valor) => {
        const el = document.getElementById(id);
        if (el) el.textContent = valor;
    };

    setTexto("totalEtapas", total);
    setTexto("pendentes", pendentes);
    setTexto("andamento", andamento);
    setTexto("concluidas", concluidas);

    const percentual = total > 0 ? Math.round((concluidas / total) * 100) : 0;

    setTexto("percentualObra", `${percentual}%`);

    const barra = document.getElementById("barraProgresso");
    if (barra) barra.style.width = `${percentual}%`;
}

function configurarEventosCronograma() {
    document.getElementById("formCronograma")?.addEventListener("submit", salvarEtapa);
}

async function salvarEtapa(e) {
    e.preventDefault();

    const nome = document.getElementById("nomeEtapa")?.value.trim();
    const clienteId = document.getElementById("clienteCronograma")?.value || null;
    const projetoId = document.getElementById("projetoCronograma")?.value || null;
    const inicio = document.getElementById("inicioEtapa")?.value || null;
    const fim = document.getElementById("fimEtapa")?.value || null;
    const status = document.getElementById("statusEtapa")?.value || "Pendente";
    const descricao = document.getElementById("descricaoEtapa")?.value.trim() || "";

    if (!nome || !clienteId || !projetoId) {
        alert("Informe a etapa, o cliente e o projeto.");
        return;
    }

    const projeto = projetosCronograma.find(item => String(item.id) === String(projetoId));
    if (!projeto || String(projeto.cliente_id) !== String(clienteId)) {
        alert("O projeto selecionado não pertence a esse cliente.");
        return;
    }

    const dados = {
        nome,
        cliente_id: clienteId,
        projeto_id: projetoId,
        data_inicio: inicio,
        data_fim: fim,
        status,
        descricao
    };

    try {
        const { error } = await supabaseClient
            .from(TABELAS.CRONOGRAMA)
            .insert(dados);

        if (error) throw error;

        document.getElementById("modalCronograma")?.classList.remove("show");
        document.getElementById("formCronograma")?.reset();

        etapas = await buscarEtapas();
        renderizarCronograma();
        atualizarResumoCronograma();
    }
    catch (error) {
        console.error("Erro ao salvar etapa:", error);
        alert("Não foi possível salvar a etapa.");
    }
}

async function excluirEtapa(id) {
    if (!confirm("Deseja realmente excluir esta etapa?")) return;

    try {
        const { error } = await supabaseClient
            .from(TABELAS.CRONOGRAMA)
            .delete()
            .eq("id", id);

        if (error) throw error;

        etapas = await buscarEtapas();
        renderizarCronograma();
        atualizarResumoCronograma();
    }
    catch (error) {
        console.error("Erro ao excluir etapa:", error);
        alert("Não foi possível excluir a etapa.");
    }
}

function pesquisarCronograma(termo) {
    const busca = (termo || "").toLowerCase().trim();

    if (!busca) {
        renderizarCronograma();
        return;
    }

    renderizarCronograma(
        etapas.filter(e => (e.nome || "").toLowerCase().includes(busca))
    );
}
