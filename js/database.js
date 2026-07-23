/*
==========================================================
CAMILA MARTINS ENGENHARIA

DATABASE.JS
CAMADA CENTRAL DO SISTEMA

TODOS OS MÓDULOS UTILIZAM ESTE ARQUIVO

ADMIN
CLIENTES
PROJETOS
DOCUMENTOS
FOTOS
BIBLIOTECA
FINANCEIRO
AGENDA
CONFIGURAÇÕES

SUPABASE
==========================================================
*/



// ==========================================================
// CLIENTES
// ==========================================================



async function dbCriarCliente(cliente){


    const {data,error} =

    await supabaseClient

    .from("clientes")

    .insert([cliente])

    .select()

    .single();



    if(error){

        console.error(error);

        throw error;

    }


    return data;


}







async function dbBuscarClientes(){


    const {data,error} =

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

        console.error(error);

        throw error;

    }


    return data || [];


}







async function dbBuscarClientePorId(id){


    const {data,error} =

    await supabaseClient

    .from("clientes")

    .select("*")

    .eq(
        "id",
        id
    )

    .single();



    if(error){

        console.error(error);

        throw error;

    }


    return data;


}







async function dbEditarCliente(id,cliente){


    const {data,error} =

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

        console.error(error);

        throw error;

    }


    return data;


}







async function dbExcluirCliente(id){


    const {error} =

    await supabaseClient

    .from("clientes")

    .delete()

    .eq(
        "id",
        id
    );



    if(error){

        console.error(error);

        throw error;

    }


    return true;


}









// ==========================================================
// PROJETOS
// ==========================================================



async function dbCriarProjeto(projeto){


    const {data,error} =

    await supabaseClient

    .from("projetos")

    .insert([projeto])

    .select()

    .single();



    if(error){

        console.error(error);

        throw error;

    }


    return data;


}







async function dbBuscarProjetos(){


    const {data,error} =

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

        console.error(error);

        throw error;

    }


    return data || [];


}







async function dbBuscarProjetoPorId(id){


    const {data,error} =

    await supabaseClient

    .from("projetos")

    .select("*")

    .eq(
        "id",
        id
    )

    .single();



    if(error){

        console.error(error);

        throw error;

    }


    return data;


}







async function dbBuscarProjetosCliente(cliente_id){


    const {data,error} =

    await supabaseClient

    .from("projetos")

    .select("*")

    .eq(
        "cliente_id",
        cliente_id
    );



    if(error){

        console.error(error);

        throw error;

    }


    return data || [];


}







async function dbEditarProjeto(id,projeto){


    const {data,error} =

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

        console.error(error);

        throw error;

    }


    return data;


}







async function dbExcluirProjeto(id){


    const {error} =

    await supabaseClient

    .from("projetos")

    .delete()

    .eq(
        "id",
        id
    );



    if(error){

        console.error(error);

        throw error;

    }


    return true;


}
// ==========================================================
// DOCUMENTOS
// ==========================================================



async function dbSalvarDocumento(documento){


    const {data,error} =

    await supabaseClient

    .from("documentos")

    .insert([documento])

    .select()

    .single();



    if(error){

        console.error(error);

        throw error;

    }


    return data;


}







async function dbBuscarDocumentos(){


    const {data,error} =

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

        console.error(error);

        throw error;

    }


    return data || [];


}







async function dbBuscarDocumentosCliente(cliente_id){


    const {data,error} =

    await supabaseClient

    .from("documentos")

    .select("*")

    .eq(
        "cliente_id",
        cliente_id
    );



    if(error){

        console.error(error);

        throw error;

    }


    return data || [];


}







async function dbExcluirDocumento(id){


    const {error} =

    await supabaseClient

    .from("documentos")

    .delete()

    .eq(
        "id",
        id
    );



    if(error){

        console.error(error);

        throw error;

    }


    return true;


}








// ==========================================================
// FOTOS
// ==========================================================




async function dbSalvarFoto(foto){


    const {data,error} =

    await supabaseClient

    .from("fotos")

    .insert([foto])

    .select()

    .single();



    if(error){

        console.error(error);

        throw error;

    }


    return data;


}







async function dbBuscarFotos(){


    const {data,error} =

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

        console.error(error);

        throw error;

    }


    return data || [];


}







async function dbBuscarFotosProjeto(projeto_id){


    const {data,error} =

    await supabaseClient

    .from("fotos")

    .select("*")

    .eq(
        "projeto_id",
        projeto_id
    );



    if(error){

        console.error(error);

        throw error;

    }


    return data || [];


}







