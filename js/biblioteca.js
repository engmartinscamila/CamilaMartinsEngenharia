/*
==========================================================
CAMILA MARTINS ENGENHARIA

BIBLIOTECA.JS
GERENCIAMENTO DE ARQUIVOS

USA:
database.js
supabase.js

VERSÃO DEFINITIVA
==========================================================
*/


let arquivoSelecionado = null;



document.addEventListener(
"DOMContentLoaded",
()=>{


    iniciarBiblioteca();


});







// ==========================================================
// INICIALIZAÇÃO
// ==========================================================


async function iniciarBiblioteca(){


    configurarEventosBiblioteca();


    await carregarBiblioteca();



}








// ==========================================================
// CARREGAR ARQUIVOS
// ==========================================================


async function carregarBiblioteca(){



    const lista =

    document.getElementById(
        "listaBiblioteca"
    );



    if(!lista)
    return;





    try{


        const arquivos =

        await dbBuscarBiblioteca();






        if(!arquivos.length){


            lista.innerHTML = `


            <div class="estado-vazio">


            Nenhum arquivo cadastrado.


            </div>


            `;


            return;


        }








        lista.innerHTML =



        arquivos.map(arquivo=>`


        <div class="item-lista arquivo-item"
        data-id="${arquivo.id}">





            <div>


                <h3>

                ${escaparTexto(
                    arquivo.nome
                )}

                </h3>




                <p>

                ${escaparTexto(
                    arquivo.categoria || ""
                )}

                </p>




                <span>

                ${escaparTexto(
                    arquivo.descricao || ""
                )}

                </span>



            </div>






            <div class="acoes-item">



                <button

                class="abrirArquivo"

                data-id="${arquivo.id}">


                <i class="fa-solid fa-eye"></i>


                </button>







                <button

                class="excluirArquivo"

                data-id="${arquivo.id}">


                <i class="fa-solid fa-trash"></i>


                </button>



            </div>



        </div>



        `)
        .join("");





        configurarAcoesBiblioteca();



    }
    catch(error){


        console.error(
            "Erro carregar biblioteca:",
            error
        );


    }



}
// ==========================================================
// MODAL ARQUIVO
// ==========================================================



function abrirModalArquivo(){


    const modal =

    document.getElementById(
        "modalArquivo"
    );



    if(modal){

        modal.style.display =
        "flex";

    }


}







function fecharModalArquivo(){


    const modal =

    document.getElementById(
        "modalArquivo"
    );



    if(modal){

        modal.style.display =
        "none";

    }



    limparFormularioArquivo();



}








// ==========================================================
// SALVAR ARQUIVO
// ==========================================================



async function salvarArquivo(evento){


    evento.preventDefault();





    try{



        const input =

        document.getElementById(
            "arquivoUpload"
        );






        if(
            !input ||
            !input.files.length
        ){


            alert(
                "Selecione um arquivo."
            );


            return;


        }








        const arquivo =

        input.files[0];






        const caminho =

        `biblioteca/${Date.now()}_${arquivo.name}`;








        await dbUploadArquivo(

            BUCKETS.BIBLIOTECA,

            caminho,

            arquivo

        );








        const tipo =

        arquivo.type ||

        "application/octet-stream";









        const dados = {



            nome:

            document.getElementById(
                "arquivoNome"
            ).value,





            categoria:

            document.getElementById(
                "arquivoCategoria"
            ).value,





            descricao:

            document.getElementById(
                "arquivoDescricao"
            ).value,





            tipo:tipo,





            tamanho:formatarTamanhoArquivo(arquivo.size),

            arquivo:caminho





        };







        await dbSalvarArquivoBiblioteca(
            dados
        );






        fecharModalArquivo();



        await carregarBiblioteca();



    }
    catch(error){



        console.error(
            "Erro salvar arquivo:",
            error
        );



        alert(
            "Erro ao salvar arquivo."
        );


    }



}







// ==========================================================
// VISUALIZAR ARQUIVO
// ==========================================================



async function visualizarArquivo(id){



    const arquivos =

    await dbBuscarBiblioteca();




    const arquivo =

    arquivos.find(

        item=>

        item.id == id

    );





    const detalhes =

    document.getElementById(
        "detalhesBiblioteca"
    );






    if(!detalhes || !arquivo)
    return;






    detalhes.innerHTML = `



    <h3>

    ${escaparTexto(
        arquivo.nome
    )}

    </h3>




    <p>

    Categoria:

    ${escaparTexto(
        arquivo.categoria || ""
    )}

    </p>




    <p>

    ${escaparTexto(
        arquivo.descricao || ""
    )}

    </p>





    <a

    href="${arquivo.url}"

    target="_blank">


    Abrir arquivo


    </a>



    `;



}
// ==========================================================
// EXCLUIR ARQUIVO
// ==========================================================



