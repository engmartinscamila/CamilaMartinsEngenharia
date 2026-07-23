/*
==========================================================
CAMILA MARTINS ENGENHARIA

ADMIN.JS
PAINEL ADMINISTRATIVO

VERSÃO DEFINITIVA
==========================================================
*/


document.addEventListener(
"DOMContentLoaded",
()=>{

    iniciarAdmin();

});




// ==========================================================
// INICIALIZAÇÃO
// ==========================================================


async function iniciarAdmin(){


    await carregarDashboard();


    configurarEventos();


}





// ==========================================================
// CARREGAMENTO PRINCIPAL
// ==========================================================


async function carregarDashboard(){


    try{


        await carregarTotais();


        await carregarClientes();


        await carregarProjetos();


        await carregarDocumentos();


        await carregarBiblioteca();


        await carregarAtividades();



    }
    catch(error){


        console.error(
            "Erro ao carregar dashboard:",
            error
        );


    }


}







// ==========================================================
// CARDS DO DASHBOARD
// ==========================================================


async function carregarTotais(){



    const [

        clientes,

        projetos,

        documentos,

        fotos,

        biblioteca


    ] = await Promise.all([



        dbBuscarClientes(),


        dbBuscarProjetos(),


        dbBuscarDocumentos(),


        dbBuscarFotos(),


        dbBuscarBiblioteca()



    ]);




    atualizarElemento(
        "totalClientes",
        clientes.length
    );



    atualizarElemento(
        "totalProjetos",
        projetos.length
    );



    atualizarElemento(
        "totalDocumentos",
        documentos.length
    );



    atualizarElemento(
        "totalFotos",
        fotos.length
    );



    atualizarElemento(
        "totalBiblioteca",
        biblioteca.length
    );



}







// ==========================================================
// CLIENTES RECENTES
// ==========================================================


async function carregarClientes(){



    const lista =
    document.getElementById(
        "listaClientes"
    );



    if(!lista)
    return;




    const clientes =
    await dbBuscarClientes();




    if(!clientes.length){


        lista.innerHTML =
        estadoVazio(
            "Nenhum cliente cadastrado."
        );


        return;


    }





    lista.innerHTML =

    clientes
    .slice(0,5)
    .map(cliente=>`


        <div class="item-lista">


            <div>

                <h3>

                ${escapar(
                    cliente.nome
                )}

                </h3>


                <span>

                ${escapar(
                    cliente.email || ""
                )}

                </span>


            </div>



        </div>


    `)
    .join("");



}
// ==========================================================
// PROJETOS RECENTES
// ==========================================================


async function carregarProjetos(){


    const lista =
    document.getElementById(
        "listaProjetos"
    );



    if(!lista)
    return;




    const projetos =
    await dbBuscarProjetos();




    if(!projetos.length){


        lista.innerHTML =
        estadoVazio(
            "Nenhum projeto cadastrado."
        );


        return;


    }




    lista.innerHTML =


    projetos
    .slice(0,5)
    .map(projeto=>`


        <div class="item-lista">


            <div>


                <h3>

                ${escapar(
                    projeto.nome
                )}

                </h3>



                <span>

                ${escapar(
                    projeto.status || ""
                )}

                </span>



            </div>


        </div>


    `)
    .join("");



}







// ==========================================================
// DOCUMENTOS RECENTES
// ==========================================================


async function carregarDocumentos(){


    const lista =
    document.getElementById(
        "listaDocumentos"
    );



    if(!lista)
    return;




    const documentos =
    await dbBuscarDocumentos();




    if(!documentos.length){


        lista.innerHTML =
        estadoVazio(
            "Nenhum documento cadastrado."
        );


        return;


    }




    lista.innerHTML =


    documentos
    .slice(0,5)
    .map(documento=>`


        <div class="item-lista">


            <div>


                <h3>

                ${escapar(
                    documento.titulo ||
                    documento.nome ||
                    "Documento"
                )}

                </h3>



                <span>

                ${escapar(
                    documento.categoria || ""
                )}

                </span>


            </div>


        </div>


    `)
    .join("");



}







// ==========================================================
// BIBLIOTECA
// ==========================================================


async function carregarBiblioteca(){



    const biblioteca =
    await dbBuscarBiblioteca();



    atualizarElemento(
        "totalBiblioteca",
        biblioteca.length
    );



}







// ==========================================================
// ATIVIDADES
// ==========================================================