async function dbExcluirFoto(id){


    const {error} =

    await supabaseClient

    .from("fotos")

    .delete()

    .eq(
        "id",
        id
    );



    if(error){

        console.error(error);

        throw error;

    }


    return true;


}
// ==========================================================
// BIBLIOTECA
// ==========================================================



async function dbSalvarArquivoBiblioteca(arquivo){


    const {data,error} =

    await supabaseClient

    .from("biblioteca")

    .insert([arquivo])

    .select()

    .single();



    if(error){

        console.error(error);

        throw error;

    }


    return data;


}







async function dbBuscarBiblioteca(){


    const {data,error} =

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

        console.error(error);

        throw error;

    }


    return data || [];


}







async function dbExcluirArquivoBiblioteca(id){


    const {error} =

    await supabaseClient

    .from("biblioteca")

    .delete()

    .eq(
        "id",
        id
    );



    if(error){

        console.error(error);

        throw error;

    }


    return true;


}









// ==========================================================
// STORAGE SUPABASE
// ==========================================================




async function dbUploadArquivo(bucket,caminho,arquivo){


    const {data,error} =

    await supabaseClient

    .storage

    .from(bucket)

    .upload(
        caminho,
        arquivo
    );



    if(error){

        console.error(error);

        throw error;

    }


    return data;


}







function dbGerarUrlArquivo(bucket,caminho){


    const {data} =

    supabaseClient

    .storage

    .from(bucket)

    .getPublicUrl(
        caminho
    );



    return data.publicUrl;


}







async function dbExcluirArquivoStorage(bucket,caminho){


    const {data,error} =

    await supabaseClient

    .storage

    .from(bucket)

    .remove([
        caminho
    ]);



    if(error){

        console.error(error);

        throw error;

    }


    return data;


}
// ==========================================================
// FINANCEIRO
// ==========================================================



async function dbCriarLancamentoFinanceiro(lancamento){


    const {data,error} =

    await supabaseClient

    .from("financeiro")

    .insert([lancamento])

    .select()

    .single();



    if(error){

        console.error(
            "Erro criar lançamento:",
            error
        );

        throw error;

    }


    return data;


}







async function dbBuscarFinanceiro(){


    const {data,error} =

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

        console.error(
            "Erro buscar financeiro:",
            error
        );

        throw error;

    }


    return data || [];


}







async function dbEditarLancamentoFinanceiro(id,lancamento){


    const {data,error} =

    await supabaseClient

    .from("financeiro")

    .update(lancamento)

    .eq(
        "id",
        id
    )

    .select()

    .single();



    if(error){

        console.error(
            "Erro editar financeiro:",
            error
        );

        throw error;

    }


    return data;


}







async function dbExcluirLancamentoFinanceiro(id){


    const {error} =

    await supabaseClient

    .from("financeiro")

    .delete()

    .eq(
        "id",
        id
    );



    if(error){

        console.error(
            "Erro excluir financeiro:",
            error
        );

        throw error;

    }


    return true;


}