async function excluirArquivo(id){


    const confirmar =

    confirm(
        "Deseja realmente excluir este arquivo?"
    );



    if(!confirmar)
    return;






    try{


        const arquivos =

        await dbBuscarBiblioteca();




        const arquivo =

        arquivos.find(

            item =>

            item.id == id

        );





        if(arquivo?.arquivo){



            await dbExcluirArquivoStorage(

                BUCKETS.BIBLIOTECA,

                arquivo.arquivo

            );


        }






        await dbExcluirArquivoBiblioteca(id);






        await carregarBiblioteca();



    }
    catch(error){


        console.error(
            "Erro excluir arquivo:",
            error
        );



        alert(
            "Erro ao excluir arquivo."
        );


    }



}









// ==========================================================
// AÇÕES DA LISTA
// ==========================================================



function configurarAcoesBiblioteca(){



    document
    .querySelectorAll(
        ".abrirArquivo"
    )
    .forEach(botao=>{


        botao.addEventListener(
            "click",
            ()=>{


                visualizarArquivo(
                    botao.dataset.id
                );


            }
        );


    });







    document
    .querySelectorAll(
        ".excluirArquivo"
    )
    .forEach(botao=>{


        botao.addEventListener(
            "click",
            ()=>{


                excluirArquivo(
                    botao.dataset.id
                );


            }
        );


    });



}







// ==========================================================
// PESQUISA
// ==========================================================



async function pesquisarBiblioteca(){



    const campo =

    document.getElementById(
        "pesquisaBiblioteca"
    );



    const lista =

    document.getElementById(
        "listaBiblioteca"
    );



    if(!campo || !lista)
    return;





    const termo =

    campo.value
    .toLowerCase()
    .trim();





    const arquivos =

    await dbBuscarBiblioteca();





    const resultado =

    arquivos.filter(arquivo=>{


        return (

            arquivo.nome ||

            ""

        )
        .toLowerCase()
        .includes(termo);



    });







    lista.innerHTML =


    resultado.map(arquivo=>`


    <div class="item-lista">


        <h3>

        ${escaparTexto(
            arquivo.nome
        )}

        </h3>


    </div>


    `)
    .join("");



}
// ==========================================================
// EVENTOS
// ==========================================================



function configurarEventosBiblioteca(){



    document
    .getElementById(
        "novoArquivo"
    )
    ?.addEventListener(
        "click",
        ()=>{


            arquivoSelecionado =
            null;


            limparFormularioArquivo();


            abrirModalArquivo();


        }
    );







    document
    .getElementById(
        "fecharModalArquivo"
    )
    ?.addEventListener(
        "click",
        fecharModalArquivo
    );







    document
    .getElementById(
        "cancelarArquivo"
    )
    ?.addEventListener(
        "click",
        fecharModalArquivo
    );







    document
    .getElementById(
        "formArquivo"
    )
    ?.addEventListener(
        "submit",
        salvarArquivo
    );







    document
    .getElementById(
        "pesquisaBiblioteca"
    )
    ?.addEventListener(
        "keyup",
        pesquisarBiblioteca
    );







    document
    .getElementById(
        "btnPesquisarBiblioteca"
    )
    ?.addEventListener(
        "click",
        pesquisarBiblioteca
    );



}









// ==========================================================
// LIMPAR FORMULÁRIO
// ==========================================================



function limparFormularioArquivo(){



    arquivoSelecionado =
    null;




    const campos = [


        "arquivoNome",

        "arquivoDescricao"


    ];




    campos.forEach(id=>{


        const campo =

        document.getElementById(id);



        if(campo){

            campo.value = "";

        }


    });





    const categoria =

    document.getElementById(
        "arquivoCategoria"
    );



    if(categoria){

        categoria.value =
        "projeto";

    }



}








// ==========================================================
// SEGURANÇA HTML
// ==========================================================



function formatarTamanhoArquivo(bytes){

    if(!Number.isFinite(bytes) || bytes <= 0)
    return "0 B";

    const unidades = ["B", "KB", "MB", "GB"];
    const indice = Math.min(
        Math.floor(Math.log(bytes) / Math.log(1024)),
        unidades.length - 1
    );

    const valor = bytes / Math.pow(1024, indice);
    return `${valor.toFixed(indice === 0 ? 0 : 1)} ${unidades[indice]}`;

}



function escaparTexto(valor){


    return String(valor ?? "")

    .replaceAll("&","&amp;")

    .replaceAll("<","&lt;")

    .replaceAll(">","&gt;")

    .replaceAll('"',"&quot;")

    .replaceAll("'","&#039;");


}
