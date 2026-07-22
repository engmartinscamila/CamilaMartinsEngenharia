/*
==========================================================
CAMILA MARTINS ENGENHARIA
DASHBOARD ADMINISTRATIVO
==========================================================
*/

document.addEventListener("DOMContentLoaded", () => {

    carregarDashboard();

    configurarBotoesDashboard();

});

/*
==========================================================
CARREGAR DASHBOARD
==========================================================
*/

async function carregarDashboard(){

    mostrarLoading();

    try{

        await Promise.all([

            carregarTotalClientes(),

            carregarTotalProjetos(),

            carregarTotalDocumentos(),

            carregarTotalFotos(),

            carregarClientesRecentes(),

            carregarProjetosRecentes(),

            carregarDocumentosRecentes()

        ]);

    }
    catch(erro){

        console.error("Erro ao carregar dashboard:", erro);

    }
    finally{

        esconderLoading();

    }

}

/*
==========================================================
TOTAL DE CLIENTES
==========================================================
*/

async function carregarTotalClientes(){

    const { count, error } = await supabase
        .from("clientes")
        .select("*", {
            count:"exact",
            head:true
        });

    if(error){

        console.error(error);

        return;

    }

    atualizarTexto("totalClientes", count || 0);

}

/*
==========================================================
TOTAL DE PROJETOS
==========================================================
*/

async function carregarTotalProjetos(){

    const { count, error } = await supabase
        .from("projetos")
        .select("*", {
            count:"exact",
            head:true
        });

    if(error){

        console.error(error);

        return;

    }

    atualizarTexto("totalProjetos", count || 0);

}

/*
==========================================================
TOTAL DE DOCUMENTOS
==========================================================
*/

async function carregarTotalDocumentos(){

    const { count, error } = await supabase
        .from("documentos")
        .select("*", {
            count:"exact",
            head:true
        });

    if(error){

        console.error(error);

        return;

    }

    atualizarTexto("totalDocumentos", count || 0);

}

/*
==========================================================
TOTAL DE FOTOS
==========================================================
*/

async function carregarTotalFotos(){

    const { count, error } = await supabase
        .from("fotos")
        .select("*", {
            count:"exact",
            head:true
        });

    if(error){

        console.error(error);

        return;

    }

    atualizarTexto("totalFotos", count || 0);

}

/*
==========================================================
CLIENTES RECENTES
==========================================================
*/

async function carregarClientesRecentes(){

    const lista = document.getElementById("listaClientes");

    if(!lista) return;

    const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .order("created_at", {
            ascending:false
        })
        .limit(5);

    if(error){

        console.error(error);

        lista.innerHTML = mensagemErro();

        return;

    }

    if(!data || data.length === 0){

        lista.innerHTML = mensagemVazia(
            "Nenhum cliente cadastrado."
        );

        return;

    }

    lista.innerHTML = data.map(cliente => {

        return `
            <div class="item-lista">

                <div class="item-info">

                    <h3>
                        ${escaparHTML(cliente.nome || "Cliente")}
                    </h3>

                    <span>
                        ${escaparHTML(cliente.email || "Sem e-mail")}
                    </span>

                </div>

                <span class="badge ${cliente.status || "ativo"}">
                    ${formatarStatus(cliente.status)}
                </span>

            </div>
        `;

    }).join("");

}

/*
==========================================================
PROJETOS RECENTES
==========================================================
*/

async function carregarProjetosRecentes(){

    const lista = document.getElementById("listaProjetos");

    if(!lista) return;

    const { data, error } = await supabase
        .from("projetos")
        .select("*")
        .order("created_at", {
            ascending:false
        })
        .limit(5);

    if(error){

        console.error(error);

        lista.innerHTML = mensagemErro();

        return;

    }

    if(!data || data.length === 0){

        lista.innerHTML = mensagemVazia(
            "Nenhum projeto cadastrado."
        );

        return;

    }

    lista.innerHTML = data.map(projeto => {

        return `
            <div class="item-lista">

                <div class="item-info">

                    <h3>
                        ${escaparHTML(projeto.nome || "Projeto")}
                    </h3>

                    <span>
                        ${escaparHTML(projeto.tipo || "Sem categoria")}
                    </span>

                </div>

                <span class="badge ${classeStatusProjeto(projeto.status)}">
                    ${formatarStatus(projeto.status)}
                </span>

            </div>
        `;

    }).join("");

}

/*
==========================================================
DOCUMENTOS RECENTES
==========================================================
*/

