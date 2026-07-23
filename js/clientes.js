/*
==========================================================
CAMILA MARTINS ENGENHARIA
CLIENTES
VERSÃO FINAL
==========================================================
*/


document.addEventListener("DOMContentLoaded", () => {

    iniciarClientes();

});




// ==========================================================
// INICIALIZAÇÃO
// ==========================================================


function iniciarClientes(){


    configurarFormularioCliente();


    carregarClientesPagina();


    carregarClientesNosSelects();



    document
    .getElementById("btnPesquisarClientes")
    ?.addEventListener(
        "click",
        pesquisarClientesPagina
    );


}





// ==========================================================
// FORMULÁRIO
// ==========================================================


function configurarFormularioCliente(){


    const formulario =
    document.getElementById("formCliente");



    if(!formulario) return;



    formulario.addEventListener(
        "submit",
        salvarClienteFormulario
    );


}





// ==========================================================
// CADASTRAR CLIENTE
// ==========================================================


async function salvarClienteFormulario(event){


    event.preventDefault();



    const cliente = {


        nome:
        document.getElementById("clienteNome")
        ?.value
        .trim(),



        cpf_cnpj:
        document.getElementById("clienteCpf")
        ?.value
        .trim() || null,



        telefone:
        document.getElementById("clienteTelefone")
        ?.value
        .trim() || null,



        email:
        document.getElementById("clienteEmail")
        ?.value
        .trim() || null,



        endereco:
        document.getElementById("clienteEndereco")
        ?.value
        .trim() || null,



        cidade:
        document.getElementById("clienteCidade")
        ?.value
        .trim() || null,



        estado:
        document.getElementById("clienteEstado")
        ?.value
        .trim() || null,



        cep:
        document.getElementById("clienteCep")
        ?.value
        .trim() || null,



        status:
        document.getElementById("clienteStatus")
        ?.value || "ativo",



        observacoes:
        document.getElementById("clienteObservacoes")
        ?.value
        .trim() || null

    };




    if(!cliente.nome){


        alert("Informe o nome do cliente.");

        return;

    }




    try{


        await criarCliente(cliente);



        alert("Cliente cadastrado com sucesso.");



        fecharModalCliente();



        document
        .getElementById("formCliente")
        ?.reset();



        await carregarClientesPagina();



        await carregarClientesNosSelects();



    }
    catch(error){


        console.error(error);


        alert("Erro ao cadastrar cliente.");


    }



}
// ==========================================================
// CARREGAR CLIENTES
// ==========================================================


async function carregarClientesPagina(){


    const tabela =
    document.getElementById("tabelaClientes");



    if(!tabela) return;




    try{


        const clientes =
        await buscarClientes();



        renderizarClientes(clientes);



    }
    catch(error){


        console.error(error);



        tabela.innerHTML = `

        <tr>

            <td colspan="7">

                Erro ao carregar clientes.

            </td>

        </tr>

        `;


    }


}





// ==========================================================
// RENDERIZAR CLIENTES
// ==========================================================


function renderizarClientes(clientes){


    const tabela =
    document.getElementById("tabelaClientes");



    if(!tabela) return;




    if(clientes.length === 0){


        tabela.innerHTML = `

        <tr>

            <td colspan="7">

                Nenhum cliente cadastrado.

            </td>

        </tr>

        `;


        return;

    }





    tabela.innerHTML = clientes.map(cliente => `


        <tr>


            <td>
                ${escaparTexto(cliente.nome)}
            </td>



            <td>
                ${escaparTexto(cliente.telefone || "-")}
            </td>



            <td>
                ${escaparTexto(cliente.email || "-")}
            </td>



            <td>
                ${escaparTexto(cliente.cidade || "-")}
            </td>



            <td>
                ${escaparTexto(cliente.estado || "-")}
            </td>



            <td>

                <span class="badge">

                    ${formatarStatus(cliente.status)}

                </span>


            </td>




            <td>


                <button
                class="btn-icon edit"
                onclick="abrirEdicaoCliente('${cliente.id}')">

                    <i class="fa-solid fa-pen"></i>

                </button>




                <button
                class="btn-icon delete"
                onclick="excluirClienteTela('${cliente.id}')">

                    <i class="fa-solid fa-trash"></i>

                </button>



            </td>



        </tr>


    `).join("");



}





// ==========================================================
// PESQUISA
// ==========================================================


