/*
==========================================================
CAMILA MARTINS ENGENHARIA

FOTOS.JS
GERENCIAMENTO DE GALERIA

USA:
database.js
supabase.js

VERSÃO DEFINITIVA
==========================================================
*/


let fotoSelecionada = null;



document.addEventListener(
"DOMContentLoaded",
()=>{


    iniciarFotos();


});







// ==========================================================
// INICIALIZAÇÃO
// ==========================================================


async function iniciarFotos(){


    configurarEventosFoto();


    await carregarFotos();


    await carregarProjetosFoto();


    await carregarClientesFoto();



}








// ==========================================================
// CARREGAR FOTOS
// ==========================================================


async function carregarFotos(){



    const galeria =

    document.getElementById(
        "galeriaFotos"
    );



    if(!galeria)
    return;




    try{


        const fotos =

        await dbBuscarFotos();






        if(!fotos.length){


            galeria.innerHTML = `


            <div class="estado-vazio">


            Nenhuma foto cadastrada.


            </div>


            `;


            return;


        }








        galeria.innerHTML =



        fotos.map(foto=>`


        <div class="foto-card"
        data-id="${foto.id}">





            <img

            src="${foto.url}"

            alt="${escaparTexto(
                foto.titulo || "Foto"
            )}"

            >





            <div class="foto-info">



                <h3>

                ${escaparTexto(
                    foto.titulo ||
                    "Imagem"
                )}

                </h3>



                <p>

                ${escaparTexto(
                    foto.projetos?.nome || ""
                )}

                </p>



            </div>






            <div class="acoes-item">



                <button

                class="visualizarFoto"

                data-id="${foto.id}">


                <i class="fa-solid fa-eye"></i>


                </button>






                <button

                class="excluirFoto"

                data-id="${foto.id}">


                <i class="fa-solid fa-trash"></i>


                </button>



            </div>



        </div>



        `)
        .join("");





        configurarAcoesFotos();



    }
    catch(error){


        console.error(
            "Erro carregar fotos:",
            error
        );


    }



}
// ==========================================================
// CARREGAR PROJETOS NO SELECT
// ==========================================================



