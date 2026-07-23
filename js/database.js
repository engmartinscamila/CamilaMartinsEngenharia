/*
==========================================================
CAMILA MARTINS ENGENHARIA
DATABASE
==========================================================
*/


// ===============================
// CLIENTES
// ===============================

async function buscarClientes(){

    const { data, error } = await supabaseClient
        .from("clientes")
        .select("*")
        .order("created_at", {
            ascending:false
        });


    if(error) throw error;

    return data || [];

}



async function criarCliente(cliente){

    const { data, error } = await supabaseClient
        .from("clientes")
        .insert([cliente])
        .select();


    if(error) throw error;

    return data;

}



async function atualizarCliente(id, dados){

    const { data, error } = await supabaseClient
        .from("clientes")
        .update(dados)
        .eq("id", id)
        .select();


    if(error) throw error;

    return data;

}



async function removerCliente(id){

    const { error } = await supabaseClient
        .from("clientes")
        .delete()
        .eq("id", id);


    if(error) throw error;

}




// ===============================
// PROJETOS
// ===============================


async function buscarProjetos(){

    const { data, error } = await supabaseClient
        .from("projetos")
        .select("*")
        .order("created_at", {
            ascending:false
        });


    if(error) throw error;

    return data || [];

}




async function criarProjeto(projeto){

    const { data, error } = await supabaseClient
        .from("projetos")
        .insert([projeto])
        .select();


    if(error) throw error;

    return data;

}
