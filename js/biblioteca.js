/*
==========================================================
CAMILA MARTINS ENGENHARIA
BIBLIOTECA
==========================================================
*/

document.addEventListener("DOMContentLoaded", () => {

    configurarFormularioBiblioteca();

    carregarBiblioteca();

});

/*
==========================================================
FORMULÁRIO
==========================================================
*/

function configurarFormularioBiblioteca(){

    const formulario = document.getElementById("formBiblioteca");

    if(!formulario) return;

    formulario.onsubmit = salvarMaterial;

}

/*
==========================================================
SALVAR MATERIAL
==========================================================
*/

async function salvarMaterial(event){

    event.preventDefault();

    const arquivo = document.getElementById("arquivoBiblioteca").files[0];

    if(!arquivo){

        alert("Selecione um arquivo.");

        return;

    }

    const nomeArquivo = Date.now()+"_"+arquivo.name;

    const caminho = await uploadArquivo(
        arquivo,
        "biblioteca",
        nomeArquivo
    );

    const material = {

        titulo: document.getElementById("tituloBiblioteca").value.trim(),

        categoria: document.getElementById("categoriaBiblioteca").value,

        descricao: document.getElementById("descricaoBiblioteca").value.trim(),

        arquivo: caminho

    };

    const { error } = await supabase
        .from("biblioteca")
        .insert([material]);

    if(error){

        console.error(error);

        alert("Erro ao salvar.");

        return;

    }

    alert("Material cadastrado.");

    document.getElementById("formBiblioteca").reset();

    document
        .getElementById("modalBiblioteca")
        ?.classList.remove("show");

    carregarBiblioteca();

}

/*
==========================================================
CARREGAR
==========================================================
*/

async function carregarBiblioteca(){

    const lista = document.getElementById("listaBiblioteca");

    if(!lista) return;

    const { data,error } = await supabase
        .from("biblioteca")
        .select("*")
        .order("created_at",{
            ascending:false
        });

    if(error){

        console.error(error);

        return;

    }

    renderizarBiblioteca(data || []);

}

/*
==========================================================
RENDERIZAR
==========================================================
*/

function renderizarBiblioteca(lista){

    const container=document.getElementById("listaBiblioteca");

    if(!container) return;

    if(lista.length===0){

        container.innerHTML=`
            <div class="empty-state">
                Nenhum material disponível.
            </div>
        `;

        return;

    }

    container.innerHTML=lista.map(material=>`

        <div class="card-material">

            <div class="card-material-info">

                <h3>${escapeBiblioteca(material.titulo)}</h3>

                <p>${escapeBiblioteca(material.descricao)}</p>

                <small>${escapeBiblioteca(material.categoria)}</small>

            </div>

            <div class="acoes-material">

                <a
                    class="btn-icon"
                    href="${urlPublica("biblioteca",material.arquivo)}"
                    target="_blank">

                    <i class="fa-solid fa-eye"></i>

                </a>

                <a
                    class="btn-icon"
                    href="${urlPublica("biblioteca",material.arquivo)}"
                    download>

                    <i class="fa-solid fa-download"></i>

                </a>

                <button
                    class="btn-icon delete"
                    onclick="excluirMaterial('${material.id}','${material.arquivo}')">

                    <i class="fa-solid fa-trash"></i>

                </button>

            </div>

        </div>

    `).join("");

}

/*
==========================================================
EXCLUIR
==========================================================
*/

async function excluirMaterial(id,arquivo){

    if(!confirm("Excluir material?")) return;

    await removerArquivo(
        "biblioteca",
        arquivo
    );

    const { error } = await supabase
        .from("biblioteca")
        .delete()
        .eq("id",id);

    if(error){

        console.error(error);

        alert("Erro ao excluir.");

        return;

    }

    carregarBiblioteca();

}

/*
==========================================================
PESQUISAR
==========================================================
*/

async function pesquisarBiblioteca(texto){

    const { data,error } = await supabase
        .from("biblioteca")
        .select("*")
        .ilike("titulo",`%${texto}%`);

    if(error){

        console.error(error);

        return;

    }

    renderizarBiblioteca(data || []);

}

/*
==========================================================
UTIL
==========================================================
*/

function escapeBiblioteca(texto){

    return String(texto || "")
        .replaceAll("&","&amp;")
        .replaceAll("<","&lt;")
        .replaceAll(">","&gt;")
        .replaceAll('"',"&quot;")
        .replaceAll("'","&#039;");

}
