/*
==========================================================
CAMILA MARTINS ENGENHARIA

DATABASE.JS

CAMADA CENTRAL DO SISTEMA

HTML
 ↓
JS DAS PÁGINAS
 ↓
DATABASE.JS
 ↓
SUPABASE.JS
 ↓
SUPABASE

VERSÃO CORRIGIDA
==========================================================
*/


// ==========================================================
// VERIFICA CONEXÃO
// ==========================================================


function verificarSupabase(){

    if(!window.supabaseClient){

        console.error(
            "Supabase não conectado."
        );

        return false;

    }


    return true;

}






// ==========================================================
// TRATAMENTO PADRÃO DE ERRO
// ==========================================================


function tratarErroDatabase(error, contexto){


    console.error(
        "Erro:",
        contexto,
        error
    );


    return [];

}






// ==========================================================
// CLIENTES
// ==========================================================



async function dbBuscarClientes(){


    try{


        const {data,error}=

        await supabaseClient

        .from("clientes")

        .select("*")

        .order(
            "created_at",
            {
                ascending:false
            }
        );



        if(error){

            throw error;

        }



        return data || [];



    }
    catch(error){


        return tratarErroDatabase(
            error,
            "buscar clientes"
        );


    }


}







async function dbBuscarClientePorId(id){


    try{


        const {data,error}=

        await supabaseClient

        .from("clientes")

        .select("*")

        .eq(
            "id",
            id
        )

        .single();



        if(error){

            throw error;

        }



        return data;



    }
    catch(error){


        console.error(
            "Erro buscar cliente:",
            error
        );


        return null;


    }


}







async function dbCriarCliente(cliente){


    try{


        const {data,error}=

        await supabaseClient

        .from("clientes")

        .insert([cliente])

        .select()

        .single();



        if(error){

            throw error;

        }



        return data;



    }
    catch(error){


        console.error(
            "Erro criar cliente:",
            error
        );


        return null;


    }


}







async function dbEditarCliente(id,cliente){


    try{


        const {data,error}=

        await supabaseClient

        .from("clientes")

        .update(cliente)

        .eq(
            "id",
            id
        )

        .select()

        .single();



        if(error){

            throw error;

        }



        return data;



    }
    catch(error){


        console.error(
            "Erro editar cliente:",
            error
        );


        return null;


    }


}







async function dbExcluirCliente(id){


    try{


        const {error}=

        await supabaseClient

        .from("clientes")

        .delete()

        .eq(
            "id",
            id
        );



        if(error){

            throw error;

        }



        return true;



    }
    catch(error){


        console.error(
            "Erro excluir cliente:",
            error
        );


        return false;


    }


}
// ==========================================================
// PROJETOS
// ==========================================================



async function dbBuscarProjetos(){


    try{


        const {data,error}=

        await supabaseClient

        .from("projetos")

        .select(`

            *,

            clientes(
                nome
            )

        `)

        .order(
            "created_at",
            {
                ascending:false
            }
        );



        if(error){

            throw error;

        }



        return data || [];



    }
    catch(error){


        return tratarErroDatabase(
            error,
            "buscar projetos"
        );


    }


}







async function dbBuscarProjetoPorId(id){


    try{


        const {data,error}=

        await supabaseClient

        .from("projetos")

        .select(`

            *,

            clientes(
                nome
            )

        `)

        .eq(
            "id",
            id
        )

        .single();



        if(error){

            throw error;

        }



        return data;



    }
    catch(error){


        console.error(
            "Erro buscar projeto:",
            error
        );


        return null;


    }


}







async function dbCriarProjeto(projeto){


    try{


        const {data,error}=

        await supabaseClient

        .from("projetos")

        .insert([projeto])

        .select()

        .single();



        if(error){

            throw error;

        }



        return data;



    }
    catch(error){


        console.error(
            "Erro criar projeto:",
            error
        );


        return null;


    }


}







async function dbEditarProjeto(id,projeto){


    try{


        const {data,error}=

        await supabaseClient

        .from("projetos")

        .update(projeto)

        .eq(
            "id",
            id
        )

        .select()

        .single();



        if(error){

            throw error;

        }



        return data;



    }
    catch(error){


        console.error(
            "Erro editar projeto:",
            error
        );


        return null;


    }


}







async function dbExcluirProjeto(id){


    try{


        const {error}=

        await supabaseClient

        .from("projetos")

        .delete()

        .eq(
            "id",
            id
        );



        if(error){

            throw error;

        }



        return true;



    }
    catch(error){


        console.error(
            "Erro excluir projeto:",
            error
        );


        return false;


    }


}







// ==========================================================
// DOCUMENTOS
// ==========================================================



async function dbBuscarDocumentos(){


    try{


        const {data,error}=

        await supabaseClient

        .from("documentos")

        .select(`

            *,

            clientes(
                nome
            ),

            projetos(
                nome
            )

        `)

        .order(
            "created_at",
            {
                ascending:false
            }
        );



        if(error){

            throw error;

        }



        return data || [];



    }
    catch(error){


        return tratarErroDatabase(
            error,
            "buscar documentos"
        );


    }


}
// ==========================================================
// DOCUMENTOS - CONTINUAÇÃO
// ==========================================================



async function dbBuscarDocumentoPorId(id){


    try{


        const {data,error}=

        await supabaseClient

        .from("documentos")

        .select(`

            *,

            clientes(
                nome
            ),

            projetos(
                nome
            )

        `)

        .eq(
            "id",
            id
        )

        .single();



        if(error){

            throw error;

        }



        return data;



    }
    catch(error){


        console.error(
            "Erro buscar documento:",
            error
        );


        return null;


    }


}







