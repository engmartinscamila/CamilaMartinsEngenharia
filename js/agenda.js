/*
==========================================================
CAMILA MARTINS ENGENHARIA

AGENDA.JS
GERENCIAMENTO DE EVENTOS

USA:
database.js
supabase.js

VERSÃO DEFINITIVA
==========================================================
*/


let eventoSelecionado = null;



document.addEventListener(
"DOMContentLoaded",
()=>{


    iniciarAgenda();


});







// ==========================================================
// INICIALIZAÇÃO
// ==========================================================


async function iniciarAgenda(){


    try{

        configurarEventosAgenda();


        await carregarClientesAgenda();


        await carregarProjetosAgenda();


        await carregarAgenda();

    }
    catch(error){

        console.error(
            "Erro ao iniciar agenda:",
            error
        );

    }
    finally{

        ocultarCarregamentoPagina();

    }


}








// ==========================================================
// CARREGAR EVENTOS
// ==========================================================


async function carregarAgenda(){



    const lista =

    document.getElementById(
        "listaAgenda"
    );



    if(!lista)
    return;




    try{


        const eventos =

        await dbBuscarAgenda();






        if(!eventos.length){


            lista.innerHTML = `


            <div class="estado-vazio">


            Nenhum evento cadastrado.


            </div>


            `;


            return;


        }








        lista.innerHTML =



        eventos.map(evento=>`



        <div class="item-lista evento-item"
        data-id="${evento.id}">





            <div>


                <h3>

                ${escaparTexto(
                    evento.titulo
                )}

                </h3>




                <p>

                ${formatarData(
                    evento.data
                )}

                ${evento.horario || ""}

                </p>





                <span>

                ${escaparTexto(
                    evento.tipo || ""
                )}

                </span>



            </div>







            <div class="acoes-item">



                <button

                class="visualizarEvento"

                data-id="${evento.id}">


                <i class="fa-solid fa-eye"></i>


                </button>






                <button

                class="editarEvento"

                data-id="${evento.id}">


                <i class="fa-solid fa-pen"></i>


                </button>







                <button

                class="excluirEvento"

                data-id="${evento.id}">


                <i class="fa-solid fa-trash"></i>


                </button>



            </div>



        </div>



        `)
        .join("");





        configurarAcoesAgenda();



    }
    catch(error){


        console.error(
            "Erro carregar agenda:",
            error
        );


    }



}
// ==========================================================
// CARREGAR CLIENTES NO SELECT
// ==========================================================



async function carregarClientesAgenda(){



    const select =

    document.getElementById(
        "eventoCliente"
    );



    if(!select)
    return;




    const clientes =

    await dbBuscarClientes();





    select.innerHTML = `

    <option value="">

    Selecione o cliente

    </option>

    `;





    clientes.forEach(cliente=>{


        select.innerHTML += `


        <option value="${cliente.id}">


        ${escaparTexto(
            cliente.nome
        )}


        </option>


        `;


    });



}








// ==========================================================
// CARREGAR PROJETOS NO SELECT
// ==========================================================



async function carregarProjetosAgenda(){



    const select =

    document.getElementById(
        "eventoProjeto"
    );



    if(!select)
    return;




    const projetos =

    await dbBuscarProjetos();





    select.innerHTML = `

    <option value="">

    Selecione o projeto

    </option>

    `;





    projetos.forEach(projeto=>{


        select.innerHTML += `


        <option value="${projeto.id}">


        ${escaparTexto(
            projeto.nome
        )}


        </option>


        `;


    });



}








// ==========================================================
// MODAL EVENTO
// ==========================================================



function abrirModalEvento(){


    const modal =

    document.getElementById(
        "modalEvento"
    );



    if(modal){

        modal.style.display =
        "flex";

    }



}







function fecharModalEvento(){


    const modal =

    document.getElementById(
        "modalEvento"
    );



    if(modal){

        modal.style.display =
        "none";

    }



    limparFormularioEvento();



}








// ==========================================================
// SALVAR EVENTO
// ==========================================================



async function salvarEvento(evento){



    evento.preventDefault();





    const dados = {



        titulo:

        document.getElementById(
            "eventoTitulo"
        ).value,





        tipo:

        document.getElementById(
            "eventoTipo"
        ).value,





        data:

        document.getElementById(
            "eventoData"
        ).value,





        horario:

        document.getElementById(
            "eventoHorario"
        ).value,





        cliente_id:

        document.getElementById(
            "eventoCliente"
        ).value || null,





        projeto_id:

        document.getElementById(
            "eventoProjeto"
        ).value || null,





        descricao:

        document.getElementById(
            "eventoDescricao"
        ).value




    };






    try{



        if(eventoSelecionado){



            await dbEditarEventoAgenda(

                eventoSelecionado,

                dados

            );



        }
        else{



            await dbCriarEventoAgenda(

                dados

            );



        }






        fecharModalEvento();



        await carregarAgenda();



    }
    catch(error){


        console.error(
            "Erro salvar evento:",
            error
        );



        alert(
            "Erro ao salvar evento."
        );


    }



}
// ==========================================================
// EDITAR EVENTO
// ==========================================================



async function editarEvento(id){



    const eventos =

    await dbBuscarAgenda();




    const evento =

    eventos.find(

        item=>

        item.id == id

    );





    if(!evento)
    return;





    eventoSelecionado =
    id;







    document.getElementById(
        "eventoTitulo"
    ).value =

    evento.titulo || "";







    document.getElementById(
        "eventoTipo"
    ).value =

    evento.tipo || "reuniao";







    document.getElementById(
        "eventoData"
    ).value =

    evento.data || "";







    document.getElementById(
        "eventoHorario"
    ).value =

    evento.horario || "";







    document.getElementById(
        "eventoCliente"
    ).value =

    evento.cliente_id || "";







    document.getElementById(
        "eventoProjeto"
    ).value =

    evento.projeto_id || "";







    document.getElementById(
        "eventoDescricao"
    ).value =

    evento.descricao || "";






    abrirModalEvento();



}








