/*
==========================================================
CAMILA MARTINS ENGENHARIA
SOLICITAÇÕES
==========================================================
*/

document.addEventListener("DOMContentLoaded", () => {

    configurarFormularioSolicitacao();

    carregarSolicitacoes();

});

/*
==========================================================
FORMULÁRIO
==========================================================
*/

function configurarFormularioSolicitacao(){

    const formulario = document.getElementById("formSolicitacao");

    if(!formulario) return;

    formulario.onsubmit = salvarSolicitacao;

}

/*
==========================================================
SALVAR
==========================================================
*/

async function salvarSolicitacao(event){

    event.preventDefault();

    const solicitacao = {

        titulo: document.getElementById("tituloSolicitacao").value.trim(),

        cliente_id: document.getElementById("clienteSolicitacao").value,

        projeto_id: document.getElementById("projetoSolicitacao").value,

        status: document.getElementById("statusSolicitacao").value,

        mensagem: document.getElementById("mensagemSolicitacao").value.trim()

    };

    const { error } = await supabase
        .from("solicitacoes")
        .insert([solicitacao]);

    if(error){

        console.error(error);

        alert("Erro ao salvar.");

        return;

    }

    alert("Solicitação enviada.");

    document.getElementById("formSolicitacao").reset();

    document
        .getElementById("modalSolicitacao")
        ?.classList.remove("show");

    carregarSolicitacoes();

}

/*
==========================================================
CARREGAR
==========================================================
*/

async function carregarSolicitacoes(){

    const tabela = document.getElementById("listaSolicitacoes");

    if(!tabela) return;

    const { data, error } = await supabase
        .from("solicitacoes")
        .select(`
            *,
            clientes(nome),
            projetos(nome)
        `)
        .order("created_at",{
            ascending:false
        });

    if(error){

        console.error(error);

        return;

    }

    renderizarSolicitacoes(data || []);

}

/*
==========================================================
RENDERIZAR
==========================================================
*/

function renderizarSolicitacoes(lista){

    const tabela=document.getElementById("listaSolicitacoes");

    if(!tabela) return;

    if(lista.length===0){

        tabela.innerHTML=`
            <tr>
                <td colspan="6" style="text-align:center;">
                    Nenhuma solicitação cadastrada.
                </td>
            </tr>
        `;

        atualizarResumoSolicitacoes([]);

        return;

    }

    tabela.innerHTML=lista.map(item=>`

        <tr>

            <td>${escapeSolicitacao(item.titulo)}</td>

            <td>${escapeSolicitacao(item.clientes?.nome || "-")}</td>

            <td>${escapeSolicitacao(item.projetos?.nome || "-")}</td>

            <td>

                <span class="status ${classeStatusSolicitacao(item.status)}">

                    ${escapeSolicitacao(item.status)}

                </span>

            </td>

            <td>${formatarDataSolicitacao(item.created_at)}</td>

            <td>

                <button
                    class="btn-icon delete"
                    onclick="excluirSolicitacao('${item.id}')">

                    <i class="fa-solid fa-trash"></i>

                </button>

            </td>

        </tr>

    `).join("");

    atualizarResumoSolicitacoes(lista);

}

/*
==========================================================
RESUMO
==========================================================
*/

function atualizarResumoSolicitacoes(lista){

    document.getElementById("totalSolicitacoes").textContent=lista.length;

    const abertas=lista.filter(x=>x.status==="Aberta").length;

    const andamento=lista.filter(x=>x.status==="Em andamento").length;

    const concluidas=lista.filter(x=>x.status==="Concluída").length;

    document.getElementById("abertas").textContent=abertas;

    document.getElementById("andamento").textContent=andamento;

    document.getElementById("concluidas").textContent=concluidas;

}

/*
==========================================================
EXCLUIR
==========================================================
*/

async function excluirSolicitacao(id){

    if(!confirm("Excluir solicitação?")) return;

    const { error } = await supabase
        .from("solicitacoes")
        .delete()
        .eq("id",id);

    if(error){

        console.error(error);

        alert("Erro ao excluir.");

        return;

    }

    carregarSolicitacoes();

}

/*
==========================================================
PESQUISAR
==========================================================
*/

async function pesquisarSolicitacoes(texto){

    const { data,error } = await supabase
        .from("solicitacoes")
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

    renderizarSolicitacoes(data || []);

}

/*
==========================================================
STATUS
==========================================================
*/

function classeStatusSolicitacao(status){

    switch(status){

        case "Concluída":
            return "success";

        case "Em andamento":
            return "warning";

        default:
            return "pending";

    }

}

/*
==========================================================
UTIL
==========================================================
*/

function formatarDataSolicitacao(data){

    if(!data) return "-";

    return new Date(data).toLocaleDateString("pt-BR");

}

function escapeSolicitacao(texto){

    return String(texto || "")
        .replaceAll("&","&amp;")
        .replaceAll("<","&lt;")
        .replaceAll(">","&gt;")
        .replaceAll('"',"&quot;")
        .replaceAll("'","&#039;");

}
