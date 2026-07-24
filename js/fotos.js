/*
=====================================================
CAMILA MARTINS ENGENHARIA
FOTOS.JS
=====================================================
*/

let fotos = [];
let projetosFotos = [];

document.addEventListener("DOMContentLoaded", () => {
    iniciarFotos();
});

async function iniciarFotos() {
    try {
        mostrarLoadingFotos(true);

        const [listaFotos, clientes, projetos] = await Promise.all([
            dbBuscarFotos(),
            dbBuscarClientes().catch(() => []),
            dbBuscarProjetos().catch(() => [])
        ]);

        fotos = listaFotos;
        projetosFotos = projetos;

        preencherSelectFotos("fotoCliente", clientes, "nome");
        preencherSelectFotos("fotoProjeto", projetos, "nome");

        renderizarGaleria();
        configurarEventosFotos();
    }
    catch (error) {
        console.error("Erro ao iniciar fotos:", error);
    }
    finally {
        mostrarLoadingFotos(false);
    }
}

function mostrarLoadingFotos(mostrar) {
    const el = document.getElementById("loading");
    if (el) el.style.display = mostrar ? "flex" : "none";
}

function preencherSelectFotos(id, itens, campoLabel) {
    const select = document.getElementById(id);
    if (!select) return;

    const atual = select.innerHTML.match(/<option[^>]*value=""[^>]*>[^<]*<\/option>/);
    select.innerHTML = (atual ? atual[0] : `<option value="">Selecione</option>`) +
        itens.map(item => `<option value="${item.id}">${item[campoLabel] ?? ""}</option>`).join("");
}

function renderizarGaleria(lista = fotos) {
    const galeria = document.getElementById("galeriaFotos");
    if (!galeria) return;

    if (!lista || lista.length === 0) {
        galeria.innerHTML = `<div class="vazio">Nenhuma foto cadastrada.</div>`;
        return;
    }

    galeria.innerHTML = lista.map(foto => {
        const url = foto.url || "";
        return `
            <div class="foto-item" data-id="${foto.id}">
                ${url ? `<img src="${url}" alt="${foto.nome ?? ""}">` : ""}
                <span>${foto.nome ?? ""}</span>
                <button type="button" class="btn-excluir-foto" data-id="${foto.id}">Excluir</button>
            </div>
        `;
    }).join("");

    galeria.querySelectorAll(".btn-excluir-foto").forEach(btn => {
        btn.addEventListener("click", () => excluirFoto(btn.dataset.id));
    });

    galeria.querySelectorAll(".foto-item").forEach(item => {
        item.addEventListener("click", (e) => {
            if (e.target.closest("button")) return;
            mostrarDetalhesFoto(item.dataset.id);
        });
    });
}

function configurarEventosFotos() {
    document.getElementById("novaFoto")?.addEventListener("click", abrirModalFoto);
    document.getElementById("cancelarFoto")?.addEventListener("click", fecharModalFoto);
    document.getElementById("fecharModalFoto")?.addEventListener("click", fecharModalFoto);

    document.getElementById("formFoto")?.addEventListener("submit", salvarFoto);

    document.getElementById("pesquisaFoto")?.addEventListener("input", pesquisarFotos);
    document.getElementById("btnPesquisarFoto")?.addEventListener("click", pesquisarFotos);
}

function abrirModalFoto() {
    document.getElementById("formFoto")?.reset();
    const modal = document.getElementById("modalFoto");
    if (modal) modal.style.display = "flex";
}

function fecharModalFoto() {
    const modal = document.getElementById("modalFoto");
    if (modal) modal.style.display = "none";
}

async function salvarFoto(e) {
    e.preventDefault();

    const nome = document.getElementById("fotoTitulo")?.value.trim();
    const descricao = document.getElementById("fotoDescricao")?.value.trim() || "";
    const clienteId = document.getElementById("fotoCliente")?.value || null;
    const projetoId = document.getElementById("fotoProjeto")?.value || null;
    const arquivo = document.getElementById("arquivoFoto")?.files?.[0];

    if (!nome || !clienteId || !arquivo) {
        alert("Informe o título, selecione o cliente e escolha uma imagem.");
        return;
    }

    const projeto = projetosFotos.find(item => String(item.id) === String(projetoId));
    if (projeto && String(projeto.cliente_id) !== String(clienteId)) {
        alert("O projeto selecionado não pertence a esse cliente.");
        return;
    }

    try {
        const caminho = `${clienteId}/${Date.now()}-${arquivo.name}`;
        await dbUploadArquivo(BUCKETS.FOTOS, caminho, arquivo);

        await dbCriarFoto({
            nome,
            descricao,
            cliente_id: clienteId,
            projeto_id: projetoId || null,
            arquivo: caminho
        });

        fecharModalFoto();

        fotos = await dbBuscarFotos();
        renderizarGaleria();
    }
    catch (error) {
        console.error("Erro ao salvar foto:", error);
        alert("Não foi possível salvar a foto.");
    }
}

function mostrarDetalhesFoto(id) {
    const foto = fotos.find(f => String(f.id) === String(id));
    const painel = document.getElementById("detalhesFoto");
    if (!foto || !painel) return;

    const url = foto.url || "";

    painel.innerHTML = `
        <h3>${foto.nome ?? ""}</h3>
        ${url ? `<img src="${url}" alt="${foto.nome ?? ""}" style="max-width:100%;">` : ""}
        <p>${foto.descricao ?? ""}</p>
    `;
}

async function excluirFoto(id) {
    if (!confirm("Deseja realmente excluir esta foto?")) return;

    try {
        const foto = fotos.find(f => String(f.id) === String(id));

        if (foto?.arquivo) {
            await dbExcluirArquivoStorage(BUCKETS.FOTOS, foto.arquivo).catch(() => {});
        }

        await dbExcluirFoto(id);

        fotos = await dbBuscarFotos();
        renderizarGaleria();
    }
    catch (error) {
        console.error("Erro ao excluir foto:", error);
        alert("Não foi possível excluir a foto.");
    }
}

function pesquisarFotos() {
    const termo = (document.getElementById("pesquisaFoto")?.value || "").toLowerCase().trim();

    if (!termo) {
        renderizarGaleria();
        return;
    }

    renderizarGaleria(fotos.filter(f => (f.nome || "").toLowerCase().includes(termo)));
}
