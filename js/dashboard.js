/*
==========================================================
CAMILA MARTINS ENGENHARIA
DASHBOARD
VERSÃO FINAL SUPABASE
==========================================================
*/


document.addEventListener(
"DOMContentLoaded",
()=>{

    iniciarDashboard();

});




// ==========================================================
// INICIALIZAÇÃO
// ==========================================================


async function iniciarDashboard(){


    try{


        await carregarIndicadores();


        await carregarFinanceiro();


        await carregarProjetosRecentes();


        await carregarAgenda();



    }
    catch(error){


        console.error(
            "Erro ao carregar dashboard:",
            error
        );


    }


}






// ==========================================================
// INDICADORES
// ==========================================================


async function carregarIndicadores(){



    const [

        clientes,

        projetos,

        documentos,

        fotos


    ] = await Promise.all([


        dbContarClientes(),


        dbContarProjetos(),


        dbContarDocumentos(),


        dbContarFotos()


    ]);





    document
    .getElementById("totalClientes")
    .textContent = clientes;




    document
    .getElementById("totalProjetos")
    .textContent = projetos;




    document
    .getElementById("totalDocumentos")
    .textContent = documentos;




    document
    .getElementById("totalFotos")
    .textContent = fotos;



}
// ==========================================================
// FINANCEIRO
// ==========================================================


async function carregarFinanceiro(){


    const financeiro =
    await dbResumoFinanceiro();




    document
    .getElementById("financeiroEntradas")
    .textContent =
    formatarMoeda(financeiro.entradas);




    document
    .getElementById("financeiroSaidas")
    .textContent =
    formatarMoeda(financeiro.saidas);




    document
    .getElementById("financeiroSaldo")
    .textContent =
    formatarMoeda(financeiro.saldo);



}






// ==========================================================
// PROJETOS RECENTES
// ==========================================================


async function carregarProjetosRecentes(){


    const tabela =
    document.getElementById(
        "listaProjetosRecentes"
    );



    const projetos =
    await dbBuscarProjetosRecentes();




    if(projetos.length === 0){


        tabela.innerHTML = `

        <tr>

        <td colspan="4">

        Nenhum projeto cadastrado.

        </td>

        </tr>

        `;


        return;

    }




    tabela.innerHTML =
    projetos.map(projeto=>{


        return `

        <tr>


        <td>
        ${escaparDashboard(projeto.nome)}
        </td>



        <td>
        ${
        projeto.clientes?.nome 
        || "-"
        }
        </td>



        <td>
        ${escaparDashboard(projeto.tipo || "-")}
        </td>



        <td>
        ${escaparDashboard(projeto.status || "-")}
        </td>



        </tr>

        `;


    }).join("");



}
// ==========================================================
// AGENDA
// ==========================================================


async function carregarAgenda(){


    const lista =
    document.getElementById(
        "listaAgenda"
    );



    const eventos =
    await dbBuscarAgenda();




    if(eventos.length === 0){


        lista.innerHTML = `

        <p>

        Nenhum evento próximo.

        </p>

        `;


        return;

    }




    lista.innerHTML =
    eventos.map(evento=>{


        return `

        <div class="agenda-item">


            <strong>

            ${escaparDashboard(evento.titulo)}

            </strong>


            <span>

            ${formatarData(evento.data)}

            ${evento.horario || ""}

            </span>


        </div>

        `;


    }).join("");



}






// ==========================================================
// FORMATADORES
// ==========================================================


function formatarMoeda(valor){


    return Number(valor || 0)
    .toLocaleString(
        "pt-BR",
        {
            style:"currency",
            currency:"BRL"
        }
    );


}




function formatarData(data){


    if(!data)
    return "-";



    return new Date(data)
    .toLocaleDateString(
        "pt-BR"
    );


}





function escaparDashboard(valor){


    return String(valor ?? "")

    .replaceAll("&","&amp;")

    .replaceAll("<","&lt;")

    .replaceAll(">","&gt;")

    .replaceAll('"',"&quot;")

    .replaceAll("'","&#039;");


}
