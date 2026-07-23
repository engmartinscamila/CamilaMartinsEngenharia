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

MÓDULOS:
- Clientes
- Projetos
- Documentos
- Fotos
- Biblioteca
- Financeiro
- Agenda
- Configurações
- Storage
- Backup

VERSÃO DEFINITIVA
==========================================================
*/





// ==========================================================
// CLIENTES
// ==========================================================



async function dbBuscarClientes(){


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



    if(error)
    throw error;



    return data || [];


}







async function dbBuscarClientePorId(id){


    const {data,error}=

    await supabaseClient

    .from("clientes")

    .select("*")

    .eq(
        "id",
        id
    )

    .single();



    if(error)
    throw error;



    return data;



}







async function dbCriarCliente(cliente){


    const {data,error}=

    await supabaseClient

    .from("clientes")

    .insert(cliente)

    .select()

    .single();



    if(error)
    throw error;



    return data;


}







async function dbEditarCliente(id,cliente){


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



    if(error)
    throw error;



    return data;


}







async function dbExcluirCliente(id){


    const {error}=

    await supabaseClient

    .from("clientes")

    .delete()

    .eq(
        "id",
        id
    );



    if(error)
    throw error;



}







// ==========================================================
// PROJETOS
// ==========================================================



async function dbBuscarProjetos(){


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



    if(error)
    throw error;



    return data || [];


}







async function dbBuscarProjetoPorId(id){


    const {data,error}=

    await supabaseClient

    .from("projetos")

    .select("*")

    .eq(
        "id",
        id
    )

    .single();



    if(error)
    throw error;



    return data;


}







async function dbCriarProjeto(projeto){


    const {data,error}=

    await supabaseClient

    .from("projetos")

    .insert(projeto)

    .select()

    .single();



    if(error)
    throw error;



    return data;


}







async function dbEditarProjeto(id,projeto){


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



    if(error)
    throw error;



    return data;


}







async function dbExcluirProjeto(id){


    const {error}=

    await supabaseClient

    .from("projetos")

    .delete()

    .eq(
        "id",
        id
    );



    if(error)
    throw error;


}
// ==========================================================
// DOCUMENTOS
// ==========================================================



async function dbBuscarDocumentos(){


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



    if(error)
    throw error;



    return data || [];


}








async function dbBuscarDocumentoPorId(id){


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



    if(error)
    throw error;



    return data;


}








async function dbSalvarDocumento(documento){


    const {data,error}=

    await supabaseClient

    .from("documentos")

    .insert(documento)

    .select()

    .single();



    if(error)
    throw error;



    return data;


}








async function dbExcluirDocumento(id){


    const {error}=

    await supabaseClient

    .from("documentos")

    .delete()

    .eq(
        "id",
        id
    );



    if(error)
    throw error;



}








async function dbBuscarDocumentosCliente(cliente_id){



    const {data,error}=

    await supabaseClient

    .from("documentos")

    .select("*")

    .eq(
        "cliente_id",
        cliente_id
    );



    if(error)
    throw error;



    return data || [];


}








async function dbBuscarDocumentosProjeto(projeto_id){



    const {data,error}=

    await supabaseClient

    .from("documentos")

    .select("*")

    .eq(
        "projeto_id",
        projeto_id
    );



    if(error)
    throw error;



    return data || [];


}







// ==========================================================
// BUSCAS RELACIONADAS
// ==========================================================



async function dbBuscarProjetosCliente(cliente_id){



    const {data,error}=

    await supabaseClient

    .from("projetos")

    .select("*")

    .eq(
        "cliente_id",
        cliente_id
    );



    if(error)
    throw error;



    return data || [];


}
// ==========================================================
// FOTOS
// ==========================================================



async function dbBuscarFotos(){



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



    if(error)
    throw error;



    return data || [];

}









async function dbSalvarFoto(foto){



    const {data,error}=

    await supabaseClient

    .from("fotos")

    .insert(foto)

    .select()

    .single();



    if(error)
    throw error;



    return data;



}









async function dbExcluirFoto(id){



    const {error}=

    await supabaseClient

    .from("fotos")

    .delete()

    .eq(

        "id",

        id

    );



    if(error)
    throw error;



}








async function dbBuscarFotosProjeto(projeto_id){



    const {data,error}=

    await supabaseClient

    .from("fotos")

    .select("*")

    .eq(

        "projeto_id",

        projeto_id

    );



    if(error)
    throw error;



    return data || [];



}









// ==========================================================
// STORAGE SUPABASE
// ==========================================================



