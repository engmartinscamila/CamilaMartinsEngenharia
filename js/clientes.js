/*
==========================================================
CAMILA MARTINS ENGENHARIA
CLIENTES.JS - VERSÃO CORRIGIDA
==========================================================
*/


let clientes = [];

let clienteSelecionado = null;



// ==========================================================
// INICIALIZAÇÃO
// ==========================================================


document.addEventListener(
    "DOMContentLoaded",
    () => {

        iniciarClientes();

    }
);





async function iniciarClientes(){


    try{


        await carregarClientes();



        configurarEventosClientes();



    }
    catch(error){


        console.error(
            "Erro inicializar clientes:",
            error
        );


    }


}







// ==========================================================
// CARREGAR CLIENTES
// ==========================================================



async function carregarClientes(){


    const lista =
    document.getElementById(
        "listaClientes"
    );



    if(lista){

        lista.innerHTML =
        carregarAnimacao();

    }



    try{


        clientes =
        await dbBuscarClientes();



        renderizarClientes();



    }
    catch(error){


        console.error(
            "Erro carregar clientes:",
            error
        );


        if(lista){

            lista.innerHTML =
            mensagemErro(
                "Não foi possível carregar clientes."
            );

        }


    }


}







// ==========================================================
// RENDERIZAÇÃO
// ==========================================================



function renderizarClientes(){


    const lista =
    document.getElementById(
        "listaClientes"
    );



    if(!lista){

        return;

    }



    lista.innerHTML = "";



    if(!clientes || clientes.length === 0){


        lista.innerHTML = `

        <div class="vazio">

            Nenhum cliente cadastrado.

        </div>

        `;


        return;


    }





    clientes.forEach(cliente=>{


        const item =
        document.createElement(
            "div"
        );



        item.className =
        "cliente-item";



        item.innerHTML = `

            <div class="cliente-info">

                <h3>
                    ${escaparTexto(cliente.nome)}
                </h3>


                <p>
                    ${escaparTexto(cliente.status || "Ativo")}
                </p>

            </div>


            <div class="cliente-acoes">

                <button
                onclick="selecionarCliente('${escaparTexto(cliente.id)}')">

                    Abrir

                </button>


            </div>

        `;



        lista.appendChild(item);



    });



}
// ==========================================================
// PESQUISA
// ==========================================================


async function pesquisarClientes(){


    const campo =
    document.getElementById(
        "pesquisaCliente"
    );



    if(!campo){

        return;

    }



    const termo =
    campo.value
    .toLowerCase()
    .trim();



    if(!termo){


        renderizarClientes();

        return;


    }




    const resultado =

    clientes.filter(cliente=>{


        return (

            cliente.nome &&
            cliente.nome
            .toLowerCase()
            .includes(termo)

        );


    });




    renderizarListaClientes(
        resultado
    );


}







function renderizarListaClientes(lista){


    const elemento =
    document.getElementById(
        "listaClientes"
    );



    if(!elemento){

        return;

    }



    elemento.innerHTML = "";




    if(!lista.length){


        elemento.innerHTML = `

        <div class="vazio">

            Nenhum cliente encontrado.

        </div>

        `;


        return;


    }




    lista.forEach(cliente=>{


        elemento.innerHTML += `

        <div class="cliente-item">


            <div class="cliente-info">


                <h3>

                    ${escaparTexto(cliente.nome)}

                </h3>


                <p>

                    ${escaparTexto(cliente.email)}

                </p>


            </div>



            <div class="cliente-acoes">


                <button
                onclick="editarCliente('${escaparTexto(cliente.id)}')">

                    Editar

                </button>



                <button
                onclick="excluirCliente('${escaparTexto(cliente.id)}')">

                    Excluir

                </button>


            </div>


        </div>

        `;


    });



}







// ==========================================================
// MODAL CLIENTE
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


    clienteSelecionado = null;



}







// ==========================================================
// SALVAR CLIENTE
// ==========================================================



