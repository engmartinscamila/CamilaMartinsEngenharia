/*
==========================================================
CAMILA MARTINS ENGENHARIA

FINANCEIRO.JS
GERENCIAMENTO FINANCEIRO

USA:
database.js
supabase.js

VERSÃO DEFINITIVA
==========================================================
*/


let lancamentoSelecionado = null;



document.addEventListener(
"DOMContentLoaded",
()=>{


    iniciarFinanceiro();


});







// ==========================================================
// INICIALIZAÇÃO
// ==========================================================


async function iniciarFinanceiro(){


    configurarEventosFinanceiro();


    await carregarProjetosFinanceiro();


    await carregarFinanceiro();



}








// ==========================================================
// CARREGAR FINANCEIRO
// ==========================================================


async function carregarFinanceiro(){


    const lista =

    document.getElementById(
        "listaFinanceiro"
    );



    if(!lista)
    return;





    try{


        const dados =

        await dbBuscarFinanceiro();




        const resumo =

        await dbResumoFinanceiro();





        atualizarResumoFinanceiro(
            resumo
        );







        if(!dados.length){


            lista.innerHTML = `


            <div class="estado-vazio">


            Nenhum lançamento cadastrado.


            </div>


            `;


            return;


        }







        lista.innerHTML =


        dados.map(item=>`


        <div class="item-lista financeiro-item"
        data-id="${item.id}">





            <div>



                <h3>

                ${escaparTexto(
                    item.descricao
                )}

                </h3>




                <p>

                ${formatarMoeda(
                    item.valor
                )}

                </p>




                <span>

                ${item.tipo === "entrada"

                ?

                "Entrada"

                :

                "Saída"

                }


                </span>



            </div>






            <div class="acoes-item">



                <button

                class="visualizarLancamento"

                data-id="${item.id}">


                <i class="fa-solid fa-eye"></i>


                </button>







                <button

                class="editarLancamento"

                data-id="${item.id}">


                <i class="fa-solid fa-pen"></i>


                </button>







                <button

                class="excluirLancamento"

                data-id="${item.id}">


                <i class="fa-solid fa-trash"></i>


                </button>



            </div>



        </div>


        `)
        .join("");





        configurarAcoesFinanceiro();



    }
    catch(error){


        console.error(
            "Erro carregar financeiro:",
            error
        );


    }



}
// ==========================================================
// RESUMO FINANCEIRO
// ==========================================================



function atualizarResumoFinanceiro(resumo){



    const entradas =

    document.getElementById(
        "totalEntradas"
    );



    const saidas =

    document.getElementById(
        "totalSaidas"
    );



    const saldo =

    document.getElementById(
        "saldoAtual"
    );






    if(entradas){

        entradas.textContent =

        formatarMoeda(
            resumo.entradas
        );

    }






    if(saidas){

        saidas.textContent =

        formatarMoeda(
            resumo.saidas
        );

    }






    if(saldo){

        saldo.textContent =

        formatarMoeda(
            resumo.saldo
        );

    }



}








// ==========================================================
// CARREGAR PROJETOS NO SELECT
// ==========================================================