async function dbUploadArquivo(

    bucket,

    caminho,

    arquivo

){



    const {data,error}=

    await supabaseClient

    .storage

    .from(bucket)

    .upload(

        caminho,

        arquivo,

        {

            upsert:true

        }

    );



    if(error)
    throw error;



    return data;



}









function dbGerarUrlArquivo(

    bucket,

    caminho

){



    const {data}=

    supabaseClient

    .storage

    .from(bucket)

    .getPublicUrl(

        caminho

    );



    return data.publicUrl;



}









async function dbExcluirArquivoStorage(

    bucket,

    caminho

){



    const {error}=

    await supabaseClient

    .storage

    .from(bucket)

    .remove([

        caminho

    ]);



    if(error)
    throw error;



}
// ==========================================================
// BIBLIOTECA
// ==========================================================



async function dbBuscarBiblioteca(){



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



    if(error)
    throw error;



    return data || [];

}









async function dbSalvarArquivoBiblioteca(arquivo){



    const {data,error}=

    await supabaseClient

    .from("biblioteca")

    .insert(arquivo)

    .select()

    .single();



    if(error)
    throw error;



    return data;



}









async function dbExcluirArquivoBiblioteca(id){



    const {error}=

    await supabaseClient

    .from("biblioteca")

    .delete()

    .eq(

        "id",

        id

    );



    if(error)
    throw error;



}








// ==========================================================
// FINANCEIRO
// ==========================================================



async function dbBuscarFinanceiro(){



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

        "data",

        {

            ascending:false

        }

    );



    if(error)
    throw error;



    return data || [];

}









async function dbCriarLancamentoFinanceiro(lancamento){



    const {data,error}=

    await supabaseClient

    .from("financeiro")

    .insert(lancamento)

    .select()

    .single();



    if(error)
    throw error;



    return data;



}









async function dbEditarLancamentoFinanceiro(

    id,

    lancamento

){



    const {data,error}=

    await supabaseClient

    .from("financeiro")

    .update(lancamento)

    .eq(

        "id",

        id

    )

    .select()

    .single();



    if(error)
    throw error;



    return data;



}









async function dbExcluirLancamentoFinanceiro(id){



    const {error}=

    await supabaseClient

    .from("financeiro")

    .delete()

    .eq(

        "id",

        id

    );



    if(error)
    throw error;



}









async function dbResumoFinanceiro(){



    const dados =

    await dbBuscarFinanceiro();





    let entradas = 0;


    let saidas = 0;





    dados.forEach(item=>{



        if(item.tipo === "entrada"){


            entradas +=

            Number(item.valor || 0);


        }
        else{


            saidas +=

            Number(item.valor || 0);


        }



    });






    return {


        entradas,


        saidas,


        saldo:

        entradas - saidas



    };



}
// ==========================================================
// AGENDA
// ==========================================================



async function dbBuscarAgenda(){



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



    if(error)
    throw error;



    return data || [];

}









async function dbCriarEventoAgenda(evento){



    const {data,error}=

    await supabaseClient

    .from("agenda")

    .insert(evento)

    .select()

    .single();



    if(error)
    throw error;



    return data;



}









async function dbEditarEventoAgenda(

    id,

    evento

){



    const {data,error}=

    await supabaseClient

    .from("agenda")

    .update(evento)

    .eq(

        "id",

        id

    )

    .select()

    .single();



    if(error)
    throw error;



    return data;



}









async function dbExcluirEventoAgenda(id){



    const {error}=

    await supabaseClient

    .from("agenda")

    .delete()

    .eq(

        "id",

        id

    );



    if(error)
    throw error;



}









// ==========================================================
// CONFIGURAÇÕES
// ==========================================================



async function dbBuscarConfiguracoes(){



    const {data,error}=

    await supabaseClient

    .from("configuracoes")

    .select("*")

    .limit(1)

    .single();





    if(error && error.code !== "PGRST116")

    throw error;



    return data;



}









async function dbSalvarConfiguracoes(configuracoes){



    const existente =

    await dbBuscarConfiguracoes();






    if(existente){



        const {data,error}=

        await supabaseClient

        .from("configuracoes")

        .update(configuracoes)

        .eq(

            "id",

            existente.id

        )

        .select()

        .single();





        if(error)
        throw error;



        return data;



    }
    else{



        const {data,error}=

        await supabaseClient

        .from("configuracoes")

        .insert(configuracoes)

        .select()

        .single();





        if(error)
        throw error;



        return data;



    }



}
// ==========================================================
// DASHBOARD
// INDICADORES GERAIS
// ==========================================================