async function dbResumoFinanceiro(){


    const dados =
    await dbBuscarFinanceiro();



    let entradas = 0;

    let saidas = 0;




    dados.forEach(item=>{


        const valor =
        Number(item.valor || 0);



        if(item.tipo === "entrada"){

            entradas += valor;

        }



        if(item.tipo === "saida"){

            saidas += valor;

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



async function dbCriarEvento(evento){


    const {data,error} =

    await supabaseClient

    .from("agenda")

    .insert([evento])

    .select()

    .single();



    if(error){

        console.error(
            "Erro criar evento:",
            error
        );

        throw error;

    }


    return data;


}







async function dbBuscarAgenda(){


    const {data,error} =

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

        console.error(
            "Erro buscar agenda:",
            error
        );

        throw error;

    }


    return data || [];


}







async function dbEditarEvento(id,event){


    const {data,error} =

    await supabaseClient

    .from("agenda")

    .update(event)

    .eq(
        "id",
        id
    )

    .select()

    .single();



    if(error){

        console.error(
            "Erro editar evento:",
            error
        );

        throw error;

    }


    return data;


}







async function dbExcluirEvento(id){


    const {error} =

    await supabaseClient

    .from("agenda")

    .delete()

    .eq(
        "id",
        id
    );



    if(error){

        console.error(
            "Erro excluir evento:",
            error
        );

        throw error;

    }


    return true;


}







// ==========================================================
// CONFIGURAÇÕES
// ==========================================================



async function dbBuscarConfiguracoes(){


    const {data,error} =

    await supabaseClient

    .from("configuracoes")

    .select("*")

    .limit(1)

    .single();



    if(error){

        console.error(
            "Erro buscar configurações:",
            error
        );

        return null;

    }


    return data;


}







async function dbSalvarConfiguracoes(config){


    const {data,error} =

    await supabaseClient

    .from("configuracoes")

    .upsert(config)

    .select()

    .single();



    if(error){

        console.error(
            "Erro salvar configurações:",
            error
        );

        throw error;

    }


    return data;


}
// ==========================================================
// DASHBOARD
// ==========================================================



async function dbDashboardTotais(){


    const [

        clientes,

        projetos,

        documentos,

        fotos,

        biblioteca


    ] = await Promise.all([


        dbBuscarClientes(),


        dbBuscarProjetos(),


        dbBuscarDocumentos(),


        dbBuscarFotos(),


        dbBuscarBiblioteca()



    ]);




    return {


        clientes:
        clientes.length,


        projetos:
        projetos.length,


        documentos:
        documentos.length,


        fotos:
        fotos.length,


        biblioteca:
        biblioteca.length


    };


}







async function dbClientesRecentes(){


    const clientes =
    await dbBuscarClientes();



    return clientes.slice(
        0,
        5
    );


}







async function dbProjetosRecentes(){


    const projetos =
    await dbBuscarProjetos();



    return projetos.slice(
        0,
        5
    );


}







async function dbDocumentosRecentes(){


    const documentos =
    await dbBuscarDocumentos();



    return documentos.slice(
        0,
        5
    );


}







async function dbProximosEventos(){


    const agenda =
    await dbBuscarAgenda();



    const hoje =
    new Date();



    return agenda.filter(evento=>{


        return new Date(evento.data)
        >= hoje;


    })
    .slice(
        0,
        5
    );


}







// ==========================================================
// AUTENTICAÇÃO
// ==========================================================



async function dbLogin(email,senha){


    const {data,error} =

    await supabaseClient

    .auth

    .signInWithPassword({

        email,

        password:senha

    });



    if(error){

        console.error(
            "Erro login:",
            error
        );

        throw error;

    }


    return data;


}







async function dbUsuarioAtual(){


    const {data,error} =

    await supabaseClient

    .auth

    .getUser();



    if(error){

        console.error(
            "Erro usuário:",
            error
        );

        throw error;

    }


    return data.user;


}







async function dbSairSistema(){


    const {error} =

    await supabaseClient

    .auth

    .signOut();



    if(error){

        console.error(
            "Erro logout:",
            error
        );

        throw error;

    }


    return true;


}
// ==========================================================
// COMPATIBILIDADE COM SCRIPTS EXISTENTES
// ==========================================================



// CLIENTES

async function buscarClientes(){

    return await dbBuscarClientes();

}



async function criarCliente(cliente){

    return await dbCriarCliente(cliente);

}



async function editarCliente(id,cliente){

    return await dbEditarCliente(id,cliente);

}



async function excluirCliente(id){

    return await dbExcluirCliente(id);

}





// PROJETOS


async function buscarProjetos(){

    return await dbBuscarProjetos();

}



async function criarProjeto(projeto){

    return await dbCriarProjeto(projeto);

}





// DOCUMENTOS


async function buscarDocumentos(){

    return await dbBuscarDocumentos();

}



async function salvarDocumento(documento){

    return await dbSalvarDocumento(documento);

}





// FOTOS


async function buscarFotos(){

    return await dbBuscarFotos();

}



async function salvarFoto(foto){

    return await dbSalvarFoto(foto);

}





// FINANCEIRO


async function buscarFinanceiro(){

    return await dbBuscarFinanceiro();

}





// AGENDA


async function buscarAgenda(){

    return await dbBuscarAgenda();

}







// ==========================================================
// FUNÇÕES AUXILIARES
// ==========================================================



function dbFormatarMoeda(valor){


    return Number(valor || 0)
    .toLocaleString(
        "pt-BR",
        {
            style:"currency",
            currency:"BRL"
        }
    );


}





function dbFormatarData(data){


    if(!data){

        return "-";

    }



    return new Date(data)
    .toLocaleDateString(
        "pt-BR"
    );


}





function dbEscaparHTML(valor){


    return String(valor ?? "")

    .replaceAll("&","&amp;")

    .replaceAll("<","&lt;")

    .replaceAll(">","&gt;")

    .replaceAll('"',"&quot;")

    .replaceAll("'","&#039;");


}




// ==========================================================
// FIM DATABASE.JS
// ==========================================================
