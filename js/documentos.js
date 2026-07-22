/*
==========================================================
CAMILA MARTINS ENGENHARIA
DOCUMENTOS
==========================================================
*/

document.addEventListener("DOMContentLoaded", () => {

    configurarFormularioDocumento();

    carregarDocumentosPagina();

});

/*
==========================================================
FORMULÁRIO
==========================================================
*/

function configurarFormularioDocumento(){

    const formulario = document.getElementById("formDocumento");

    if(!formulario) return;

    formulario.onsubmit = salvarDocumento;

}

/*
==========================================================
SALVAR DOCUMENTO
==========================================================
*/

async function salvarDocumento(event){

    event.preventDefault();

    const arquivo = document.getElementById("arquivoDocumento").files[0];

    if(!arquivo){

        alert("Selecione um documento.");

        return;

    }

    const nomeArquivo =
        Date.now() + "_" + arquivo.name;

    const caminho = await uploadDocumento(
        arquivo,
        nomeArquivo
    );

    const documento = {

        titulo:document.getElementById("documentoTitulo").value.trim(),

        categoria:document.getElementById("documentoCategoria").value,

        cliente_id:document.getElementById("documentoCliente").value,

        projeto_id:document.getElementById("documentoProjeto").value,

        descricao:document.getElementById("descricaoDocumento").value.trim(),

        arquivo:caminho

    };

    const { error } = await supabase

        .from("documentos")

        .insert([documento]);

    if(error){

        console.error(error);

        alert("Erro ao salvar documento.");

        return;

    }

    alert("Documento enviado com sucesso.");

    document.getElementById("formDocumento").reset();

    document.getElementById("modalDocumento")
        ?.classList.remove("show");

    carregarDocumentosPagina();

    if(typeof carregarDashboard==="function"){

        carregarDashboard();

    }

}

/*
==========================================================
CARREGAR DOCUMENTOS
==========================================================
*/

async function carregarDocumentosPagina(){

    const tabela=document.getElementById("tabelaDocumentos");

    if(!tabela) return;

    const { data,error }=await supabase

        .from("documentos")

        .select(`
            *,
            clientes(nome),
            projetos(nome)
        `)

        .order("created_at",{ascending:false});

    if(error){

        console.error(error);

        return;

    }

    renderizarDocumentos(data||[]);

}

/*
==========================================================
RENDERIZAR
==========================================================
*/

function renderizarDocumentos(lista){

    const tabela=document.getElementById("tabelaDocumentos");

    if(!tabela) return;

    if(lista.length===0){

        tabela.innerHTML=`
        <tr>
            <td colspan="7">
                Nenhum documento encontrado.
            </td>
        </tr>`;

        return;

    }

    tabela.innerHTML=lista.map(doc=>`

<tr>

<td>${escapeDocumento(doc.titulo)}</td>

<td>${escapeDocumento(doc.categoria)}</td>

<td>${escapeDocumento(doc.clientes?.nome||"-")}</td>

<td>${escapeDocumento(doc.projetos?.nome||"-")}</td>

<td>${formatarData(doc.created_at)}</td>

<td>

<a

class="btn-icon"

target="_blank"

href="${urlPublica("documentos",doc.arquivo)}">

<i class="fa-solid fa-download"></i>

</a>

</td>

<td>

<button

class="btn-icon delete"

onclick="excluirDocumento('${doc.id}','${doc.arquivo}')">

<i class="fa-solid fa-trash"></i>

</button>

</td>

</tr>

`).join("");

}

/*
==========================================================
EXCLUIR
==========================================================
*/

async function excluirDocumento(id,arquivo){

    if(!confirm("Excluir documento?")) return;

    await removerArquivo(

        "documentos",

        arquivo

    );

    const { error } = await supabase

        .from("documentos")

        .delete()

        .eq("id",id);

    if(error){

        console.error(error);

        return;

    }

    carregarDocumentosPagina();

    if(typeof carregarDashboard==="function"){

        carregarDashboard();

    }

}

/*
==========================================================
PESQUISA
==========================================================
*/

async function pesquisarDocumento(texto){

    const { data,error }=await supabase

        .from("documentos")

        .select(`
            *,
            clientes(nome),
            projetos(nome)
        `)

        .ilike("titulo",`%${texto}%`);

    if(error){

        console.error(error);

        return;

    }

    renderizarDocumentos(data||[]);

}

/*
==========================================================
UTIL
==========================================================
*/

function escapeDocumento(texto){

    return String(texto||"")

    .replaceAll("&","&amp;")

    .replaceAll("<","&lt;")

    .replaceAll(">","&gt;")

    .replaceAll('"',"&quot;")

    .replaceAll("'","&#039;");

}
