/*
==========================================================
CAMILA MARTINS ENGENHARIA

CLIENTES.JS
GERENCIAMENTO DE CLIENTES

USA:
database.js
supabase.js

VERSÃO DEFINITIVA
==========================================================
*/


let clienteSelecionado = null;



document.addEventListener(
"DOMContentLoaded",
()=>{


    iniciarClientes();


});







// ==========================================================
// INICIALIZAÇÃO
// ==========================================================


async function iniciarClientes(){


    configurarEventosCliente();


    await carregarClientes();



}








// ==========================================================
// CARREGAR CLIENTES
// ==========================================================


async function carregarClientes(){


    const lista =
    document.getElementById(
        "listaClientes"
    );



    if(!lista)
    return;




    try{


        const clientes =
        await dbBuscarClientes();




        if(!clientes.length){


            lista.innerHTML = `

            <div class="estado-vazio">

                Nenhum cliente cadastrado.

            </div>

            `;


            return;


        }






        lista.innerHTML =


        clientes.map(cliente=>`


        <div class="item-lista cliente-item"
        data-id="${cliente.id}">


            <div>


                <h3>

                ${escaparTexto(
                    cliente.nome
                )}

                </h3>



                <p>

                ${escaparTexto(
                    cliente.email || ""
                )}

                </p>



                <span>

                ${cliente.status || "Ativo"}

                </span>



            </div>




            <div class="acoes-item">


                <button
                class="editarCliente"
                data-id="${cliente.id}">

                <i class="fa-solid fa-pen"></i>

                </button>




                <button
                class="excluirCliente"
                data-id="${cliente.id}">

                <i class="fa-solid fa-trash"></i>

                </button>



            </div>



        </div>


        `)
        .join("");





        configurarAcoesLista();



    }
    catch(error){


        console.error(
            "Erro carregar clientes:",
            error
        );


    }



}








// ==========================================================
// PESQUISA
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



    const termo =
    campo.value
    .toLowerCase()
    .trim();




    const clientes =
    await dbBuscarClientes();




    const filtrados =

    clientes.filter(cliente=>{


        return cliente.nome
        .toLowerCase()
        .includes(termo);


    });




    lista.innerHTML =


    filtrados.map(cliente=>`


    <div class="item-lista cliente-item"
    data-id="${cliente.id}">


        <h3>

        ${escaparTexto(cliente.nome)}

        </h3>


    </div>


    `)
    .join("");



}
// ==========================================================
// CADASTRO / EDIÇÃO DE CLIENTE
// ==========================================================



function abrirModalCliente(){


    const modal =
    document.getElementById(
        "modalCliente"
    );



    if(modal){

        modal.style.display =
        "flex";

    }


}







function fecharModalCliente(){


    const modal =
    document.getElementById(
        "modalCliente"
    );



    if(modal){

        modal.style.display =
        "none";

    }



    limparFormularioCliente();


}








async function salvarCliente(evento){


    evento.preventDefault();




    const cliente = {


        nome:
        document.getElementById(
            "clienteNome"
        ).value,



        cpf:
        document.getElementById(
            "clienteCpf"
        ).value,



        telefone:
        document.getElementById(
            "clienteTelefone"
        ).value,



        email:
        document.getElementById(
            "clienteEmail"
        ).value,



        endereco:
        document.getElementById(
            "clienteEndereco"
        ).value,



        cidade:
        document.getElementById(
            "clienteCidade"
        ).value,



        estado:
        document.getElementById(
            "clienteEstado"
        ).value,



        cep:
        document.getElementById(
            "clienteCep"
        ).value,



        status:
        document.getElementById(
            "clienteStatus"
        ).value,



        observacoes:
        document.getElementById(
            "clienteObservacoes"
        ).value



    };






    try{



        if(clienteSelecionado){



            await dbEditarCliente(

                clienteSelecionado,

                cliente

            );



        }
        else{



            await dbCriarCliente(

                cliente

            );



        }




        fecharModalCliente();



        await carregarClientes();



    }
    catch(error){


        console.error(
            "Erro salvar cliente:",
            error
        );


        alert(
            "Erro ao salvar cliente."
        );


    }



}







