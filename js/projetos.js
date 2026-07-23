/*
==========================================================
CAMILA MARTINS ENGENHARIA

PROJETOS.JS
GERENCIAMENTO DE PROJETOS

USA:
database.js
supabase.js

VERSÃO DEFINITIVA
==========================================================
*/


let projetoSelecionado = null;



document.addEventListener(
"DOMContentLoaded",
()=>{


    iniciarProjetos();


});







// ==========================================================
// INICIALIZAÇÃO
// ==========================================================


async function iniciarProjetos(){


    configurarEventosProjeto();


    await carregarProjetos();


    await carregarClientesSelect();



}








// ==========================================================
// CARREGAR PROJETOS
// ==========================================================


async function carregarProjetos(){



    const lista =

    document.getElementById(
        "listaProjetos"
    );



    if(!lista)
    return;




    try{


        const projetos =

        await dbBuscarProjetos();





        if(!projetos.length){


            lista.innerHTML = `

            <div class="estado-vazio">

            Nenhum projeto cadastrado.

            </div>

            `;


            return;


        }







        lista.innerHTML =


        projetos.map(projeto=>`


        <div class="item-lista projeto-item"
        data-id="${projeto.id}">



            <div>


                <h3>

                ${escaparTexto(
                    projeto.nome
                )}

                </h3>



                <p>

                Cliente:

                ${escaparTexto(
                    projeto.clientes?.nome || 
                    "Não informado"
                )}

                </p>



                <span>

                ${escaparTexto(
                    projeto.status || ""
                )}

                </span>



            </div>





            <div class="acoes-item">


                <button
                class="editarProjeto"
                data-id="${projeto.id}">


                <i class="fa-solid fa-pen"></i>


                </button>





                <button
                class="excluirProjeto"
                data-id="${projeto.id}">


                <i class="fa-solid fa-trash"></i>


                </button>



            </div>



        </div>



        `)
        .join("");





        configurarAcoesProjetos();



    }
    catch(error){


        console.error(
            "Erro carregar projetos:",
            error
        );


    }



}
// ==========================================================
// CARREGAR CLIENTES NO SELECT
// ==========================================================