async function dbCriarDocumento(documento){


    try{


        const {data,error}=

        await supabaseClient

        .from("documentos")

        .insert([documento])

        .select()

        .single();



        if(error){

            throw error;

        }



        return data;



    }
    catch(error){


        console.error(
            "Erro criar documento:",
            error
        );


        return null;


    }


}







async function dbExcluirDocumento(id){


    try{


        const {error}=

        await supabaseClient

        .from("documentos")

        .delete()

        .eq(
            "id",
            id
        );



        if(error){

            throw error;

        }



        return true;



    }
    catch(error){


        console.error(
            "Erro excluir documento:",
            error
        );


        return false;


    }


}







// ==========================================================
// FOTOS
// ==========================================================



async function dbBuscarFotos(){


    try{


        const {data,error}=

        await supabaseClient

        .from("fotos")

        .select(`

            *,

            clientes(
                nome
            ),

            projetos(
                nome
            )

        `)

        .order(
            "created_at",
            {
                ascending:false
            }
        );



        if(error){

            throw error;

        }



        return data || [];



    }
    catch(error){


        return tratarErroDatabase(
            error,
            "buscar fotos"
        );


    }


}







async function dbExcluirFoto(id){


    try{


        const {error}=

        await supabaseClient

        .from("fotos")

        .delete()

        .eq(
            "id",
            id
        );



        if(error){

            throw error;

        }



        return true;



    }
    catch(error){


        console.error(
            "Erro excluir foto:",
            error
        );


        return false;


    }


}







// ==========================================================
// BIBLIOTECA
// ==========================================================



async function dbBuscarBiblioteca(){


    try{


        const {data,error}=

        await supabaseClient

        .from("biblioteca")

        .select("*")

        .order(
            "created_at",
            {
                ascending:false
            }
        );



        if(error){

            throw error;

        }



        return data || [];



    }
    catch(error){


        return tratarErroDatabase(
            error,
            "buscar biblioteca"
        );


    }


}
// ==========================================================
// FINANCEIRO
// ==========================================================



async function dbBuscarFinanceiro(){


    try{


        const {data,error}=

        await supabaseClient

        .from("financeiro")

        .select(`

            *,

            projetos(
                nome
            )

        `)

        .order(
            "created_at",
            {
                ascending:false
            }
        );



        if(error){

            throw error;

        }



        return data || [];



    }
    catch(error){


        return tratarErroDatabase(
            error,
            "buscar financeiro"
        );


    }


}







async function dbResumoFinanceiro(){


    try{


        const dados =
        await dbBuscarFinanceiro();



        let entradas = 0;

        let saidas = 0;



        dados.forEach(item=>{


            if(item.tipo === "entrada"){

                entradas += Number(item.valor || 0);

            }


            if(item.tipo === "saida"){

                saidas += Number(item.valor || 0);

            }


        });




        return {

            entradas,

            saidas,

            saldo:
            entradas - saidas

        };



    }
    catch(error){


        console.error(
            "Erro resumo financeiro:",
            error
        );


        return {

            entradas:0,

            saidas:0,

            saldo:0

        };


    }


}







// ==========================================================
// AGENDA
// ==========================================================



async function dbBuscarAgenda(){


    try{


        const {data,error}=

        await supabaseClient

        .from("agenda")

        .select(`

            *,

            clientes(
                nome
            ),

            projetos(
                nome
            )

        `)

        .order(
            "data",
            {
                ascending:true
            }
        );



        if(error){

            throw error;

        }



        return data || [];



    }
    catch(error){


        return tratarErroDatabase(
            error,
            "buscar agenda"
        );


    }


}







// ==========================================================
// CONFIGURAÇÕES
// ==========================================================



async function dbBuscarConfiguracoes(){


    try{


        const {data,error}=

        await supabaseClient

        .from("configuracoes")

        .select("*")

        .limit(1);



        if(error){

            throw error;

        }



        return data?.[0] || {};



    }
    catch(error){


        console.error(
            "Erro buscar configurações:",
            error
        );


        return {};

    }


}







async function dbSalvarConfiguracoes(dados){


    try{


        const atual =
        await dbBuscarConfiguracoes();



        let resposta;



        if(atual.id){


            resposta =
            await supabaseClient

            .from("configuracoes")

            .update(dados)

            .eq(
                "id",
                atual.id
            );



        }
        else{


            resposta =
            await supabaseClient

            .from("configuracoes")

            .insert([dados]);


        }



        if(resposta.error){

            throw resposta.error;

        }



        return true;



    }
    catch(error){


        console.error(
            "Erro salvar configurações:",
            error
        );


        return false;


    }


}







// ==========================================================
// CONTADORES
// ==========================================================



async function dbContarClientes(){

    const dados =
    await dbBuscarClientes();

    return dados.length;

}



async function dbContarProjetos(){

    const dados =
    await dbBuscarProjetos();

    return dados.length;

}



async function dbContarDocumentos(){

    const dados =
    await dbBuscarDocumentos();

    return dados.length;

}



async function dbContarFotos(){

    const dados =
    await dbBuscarFotos();

    return dados.length;

}





// ==========================================================
// FINAL
// ==========================================================


console.log(
    "DATABASE.JS CARREGADO COM SUCESSO"
);
