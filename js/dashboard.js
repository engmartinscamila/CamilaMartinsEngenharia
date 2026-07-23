// ==========================================================
// DASHBOARD - FUNÇÕES DO SISTEMA
// ==========================================================


// TOTAL CLIENTES

async function dbContarClientes(){

    const { count, error } = await supabaseClient
    .from("clientes")
    .select("*", { count:"exact", head:true });


    if(error) throw error;


    return count || 0;

}




// TOTAL PROJETOS

async function dbContarProjetos(){

    const { count, error } = await supabaseClient
    .from("projetos")
    .select("*", { count:"exact", head:true });


    if(error) throw error;


    return count || 0;

}




// TOTAL DOCUMENTOS

async function dbContarDocumentos(){

    const { count, error } = await supabaseClient
    .from("documentos")
    .select("*", { count:"exact", head:true });


    if(error) throw error;


    return count || 0;

}




// TOTAL FOTOS

async function dbContarFotos(){

    const { count, error } = await supabaseClient
    .from("fotos")
    .select("*", { count:"exact", head:true });


    if(error) throw error;


    return count || 0;

}




// PROJETOS RECENTES

async function dbBuscarProjetosRecentes(){


    const { data, error } = await supabaseClient
    .from("projetos")
    .select(`
        id,
        nome,
        tipo,
        status,
        created_at,
        clientes(
            nome
        )
    `)
    .order("created_at",{ascending:false})
    .limit(5);



    if(error) throw error;



    return data || [];

}




// AGENDA PRÓXIMOS EVENTOS

async function dbBuscarAgenda(){


    const hoje =
    new Date()
    .toISOString()
    .split("T")[0];



    const { data, error } = await supabaseClient
    .from("agenda")
    .select("*")
    .gte("data",hoje)
    .order("data",{ascending:true})
    .limit(5);



    if(error) throw error;



    return data || [];

}




// RESUMO FINANCEIRO

async function dbResumoFinanceiro(){


    const { data, error } = await supabaseClient
    .from("financeiro")
    .select("tipo,valor");



    if(error) throw error;



    let entradas = 0;

    let saidas = 0;



    data.forEach(item=>{


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