async function carregarClientesSelect(){



    const select =

    document.getElementById(
        "projetoCliente"
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
// ABRIR / FECHAR MODAL
// ==========================================================



function abrirModalProjeto(){


    const modal =

    document.getElementById(
        "modalProjeto"
    );



    if(modal){

        modal.style.display =
        "flex";

    }


}







function fecharModalProjeto(){


    const modal =

    document.getElementById(
        "modalProjeto"
    );



    if(modal){

        modal.style.display =
        "none";

    }



    limparFormularioProjeto();



}








// ==========================================================
// SALVAR PROJETO
// ==========================================================



async function salvarProjeto(evento){


    evento.preventDefault();





    const projeto = {



        nome:

        document.getElementById(
            "projetoNome"
        ).value,





        cliente_id:

        document.getElementById(
            "projetoCliente"
        ).value,





        tipo:

        document.getElementById(
            "projetoTipo"
        ).value,





        status:

        document.getElementById(
            "projetoStatus"
        ).value,





        descricao:

        document.getElementById(
            "projetoDescricao"
        ).value,





        data_inicio:

        document.getElementById(
            "projetoDataInicio"
        ).value,





        data_fim:

        document.getElementById(
            "projetoDataFim"
        ).value




    };






    try{



        if(projetoSelecionado){



            await dbEditarProjeto(

                projetoSelecionado,

                projeto

            );



        }
        else{



            await dbCriarProjeto(

                projeto

            );



        }






        fecharModalProjeto();



        await carregarProjetos();



    }
    catch(error){


        console.error(
            "Erro salvar projeto:",
            error
        );



        alert(
            "Erro ao salvar projeto."
        );


    }



}







// ==========================================================
// EDITAR PROJETO
// ==========================================================



async function editarProjeto(id){



    const projeto =

    await dbBuscarProjetoPorId(id);





    projetoSelecionado =
    id;





    document.getElementById(
        "projetoNome"
    ).value =
    projeto.nome || "";





    document.getElementById(
        "projetoCliente"
    ).value =
    projeto.cliente_id || "";





    document.getElementById(
        "projetoTipo"
    ).value =
    projeto.tipo || "";





    document.getElementById(
        "projetoStatus"
    ).value =
    projeto.status || "";





    document.getElementById(
        "projetoDescricao"
    ).value =
    projeto.descricao || "";





    document.getElementById(
        "projetoDataInicio"
    ).value =
    projeto.data_inicio || "";





    document.getElementById(
        "projetoDataFim"
    ).value =
    projeto.data_fim || "";





    abrirModalProjeto();



}
// ==========================================================
// EXCLUIR PROJETO
// ==========================================================



async function excluirProjeto(id){


    const confirmar =

    confirm(
        "Deseja realmente excluir este projeto?"
    );



    if(!confirmar)
    return;





    try{


        await dbExcluirProjeto(id);



        projetoSelecionado =
        null;



        await carregarProjetos();



    }
    catch(error){


        console.error(
            "Erro excluir projeto:",
            error
        );



        alert(
            "Erro ao excluir projeto."
        );


    }



}








// ==========================================================
// AÇÕES DA LISTA
// ==========================================================



function configurarAcoesProjetos(){



    document
    .querySelectorAll(
        ".editarProjeto"
    )
    .forEach(botao=>{


        botao.addEventListener(
            "click",
            ()=>{


                editarProjeto(
                    botao.dataset.id
                );


            }
        );


    });







    document
    .querySelectorAll(
        ".excluirProjeto"
    )
    .forEach(botao=>{


        botao.addEventListener(
            "click",
            ()=>{


                excluirProjeto(
                    botao.dataset.id
                );


            }
        );


    });







    document
    .querySelectorAll(
        ".projeto-item"
    )
    .forEach(item=>{


        item.addEventListener(
            "click",
            ()=>{


                carregarDetalhesProjeto(
                    item.dataset.id
                );


            }
        );


    });



}








// ==========================================================
// DETALHES DO PROJETO
// ==========================================================



async function carregarDetalhesProjeto(id){



    projetoSelecionado =
    id;




    const projeto =

    await dbBuscarProjetoPorId(id);





    const detalhes =

    document.getElementById(
        "detalhesProjeto"
    );





    if(detalhes){



        detalhes.innerHTML = `


        <h3>

        ${escaparTexto(
            projeto.nome
        )}

        </h3>



        <p>

        Status:

        ${escaparTexto(
            projeto.status || ""
        )}

        </p>



        <p>

        Tipo:

        ${escaparTexto(
            projeto.tipo || ""
        )}

        </p>



        <p>

        ${escaparTexto(
            projeto.descricao || ""
        )}

        </p>


        `;


    }





    carregarDocumentosProjeto(id);


    carregarFotosProjeto(id);



}








// ==========================================================
// DOCUMENTOS DO PROJETO
// ==========================================================



async function carregarDocumentosProjeto(id){



    const lista =

    document.getElementById(
        "documentosProjeto"
    );



    if(!lista)
    return;





    const documentos =

    await dbBuscarDocumentosProjeto(id);





    lista.innerHTML =


    documentos.map(documento=>`


        <div class="item-lista">


            ${escaparTexto(
                documento.nome ||
                documento.titulo
            )}


        </div>


    `)
    .join("");



}







// ==========================================================
// FOTOS DO PROJETO
// ==========================================================



async function carregarFotosProjeto(id){



    const lista =

    document.getElementById(
        "fotosProjeto"
    );



    if(!lista)
    return;





    const fotos =

    await dbBuscarFotosProjeto(id);





    lista.innerHTML =


    fotos.map(foto=>`


        <img
        src="${foto.url}"
        class="foto-miniatura">



    `)
    .join("");



}
// ==========================================================
// EVENTOS
// ==========================================================



function configurarEventosProjeto(){



    document
    .getElementById(
        "novoProjeto"
    )
    ?.addEventListener(
        "click",
        ()=>{


            projetoSelecionado =
            null;


            limparFormularioProjeto();


            abrirModalProjeto();


        }
    );






    document
    .getElementById(
        "fecharModalProjeto"
    )
    ?.addEventListener(
        "click",
        fecharModalProjeto
    );







    document
    .getElementById(
        "cancelarProjeto"
    )
    ?.addEventListener(
        "click",
        fecharModalProjeto
    );







    document
    .getElementById(
        "formProjeto"
    )
    ?.addEventListener(
        "submit",
        salvarProjeto
    );







    document
    .getElementById(
        "pesquisaProjeto"
    )
    ?.addEventListener(
        "keyup",
        pesquisarProjetos
    );







    document
    .getElementById(
        "btnPesquisarProjeto"
    )
    ?.addEventListener(
        "click",
        pesquisarProjetos
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
// PESQUISA DE PROJETOS
// ==========================================================



async function pesquisarProjetos(){



    const campo =

    document.getElementById(
        "pesquisaProjeto"
    );



    const lista =

    document.getElementById(
        "listaProjetos"
    );



    if(!campo || !lista)
    return;





    const termo =

    campo.value
    .toLowerCase()
    .trim();





    const projetos =

    await dbBuscarProjetos();





    const resultado =

    projetos.filter(projeto=>{


        return projeto.nome
        .toLowerCase()
        .includes(termo);


    });





    lista.innerHTML =


    resultado.map(projeto=>`


    <div class="item-lista projeto-item"
    data-id="${projeto.id}">


        <h3>

        ${escaparTexto(
            projeto.nome
        )}

        </h3>


    </div>


    `)
    .join("");



}








// ==========================================================
// LIMPAR FORMULÁRIO
// ==========================================================



function limparFormularioProjeto(){



    projetoSelecionado =
    null;




    const campos = [


        "projetoNome",

        "projetoDescricao",

        "projetoDataInicio",

        "projetoDataFim"


    ];




    campos.forEach(id=>{


        const campo =

        document.getElementById(id);



        if(campo){

            campo.value = "";

        }


    });





    const cliente =

    document.getElementById(
        "projetoCliente"
    );



    if(cliente){

        cliente.value = "";

    }




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