// ==========================================================
// EXCLUIR EVENTO
// ==========================================================



async function excluirEvento(id){



    const confirmar =

    confirm(
        "Deseja realmente excluir este evento?"
    );



    if(!confirmar)
    return;







    try{


        await dbExcluirEventoAgenda(
            id
        );





        await carregarAgenda();



    }
    catch(error){



        console.error(
            "Erro excluir evento:",
            error
        );



        alert(
            "Erro ao excluir evento."
        );


    }



}









// ==========================================================
// VISUALIZAR EVENTO
// ==========================================================



async function visualizarEvento(id){



    const eventos =

    await dbBuscarAgenda();




    const evento =

    eventos.find(

        item=>

        item.id == id

    );





    const detalhes =

    document.getElementById(
        "detalhesAgenda"
    );






    if(!detalhes || !evento)
    return;







    detalhes.innerHTML = `



    <h3>

    ${escaparTexto(
        evento.titulo
    )}

    </h3>





    <p>

    Tipo:

    ${escaparTexto(
        evento.tipo || ""
    )}

    </p>





    <p>

    Data:

    ${formatarData(
        evento.data
    )}

    </p>





    <p>

    Horário:

    ${evento.horario || "-"}

    </p>





    <p>

    ${escaparTexto(
        evento.descricao || ""
    )}

    </p>



    `;



}








// ==========================================================
// AÇÕES DA LISTA
// ==========================================================



function configurarAcoesAgenda(){



    document
    .querySelectorAll(
        ".visualizarEvento"
    )
    .forEach(botao=>{


        botao.addEventListener(
            "click",
            ()=>{


                visualizarEvento(
                    botao.dataset.id
                );


            }
        );


    });







    document
    .querySelectorAll(
        ".editarEvento"
    )
    .forEach(botao=>{


        botao.addEventListener(
            "click",
            ()=>{


                editarEvento(
                    botao.dataset.id
                );


            }
        );


    });







    document
    .querySelectorAll(
        ".excluirEvento"
    )
    .forEach(botao=>{


        botao.addEventListener(
            "click",
            ()=>{


                excluirEvento(
                    botao.dataset.id
                );


            }
        );


    });



}
// ==========================================================
// EVENTOS
// ==========================================================



function configurarEventosAgenda(){



    document
    .getElementById(
        "novoEvento"
    )
    ?.addEventListener(
        "click",
        ()=>{


            eventoSelecionado =
            null;


            limparFormularioEvento();


            abrirModalEvento();


        }
    );







    document
    .getElementById(
        "fecharModalEvento"
    )
    ?.addEventListener(
        "click",
        fecharModalEvento
    );







    document
    .getElementById(
        "cancelarEvento"
    )
    ?.addEventListener(
        "click",
        fecharModalEvento
    );







    document
    .getElementById(
        "formEvento"
    )
    ?.addEventListener(
        "submit",
        salvarEvento
    );







    document
    .getElementById(
        "pesquisaAgenda"
    )
    ?.addEventListener(
        "keyup",
        pesquisarAgenda
    );







    document
    .getElementById(
        "btnPesquisarAgenda"
    )
    ?.addEventListener(
        "click",
        pesquisarAgenda
    );



}








// ==========================================================
// PESQUISA
// ==========================================================



async function pesquisarAgenda(){



    const campo =

    document.getElementById(
        "pesquisaAgenda"
    );



    const lista =

    document.getElementById(
        "listaAgenda"
    );



    if(!campo || !lista)
    return;





    const termo =

    campo.value
    .toLowerCase()
    .trim();





    const eventos =

    await dbBuscarAgenda();





    const resultado =

    eventos.filter(evento=>{


        return (

            evento.titulo ||

            ""

        )
        .toLowerCase()
        .includes(termo);



    });







    lista.innerHTML =


    resultado.map(evento=>`


    <div class="item-lista">


        <h3>

        ${escaparTexto(
            evento.titulo
        )}

        </h3>



        <p>

        ${formatarData(
            evento.data
        )}

        </p>


    </div>


    `)
    .join("");



}








// ==========================================================
// LIMPAR FORMULÁRIO
// ==========================================================



function limparFormularioEvento(){



    eventoSelecionado =
    null;




    const campos = [


        "eventoTitulo",

        "eventoData",

        "eventoHorario",

        "eventoDescricao"


    ];




    campos.forEach(id=>{


        const campo =

        document.getElementById(id);



        if(campo){

            campo.value = "";

        }


    });





    const tipo =

    document.getElementById(
        "eventoTipo"
    );



    if(tipo){

        tipo.value =
        "reuniao";

    }





    const cliente =

    document.getElementById(
        "eventoCliente"
    );



    const projeto =

    document.getElementById(
        "eventoProjeto"
    );



    if(cliente){

        cliente.value = "";

    }



    if(projeto){

        projeto.value = "";

    }



}









// ==========================================================
// FORMATADORES
// ==========================================================



function formatarData(data){



    if(!data)
    return "-";



    return new Date(data)

    .toLocaleDateString(
        "pt-BR"
    );


}








// ==========================================================
// SEGURANÇA HTML
// ==========================================================



function escaparTexto(valor){


    return String(valor ?? "")

    .replaceAll("&","&amp;")

    .replaceAll("<","&lt;")

    .replaceAll(">","&gt;")

    .replaceAll('"',"&quot;")

    .replaceAll("'","&#039;");


}
