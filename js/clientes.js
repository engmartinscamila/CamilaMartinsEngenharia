/*
==========================================================
CAMILA MARTINS ENGENHARIA
CLIENTES
VERSÃO FINAL SUPABASE
==========================================================
*/


document.addEventListener("DOMContentLoaded", () => {

    configurarFormularioCliente();

    carregarClientesPagina();

    carregarClientesNosSelects();


    document
    .getElementById("btnPesquisarClientes")
    ?.addEventListener(
        "click",
        pesquisarClientesPagina
    );


    document
    .getElementById("pesquisarClientes")
    ?.addEventListener(
        "keydown",
        (event)=>{

            if(event.key === "Enter"){

                event.preventDefault();

                pesquisarClientesPagina();

            }

        }
    );

});




// ==========================================================
// FORMULÁRIO
// ==========================================================


function configurarFormularioCliente(){

    const formulario =
    document.getElementById("formCliente");


    if(!formulario) return;


    formulario.addEventListener(
        "submit",
        salvarCliente
    );

}




// ==========================================================
// CADASTRAR CLIENTE
// ==========================================================


async function salvarCliente(event){

    event.preventDefault();


    const cliente = {

        nome:
        document.getElementById("clienteNome")
        ?.value.trim(),


        cpf_cnpj:
        document.getElementById("clienteCpf")
        ?.value.trim() || null,


        telefone:
        document.getElementById("clienteTelefone")
        ?.value.trim() || null,


        email:
        document.getElementById("clienteEmail")
        ?.value.trim() || null,


        endereco:
        document.getElementById("clienteEndereco")
        ?.value.trim() || null,


        cidade:
        document.getElementById("clienteCidade")
        ?.value.trim() || null,


        estado:
        document.getElementById("clienteEstado")
        ?.value.trim() || null,


        cep:
        document.getElementById("clienteCep")
        ?.value.trim() || null,


        status:
        document.getElementById("clienteStatus")
        ?.value || "ativo",


        observacoes:
        document.getElementById("clienteObservacoes")
        ?.value.trim() || null

    };



    if(!cliente.nome){

        alert("Informe o nome do cliente.");

        return;

    }



    try{


        await criarCliente(cliente);



        alert(
            "Cliente cadastrado com sucesso."
        );



        document
        .getElementById("formCliente")
        ?.reset();



        document
        .getElementById("modalCliente")
        ?.classList
        .remove("show");



        await carregarClientesPagina();


        await carregarClientesNosSelects();



    }
    catch(error){


        console.error(error);


        alert(
            "Erro ao cadastrar cliente."
        );


    }


}
// ==========================================================
// CARREGAR CLIENTES
// ==========================================================


async function carregarClientesPagina(){

    const tabela =
    document.getElementById("tabelaClientes");


    if(!tabela) return;



    tabela.innerHTML = `

        <tr>

            <td colspan="7">

                Carregando clientes...

            </td>

        </tr>

    `;



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
                ${escaparCliente(cliente.nome)}
            </td>


            <td>
                ${escaparCliente(cliente.telefone || "-")}
            </td>


            <td>
                ${escaparCliente(cliente.email || "-")}
            </td>


            <td>
                ${escaparCliente(cliente.cidade || "-")}
            </td>


            <td>
                ${escaparCliente(cliente.estado || "-")}
            </td>


            <td>

                <span class="badge">

                    ${formatarStatusCliente(cliente.status)}

                </span>

            </td>


            <td>


                <button
                class="btn-icon edit"
                onclick="editarCliente('${cliente.id}')">

                    <i class="fa-solid fa-pen"></i>

                </button>



                <button
                class="btn-icon delete"
                onclick="excluirCliente('${cliente.id}')">

                    <i class="fa-solid fa-trash"></i>

                </button>


            </td>


        </tr>


    `).join("");

}





// ==========================================================
// PESQUISAR CLIENTES
// ==========================================================


async function pesquisarClientesPagina(){


    const termo =
    document.getElementById("pesquisarClientes")
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
// EDITAR CLIENTE
// ==========================================================


async function editarCliente(id){


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


    formulario.dataset.id = id;



    formulario.removeEventListener(
        "submit",
        salvarCliente
    );


    formulario.addEventListener(
        "submit",
        atualizarCliente,
        {once:true}
    );



    document
    .getElementById("modalCliente")
    ?.classList
    .add("show");


}





// ==========================================================
// ATUALIZAR CLIENTE
// ==========================================================


async function atualizarCliente(event){

    event.preventDefault();



    const id =
    document
    .getElementById("formCliente")
    .dataset.id;



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



    alert("Cliente atualizado.");



    document
    .getElementById("formCliente")
    .reset();



    await carregarClientesPagina();

}





// ==========================================================
// EXCLUIR CLIENTE
// ==========================================================


async function excluirCliente(id){


    if(
        !confirm("Deseja excluir este cliente?")
    )
    return;



    await window.excluirCliente(id);



    await carregarClientesPagina();


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
// AUXILIARES
// ==========================================================


function formatarStatusCliente(status){


    const lista = {

        ativo:"Ativo",

        orcamento:"Orçamento",

        pausado:"Pausado",

        concluido:"Concluído"

    };


    return lista[status] || "Ativo";

}




function escaparCliente(valor){


    return String(valor ?? "")

    .replaceAll("&","&amp;")

    .replaceAll("<","&lt;")

    .replaceAll(">","&gt;")

    .replaceAll('"',"&quot;")

    .replaceAll("'","&#039;");


}
