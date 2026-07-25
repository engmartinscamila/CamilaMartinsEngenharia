/*
==========================================================
CAMILA MARTINS ENGENHARIA

ADMIN.JS
PAINEL ADMINISTRATIVO

VERSÃO CORRIGIDA
==========================================================
*/


document.addEventListener(
"DOMContentLoaded",
()=>{

    iniciarAdmin();

});




// ==========================================================
// INICIALIZAÇÃO
// ==========================================================


async function iniciarAdmin(){


    try{

        await carregarDashboard();

    }
    catch(error){

        console.error(
            "Erro ao iniciar painel:",
            error
        );

    }


    configurarEventos();


}






// ==========================================================
// CARREGAMENTO PRINCIPAL
// ==========================================================


async function carregarDashboard(){


    try{


        await Promise.allSettled([

            carregarTotais(),

            carregarClientes(),

            carregarProjetos(),

            carregarDocumentos(),

            carregarBiblioteca(),

            carregarAtividades(),

            carregarArmazenamento()

        ]);



        finalizarCarregamento();



    }
    catch(error){


        console.error(
            "Erro dashboard:",
            error
        );


        finalizarCarregamento();


    }


}


// ==========================================================
// ARMAZENAMENTO DE ARQUIVOS
// ==========================================================

async function carregarArmazenamento(){

    const barra = document.getElementById("storageBar");
    const trilho = barra?.parentElement;
    const usado = document.getElementById("storageUsado");
    const limiteTexto = document.getElementById("storageLimite");
    const detalhes = document.getElementById("storageDetalhes");
    const limite = Number(window.CM_CONFIG?.limiteArmazenamentoBytes) || (1024 ** 3);

    if (limiteTexto) limiteTexto.textContent = formatarBytes(limite);

    try {
        const { data, error } = await supabaseClient
            .rpc("uso_armazenamento_portal");

        if (error) throw error;

        const bytes = Math.max(0, Number(data?.bytes_utilizados) || 0);
        const arquivos = Math.max(0, Number(data?.quantidade_arquivos) || 0);
        const percentualExato = limite > 0 ? (bytes / limite) * 100 : 0;
        const percentualBarra = Math.min(100, percentualExato);
        const percentualTexto =
            percentualExato > 0 && percentualExato < 0.1
                ? "< 0,1"
                : percentualExato.toLocaleString("pt-BR", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 1
                });

        if (barra) barra.style.width = `${percentualBarra}%`;
        if (trilho) trilho.setAttribute(
            "aria-valuenow",
            String(Math.round(percentualBarra))
        );
        if (usado) usado.textContent = formatarBytes(bytes);
        if (detalhes) {
            detalhes.textContent =
                `${arquivos} ${arquivos === 1 ? "arquivo" : "arquivos"} • ` +
                `${percentualTexto}% utilizado`;
        }
    }
    catch (error) {
        console.error("Erro armazenamento:", error);
        if (barra) barra.style.width = "0%";
        if (trilho) trilho.setAttribute("aria-valuenow", "0");
        if (usado) usado.textContent = "Indisponível";
        if (detalhes) {
            detalhes.textContent =
                "Execute a migração de ajustes finais no Supabase.";
        }
    }

}


function formatarBytes(bytes){

    const valor = Number(bytes) || 0;
    if (valor <= 0) return "0 B";

    const unidades = ["B", "KB", "MB", "GB", "TB"];
    const indice = Math.min(
        Math.floor(Math.log(valor) / Math.log(1024)),
        unidades.length - 1
    );
    const casas = indice === 0 ? 0 : (valor / (1024 ** indice) < 10 ? 2 : 1);

    return `${(valor / (1024 ** indice)).toLocaleString("pt-BR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: casas
    })} ${unidades[indice]}`;

}





function finalizarCarregamento(){


    const elementos = [

        "loading",

        "loader",

        "carregando"

    ];



    elementos.forEach(id=>{


        const elemento =
        document.getElementById(id);



        if(elemento){

            elemento.style.display="none";

        }


    });



}
// ==========================================================
// TOTAIS DO DASHBOARD
// ==========================================================


async function carregarTotais(){


    try{


        const [

            clientes,

            projetos,

            documentos,

            fotos


        ] = await Promise.allSettled([


            buscarDados("clientes"),

            buscarDados("projetos"),

            buscarDados("documentos"),

            buscarDados("fotos")


        ]);




        atualizarNumero(

            "totalClientes",

            clientes.status==="fulfilled"
            ? clientes.value.length
            : 0

        );



        atualizarNumero(

            "totalProjetos",

            projetos.status==="fulfilled"
            ? projetos.value.length
            : 0

        );



        atualizarNumero(

            "totalDocumentos",

            documentos.status==="fulfilled"
            ? documentos.value.length
            : 0

        );



        atualizarNumero(

            "totalFotos",

            fotos.status==="fulfilled"
            ? fotos.value.length
            : 0

        );



    }
    catch(error){

        console.error(
            "Erro totais:",
            error
        );

    }


}







function atualizarNumero(id,valor){


    const elemento =
    document.getElementById(id);



    if(elemento){

        elemento.innerText =
        valor ?? 0;

    }


}







// ==========================================================
// CLIENTES
// ==========================================================


