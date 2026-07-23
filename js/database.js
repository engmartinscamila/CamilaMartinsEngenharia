/*
==========================================================
CAMILA MARTINS ENGENHARIA

DATABASE.JS
CAMADA CENTRAL DO SISTEMA

ADMIN
CLIENTES
PROJETOS
DOCUMENTOS
FOTOS
FINANCEIRO
AGENDA
CONFIGURAÇÕES

VERSÃO DEFINITIVA
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

        console.error(
            "Erro criar cliente:",
            error
        );

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

        console.error(
            "Erro buscar clientes:",
            error
        );

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

        console.error(
            "Erro buscar cliente:",
            error
        );

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

        console.error(
            "Erro editar cliente:",
            error
        );

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

        console.error(
            "Erro excluir cliente:",
            error
        );

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

        console.error(
            "Erro criar projeto:",
            error
        );

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

        console.error(
            "Erro buscar projetos:",
            error
        );

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

        console.error(
            "Erro buscar projeto:",
            error
        );

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

        console.error(
            "Erro buscar projetos cliente:",
            error
        );

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

        console.error(
            "Erro editar projeto:",
            error
        );

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

        console.error(
            "Erro excluir projeto:",
            error
        );

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

        console.error(
            "Erro salvar documento:",
            error
        );

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

        console.error(
            "Erro buscar documentos:",
            error
        );

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

        console.error(
            "Erro documentos cliente:",
            error
        );

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

        console.error(
            "Erro excluir documento:",
            error
        );

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

        console.error(
            "Erro salvar foto:",
            error
        );

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

        console.error(
            "Erro buscar fotos:",
            error
        );

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

        console.error(
            "Erro fotos projeto:",
            error
        );

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

        console.error(
            "Erro excluir foto:",
            error
        );

        throw error;

    }


    return true;

}







// ==========================================================
// STORAGE
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

        console.error(
            "Erro upload:",
            error
        );

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





async function dbExcluirArquivo(bucket,caminho){


    const {data,error} =
    await supabaseClient
    .storage
    .from(bucket)
    .remove([
        caminho
    ]);



    if(error){

        console.error(
            "Erro excluir arquivo:",
            error
        );

        throw error;

    }


    return data;

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

        console.error(
            "Erro salvar biblioteca:",
            error
        );

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

        console.error(
            "Erro buscar biblioteca:",
            error
        );

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

        console.error(
            "Erro excluir biblioteca:",
            error
        );

        throw error;

    }


    return true;

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



async function dbCriarEventoAgenda(evento){


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
    .select("*")
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





async function dbEditarEventoAgenda(id,evento){


    const {data,error} =
    await supabaseClient
    .from("agenda")
    .update(evento)
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





async function dbExcluirEventoAgenda(id){


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
// CONFIGURAÇÕES DA EMPRESA
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

        fotos


    ] = await Promise.all([


        dbBuscarClientes(),


        dbBuscarProjetos(),


        dbBuscarDocumentos(),


        dbBuscarFotos()


    ]);




    return {


        clientes:
        clientes.length,


        projetos:
        projetos.length,


        documentos:
        documentos.length,


        fotos:
        fotos.length


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



    return agenda
    .filter(evento=>{


        const dataEvento =
        new Date(evento.data);



        return dataEvento >= hoje;


    })
    .slice(
        0,
        5
    );


}






async function dbBuscarResumoDashboard(){


    const financeiro =
    await dbResumoFinanceiro();



    const totais =
    await dbDashboardTotais();




    return {


        ...totais,


        financeiro


    };


}
// ==========================================================
// AUTENTICAÇÃO / SESSÃO
// ==========================================================




async function dbObterUsuarioAtual(){


    const {data,error} =
    await supabaseClient
    .auth
    .getSession();



    if(error){

        console.error(
            "Erro obter sessão:",
            error
        );

        throw error;

    }



    return data.session;


}







async function dbUsuarioLogado(){


    const sessao =
    await dbObterUsuarioAtual();



    if(!sessao){

        return null;

    }



    return sessao.user;


}







async function dbSairSistema(){


    const {error} =
    await supabaseClient
    .auth
    .signOut();



    if(error){

        console.error(
            "Erro sair sistema:",
            error
        );

        throw error;

    }


    return true;


}







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
// FUNÇÕES AUXILIARES GERAIS
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
