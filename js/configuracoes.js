/*
==========================================================
CAMILA MARTINS ENGENHARIA

CONFIGURACOES.JS
GERENCIAMENTO DO SISTEMA

USA:
database.js
supabase.js

VERSÃO DEFINITIVA
==========================================================
*/


document.addEventListener(
"DOMContentLoaded",
()=>{


    iniciarConfiguracoes();


});







// ==========================================================
// INICIALIZAÇÃO
// ==========================================================


async function iniciarConfiguracoes(){


    configurarEventosConfiguracoes();


    await carregarConfiguracoes();



}








// ==========================================================
// CARREGAR CONFIGURAÇÕES
// ==========================================================


async function carregarConfiguracoes(){


    try{


        const dados =

        await dbBuscarConfiguracoes();





        if(!dados)
        return;






        document.getElementById(
            "empresaNome"
        ).value =

        dados.nome || "";





        document.getElementById(
            "empresaCnpj"
        ).value =

        dados.cnpj || "";





        document.getElementById(
            "empresaTelefone"
        ).value =

        dados.telefone || "";





        document.getElementById(
            "empresaEmail"
        ).value =

        dados.email || "";





        document.getElementById(
            "empresaEndereco"
        ).value =

        dados.endereco || "";





        document.getElementById(
            "empresaCidade"
        ).value =

        dados.cidade || "";





        document.getElementById(
            "empresaEstado"
        ).value =

        dados.estado || "";





        document.getElementById(
            "empresaCrea"
        ).value =

        dados.crea || "";





        document.getElementById(
            "empresaDescricao"
        ).value =

        dados.descricao || "";





        document.getElementById(
            "sistemaCorPrincipal"
        ).value =

        dados.cor || "#1b2430";





        document.getElementById(
            "sistemaTema"
        ).value =

        dados.tema || "claro";





        document.getElementById(
            "sistemaNotificacoes"
        ).value =

        dados.notificacoes || "ativo";





    }
    catch(error){


        console.error(
            "Erro carregar configurações:",
            error
        );


    }



}
// ==========================================================
// SALVAR CONFIGURAÇÕES
// ==========================================================



async function salvarConfiguracoes(evento){


    evento.preventDefault();





    const dados = {



        nome:

        document.getElementById(
            "empresaNome"
        ).value,





        cnpj:

        document.getElementById(
            "empresaCnpj"
        ).value,





        telefone:

        document.getElementById(
            "empresaTelefone"
        ).value,





        email:

        document.getElementById(
            "empresaEmail"
        ).value,





        endereco:

        document.getElementById(
            "empresaEndereco"
        ).value,





        cidade:

        document.getElementById(
            "empresaCidade"
        ).value,





        estado:

        document.getElementById(
            "empresaEstado"
        ).value,





        crea:

        document.getElementById(
            "empresaCrea"
        ).value,





        descricao:

        document.getElementById(
            "empresaDescricao"
        ).value,





        cor:

        document.getElementById(
            "sistemaCorPrincipal"
        ).value,





        tema:

        document.getElementById(
            "sistemaTema"
        ).value,





        notificacoes:

        document.getElementById(
            "sistemaNotificacoes"
        ).value





    };







    try{



        await dbSalvarConfiguracoes(

            dados

        );






        alert(

            "Configurações salvas com sucesso."

        );



    }
    catch(error){



        console.error(

            "Erro salvar configurações:",

            error

        );




        alert(

            "Erro ao salvar configurações."

        );



    }



}








// ==========================================================
// BACKUP
// ==========================================================



async function gerarBackup(){



    try{



        const backup =

        await dbGerarBackup();





        const arquivo =

        new Blob(

            [

                JSON.stringify(

                    backup,

                    null,

                    2

                )

            ],

            {

                type:

                "application/json"

            }

        );






        const link =

        document.createElement(
            "a"
        );





        link.href =

        URL.createObjectURL(
            arquivo
        );





        link.download =

        "backup_camila_martins_engenharia.json";





        link.click();





    }
    catch(error){



        console.error(

            "Erro gerar backup:",

            error

        );



        alert(

            "Erro ao gerar backup."

        );



    }



}
// ==========================================================
// LIMPAR CACHE
// ==========================================================



function limparCache(){



    try{


        localStorage.clear();



        sessionStorage.clear();





        alert(

            "Cache limpo com sucesso."

        );



    }
    catch(error){



        console.error(

            "Erro limpar cache:",

            error

        );



        alert(

            "Erro ao limpar cache."

        );



    }



}








// ==========================================================
// APLICAR TEMA
// ==========================================================



function aplicarTema(){



    const tema =

    document.getElementById(
        "sistemaTema"
    ).value;





    if(
        tema === "escuro"
    ){


        document.body.classList.add(
            "tema-escuro"
        );


    }
    else{


        document.body.classList.remove(
            "tema-escuro"
        );


    }



}








// ==========================================================
// APLICAR COR PRINCIPAL
// ==========================================================



function aplicarCorPrincipal(){



    const cor =

    document.getElementById(
        "sistemaCorPrincipal"
    ).value;





    document.documentElement.style.setProperty(

        "--cor-principal",

        cor

    );



}
// ==========================================================
// EVENTOS
// ==========================================================



function configurarEventosConfiguracoes(){



    document
    .getElementById(
        "formConfiguracoes"
    )
    ?.addEventListener(
        "submit",
        salvarConfiguracoes
    );







    document
    .getElementById(
        "gerarBackup"
    )
    ?.addEventListener(
        "click",
        gerarBackup
    );







    document
    .getElementById(
        "limparCache"
    )
    ?.addEventListener(
        "click",
        limparCache
    );







    document
    .getElementById(
        "sistemaTema"
    )
    ?.addEventListener(
        "change",
        aplicarTema
    );







    document
    .getElementById(
        "sistemaCorPrincipal"
    )
    ?.addEventListener(
        "change",
        aplicarCorPrincipal
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