async function dbBuscarResumoDashboard(){



    const clientes =

    await dbBuscarClientes();





    const projetos =

    await dbBuscarProjetos();





    const documentos =

    await dbBuscarDocumentos();





    const fotos =

    await dbBuscarFotos();





    const financeiro =

    await dbResumoFinanceiro();








    return {



        totalClientes:

        clientes.length,





        totalProjetos:

        projetos.length,





        totalDocumentos:

        documentos.length,





        totalFotos:

        fotos.length,





        entradas:

        financeiro.entradas,





        saidas:

        financeiro.saidas,





        saldo:

        financeiro.saldo





    };



}








// ==========================================================
// ÚLTIMOS REGISTROS
// ==========================================================





async function dbBuscarUltimosProjetos(){



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

    )

    .limit(5);





    if(error)

    throw error;





    return data || [];



}









async function dbBuscarUltimosClientes(){



    const {data,error}=

    await supabaseClient

    .from("clientes")

    .select("*")

    .order(

        "created_at",

        {

            ascending:false

        }

    )

    .limit(5);





    if(error)

    throw error;





    return data || [];



}








async function dbBuscarProximosEventos(){



    const hoje =

    new Date()

    .toISOString()

    .split("T")[0];







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

    .gte(

        "data",

        hoje

    )

    .order(

        "data",

        {

            ascending:true

        }

    )

    .limit(5);





    if(error)

    throw error;





    return data || [];



}
// ==========================================================
// BACKUP COMPLETO DO SISTEMA
// ==========================================================



async function dbGerarBackup(){



    const backup = {



        data:

        new Date()

        .toISOString(),






        clientes:

        await dbBuscarClientes(),





        projetos:

        await dbBuscarProjetos(),





        documentos:

        await dbBuscarDocumentos(),





        fotos:

        await dbBuscarFotos(),





        biblioteca:

        await dbBuscarBiblioteca(),





        financeiro:

        await dbBuscarFinanceiro(),





        agenda:

        await dbBuscarAgenda(),





        configuracoes:

        await dbBuscarConfiguracoes()





    };







    return backup;



}









// ==========================================================
// AUTENTICAÇÃO
// ==========================================================





async function dbUsuarioAtual(){



    const {data,error}=

    await supabaseClient

    .auth

    .getUser();





    if(error)

    throw error;





    return data.user;



}









async function dbSairSistema(){



    const {error}=

    await supabaseClient

    .auth

    .signOut();





    if(error)

    throw error;



}









async function dbVerificarLogin(){



    const {data}=

    await supabaseClient

    .auth

    .getSession();





    return !!data.session;



}









// ==========================================================
// UTILIDADES
// ==========================================================



function dbDataAtual(){



    return new Date()

    .toISOString()

    .split("T")[0];



}








function dbGerarId(){



    return crypto.randomUUID();



}
// ==========================================================
// TESTE DE CONEXÃO COM SUPABASE
// ==========================================================



async function dbTesteConexao(){


    try{


        const {data,error}=

        await supabaseClient

        .from("clientes")

        .select("id")

        .limit(1);





        if(error)

        throw error;





        console.log(

            "Supabase conectado com sucesso",

            data

        );





        return true;



    }
    catch(error){


        console.error(

            "Erro conexão Supabase:",

            error

        );



        return false;



    }



}








// ==========================================================
// VERIFICA EXISTÊNCIA DE TABELA
// ==========================================================



async function dbVerificarTabela(nomeTabela){



    try{


        const {error}=

        await supabaseClient

        .from(nomeTabela)

        .select("*")

        .limit(1);





        if(error)

        throw error;





        return true;



    }
    catch(error){



        console.error(

            `Tabela ${nomeTabela} não encontrada:`,

            error

        );



        return false;



    }



}








// ==========================================================
// STATUS DO SISTEMA
// ==========================================================



async function dbStatusSistema(){



    const tabelas = [


        "clientes",

        "projetos",

        "documentos",

        "fotos",

        "biblioteca",

        "financeiro",

        "agenda",

        "configuracoes"


    ];






    const status = {};






    for(const tabela of tabelas){



        status[tabela] =

        await dbVerificarTabela(
            tabela
        );



    }






    return status;



}








// ==========================================================
// FINALIZAÇÃO
// ==========================================================



console.log(

"CAMILA MARTINS ENGENHARIA - DATABASE.JS CARREGADO"

);