async function carregarDocumentosRecentes(){

    const lista = document.getElementById("listaDocumentos");

    if(!lista) return;

    const { data, error } = await supabase
        .from("documentos")
        .select("*")
        .order("created_at", {
            ascending:false
        })
        .limit(5);

    if(error){

        console.error(error);

        lista.innerHTML = mensagemErro();

        return;

    }

    if(!data || data.length === 0){

        lista.innerHTML = mensagemVazia(
            "Nenhum documento cadastrado."
        );

        return;

    }

    lista.innerHTML = data.map(documento => {

        return `
            <div class="item-lista">

                <div class="item-info">

                    <h3>
                        ${escaparHTML(documento.titulo || "Documento")}
                    </h3>

                    <span>
                        ${escaparHTML(documento.categoria || "Sem categoria")}
                    </span>

                </div>

                <span>
                    ${formatarData(documento.created_at)}
                </span>

            </div>
        `;

    }).join("");

}

/*
==========================================================
BOTÕES DO DASHBOARD
==========================================================
*/

function configurarBotoesDashboard(){

    document
        .getElementById("verTodosProjetos")
        ?.addEventListener("click", () => {

            location.href = "projetos.html";

        });

    document
        .getElementById("verTodosDocumentos")
        ?.addEventListener("click", () => {

            location.href = "documentos.html";

        });

    document
        .getElementById("btnPesquisarCliente")
        ?.addEventListener("click", pesquisarCliente);

    document
        .getElementById("pesquisaCliente")
        ?.addEventListener("keydown", event => {

            if(event.key === "Enter"){

                event.preventDefault();

                pesquisarCliente();

            }

        });

}

/*
==========================================================
PESQUISAR CLIENTE
==========================================================
*/

async function pesquisarCliente(){

    const campo = document.getElementById("pesquisaCliente");

    const lista = document.getElementById("listaClientes");

    if(!campo || !lista) return;

    const pesquisa = campo.value.trim();

    if(!pesquisa){

        carregarClientesRecentes();

        return;

    }

    const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .ilike("nome", `%${pesquisa}%`)
        .limit(10);

    if(error){

        console.error(error);

        lista.innerHTML = mensagemErro();

        return;

    }

    if(!data || data.length === 0){

        lista.innerHTML = mensagemVazia(
            "Nenhum cliente encontrado."
        );

        return;

    }

    lista.innerHTML = data.map(cliente => {

        return `
            <div class="item-lista">

                <div class="item-info">

                    <h3>
                        ${escaparHTML(cliente.nome || "Cliente")}
                    </h3>

                    <span>
                        ${escaparHTML(cliente.email || "Sem e-mail")}
                    </span>

                </div>

                <span class="badge ${cliente.status || "ativo"}">
                    ${formatarStatus(cliente.status)}
                </span>

            </div>
        `;

    }).join("");

}

/*
==========================================================
FUNÇÕES AUXILIARES
==========================================================
*/

function atualizarTexto(id, valor){

    const elemento = document.getElementById(id);

    if(elemento){

        elemento.textContent = valor;

    }

}

function formatarStatus(status){

    if(!status) return "Ativo";

    const textos = {

        ativo:"Ativo",

        orcamento:"Orçamento",

        pausado:"Pausado",

        concluido:"Concluído",

        em_andamento:"Em andamento",

        aprovacao:"Aprovação",

        execucao:"Execução",

        finalizado:"Finalizado"

    };

    return textos[status] || status;

}

function classeStatusProjeto(status){

    const classes = {

        orcamento:"orcamento",

        em_andamento:"andamento",

        aprovacao:"andamento",

        execucao:"andamento",

        finalizado:"finalizado"

    };

    return classes[status] || "ativo";

}

function mensagemVazia(texto){

    return `
        <div class="empty-state">

            <i class="fa-solid fa-folder-open"></i>

            <h3>
                ${escaparHTML(texto)}
            </h3>

        </div>
    `;

}

function mensagemErro(){

    return `
        <div class="alert alert-error">

            <i class="fa-solid fa-circle-exclamation"></i>

            Não foi possível carregar os dados.

        </div>
    `;

}

function mostrarLoading(){

    const loading = document.getElementById("loading");

    if(loading){

        loading.style.display = "flex";

    }

}

function esconderLoading(){

    const loading = document.getElementById("loading");

    if(loading){

        loading.style.display = "none";

    }

}

function escaparHTML(valor){

    return String(valor ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}
