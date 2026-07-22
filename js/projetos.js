/*
==========================================================
CAMILA MARTINS ENGENHARIA
PROJETOS
==========================================================
*/

document.addEventListener("DOMContentLoaded", () => {

    configurarFormularioProjeto();

    carregarProjetosPagina();

    configurarPesquisaProjetos();

});

/*
==========================================================
CONFIGURAR FORMULÁRIO
==========================================================
*/

function configurarFormularioProjeto(){

    const formulario = document.getElementById("formProjeto");

    if(!formulario) return;

    formulario.onsubmit = salvarProjeto;

}

/*
==========================================================
OBTER DADOS DO FORMULÁRIO
==========================================================
*/

function obterDadosProjeto(){

    return {

        nome: document
            .getElementById("projetoNome")
            ?.value
            .trim(),

        cliente_id: document
            .getElementById("clienteProjeto")
            ?.value || null,

        tipo: document
            .getElementById("tipoProjeto")
            ?.value || null,

        status: document
            .getElementById("statusProjeto")
            ?.value || "orcamento",

        data_inicio: document
            .getElementById("dataInicio")
            ?.value || null,

        prazo_final: document
            .getElementById("prazoProjeto")
            ?.value || null,

        valor: document
            .getElementById("valorProjeto")
            ?.value || null,

        descricao: document
            .getElementById("descricaoProjeto")
            ?.value
            .trim() || null

    };

}

/*
==========================================================
SALVAR PROJETO
==========================================================
*/

async function salvarProjeto(event){

    event.preventDefault();

    const formulario = document.getElementById("formProjeto");

    const id = formulario?.dataset.projetoId;

    if(id){

        await atualizarProjeto(id);

        return;

    }

    const projeto = obterDadosProjeto();

    if(!projeto.nome){

        alert("Informe o nome do projeto.");

        return;

    }

    if(!projeto.cliente_id){

        alert("Selecione o cliente.");

        return;

    }

    const botao = document.getElementById("salvarProjeto");

    alterarBotaoProjeto(botao, true);

    try{

        const { error } = await supabase
            .from("projetos")
            .insert([projeto]);

        if(error) throw error;

        alert("Projeto cadastrado com sucesso.");

        formulario.reset();

        fecharModalProjeto();

        await carregarProjetosPagina();

        if(typeof carregarDashboard === "function"){

            await carregarDashboard();

        }

    }
    catch(erro){

        console.error("Erro ao salvar projeto:", erro);

        alert(
            "Não foi possível cadastrar o projeto. " +
            (erro.message || "")
        );

    }
    finally{

        alterarBotaoProjeto(botao, false);

    }

}

/*
==========================================================
CARREGAR PROJETOS
==========================================================
*/

async function carregarProjetosPagina(){

    const tabela = document.getElementById("tabelaProjetos");

    if(!tabela) return;

    tabela.innerHTML = `
        <tr>
            <td colspan="8">
                Carregando projetos...
            </td>
        </tr>
    `;

    const { data, error } = await supabase
        .from("projetos")
        .select(`
            *,
            clientes (
                nome
            )
        `)
        .order("created_at", {
            ascending:false
        });

    if(error){

        console.error("Erro ao carregar projetos:", error);

        tabela.innerHTML = `
            <tr>
                <td colspan="8">
                    Não foi possível carregar os projetos.
                </td>
            </tr>
        `;

        return;

    }

    renderizarProjetos(data || []);

}

/*
==========================================================
RENDERIZAR PROJETOS
==========================================================
*/

function renderizarProjetos(projetos){

    const tabela = document.getElementById("tabelaProjetos");

    if(!tabela) return;

    if(projetos.length === 0){

        tabela.innerHTML = `
            <tr>
                <td colspan="8">
                    Nenhum projeto cadastrado.
                </td>
            </tr>
        `;

        return;

    }

    tabela.innerHTML = projetos.map(projeto => {

        return `
            <tr>

                <td>
                    ${escaparProjeto(projeto.nome || "")}
                </td>

                <td>
                    ${escaparProjeto(
                        projeto.clientes?.nome || "Sem cliente"
                    )}
                </td>

                <td>
                    ${formatarTipoProjeto(projeto.tipo)}
                </td>

                <td>
                    <span class="badge ${classeProjetoStatus(projeto.status)}">
                        ${formatarStatusProjeto(projeto.status)}
                    </span>
                </td>

                <td>
                    ${formatarDataProjeto(projeto.data_inicio)}
                </td>

                <td>
                    ${formatarDataProjeto(projeto.prazo_final)}
                </td>

                <td>
                    ${formatarValorProjeto(projeto.valor)}
                </td>

                <td>

                    <button
                        type="button"
                        class="btn-icon edit"
                        title="Editar"
                        onclick="editarProjeto('${projeto.id}')">

                        <i class="fa-solid fa-pen"></i>

                    </button>

                    <button
                        type="button"
                        class="btn-icon delete"
                        title="Excluir"
                        onclick="excluirProjeto('${projeto.id}')">

                        <i class="fa-solid fa-trash"></i>

                    </button>

                </td>

            </tr>
        `;

    }).join("");

}

