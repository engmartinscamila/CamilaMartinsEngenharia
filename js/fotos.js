/*
==========================================================
CAMILA MARTINS ENGENHARIA
FOTOS
==========================================================
*/

document.addEventListener("DOMContentLoaded", () => {

    configurarFormularioFotos();

    carregarFotosPagina();

});

/*
==========================================================
FORMULÁRIO
==========================================================
*/

function configurarFormularioFotos(){

    const formulario = document.getElementById("formFoto");

    if(!formulario) return;

    formulario.onsubmit = salvarFoto;

}

/*
==========================================================
SALVAR FOTO
==========================================================
*/

async function salvarFoto(event){

    event.preventDefault();

    const arquivo = document.getElementById("arquivoFoto").files[0];

    if(!arquivo){

        alert("Selecione uma imagem.");

        return;

    }

    const nomeArquivo = Date.now() + "_" + arquivo.name;

    const caminho = await uploadFoto(
        arquivo,
        nomeArquivo
    );

    const foto = {

        titulo: document.getElementById("fotoTitulo").value.trim(),

        categoria: document.getElementById("fotoCategoria").value,

        cliente_id: document.getElementById("fotoCliente").value,

        projeto_id: document.getElementById("fotoProjeto").value,

        descricao: document.getElementById("descricaoFoto").value.trim(),

        arquivo: caminho

    };

    const { error } = await supabase
        .from("fotos")
        .insert([foto]);

    if(error){

        console.error(error);

        alert("Erro ao salvar a foto.");

        return;

    }

    alert("Foto enviada com sucesso.");

    document.getElementById("formFoto").reset();

    document
        .getElementById("modalFoto")
        ?.classList.remove("show");

    carregarFotosPagina();

    if(typeof carregarDashboard === "function"){

        carregarDashboard();

    }

}

/*
==========================================================
CARREGAR FOTOS
==========================================================
*/

async function carregarFotosPagina(){

    const galeria = document.getElementById("galeriaFotos");

    if(!galeria) return;

    const { data, error } = await supabase
        .from("fotos")
        .select(`
            *,
            clientes(nome),
            projetos(nome)
        `)
        .order("created_at", {
            ascending:false
        });

    if(error){

        console.error(error);

        return;

    }

    renderizarFotos(data || []);

}

/*
==========================================================
GALERIA
==========================================================
*/

function renderizarFotos(lista){

    const galeria = document.getElementById("galeriaFotos");

    if(!galeria) return;

    if(lista.length === 0){

        galeria.innerHTML = `
            <div class="empty-state">
                Nenhuma foto cadastrada.
            </div>
        `;

        return;

    }

    galeria.innerHTML = lista.map(foto => `

        <div class="card-foto">

            <img
                src="${urlPublica("fotos", foto.arquivo)}"
                alt="${escapeFoto(foto.titulo)}">

            <div class="card-foto-info">

                <h3>${escapeFoto(foto.titulo)}</h3>

                <p>${escapeFoto(foto.clientes?.nome || "-")}</p>

                <small>${escapeFoto(foto.projetos?.nome || "-")}</small>

                <div class="acoes-foto">

                    <a
                        class="btn-icon"
                        href="${urlPublica("fotos", foto.arquivo)}"
                        target="_blank">

                        <i class="fa-solid fa-eye"></i>

                    </a>

                    <button
                        class="btn-icon delete"
                        onclick="excluirFoto('${foto.id}','${foto.arquivo}')">

                        <i class="fa-solid fa-trash"></i>

                    </button>

                </div>

            </div>

        </div>

    `).join("");

}

/*
==========================================================
EXCLUIR FOTO
==========================================================
*/

async function excluirFoto(id, arquivo){

    if(!confirm("Excluir esta foto?")){

        return;

    }

    await removerArquivo(
        "fotos",
        arquivo
    );

    const { error } = await supabase
        .from("fotos")
        .delete()
        .eq("id", id);

    if(error){

        console.error(error);

        alert("Erro ao excluir.");

        return;

    }

    carregarFotosPagina();

    if(typeof carregarDashboard === "function"){

        carregarDashboard();

    }

}

/*
==========================================================
PESQUISAR
==========================================================
*/

async function pesquisarFotos(texto){

    const { data, error } = await supabase
        .from("fotos")
        .select(`
            *,
            clientes(nome),
            projetos(nome)
        `)
        .ilike("titulo", `%${texto}%`);

    if(error){

        console.error(error);

        return;

    }

    renderizarFotos(data || []);

}

/*
==========================================================
UTIL
==========================================================
*/

function escapeFoto(texto){

    return String(texto || "")
        .replaceAll("&","&amp;")
        .replaceAll("<","&lt;")
        .replaceAll(">","&gt;")
        .replaceAll('"',"&quot;")
        .replaceAll("'","&#039;");

}