async function carregarProjetosFoto(){



    const select =

    document.getElementById(
        "fotoProjeto"
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
// CARREGAR CLIENTES NO SELECT
// ==========================================================



async function carregarClientesFoto(){



    const select =

    document.getElementById(
        "fotoCliente"
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
// MODAL FOTO
// ==========================================================



function abrirModalFoto(){


    const modal =

    document.getElementById(
        "modalFoto"
    );



    if(modal){

        modal.style.display =
        "flex";

    }



}







function fecharModalFoto(){


    const modal =

    document.getElementById(
        "modalFoto"
    );



    if(modal){

        modal.style.display =
        "none";

    }



    limparFormularioFoto();



}








// ==========================================================
// SALVAR FOTO
// ==========================================================



async function salvarFoto(evento){


    evento.preventDefault();




    try{



        const arquivoInput =

        document.getElementById(
            "arquivoFoto"
        );




        if(
            !arquivoInput ||
            !arquivoInput.files.length
        ){


            alert(
                "Selecione uma imagem."
            );


            return;


        }







        const arquivo =

        arquivoInput.files[0];





        const caminho =

        `fotos/${Date.now()}_${arquivo.name}`;





        await dbUploadArquivo(

            "fotos",

            caminho,

            arquivo

        );






        const url =

        dbGerarUrlArquivo(

            "fotos",

            caminho

        );







        const foto = {



            projeto_id:

            document.getElementById(
                "fotoProjeto"
            ).value || null,





            cliente_id:

            document.getElementById(
                "fotoCliente"
            ).value || null,





            titulo:

            document.getElementById(
                "fotoTitulo"
            ).value,





            url:url,





            caminho:caminho





        };







        await dbSalvarFoto(
            foto
        );







        fecharModalFoto();



        await carregarFotos();



    }
    catch(error){


        console.error(
            "Erro salvar foto:",
            error
        );



        alert(
            "Erro ao salvar foto."
        );


    }



}
// ==========================================================
// EXCLUIR FOTO
// ==========================================================



async function excluirFoto(id){


    const confirmar =

    confirm(
        "Deseja realmente excluir esta foto?"
    );



    if(!confirmar)
    return;





    try{


        const fotos =

        await dbBuscarFotos();




        const foto =

        fotos.find(
            item=>item.id == id
        );




        if(foto?.caminho){



            await dbExcluirArquivoStorage(

                "fotos",

                foto.caminho

            );



        }





        await dbExcluirFoto(id);




        await carregarFotos();



    }
    catch(error){


        console.error(
            "Erro excluir foto:",
            error
        );



        alert(
            "Erro ao excluir foto."
        );


    }



}









// ==========================================================
// VISUALIZAR FOTO
// ==========================================================



async function visualizarFoto(id){



    const fotos =

    await dbBuscarFotos();




    const foto =

    fotos.find(
        item=>item.id == id
    );






    const detalhes =

    document.getElementById(
        "detalhesFoto"
    );






    if(!detalhes || !foto)
    return;






    detalhes.innerHTML = `



    <img

    src="${foto.url}"

    class="foto-detalhe"



    >




    <h3>

    ${escaparTexto(
        foto.titulo || ""
    )}

    </h3>





    <p>

    Projeto:

    ${escaparTexto(
        foto.projetos?.nome || ""
    )}

    </p>





    <p>

    Cliente:

    ${escaparTexto(
        foto.clientes?.nome || ""
    )}

    </p>



    `;



}








// ==========================================================
// AÇÕES DA GALERIA
// ==========================================================



function configurarAcoesFotos(){



    document
    .querySelectorAll(
        ".visualizarFoto"
    )
    .forEach(botao=>{


        botao.addEventListener(
            "click",
            ()=>{


                visualizarFoto(
                    botao.dataset.id
                );


            }
        );


    });







    document
    .querySelectorAll(
        ".excluirFoto"
    )
    .forEach(botao=>{


        botao.addEventListener(
            "click",
            ()=>{


                excluirFoto(
                    botao.dataset.id
                );


            }
        );


    });



}
// ==========================================================
// EVENTOS
// ==========================================================



function configurarEventosFoto(){



    document
    .getElementById(
        "novaFoto"
    )
    ?.addEventListener(
        "click",
        ()=>{


            fotoSelecionada =
            null;


            limparFormularioFoto();


            abrirModalFoto();


        }
    );







    document
    .getElementById(
        "fecharModalFoto"
    )
    ?.addEventListener(
        "click",
        fecharModalFoto
    );







    document
    .getElementById(
        "cancelarFoto"
    )
    ?.addEventListener(
        "click",
        fecharModalFoto
    );







    document
    .getElementById(
        "formFoto"
    )
    ?.addEventListener(
        "submit",
        salvarFoto
    );







    document
    .getElementById(
        "pesquisaFoto"
    )
    ?.addEventListener(
        "keyup",
        pesquisarFotos
    );







    document
    .getElementById(
        "btnPesquisarFoto"
    )
    ?.addEventListener(
        "click",
        pesquisarFotos
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
// PESQUISA
// ==========================================================



async function pesquisarFotos(){



    const campo =

    document.getElementById(
        "pesquisaFoto"
    );



    const galeria =

    document.getElementById(
        "galeriaFotos"
    );



    if(!campo || !galeria)
    return;





    const termo =

    campo.value
    .toLowerCase()
    .trim();





    const fotos =

    await dbBuscarFotos();





    const resultado =

    fotos.filter(foto=>{


        return (

            foto.titulo ||

            ""

        )
        .toLowerCase()
        .includes(termo);


    });







    galeria.innerHTML =


    resultado.map(foto=>`


    <div class="foto-card">


        <img

        src="${foto.url}"

        >



        <h3>

        ${escaparTexto(
            foto.titulo || ""
        )}

        </h3>



    </div>


    `)
    .join("");



}








// ==========================================================
// LIMPAR FORMULÁRIO
// ==========================================================



function limparFormularioFoto(){



    fotoSelecionada =
    null;




    const campos = [


        "fotoTitulo"

    ];




    campos.forEach(id=>{


        const campo =

        document.getElementById(id);



        if(campo){

            campo.value = "";

        }


    });





    const projeto =

    document.getElementById(
        "fotoProjeto"
    );



    const cliente =

    document.getElementById(
        "fotoCliente"
    );



    if(projeto){

        projeto.value = "";

    }



    if(cliente){

        cliente.value = "";

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