async function carregarClientes(){


    try{


        const dados =
        await buscarDados("clientes");



        const elemento =
        document.getElementById(
            "listaClientes"
        );



        if(!elemento)
        return;



        elemento.innerHTML="";



        dados.forEach(cliente=>{


            elemento.innerHTML += `

            <div class="item-dashboard">

                <strong>
                ${escapar(cliente.nome)}
                </strong>


                <span>
                ${escapar(cliente.email)}
                </span>


            </div>

            `;


        });



    }
    catch(error){


        console.error(
            "Erro clientes:",
            error
        );


    }


}







// ==========================================================
// PROJETOS
// ==========================================================


async function carregarProjetos(){


    try{


        const dados =
        await buscarDados("projetos");



        const elemento =
        document.getElementById(
            "listaProjetos"
        );



        if(!elemento)
        return;



        elemento.innerHTML="";



        dados.forEach(projeto=>{


            elemento.innerHTML += `

            <div class="item-dashboard">

                <strong>
                ${escapar(projeto.nome)}
                </strong>


            </div>

            `;


        });



    }
    catch(error){


        console.error(
            "Erro projetos:",
            error
        );


    }


}
// ==========================================================
// DOCUMENTOS
// ==========================================================


async function carregarDocumentos(){


    try{


        const dados =
        await buscarDados("documentos");



        const elemento =
        document.getElementById(
            "listaDocumentos"
        );



        if(!elemento)
        return;



        elemento.innerHTML="";



        dados.forEach(documento=>{


            elemento.innerHTML += `

            <div class="item-dashboard">


                <strong>

                ${escapar(documento.nome ?? documento.titulo)}

                </strong>


                <span>

                ${escapar(documento.tipo)}

                </span>


            </div>

            `;


        });



    }
    catch(error){


        console.error(
            "Erro documentos:",
            error
        );


    }


}







// ==========================================================
// BIBLIOTECA
// ==========================================================


async function carregarBiblioteca(){


    try{


        const dados =
        await buscarDados("biblioteca");



        atualizarNumero(

            "totalBiblioteca",

            dados.length

        );



    }
    catch(error){


        console.error(
            "Erro biblioteca:",
            error
        );


        atualizarNumero(
            "totalBiblioteca",
            0
        );


    }


}







// ==========================================================
// ATIVIDADES
// ==========================================================


async function carregarAtividades(){


    const elemento =
    document.getElementById(
        "atividadeRecentes"
    );



    if(!elemento)
    return;



    elemento.innerHTML = `

        <div class="atividade">

            Sistema iniciado.

        </div>

    `;


}







// ==========================================================
// BUSCA PADRÃO SUPABASE
// ==========================================================


async function buscarDados(tabela){


    try{


        const {

            data,

            error


        } = await supabaseClient

        .from(tabela)

        .select("*");




        if(error){

            console.error(
                "Erro tabela:",
                tabela,
                error
            );

            return [];

        }




        return data || [];



    }
    catch(error){


        console.error(
            "Erro consulta:",
            tabela,
            error
        );


        return [];

    }


}







// ==========================================================
// EVENTOS
// ==========================================================


function configurarEventos(){


    document
    .getElementById(
        "abrirClientes"
    )
    ?.addEventListener(
        "click",
        ()=>{

            window.location.href =
            "clientes.html";

        }
    );



    document
    .getElementById(
        "abrirProjetos"
    )
    ?.addEventListener(
        "click",
        ()=>{

            window.location.href =
            "projetos.html";

        }
    );



    document
    .getElementById(
        "abrirDocumentos"
    )
    ?.addEventListener(
        "click",
        ()=>{

            window.location.href =
            "documentos.html";

        }
    );


    const navegacaoRestante = {
        abrirFotos: "fotos.html",
        abrirFinanceiro: "financeiro.html",
        abrirAgenda: "agenda.html",
        abrirBiblioteca: "biblioteca.html",
        abrirConfiguracoes: "configuracoes.html",
        novoProjeto: "projetos.html",
        verTodosProjetos: "projetos.html",
        verTodosDocumentos: "documentos.html"
    };

    Object.entries(navegacaoRestante).forEach(([id, destino]) => {

        document
        .getElementById(id)
        ?.addEventListener("click", () => {
            window.location.href = destino;
        });

    });


}
// ==========================================================
// PESQUISA CLIENTES
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



    if(!campo || !lista)
    return;




    const termo =
    campo.value
    .toLowerCase()
    .trim();




    const clientes =
    await buscarDados(
        "clientes"
    );




    const resultado =
    clientes.filter(cliente=>{


        return (

            cliente.nome &&
            cliente.nome
            .toLowerCase()
            .includes(termo)

        );


    });





    lista.innerHTML = "";





    resultado.forEach(cliente=>{


        lista.innerHTML += `

        <div class="item-dashboard">


            <strong>

                ${escapar(cliente.nome)}

            </strong>


            <span>

                ${escapar(cliente.email)}

            </span>


        </div>

        `;


    });



}







// ==========================================================
// UTILITÁRIOS
// ==========================================================



function escapar(valor){


    return String(valor ?? "")

    .replaceAll("&","&amp;")

    .replaceAll("<","&lt;")

    .replaceAll(">","&gt;")

    .replaceAll('"',"&quot;")

    .replaceAll("'","&#039;");


}







function estadoVazio(texto){


    return `

    <div class="estado-vazio">

        ${texto}

    </div>

    `;


}






// ==========================================================
// ATUALIZAÇÃO AUTOMÁTICA
// ==========================================================


setInterval(()=>{


    if(
        typeof carregarDashboard === "function"
    ){

        carregarDashboard();

    }


},300000);