async function salvarCliente(event){


    if(event){

        event.preventDefault();

    }




    const dados = {


        nome:

        document.getElementById(
            "clienteNome"
        )?.value.trim() || "",



        email:

        document.getElementById(
            "clienteEmail"
        )?.value.trim() || "",



        telefone:

        document.getElementById(
            "clienteTelefone"
        )?.value.trim() || "",



        cpf_cnpj:

        document.getElementById(
            "clienteCpf"
        )?.value.trim() || "",



        endereco:

        document.getElementById(
            "clienteEndereco"
        )?.value.trim() || "",



        cidade:
        document.getElementById(
            "clienteCidade"
        )?.value.trim() || "",

        estado:
        document.getElementById(
            "clienteEstado"
        )?.value.trim() || "",

        cep:
        document.getElementById(
            "clienteCep"
        )?.value.trim() || "",

        observacoes:
        document.getElementById(
            "clienteObservacoes"
        )?.value.trim() || "",

        status:
        document.getElementById(
            "clienteStatus"
        )?.value || "ativo"


    };




    try{


        if(clienteSelecionado){


            await dbEditarCliente(

                clienteSelecionado,

                dados

            );


        }
        else{


            await dbCriarCliente(

                dados

            );


        }



        fecharModalCliente();



        limparFormularioCliente();



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
// ==========================================================
// EDITAR CLIENTE
// ==========================================================



async function editarCliente(id){


    const cliente =

    clientes.find(
        c => c.id == id
    );



    if(!cliente){

        return;

    }




    clienteSelecionado = id;




    const campos = {


        clienteNome:
        cliente.nome,


        clienteEmail:
        cliente.email,


        clienteTelefone:
        cliente.telefone,


        clienteCpf:
        cliente.cpf_cnpj,


        clienteEndereco:
        cliente.endereco,

        clienteCidade:
        cliente.cidade,

        clienteEstado:
        cliente.estado,

        clienteCep:
        cliente.cep,

        clienteStatus:
        cliente.status,

        clienteObservacoes:
        cliente.observacoes


    };





    Object.keys(campos)
    .forEach(campo=>{


        const elemento =

        document.getElementById(
            campo
        );



        if(elemento){

            elemento.value =
            campos[campo] || "";

        }


    });





    abrirModalCliente();



}







// ==========================================================
// EXCLUIR CLIENTE
// ==========================================================



async function excluirCliente(id){


    if(!confirm(
        "Deseja excluir este cliente?"
    )){


        return;


    }





    try{


        await dbExcluirCliente(id);



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
// LIMPAR FORMULÁRIO
// ==========================================================



function limparFormularioCliente(){


    const campos = [


        "clienteNome",

        "clienteEmail",

        "clienteTelefone",

        "clienteCpf",

        "clienteEndereco",

        "clienteCidade",

        "clienteEstado",

        "clienteCep",

        "clienteObservacoes"


    ];





    campos.forEach(id=>{


        const campo =

        document.getElementById(
            id
        );



        if(campo){

            campo.value="";

        }



    });





    clienteSelecionado = null;



}







// ==========================================================
// EVENTOS
// ==========================================================



function configurarEventosClientes(){

    document
    .getElementById("novoCliente")
    ?.addEventListener("click", ()=>{

        clienteSelecionado = null;

        limparFormularioCliente();

        abrirModalCliente();

    });


    document
    .getElementById("fecharModalCliente")
    ?.addEventListener("click", fecharModalCliente);


    document
    .getElementById("cancelarCliente")
    ?.addEventListener("click", fecharModalCliente);



    const formulario =

    document.getElementById(
        "formCliente"
    );



    if(formulario){


        formulario.addEventListener(

            "submit",

            salvarCliente

        );


    }




    const busca =

    document.getElementById(
        "pesquisaCliente"
    );



    if(busca){


        busca.addEventListener(

            "input",

            pesquisarClientes

        );


    }



}







// ==========================================================
// FUNÇÕES AUXILIARES
// ==========================================================



function carregarAnimacao(){


    return `

    <div class="loading">

        Carregando...

    </div>

    `;


}






function mensagemErro(texto){


    return `

    <div class="erro">

        ${texto}

    </div>

    `;


}




function escaparTexto(texto){


    return String(texto ?? "")

    .replaceAll("&","&amp;")

    .replaceAll("<","&lt;")

    .replaceAll(">","&gt;")

    .replaceAll('"',"&quot;")

    .replaceAll("'","&#039;");


}
// ==========================================================
// SELECIONAR CLIENTE
// ==========================================================



function selecionarCliente(id){


    const cliente =

    clientes.find(
        c => c.id == id
    );



    if(!cliente){

        return;

    }



    clienteSelecionado = id;



    if(typeof abrirDetalhesCliente === "function"){

        abrirDetalhesCliente(cliente);

    }
    else{


        console.log(
            "Cliente selecionado:",
            cliente
        );


    }



}







// ==========================================================
// ATUALIZAR LISTA APÓS ALTERAÇÃO
// ==========================================================



async function atualizarClientes(){


    await carregarClientes();



}







// ==========================================================
// EXPORTAÇÃO GLOBAL
// ==========================================================


window.carregarClientes =
carregarClientes;


window.salvarCliente =
salvarCliente;


window.editarCliente =
editarCliente;


window.excluirCliente =
excluirCliente;


window.abrirModalCliente =
abrirModalCliente;


window.fecharModalCliente =
fecharModalCliente;


window.pesquisarClientes =
pesquisarClientes;


console.log(
    "CLIENTES.JS CARREGADO COM SUCESSO"
);