async function carregarAtividades(){



    const lista =
    document.getElementById(
        "atividadeRecentes"
    );



    if(!lista)
    return;



    lista.innerHTML = `

        <div class="atividade">

            Sistema iniciado.

        </div>

    `;



}
// ==========================================================
// PESQUISA DE CLIENTES
// ==========================================================


async function pesquisarClientes(){


    const campo =
    document.getElementById(
        "pesquisaCliente"
    );



    const lista =
    document.getElementById(
        "listaClientes"
    );



    if(!campo || !lista)
    return;




    const termo =
    campo.value
    .toLowerCase()
    .trim();




    const clientes =
    await dbBuscarClientes();




    const resultado =

    clientes.filter(cliente=>{


        return cliente.nome
        .toLowerCase()
        .includes(termo);


    });





    if(!resultado.length){


        lista.innerHTML =
        estadoVazio(
            "Nenhum cliente encontrado."
        );


        return;


    }





    lista.innerHTML =


    resultado.map(cliente=>`


        <div class="item-lista">


            <div>


                <h3>

                ${escapar(
                    cliente.nome
                )}

                </h3>



                <span>

                ${escapar(
                    cliente.email || ""
                )}

                </span>


            </div>


        </div>


    `)
    .join("");



}







// ==========================================================
// EVENTOS DO PAINEL
// ==========================================================


function configurarEventos(){



    document
    .getElementById(
        "btnPesquisarCliente"
    )
    ?.addEventListener(
        "click",
        pesquisarClientes
    );





    document
    .getElementById(
        "pesquisaCliente"
    )
    ?.addEventListener(
        "keydown",
        (evento)=>{


            if(evento.key==="Enter"){

                pesquisarClientes();

            }


        }
    );







    document
    .getElementById(
        "abrirClientes"
    )
    ?.addEventListener(
        "click",
        ()=>{

            window.location.href =
            "clientes.html";

        }
    );





    document
    .getElementById(
        "abrirProjetos"
    )
    ?.addEventListener(
        "click",
        ()=>{

            window.location.href =
            "projetos.html";

        }
    );





    document
    .getElementById(
        "abrirDocumentos"
    )
    ?.addEventListener(
        "click",
        ()=>{

            window.location.href =
            "documentos.html";

        }
    );





    document
    .getElementById(
        "abrirBiblioteca"
    )
    ?.addEventListener(
        "click",
        ()=>{

            window.location.href =
            "biblioteca.html";

        }
    );





    document
    .getElementById(
        "abrirFotos"
    )
    ?.addEventListener(
        "click",
        ()=>{

            window.location.href =
            "fotos.html";

        }
    );





    document
    .getElementById(
        "abrirFinanceiro"
    )
    ?.addEventListener(
        "click",
        ()=>{

            window.location.href =
            "financeiro.html";

        }
    );





    document
    .getElementById(
        "abrirAgenda"
    )
    ?.addEventListener(
        "click",
        ()=>{

            window.location.href =
            "agenda.html";

        }
    );





    document
    .getElementById(
        "abrirConfiguracoes"
    )
    ?.addEventListener(
        "click",
        ()=>{

            window.location.href =
            "configuracoes.html";

        }
    );





    document
    .getElementById(
        "logoutButton"
    )
    ?.addEventListener(
        "click",
        async()=>{


            await dbSairSistema();



            window.location.href =
            "login.html";


        }
    );



}
// ==========================================================
// FUNÇÕES AUXILIARES
// ==========================================================



function atualizarElemento(id,valor){


    const elemento =
    document.getElementById(id);



    if(elemento){

        elemento.textContent =
        valor;

    }


}







function estadoVazio(texto){


    return `

        <div class="estado-vazio">

            ${texto}

        </div>

    `;


}







function escapar(valor){


    return String(valor ?? "")

    .replaceAll("&","&amp;")

    .replaceAll("<","&lt;")

    .replaceAll(">","&gt;")

    .replaceAll('"',"&quot;")

    .replaceAll("'","&#039;");


}







async function atualizarStorage(){



    const elemento =
    document.getElementById(
        "storageUsado"
    );



    if(elemento){

        elemento.textContent =
        "0 MB";

    }



}





// ==========================================================
// ATUALIZAÇÃO AUTOMÁTICA
// ==========================================================


setInterval(()=>{


    if(
        typeof carregarDashboard === "function"
    ){

        carregarDashboard();

    }


},300000);