async function pesquisarClientesPagina(){


    const termo =
    document
    .getElementById("pesquisarClientes")
    ?.value
    .toLowerCase()
    .trim();




    const clientes =
    await buscarClientes();




    const filtrados =
    clientes.filter(cliente => {


        return (

            cliente.nome
            ?.toLowerCase()
            .includes(termo)


            ||


            cliente.email
            ?.toLowerCase()
            .includes(termo)


            ||


            cliente.telefone
            ?.toLowerCase()
            .includes(termo)

        );


    });




    renderizarClientes(filtrados);



}
// ==========================================================
// ABRIR EDIÇÃO
// ==========================================================


async function abrirEdicaoCliente(id){


    const cliente =
    await buscarClientePorId(id);



    if(!cliente) return;




    document.getElementById("clienteNome").value =
    cliente.nome || "";



    document.getElementById("clienteCpf").value =
    cliente.cpf_cnpj || "";



    document.getElementById("clienteTelefone").value =
    cliente.telefone || "";



    document.getElementById("clienteEmail").value =
    cliente.email || "";



    document.getElementById("clienteEndereco").value =
    cliente.endereco || "";



    document.getElementById("clienteCidade").value =
    cliente.cidade || "";



    document.getElementById("clienteEstado").value =
    cliente.estado || "";



    document.getElementById("clienteCep").value =
    cliente.cep || "";



    document.getElementById("clienteStatus").value =
    cliente.status || "ativo";



    document.getElementById("clienteObservacoes").value =
    cliente.observacoes || "";




    const formulario =
    document.getElementById("formCliente");



    formulario.dataset.clienteId = id;



    formulario.removeEventListener(
        "submit",
        salvarClienteFormulario
    );



    formulario.addEventListener(
        "submit",
        salvarEdicaoCliente,
        {once:true}
    );



    abrirModalCliente();



}





// ==========================================================
// SALVAR EDIÇÃO
// ==========================================================


async function salvarEdicaoCliente(event){


    event.preventDefault();



    const id =
    document
    .getElementById("formCliente")
    .dataset.clienteId;




    const cliente = {


        nome:
        clienteNome.value,


        cpf_cnpj:
        clienteCpf.value,


        telefone:
        clienteTelefone.value,


        email:
        clienteEmail.value,


        endereco:
        clienteEndereco.value,


        cidade:
        clienteCidade.value,


        estado:
        clienteEstado.value,


        cep:
        clienteCep.value,


        status:
        clienteStatus.value,


        observacoes:
        clienteObservacoes.value


    };



    await editarCliente(id, cliente);



    alert("Cliente atualizado com sucesso.");



    fecharModalCliente();



    document
    .getElementById("formCliente")
    ?.reset();



    await carregarClientesPagina();



}





// ==========================================================
// EXCLUIR
// ==========================================================


async function excluirClienteTela(id){


    if(
        !confirm(
            "Deseja excluir este cliente?"
        )
    )
    return;



    try{


        await excluirCliente(id);



        await carregarClientesPagina();



    }
    catch(error){


        console.error(error);


        alert(
            "Erro ao excluir cliente."
        );


    }


}





// ==========================================================
// SELECTS
// ==========================================================


async function carregarClientesNosSelects(){


    const selects = [

        document.getElementById("clienteProjeto"),

        document.getElementById("documentoCliente"),

        document.getElementById("fotoCliente")

    ].filter(Boolean);




    if(selects.length === 0) return;




    const clientes =
    await buscarClientes();




    selects.forEach(select=>{


        select.innerHTML = `

        <option value="">
        Selecione um cliente
        </option>

        `;



        clientes.forEach(cliente=>{


            const option =
            document.createElement("option");



            option.value =
            cliente.id;



            option.textContent =
            cliente.nome;



            select.appendChild(option);


        });



    });



}





// ==========================================================
// MODAL
// ==========================================================


function abrirModalCliente(){


    document
    .getElementById("modalCliente")
    ?.classList
    .add("show");


}



function fecharModalCliente(){


    document
    .getElementById("modalCliente")
    ?.classList
    .remove("show");


}





// ==========================================================
// AUXILIARES
// ==========================================================


function formatarStatus(status){


    const lista = {


        ativo:"Ativo",

        orcamento:"Orçamento",

        pausado:"Pausado",

        concluido:"Concluído"


    };


    return lista[status] || "Ativo";


}




function escaparTexto(valor){


    return String(valor ?? "")

    .replaceAll("&","&amp;")

    .replaceAll("<","&lt;")

    .replaceAll(">","&gt;")

    .replaceAll('"',"&quot;")

    .replaceAll("'","&#039;");


}
