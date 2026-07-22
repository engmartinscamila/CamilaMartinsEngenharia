/*
==========================================================
CAMILA MARTINS ENGENHARIA
CLIENTES
==========================================================
*/

document.addEventListener("DOMContentLoaded", () => {

    configurarFormularioCliente();

    carregarClientesPagina();

});

/*
==========================================================
CONFIGURAR FORMULÁRIO
==========================================================
*/

function configurarFormularioCliente(){

    const formulario = document.getElementById("formCliente");

    if(!formulario) return;

    formulario.addEventListener("submit", salvarCliente);

}

/*
==========================================================
SALVAR CLIENTE
==========================================================
*/

async function salvarCliente(event){

    event.preventDefault();

    const botao = document.getElementById("salvarCliente");

    const cliente = {

        nome: document
            .getElementById("clienteNome")
            ?.value
            .trim(),

        cpf_cnpj: document
            .getElementById("clienteCpf")
            ?.value
            .trim() || null,

        telefone: document
            .getElementById("clienteTelefone")
            ?.value
            .trim() || null,

        email: document
            .getElementById("clienteEmail")
            ?.value
            .trim() || null,

        endereco: document
            .getElementById("clienteEndereco")
            ?.value
            .trim() || null,

        cidade: document
            .getElementById("clienteCidade")
            ?.value
            .trim() || null,

        estado: document
            .getElementById("clienteEstado")
            ?.value
            .trim() || null,

        cep: document
            .getElementById("clienteCep")
            ?.value
            .trim() || null,

        status: document
            .getElementById("clienteStatus")
            ?.value || "ativo",

        observacoes: document
            .getElementById("clienteObservacoes")
            ?.value
            .trim() || null

    };

    if(!cliente.nome){

        alert("Informe o nome do cliente.");

        return;

    }

    alterarBotaoCliente(botao, true);

    try{

        const { error } = await supabase
            .from("clientes")
            .insert([cliente]);

        if(error) throw error;

        alert("Cliente cadastrado com sucesso.");

        document
            .getElementById("formCliente")
            ?.reset();

        document
            .getElementById("modalCliente")
            ?.classList
            .remove("show");

        if(typeof carregarDashboard === "function"){

            await carregarDashboard();

        }

        await carregarClientesPagina();

        await carregarClientesNosSelects();

    }
    catch(erro){

        console.error("Erro ao salvar cliente:", erro);

        alert(
            "Não foi possível cadastrar o cliente. " +
            (erro.message || "")
        );

    }
    finally{

        alterarBotaoCliente(botao, false);

    }

}

/*
==========================================================
CARREGAR CLIENTES NA PÁGINA
==========================================================
*/

async function carregarClientesPagina(){

    const lista = document.getElementById("tabelaClientes");

    if(!lista) return;

    lista.innerHTML = `
        <tr>
            <td colspan="7">
                Carregando clientes...
            </td>
        </tr>
    `;

    const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .order("created_at", {
            ascending:false
        });

    if(error){

        console.error(error);

        lista.innerHTML = `
            <tr>
                <td colspan="7">
                    Não foi possível carregar os clientes.
                </td>
            </tr>
        `;

        return;

    }

    renderizarClientes(data || []);

}

/*
==========================================================
RENDERIZAR CLIENTES
==========================================================
*/

function renderizarClientes(clientes){

    const lista = document.getElementById("tabelaClientes");

    if(!lista) return;

    if(clientes.length === 0){

        lista.innerHTML = `
            <tr>
                <td colspan="7">
                    Nenhum cliente cadastrado.
                </td>
            </tr>
        `;

        return;

    }

    lista.innerHTML = clientes.map(cliente => {

        return `
            <tr>

                <td>
                    ${escaparCliente(cliente.nome || "")}
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
                    <span class="badge ${cliente.status || "ativo"}">
                        ${formatarStatusCliente(cliente.status)}
                    </span>
                </td>

                <td>

                    <button
                        class="btn-icon edit"
                        type="button"
                        title="Editar"
                        onclick="editarCliente('${cliente.id}')">

                        <i class="fa-solid fa-pen"></i>

                    </button>

                    <button
                        class="btn-icon delete"
                        type="button"
                        title="Excluir"
                        onclick="excluirCliente('${cliente.id}')">

                        <i class="fa-solid fa-trash"></i>

                    </button>

                </td>

            </tr>
        `;

    }).join("");

}

/*
==========================================================
PESQUISAR CLIENTES NA PÁGINA
==========================================================
*/

async function pesquisarClientesPagina(){

    const campo = document.getElementById("pesquisarClientes");

    const termo = campo?.value.trim() || "";

    let consulta = supabase
        .from("clientes")
        .select("*")
        .order("created_at", {
            ascending:false
        });

    if(termo){

        consulta = consulta.or(
            `nome.ilike.%${termo}%,email.ilike.%${termo}%,telefone.ilike.%${termo}%`
        );

    }

    const { data, error } = await consulta;

    if(error){

        console.error(error);

        return;

    }

    renderizarClientes(data || []);

}

/*
==========================================================
EDITAR CLIENTE
==========================================================
*/