/*
==========================================================
EDITAR PROJETO
==========================================================
*/

async function editarProjeto(id){

    const { data, error } = await supabase
        .from("projetos")
        .select("*")
        .eq("id", id)
        .single();

    if(error){

        console.error(error);

        alert("Não foi possível abrir o projeto.");

        return;

    }

    const formulario = document.getElementById("formProjeto");

    if(!formulario) return;

    document.getElementById("projetoNome").value =
        data.nome || "";

    document.getElementById("clienteProjeto").value =
        data.cliente_id || "";

    document.getElementById("tipoProjeto").value =
        data.tipo || "arquitetonico";

    document.getElementById("statusProjeto").value =
        data.status || "orcamento";

    document.getElementById("dataInicio").value =
        data.data_inicio || "";

    document.getElementById("prazoProjeto").value =
        data.prazo_final || "";

    document.getElementById("valorProjeto").value =
        data.valor || "";

    document.getElementById("descricaoProjeto").value =
        data.descricao || "";

    formulario.dataset.projetoId = id;

    const botao = document.getElementById("salvarProjeto");

    if(botao){

        botao.textContent = "Atualizar Projeto";

    }

    document
        .getElementById("modalProjeto")
        ?.classList
        .add("show");

}

/*
==========================================================
ATUALIZAR PROJETO
==========================================================
*/

async function atualizarProjeto(id){

    const projeto = obterDadosProjeto();

    if(!projeto.nome){

        alert("Informe o nome do projeto.");

        return;

    }

    if(!projeto.cliente_id){

        alert("Selecione o cliente.");

        return;

    }

    const botao = document.getElementById("salvarProjeto");

    alterarBotaoProjeto(botao, true);

    try{

        const { error } = await supabase
            .from("projetos")
            .update(projeto)
            .eq("id", id);

        if(error) throw error;

        alert("Projeto atualizado com sucesso.");

        limparFormularioProjeto();

        fecharModalProjeto();

        await carregarProjetosPagina();

        if(typeof carregarDashboard === "function"){

            await carregarDashboard();

        }

    }
    catch(erro){

        console.error("Erro ao atualizar projeto:", erro);

        alert(
            "Não foi possível atualizar o projeto. " +
            (erro.message || "")
        );

    }
    finally{

        alterarBotaoProjeto(botao, false);

    }

}

/*
==========================================================
EXCLUIR PROJETO
==========================================================
*/

async function excluirProjeto(id){

    const confirmar = confirm(
        "Deseja realmente excluir este projeto?"
    );

    if(!confirmar) return;

    const { error } = await supabase
        .from("projetos")
        .delete()
        .eq("id", id);

    if(error){

        console.error(error);

        alert(
            "Não foi possível excluir o projeto. " +
            "Verifique se existem documentos ou fotos vinculados."
        );

        return;

    }

    alert("Projeto excluído com sucesso.");

    await carregarProjetosPagina();

    if(typeof carregarDashboard === "function"){

        await carregarDashboard();

    }

}

/*
==========================================================
PESQUISAR PROJETOS
==========================================================
*/

function configurarPesquisaProjetos(){

    document
        .getElementById("btnPesquisarProjetos")
        ?.addEventListener(
            "click",
            pesquisarProjetos
        );

    document
        .getElementById("pesquisarProjetos")
        ?.addEventListener("keydown", event => {

            if(event.key === "Enter"){

                event.preventDefault();

                pesquisarProjetos();

            }

        });

}

