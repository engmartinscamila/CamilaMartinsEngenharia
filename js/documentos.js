/*
==========================================================
CAMILA MARTINS ENGENHARIA

DOCUMENTOS.JS
GERENCIAMENTO DE DOCUMENTOS

VERSÃO CORRIGIDA
==========================================================
*/


let documentoSelecionado = null;



// ==========================================================
// INICIALIZAÇÃO
// ==========================================================


document.addEventListener(
    "DOMContentLoaded",
    async()=>{


        await iniciarDocumentos();


    }
);





async function iniciarDocumentos(){


    try{


        await carregarDocumentos();


        await carregarClientesDocumento();


        await carregarProjetosDocumento();


        configurarEventosDocumento();



    }
    catch(error){


        console.error(
            "Erro iniciando documentos:",
            error
        );


    }


}






// ==========================================================
// LISTAR DOCUMENTOS
// ==========================================================



async function carregarDocumentos(){


    const lista =

    document.getElementById(
        "listaDocumentos"
    );



    if(!lista)
    return;



    try{


        const documentos =

        await dbBuscarDocumentos();




        if(!documentos.length){


            lista.innerHTML = `

            <div class="estado-vazio">

                Nenhum documento cadastrado.

            </div>

            `;


            return;


        }






        lista.innerHTML =


        documentos.map(documento=>`



        <div class="item-lista documento-item">


            <div>


                <h3>

                ${escaparTexto(
                    documento.nome ||
                    "Documento"
                )}

                </h3>



                <p>

                ${escaparTexto(
                    documento.categoria || ""
                )}

                </p>



                <span>

                ${
                    escaparTexto(
                        documento.clientes?.nome || ""
                    )
                }

                </span>


            </div>





            <div class="acoes-item">


                <button
                class="visualizarDocumento"
                data-id="${documento.id}">

                    👁

                </button>



                <button
                class="excluirDocumento"
                data-id="${documento.id}">

                    🗑

                </button>



            </div>



        </div>



        `)

        .join("");




        configurarAcoesDocumentos();



    }
    catch(error){


        console.error(
            "Erro carregar documentos:",
            error
        );


    }



}
// ==========================================================
// CARREGAR CLIENTES
// ==========================================================


async function carregarClientesDocumento(){


    const select =

    document.getElementById(
        "documentoCliente"
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
// CARREGAR PROJETOS
// ==========================================================



async function carregarProjetosDocumento(){


    const select =

    document.getElementById(
        "documentoProjeto"
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
// ABRIR / FECHAR MODAL
// ==========================================================



function abrirModalDocumento(){


    const modal =

    document.getElementById(
        "modalDocumento"
    );



    if(modal){

        modal.style.display = "flex";

    }


}




function fecharModalDocumento(){


    const modal =

    document.getElementById(
        "modalDocumento"
    );



    if(modal){

        modal.style.display = "none";

    }



    limparFormularioDocumento();



}







// ==========================================================
// SALVAR DOCUMENTO
// ==========================================================



async function salvarDocumento(evento){


    evento.preventDefault();



    try{


        const documento = {


            nome:

            document.getElementById(
                "documentoNome"
            ).value,



            cliente_id:

            document.getElementById(
                "documentoCliente"
            ).value || null,



            projeto_id:

            document.getElementById(
                "documentoProjeto"
            ).value || null,



            categoria:

            document.getElementById(
                "documentoCategoria"
            )?.value || "",



            descricao:

            document.getElementById(
                "documentoDescricao"
            )?.value || ""



        };





        await dbSalvarDocumento(
            documento
        );



        fecharModalDocumento();


        await carregarDocumentos();



    }
    catch(error){


        console.error(
            "Erro salvar documento:",
            error
        );


        alert(
            "Erro ao salvar documento."
        );


    }



}
// ==========================================================
// EXCLUIR DOCUMENTO
// ==========================================================



async function excluirDocumento(id){


    const confirmar = confirm(
        "Deseja realmente excluir este documento?"
    );



    if(!confirmar)
    return;



    try{


        await dbExcluirDocumento(id);



        await carregarDocumentos();



    }
    catch(error){


        console.error(
            "Erro excluir documento:",
            error
        );


        alert(
            "Erro ao excluir documento."
        );


    }



}






// ==========================================================
// VISUALIZAR DOCUMENTO
// ==========================================================



async function visualizarDocumento(id){


    const documentos =

    await dbBuscarDocumentos();




    const documento =

    documentos.find(
        item =>
        item.id == id
    );



    if(!documento)
    return;



    const detalhes =

    document.getElementById(
        "detalhesDocumento"
    );



    if(!detalhes)
    return;



    detalhes.innerHTML = `


        <h3>

        ${escaparTexto(
            documento.nome
        )}

        </h3>



        <p>

        Cliente:

        ${escaparTexto(
            documento.clientes?.nome || ""
        )}

        </p>



        <p>

        ${escaparTexto(
            documento.descricao || ""
        )}

        </p>



        ${
            documento.url ?

            `

            <a
            href="${documento.url}"
            target="_blank">

                Abrir arquivo

            </a>

            `

            :

            ""

        }


    `;



}







// ==========================================================
// AÇÕES DA LISTA
// ==========================================================



function configurarAcoesDocumentos(){



    document
    .querySelectorAll(
        ".visualizarDocumento"
    )
    .forEach(botao=>{


        botao.addEventListener(
            "click",
            ()=>{


                visualizarDocumento(
                    botao.dataset.id
                );


            }
        );


    });







    document
    .querySelectorAll(
        ".excluirDocumento"
    )
    .forEach(botao=>{


        botao.addEventListener(
            "click",
            ()=>{


                excluirDocumento(
                    botao.dataset.id
                );


            }
        );


    });



}







// ==========================================================
// EVENTOS
// ==========================================================



function configurarEventosDocumento(){



    document
    .getElementById(
        "novoDocumento"
    )
    ?.addEventListener(
        "click",
        ()=>{


            abrirModalDocumento();


        }
    );





    document
    .getElementById(
        "fecharModalDocumento"
    )
    ?.addEventListener(
        "click",
        fecharModalDocumento
    );





    document
    .getElementById(
        "cancelarDocumento"
    )
    ?.addEventListener(
        "click",
        fecharModalDocumento
    );





    document
    .getElementById(
        "formDocumento"
    )
    ?.addEventListener(
        "submit",
        salvarDocumento
    );



}
// ==========================================================
// LIMPAR FORMULÁRIO
// ==========================================================



function limparFormularioDocumento(){


    documentoSelecionado = null;



    const campos = [


        "documentoNome",

        "documentoDescricao"


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
        "documentoCliente"
    );



    const projeto =

    document.getElementById(
        "documentoProjeto"
    );




    if(cliente){

        cliente.value = "";

    }



    if(projeto){

        projeto.value = "";

    }



}








// ==========================================================
// PESQUISA
// ==========================================================



async function pesquisarDocumentos(){



    const campo =

    document.getElementById(
        "pesquisaDocumento"
    );



    const lista =

    document.getElementById(
        "listaDocumentos"
    );



    if(!campo || !lista)
    return;





    const termo =

    campo.value
    .toLowerCase()
    .trim();




    const documentos =

    await dbBuscarDocumentos();





    const resultado =

    documentos.filter(documento=>{


        return (

            documento.nome ||

            ""

        )
        .toLowerCase()
        .includes(termo);



    });






    lista.innerHTML =


    resultado.map(documento=>`


        <div class="item-lista documento-item">


            <h3>

                ${escaparTexto(
                    documento.nome
                )}

            </h3>


        </div>



    `)

    .join("");



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