async function editarCliente(id){

    const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .eq("id", id)
        .single();

    if(error){

        console.error(error);

        alert("Não foi possível abrir o cliente.");

        return;

    }

    document.getElementById("clienteNome").value =
        data.nome || "";

    document.getElementById("clienteCpf").value =
        data.cpf_cnpj || "";

    document.getElementById("clienteTelefone").value =
        data.telefone || "";

    document.getElementById("clienteEmail").value =
        data.email || "";

    document.getElementById("clienteEndereco").value =
        data.endereco || "";

    document.getElementById("clienteCidade").value =
        data.cidade || "";

    document.getElementById("clienteEstado").value =
        data.estado || "";

    document.getElementById("clienteCep").value =
        data.cep || "";

    document.getElementById("clienteStatus").value =
        data.status || "ativo";

    document.getElementById("clienteObservacoes").value =
        data.observacoes || "";

    const formulario = document.getElementById("formCliente");

    formulario.dataset.clienteId = id;

    formulario.removeEventListener("submit", salvarCliente);

    formulario.addEventListener(
        "submit",
        atualizarCliente,
        { once:true }
    );

    document
        .getElementById("modalCliente")
        ?.classList
        .add("show");

}

/*
==========================================================
ATUALIZAR CLIENTE
==========================================================
*/

async function atualizarCliente(event){

    event.preventDefault();

    const formulario = document.getElementById("formCliente");

    const id = formulario?.dataset.clienteId;

    if(!id) return;

    const cliente = {

        nome: document
            .getElementById("clienteNome")
            ?.value
            .trim(),

        cpf_cnpj: document
            .getElementById("clienteCpf")
            ?.value
            .trim() || null,

        telefone: document
            .getElementById("clienteTelefone")
            ?.value
            .trim() || null,

        email: document
            .getElementById("clienteEmail")
            ?.value
            .trim() || null,

        endereco: document
            .getElementById("clienteEndereco")
            ?.value
            .trim() || null,

        cidade: document
            .getElementById("clienteCidade")
            ?.value
            .trim() || null,

        estado: document
            .getElementById("clienteEstado")
            ?.value
            .trim() || null,

        cep: document
            .getElementById("clienteCep")
            ?.value
            .trim() || null,

        status: document
            .getElementById("clienteStatus")
            ?.value || "ativo",

        observacoes: document
            .getElementById("clienteObservacoes")
            ?.value
            .trim() || null

    };

    const { error } = await supabase
        .from("clientes")
        .update(cliente)
        .eq("id", id);

    if(error){

        console.error(error);

        alert("Não foi possível atualizar o cliente.");

        configurarFormularioCliente();

        return;

    }

    alert("Cliente atualizado com sucesso.");

    formulario.reset();

    delete formulario.dataset.clienteId;

    formulario.addEventListener("submit", salvarCliente);

    document
        .getElementById("modalCliente")
        ?.classList
        .remove("show");

    await carregarClientesPagina();

    if(typeof carregarDashboard === "function"){

        await carregarDashboard();

    }

}

/*
==========================================================
EXCLUIR CLIENTE
==========================================================
*/

async function excluirCliente(id){

    const confirmar = confirm(
        "Deseja realmente excluir este cliente?"
    );

    if(!confirmar) return;

    const { error } = await supabase
        .from("clientes")
        .delete()
        .eq("id", id);

    if(error){

        console.error(error);

        alert(
            "Não foi possível excluir o cliente. " +
            "Verifique se ele possui projetos vinculados."
        );

        return;

    }

    alert("Cliente excluído com sucesso.");

    await carregarClientesPagina();

    if(typeof carregarDashboard === "function"){

        await carregarDashboard();

    }

}

/*
==========================================================
CLIENTES NOS SELECTS
==========================================================
*/

async function carregarClientesNosSelects(){

    const selects = [

        document.getElementById("clienteProjeto"),

        document.getElementById("documentoCliente"),

        document.getElementById("fotoCliente")

    ].filter(Boolean);

    if(selects.length === 0) return;

    const { data, error } = await supabase
        .from("clientes")
        .select("id, nome")
        .order("nome", {
            ascending:true
        });

    if(error){

        console.error(error);

        return;

    }

    selects.forEach(select => {

        const valorAtual = select.value;

        select.innerHTML = `
            <option value="">
                Selecione um cliente
            </option>
        `;

        (data || []).forEach(cliente => {

            const option = document.createElement("option");

            option.value = cliente.id;

            option.textContent = cliente.nome;

            select.appendChild(option);

        });

        select.value = valorAtual;

    });

}

/*
==========================================================
BOTÃO DO CLIENTE
==========================================================
*/

function alterarBotaoCliente(botao, carregando){

    if(!botao) return;

    botao.disabled = carregando;

    botao.textContent = carregando
        ? "Salvando..."
        : "Salvar Cliente";

}

/*
==========================================================
FORMATAR STATUS
==========================================================
*/

function formatarStatusCliente(status){

    const statusClientes = {

        ativo:"Ativo",

        orcamento:"Orçamento",

        pausado:"Pausado",

        concluido:"Concluído"

    };

    return statusClientes[status] || "Ativo";

}

/*
==========================================================
ESCAPAR HTML
==========================================================
*/

function escaparCliente(valor){

    return String(valor ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}

/*
==========================================================
INICIAR SELECTS E PESQUISA
==========================================================
*/

document.addEventListener("DOMContentLoaded", () => {

    carregarClientesNosSelects();

    document
        .getElementById("btnPesquisarClientes")
        ?.addEventListener(
            "click",
            pesquisarClientesPagina
        );

    document
        .getElementById("pesquisarClientes")
        ?.addEventListener("keydown", event => {

            if(event.key === "Enter"){

                event.preventDefault();

                pesquisarClientesPagina();

            }

        });

});