async function pesquisarProjetos(){

    const termo = document
        .getElementById("pesquisarProjetos")
        ?.value
        .trim() || "";

    if(!termo){

        await carregarProjetosPagina();

        return;

    }

    const { data, error } = await supabase
        .from("projetos")
        .select(`
            *,
            clientes (
                nome
            )
        `)
        .ilike("nome", `%${termo}%`)
        .order("created_at", {
            ascending:false
        });

    if(error){

        console.error(error);

        alert("Não foi possível pesquisar os projetos.");

        return;

    }

    renderizarProjetos(data || []);

}

/*
==========================================================
PROJETOS NOS SELECTS
==========================================================
*/

async function carregarProjetosNosSelects(clienteId = null){

    const selects = [

        document.getElementById("documentoProjeto"),

        document.getElementById("fotoProjeto")

    ].filter(Boolean);

    if(selects.length === 0) return;

    let consulta = supabase
        .from("projetos")
        .select("id, nome, cliente_id")
        .order("nome", {
            ascending:true
        });

    if(clienteId){

        consulta = consulta.eq("cliente_id", clienteId);

    }

    const { data, error } = await consulta;

    if(error){

        console.error(error);

        return;

    }

    selects.forEach(select => {

        const valorAtual = select.value;

        select.innerHTML = `
            <option value="">
                Selecione um projeto
            </option>
        `;

        (data || []).forEach(projeto => {

            const option = document.createElement("option");

            option.value = projeto.id;

            option.textContent = projeto.nome;

            select.appendChild(option);

        });

        select.value = valorAtual;

    });

}

/*
==========================================================
FILTRAR PROJETOS POR CLIENTE
==========================================================
*/

document
    .getElementById("documentoCliente")
    ?.addEventListener("change", event => {

        carregarProjetosNosSelects(event.target.value);

    });

document
    .getElementById("fotoCliente")
    ?.addEventListener("change", event => {

        carregarProjetosNosSelects(event.target.value);

    });

/*
==========================================================
LIMPAR FORMULÁRIO
==========================================================
*/

function limparFormularioProjeto(){

    const formulario = document.getElementById("formProjeto");

    if(!formulario) return;

    formulario.reset();

    delete formulario.dataset.projetoId;

    const botao = document.getElementById("salvarProjeto");

    if(botao){

        botao.textContent = "Salvar Projeto";

    }

}

/*
==========================================================
FECHAR MODAL
==========================================================
*/

function fecharModalProjeto(){

    document
        .getElementById("modalProjeto")
        ?.classList
        .remove("show");

    limparFormularioProjeto();

}

/*
==========================================================
BOTÃO
==========================================================
*/

function alterarBotaoProjeto(botao, carregando){

    if(!botao) return;

    botao.disabled = carregando;

    if(carregando){

        botao.textContent = "Salvando...";

        return;

    }

    const formulario = document.getElementById("formProjeto");

    botao.textContent = formulario?.dataset.projetoId
        ? "Atualizar Projeto"
        : "Salvar Projeto";

}

/*
==========================================================
FORMATAÇÕES
==========================================================
*/

function formatarTipoProjeto(tipo){

    const tipos = {

        arquitetonico:"Projeto Arquitetônico",

        interiores:"Design de Interiores",

        estrutural:"Projeto Estrutural",

        eletrico:"Projeto Elétrico",

        hidraulico:"Projeto Hidráulico",

        regularizacao:"Regularização",

        laudo:"Laudo Técnico",

        vistoria:"Vistoria",

        consultoria:"Consultoria"

    };

    return tipos[tipo] || tipo || "-";

}

function formatarStatusProjeto(status){

    const statusProjetos = {

        orcamento:"Orçamento",

        em_andamento:"Em andamento",

        aprovacao:"Aprovação",

        execucao:"Execução",

        finalizado:"Finalizado"

    };

    return statusProjetos[status] || status || "-";

}

function classeProjetoStatus(status){

    const classes = {

        orcamento:"orcamento",

        em_andamento:"andamento",

        aprovacao:"andamento",

        execucao:"andamento",

        finalizado:"finalizado"

    };

    return classes[status] || "ativo";

}

function formatarDataProjeto(data){

    if(!data) return "-";

    const partes = data.split("-");

    if(partes.length !== 3) return data;

    return `${partes[2]}/${partes[1]}/${partes[0]}`;

}

function formatarValorProjeto(valor){

    if(valor === null || valor === undefined || valor === ""){

        return "-";

    }

    return Number(valor).toLocaleString(
        "pt-BR",
        {

            style:"currency",

            currency:"BRL"

        }
    );

}

function escaparProjeto(valor){

    return String(valor ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}
