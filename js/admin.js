/*
==========================================================
CAMILA MARTINS ENGENHARIA
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


    configurarBotoesAdmin();


    await carregarPainel();



}




// ==========================================================
// CARREGAR PAINEL
// ==========================================================


async function carregarPainel(){


    mostrarLoading();



    try{


        await Promise.all([


            carregarTotais(),


            carregarClientesRecentes(),


            carregarProjetosRecentes(),


            carregarDocumentosRecentes()



        ]);



    }
    catch(error){


        console.error(
            "Erro no painel:",
            error
        );


    }
    finally{


        esconderLoading();


    }


}






// ==========================================================
// TOTAIS
// ==========================================================


async function carregarTotais(){



    const [

        clientes,

        projetos,

        documentos,

        fotos


    ] = await Promise.all([


        dbBuscarClientes(),


        dbBuscarProjetos(),


        dbBuscarDocumentos(),


        dbBuscarFotos()


    ]);




    atualizarTexto(
        "totalClientes",
        clientes.length
    );



    atualizarTexto(
        "totalProjetos",
        projetos.length
    );



    atualizarTexto(
        "totalDocumentos",
        documentos.length
    );



    atualizarTexto(
        "totalFotos",
        fotos.length
    );


}
// ==========================================================
// CLIENTES RECENTES
// ==========================================================


async function carregarClientesRecentes(){


    const lista =
    document.getElementById(
        "listaClientes"
    );


    if(!lista) return;




    const clientes =
    await dbBuscarClientes();




    const recentes =
    clientes.slice(0,5);




    if(recentes.length === 0){


        lista.innerHTML =
        mensagemVazia(
            "Nenhum cliente cadastrado."
        );


        return;

    }




    lista.innerHTML =
    recentes.map(cliente=>{


        return `

        <div class="item-lista">


            <div class="item-info">


                <h3>

                ${escaparHTML(
                    cliente.nome
                )}

                </h3>



                <span>

                ${escaparHTML(
                    cliente.email || "Sem e-mail"
                )}

                </span>


            </div>




            <span class="badge">


            ${formatarStatus(
                cliente.status
            )}


            </span>



        </div>

        `;


    }).join("");



}





// ==========================================================
// PROJETOS RECENTES
// ==========================================================


async function carregarProjetosRecentes(){


    const lista =
    document.getElementById(
        "listaProjetos"
    );



    if(!lista) return;




    const projetos =
    await dbBuscarProjetos();




    const recentes =
    projetos.slice(0,5);




    if(recentes.length === 0){


        lista.innerHTML =
        mensagemVazia(
            "Nenhum projeto cadastrado."
        );


        return;

    }




    lista.innerHTML =
    recentes.map(projeto=>{


        return `

        <div class="item-lista">


            <div class="item-info">


                <h3>

                ${escaparHTML(
                    projeto.nome
                )}

                </h3>



                <span>

                ${escaparHTML(
                    projeto.tipo || "Sem categoria"
                )}

                </span>


            </div>




            <span class="badge">


            ${formatarStatus(
                projeto.status
            )}


            </span>



        </div>

        `;


    }).join("");



}





// ==========================================================
// DOCUMENTOS RECENTES
// ==========================================================


async function carregarDocumentosRecentes(){


    const lista =
    document.getElementById(
        "listaDocumentos"
    );



    if(!lista) return;




    const documentos =
    await dbBuscarDocumentos();




    const recentes =
    documentos.slice(0,5);




    if(recentes.length === 0){


        lista.innerHTML =
        mensagemVazia(
            "Nenhum documento cadastrado."
        );


        return;

    }




    lista.innerHTML =
    recentes.map(documento=>{


        return `

        <div class="item-lista">


            <div class="item-info">


                <h3>

                ${escaparHTML(
                    documento.nome || "Documento"
                )}

                </h3>



                <span>

                ${escaparHTML(
                    documento.tipo || ""
                )}

                </span>


            </div>




        </div>

        `;


    }).join("");



}
// ==========================================================
// PESQUISA DE CLIENTES
// ==========================================================


function configurarPesquisaCliente(){


    const botao =
    document.getElementById(
        "btnPesquisarCliente"
    );


    const campo =
    document.getElementById(
        "pesquisaCliente"
    );



    if(botao){


        botao.addEventListener(
            "click",
            pesquisarCliente
        );


    }




    if(campo){


        campo.addEventListener(
            "keydown",
            (evento)=>{


                if(evento.key === "Enter"){

                    pesquisarCliente();

                }


            }
        );


    }



}





async function pesquisarCliente(){


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
    .trim()
    .toLowerCase();



    const clientes =
    await dbBuscarClientes();




    const resultado =
    clientes.filter(cliente=>{


        return cliente.nome
        .toLowerCase()
        .includes(termo);


    });





    if(resultado.length === 0){


        lista.innerHTML =
        mensagemVazia(
            "Nenhum cliente encontrado."
        );


        return;


    }




    lista.innerHTML =
    resultado.map(cliente=>{


        return `

        <div class="item-lista">


            <div class="item-info">


                <h3>

                ${escaparHTML(
                    cliente.nome
                )}

                </h3>


                <span>

                ${escaparHTML(
                    cliente.email || "Sem e-mail"
                )}

                </span>


            </div>


        </div>

        `;


    }).join("");



}






// ==========================================================
// NAVEGAÇÃO DO PAINEL
// ==========================================================


function configurarBotoesAdmin(){


    configurarPesquisaCliente();



    document
    .getElementById(
        "btnSair"
    )
    ?.addEventListener(
        "click",
        async()=>{


            await sairSistema();


            window.location.href =
            "index.html";


        }
    );



    document
    .getElementById(
        "verTodosProjetos"
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
        "verTodosDocumentos"
    )
    ?.addEventListener(
        "click",
        ()=>{


            window.location.href =
            "documentos.html";


        }
    );



}
// ==========================================================
// FINANCEIRO
// ==========================================================


async function carregarResumoFinanceiro(){


    const financeiro =
    await dbBuscarFinanceiro();



    let entradas = 0;

    let saidas = 0;




    financeiro.forEach(item=>{


        const valor =
        Number(item.valor || 0);



        if(item.tipo === "entrada"){

            entradas += valor;

        }


        if(item.tipo === "saida"){

            saidas += valor;

        }



    });




    atualizarTexto(
        "financeiroEntradas",
        formatarMoeda(entradas)
    );



    atualizarTexto(
        "financeiroSaidas",
        formatarMoeda(saidas)
    );



    atualizarTexto(
        "financeiroSaldo",
        formatarMoeda(
            entradas - saidas
        )
    );


}





// ==========================================================
// AGENDA
// ==========================================================


async function carregarAgenda(){


    const agenda =
    await dbBuscarAgenda();



    const lista =
    document.getElementById(
        "listaAgenda"
    );



    if(!lista)
    return;




    if(!agenda.length){


        lista.innerHTML =
        mensagemVazia(
            "Nenhum evento cadastrado."
        );


        return;

    }




    lista.innerHTML =
    agenda.slice(0,5)
    .map(evento=>{


        return `

        <div class="item-lista">


            <div class="item-info">


                <h3>

                ${escaparHTML(
                    evento.titulo
                )}

                </h3>



                <span>

                ${formatarData(
                    evento.data
                )}

                ${evento.horario || ""}

                </span>


            </div>


        </div>

        `;


    }).join("");



}





// ==========================================================
// AUXILIARES
// ==========================================================


function atualizarTexto(id,valor){


    const elemento =
    document.getElementById(id);



    if(elemento){

        elemento.textContent =
        valor;

    }


}





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





function formatarStatus(status){


    const lista = {


        ativo:"Ativo",

        em_andamento:"Em andamento",

        concluido:"Concluído",

        pendente:"Pendente",

        aprovado:"Aprovado"


    };



    return lista[status]
    ||
    status
    ||
    "Ativo";


}





function mensagemVazia(texto){


    return `

    <div class="empty-state">

        <p>

        ${texto}

        </p>


    </div>

    `;


}





function mostrarLoading(){


    const loading =
    document.getElementById(
        "loading"
    );



    if(loading){

        loading.style.display =
        "flex";

    }


}





function esconderLoading(){


    const loading =
    document.getElementById(
        "loading"
    );



    if(loading){

        loading.style.display =
        "none";

    }


}





function escaparHTML(valor){


    return String(valor ?? "")

    .replaceAll("&","&amp;")

    .replaceAll("<","&lt;")

    .replaceAll(">","&gt;")

    .replaceAll('"',"&quot;")

    .replaceAll("'","&#039;");


}