async function editarCliente(id){



    const cliente =

    await dbBuscarClientePorId(id);




    clienteSelecionado =
    id;





    document.getElementById(
        "clienteNome"
    ).value =
    cliente.nome || "";




    document.getElementById(
        "clienteCpf"
    ).value =
    cliente.cpf || "";




    document.getElementById(
        "clienteTelefone"
    ).value =
    cliente.telefone || "";




    document.getElementById(
        "clienteEmail"
    ).value =
    cliente.email || "";




    document.getElementById(
        "clienteEndereco"
    ).value =
    cliente.endereco || "";




    document.getElementById(
        "clienteCidade"
    ).value =
    cliente.cidade || "";




    document.getElementById(
        "clienteEstado"
    ).value =
    cliente.estado || "";




    document.getElementById(
        "clienteCep"
    ).value =
    cliente.cep || "";




    document.getElementById(
        "clienteStatus"
    ).value =
    cliente.status || "ativo";




    document.getElementById(
        "clienteObservacoes"
    ).value =
    cliente.observacoes || "";




    abrirModalCliente();



}
// ==========================================================
// EXCLUSÃO DE CLIENTE
// ==========================================================



async function excluirCliente(id){


    const confirmar =

    confirm(
        "Deseja realmente excluir este cliente?"
    );



    if(!confirmar)
    return;




    try{


        await dbExcluirCliente(id);



        clienteSelecionado =
        null;



        await carregarClientes();



    }
    catch(error){


        console.error(
            "Erro excluir cliente:",
            error
        );


        alert(
            "Erro ao excluir cliente."
        );


    }



}







// ==========================================================
// AÇÕES DA LISTA
// ==========================================================



function configurarAcoesLista(){



    document
    .querySelectorAll(
        ".editarCliente"
    )
    .forEach(botao=>{


        botao.addEventListener(
            "click",
            ()=>{


                editarCliente(
                    botao.dataset.id
                );


            }
        );


    });







    document
    .querySelectorAll(
        ".excluirCliente"
    )
    .forEach(botao=>{


        botao.addEventListener(
            "click",
            ()=>{


                excluirCliente(
                    botao.dataset.id
                );


            }
        );


    });







    document
    .querySelectorAll(
        ".cliente-item"
    )
    .forEach(item=>{


        item.addEventListener(
            "click",
            ()=>{


                carregarDetalhesCliente(
                    item.dataset.id
                );


            }
        );


    });



}








// ==========================================================
// DETALHES DO CLIENTE
// ==========================================================



async function carregarDetalhesCliente(id){



    clienteSelecionado =
    id;




    const cliente =

    await dbBuscarClientePorId(id);




    const detalhes =

    document.getElementById(
        "detalhesCliente"
    );




    if(detalhes){


        detalhes.innerHTML = `


        <h3>

        ${escaparTexto(
            cliente.nome
        )}

        </h3>


        <p>

        ${escaparTexto(
            cliente.email || ""
        )}

        </p>


        <p>

        ${escaparTexto(
            cliente.telefone || ""
        )}

        </p>


        <p>

        ${escaparTexto(
            cliente.endereco || ""
        )}

        </p>


        `;


    }






    carregarProjetosCliente(id);


    carregarDocumentosCliente(id);



}







async function carregarProjetosCliente(id){



    const lista =

    document.getElementById(
        "projetosCliente"
    );



    if(!lista)
    return;




    const projetos =

    await dbBuscarProjetosCliente(id);




    lista.innerHTML =


    projetos.map(projeto=>`


        <div class="item-lista">


            ${escaparTexto(
                projeto.nome
            )}


        </div>


    `)
    .join("");



}







async function carregarDocumentosCliente(id){



    const lista =

    document.getElementById(
        "documentosCliente"
    );



    if(!lista)
    return;




    const documentos =

    await dbBuscarDocumentosCliente(id);




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
// EVENTOS
// ==========================================================


function configurarEventosCliente(){



    document
    .getElementById(
        "novoCliente"
    )
    ?.addEventListener(
        "click",
        ()=>{


            clienteSelecionado =
            null;


            limparFormularioCliente();


            abrirModalCliente();


        }
    );






    document
    .getElementById(
        "fecharModalCliente"
    )
    ?.addEventListener(
        "click",
        fecharModalCliente
    );






    document
    .getElementById(
        "cancelarCliente"
    )
    ?.addEventListener(
        "click",
        fecharModalCliente
    );






    document
    .getElementById(
        "formCliente"
    )
    ?.addEventListener(
        "submit",
        salvarCliente
    );






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
        "keyup",
        pesquisarClientes
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
// LIMPAR FORMULÁRIO
// ==========================================================



function limparFormularioCliente(){



    clienteSelecionado =
    null;




    const campos = [


        "clienteNome",

        "clienteCpf",

        "clienteTelefone",

        "clienteEmail",

        "clienteEndereco",

        "clienteCidade",

        "clienteEstado",

        "clienteCep",

        "clienteObservacoes"


    ];




    campos.forEach(id=>{


        const campo =
        document.getElementById(id);



        if(campo){

            campo.value = "";

        }


    });




    const status =
    document.getElementById(
        "clienteStatus"
    );



    if(status){

        status.value =
        "ativo";

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
