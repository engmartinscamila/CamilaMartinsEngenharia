/*
==========================================================
CAMILA MARTINS ENGENHARIA
CRONOGRAMA
==========================================================
*/

document.addEventListener("DOMContentLoaded", () => {

    configurarFormularioCronograma();

    carregarCronograma();

});

/*
==========================================================
FORMULÁRIO
==========================================================
*/

function configurarFormularioCronograma(){

    const formulario = document.getElementById("formCronograma");

    if(!formulario) return;

    formulario.onsubmit = salvarEtapa;

}

/*
==========================================================
SALVAR ETAPA
==========================================================
*/

async function salvarEtapa(event){

    event.preventDefault();

    const etapa = {

        nome: document.getElementById("nomeEtapa").value.trim(),

        cliente_id: document.getElementById("clienteCronograma").value,

        projeto_id: document.getElementById("projetoCronograma").value,

        data_inicio: document.getElementById("inicioEtapa").value,

        data_fim: document.getElementById("fimEtapa").value,

        status: document.getElementById("statusEtapa").value,

        descricao: document.getElementById("descricaoEtapa").value.trim()

    };

    const { error } = await supabase
        .from("cronograma")
        .insert([etapa]);

    if(error){

        console.error(error);

        alert("Erro ao salvar etapa.");

        return;

    }

    alert("Etapa cadastrada com sucesso.");

    document.getElementById("formCronograma").reset();

    document
        .getElementById("modalCronograma")
        ?.classList.remove("show");

    carregarCronograma();

}

/*
==========================================================
CARREGAR CRONOGRAMA
==========================================================
*/

async function carregarCronograma(){

    const tabela = document.getElementById("listaCronograma");

    if(!tabela) return;

    const { data, error } = await supabase
        .from("cronograma")
        .select(`
            *,
            clientes(nome),
            projetos(nome)
        `)
        .order("data_inicio",{
            ascending:true
        });

    if(error){

        console.error(error);

        return;

    }

    renderizarCronograma(data || []);

}

/*
==========================================================
RENDERIZAR
==========================================================
*/

function renderizarCronograma(lista){

    const tabela = document.getElementById("listaCronograma");

    if(!tabela) return;

    if(lista.length===0){

        tabela.innerHTML=`
            <tr>
                <td colspan="7" style="text-align:center;">
                    Nenhuma etapa cadastrada.
                </td>
            </tr>
        `;

        atualizarResumo([]);

        return;

    }

    tabela.innerHTML=lista.map(etapa=>`

        <tr>

            <td>${escapeCronograma(etapa.nome)}</td>

            <td>${escapeCronograma(etapa.clientes?.nome || "-")}</td>

            <td>${escapeCronograma(etapa.projetos?.nome || "-")}</td>

            <td>${formatarData(etapa.data_inicio)}</td>

            <td>${formatarData(etapa.data_fim)}</td>

            <td>

                <span class="status ${classeStatus(etapa.status)}">

                    ${escapeCronograma(etapa.status)}

                </span>

            </td>

            <td>

                <button
                    class="btn-icon delete"
                    onclick="excluirEtapa('${etapa.id}')">

                    <i class="fa-solid fa-trash"></i>

                </button>

            </td>

        </tr>

    `).join("");

    atualizarResumo(lista);

}

/*
==========================================================
RESUMO
==========================================================
*/

function atualizarResumo(lista){

    document.getElementById("totalEtapas").textContent=lista.length;

    const pendentes=lista.filter(e=>e.status==="Pendente").length;

    const andamento=lista.filter(e=>e.status==="Em andamento").length;

    const concluidas=lista.filter(e=>e.status==="Concluído").length;

    document.getElementById("pendentes").textContent=pendentes;

    document.getElementById("andamento").textContent=andamento;

    document.getElementById("concluidas").textContent=concluidas;

    const percentual=lista.length
        ?Math.round((concluidas/lista.length)*100)
        :0;

    document.getElementById("percentualObra").textContent=percentual+"%";

    document.getElementById("barraProgresso").style.width=percentual+"%";

}

/*
==========================================================
EXCLUIR
==========================================================
*/

async function excluirEtapa(id){

    if(!confirm("Excluir esta etapa?")) return;

    const { error } = await supabase
        .from("cronograma")
        .delete()
        .eq("id",id);

    if(error){

        console.error(error);

        alert("Erro ao excluir.");

        return;

    }

    carregarCronograma();

}

/*
==========================================================
PESQUISA
==========================================================
*/

async function pesquisarCronograma(texto){

    const { data,error } = await supabase
        .from("cronograma")
        .select(`
            *,
            clientes(nome),
            projetos(nome)
        `)
        .ilike("nome",`%${texto}%`);

    if(error){

        console.error(error);

        return;

    }

    renderizarCronograma(data || []);

}

/*
==========================================================
STATUS
==========================================================
*/

function classeStatus(status){

    switch(status){

        case "Concluído":
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

function formatarData(data){

    if(!data) return "-";

    return new Date(data)
        .toLocaleDateString("pt-BR");

}

function escapeCronograma(texto){

    return String(texto || "")
        .replaceAll("&","&amp;")
        .replaceAll("<","&lt;")
        .replaceAll(">","&gt;")
        .replaceAll('"',"&quot;")
        .replaceAll("'","&#039;");

}