async function carregarProjetosFinanceiro(){



    const select =

    document.getElementById(
        "financeiroProjeto"
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
// MODAL
// ==========================================================



function abrirModalFinanceiro(){


    const modal =

    document.getElementById(
        "modalFinanceiro"
    );



    if(modal){

        modal.style.display =
        "flex";

    }



}







function fecharModalFinanceiro(){


    const modal =

    document.getElementById(
        "modalFinanceiro"
    );



    if(modal){

        modal.style.display =
        "none";

    }



    limparFormularioFinanceiro();



}








// ==========================================================
// SALVAR LANÇAMENTO
// ==========================================================



async function salvarLancamento(evento){


    evento.preventDefault();





    const lancamento = {



        descricao:

        document.getElementById(
            "financeiroDescricao"
        ).value,





        tipo:

        document.getElementById(
            "financeiroTipo"
        ).value,





        valor:

        Number(

            document.getElementById(
                "financeiroValor"
            ).value

        ),





        data:

        document.getElementById(
            "financeiroData"
        ).value,





        projeto_id:

        document.getElementById(
            "financeiroProjeto"
        ).value || null,





        observacoes:

        document.getElementById(
            "financeiroObservacoes"
        ).value




    };






    try{



        if(lancamentoSelecionado){



            await dbEditarLancamentoFinanceiro(

                lancamentoSelecionado,

                lancamento

            );



        }
        else{



            await dbCriarLancamentoFinanceiro(

                lancamento

            );



        }






        fecharModalFinanceiro();



        await carregarFinanceiro();



    }
    catch(error){


        console.error(
            "Erro salvar lançamento:",
            error
        );



        alert(
            "Erro ao salvar lançamento."
        );


    }



}
// ==========================================================
// EDITAR LANÇAMENTO
// ==========================================================



async function editarLancamento(id){



    const dados =

    await dbBuscarFinanceiro();




    const lancamento =

    dados.find(

        item=>

        item.id == id

    );





    if(!lancamento)
    return;





    lancamentoSelecionado =
    id;







    document.getElementById(
        "financeiroDescricao"
    ).value =

    lancamento.descricao || "";







    document.getElementById(
        "financeiroTipo"
    ).value =

    lancamento.tipo || "entrada";







    document.getElementById(
        "financeiroValor"
    ).value =

    lancamento.valor || "";







    document.getElementById(
        "financeiroData"
    ).value =

    lancamento.data || "";







    document.getElementById(
        "financeiroProjeto"
    ).value =

    lancamento.projeto_id || "";







    document.getElementById(
        "financeiroObservacoes"
    ).value =

    lancamento.observacoes || "";







    abrirModalFinanceiro();



}









// ==========================================================
// EXCLUIR LANÇAMENTO
// ==========================================================



async function excluirLancamento(id){



    const confirmar =

    confirm(
        "Deseja realmente excluir este lançamento?"
    );



    if(!confirmar)
    return;







    try{


        await dbExcluirLancamentoFinanceiro(
            id
        );




        await carregarFinanceiro();



    }
    catch(error){



        console.error(
            "Erro excluir lançamento:",
            error
        );



        alert(
            "Erro ao excluir lançamento."
        );


    }



}









// ==========================================================
// VISUALIZAR LANÇAMENTO
// ==========================================================



async function visualizarLancamento(id){



    const dados =

    await dbBuscarFinanceiro();




    const lancamento =

    dados.find(

        item=>

        item.id == id

    );





    const detalhes =

    document.getElementById(
        "detalhesFinanceiro"
    );






    if(!detalhes || !lancamento)
    return;







    detalhes.innerHTML = `



    <h3>

    ${escaparTexto(
        lancamento.descricao
    )}

    </h3>




    <p>

    Tipo:

    ${lancamento.tipo}

    </p>




    <p>

    Valor:

    ${formatarMoeda(
        lancamento.valor
    )}

    </p>




    <p>

    Data:

    ${formatarData(
        lancamento.data
    )}

    </p>




    <p>

    ${escaparTexto(
        lancamento.observacoes || ""
    )}

    </p>



    `;



}








// ==========================================================
// AÇÕES DA LISTA
// ==========================================================



function configurarAcoesFinanceiro(){



    document
    .querySelectorAll(
        ".visualizarLancamento"
    )
    .forEach(botao=>{


        botao.addEventListener(
            "click",
            ()=>{


                visualizarLancamento(
                    botao.dataset.id
                );


            }
        );


    });







    document
    .querySelectorAll(
        ".editarLancamento"
    )
    .forEach(botao=>{


        botao.addEventListener(
            "click",
            ()=>{


                editarLancamento(
                    botao.dataset.id
                );


            }
        );


    });







    document
    .querySelectorAll(
        ".excluirLancamento"
    )
    .forEach(botao=>{


        botao.addEventListener(
            "click",
            ()=>{


                excluirLancamento(
                    botao.dataset.id
                );


            }
        );


    });


}
// ==========================================================
// EVENTOS
// ==========================================================



function configurarEventosFinanceiro(){



    document
    .getElementById(
        "novoLancamento"
    )
    ?.addEventListener(
        "click",
        ()=>{


            lancamentoSelecionado =
            null;


            limparFormularioFinanceiro();


            abrirModalFinanceiro();


        }
    );







    document
    .getElementById(
        "fecharModalFinanceiro"
    )
    ?.addEventListener(
        "click",
        fecharModalFinanceiro
    );







    document
    .getElementById(
        "cancelarLancamento"
    )
    ?.addEventListener(
        "click",
        fecharModalFinanceiro
    );







    document
    .getElementById(
        "formFinanceiro"
    )
    ?.addEventListener(
        "submit",
        salvarLancamento
    );







    document
    .getElementById(
        "pesquisaFinanceiro"
    )
    ?.addEventListener(
        "keyup",
        pesquisarFinanceiro
    );







    document
    .getElementById(
        "btnPesquisarFinanceiro"
    )
    ?.addEventListener(
        "click",
        pesquisarFinanceiro
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



async function pesquisarFinanceiro(){



    const campo =

    document.getElementById(
        "pesquisaFinanceiro"
    );



    const lista =

    document.getElementById(
        "listaFinanceiro"
    );



    if(!campo || !lista)
    return;





    const termo =

    campo.value
    .toLowerCase()
    .trim();





    const dados =

    await dbBuscarFinanceiro();





    const resultado =

    dados.filter(item=>{


        return (

            item.descricao ||

            ""

        )
        .toLowerCase()
        .includes(termo);



    });







    lista.innerHTML =


    resultado.map(item=>`


    <div class="item-lista">


        <h3>

        ${escaparTexto(
            item.descricao
        )}

        </h3>



        <p>

        ${formatarMoeda(
            item.valor
        )}

        </p>


    </div>


    `)
    .join("");



}








// ==========================================================
// LIMPAR FORMULÁRIO
// ==========================================================



function limparFormularioFinanceiro(){



    lancamentoSelecionado =
    null;




    const campos = [


        "financeiroDescricao",

        "financeiroValor",

        "financeiroData",

        "financeiroObservacoes"


    ];




    campos.forEach(id=>{


        const campo =

        document.getElementById(id);



        if(campo){

            campo.value = "";

        }


    });





    const tipo =

    document.getElementById(
        "financeiroTipo"
    );



    if(tipo){

        tipo.value =
        "entrada";

    }




    const projeto =

    document.getElementById(
        "financeiroProjeto"
    );



    if(projeto){

        projeto.value =
        "";

    }



}









// ==========================================================
// FORMATADORES
// ==========================================================



function formatarMoeda(valor){



    return Number(valor || 0)

    .toLocaleString(

        "pt-BR",

        {

            style:"currency",

            currency:"BRL"

        }

    );



}







function formatarData(data){



    if(!data)
    return "-";



    return new Date(data)

    .toLocaleDateString(
        "pt-BR"
    );


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
