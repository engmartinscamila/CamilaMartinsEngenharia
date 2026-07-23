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
// ===============================
// DOCUMENTOS
// ===============================

async function buscarDocumentos(){

    const { data, error } = await supabaseClient
        .from("documentos")
        .select("*")
        .order("created_at", {
            ascending:false
        });


    if(error) throw error;

    return data || [];

}



async function criarDocumento(documento){

    const { data, error } = await supabaseClient
        .from("documentos")
        .insert([documento])
        .select();


    if(error) throw error;

    return data;

}




// ===============================
// FOTOS
// ===============================


async function buscarFotos(){

    const { data, error } = await supabaseClient
        .from("fotos")
        .select("*")
        .order("created_at", {
            ascending:false
        });


    if(error) throw error;

    return data || [];

}



async function criarFoto(foto){

    const { data, error } = await supabaseClient
        .from("fotos")
        .insert([foto])
        .select();


    if(error) throw error;

    return data;

}




// ===============================
// BIBLIOTECA
// ===============================


async function buscarBiblioteca(){

    const { data, error } = await supabaseClient
        .from("biblioteca")
        .select("*")
        .order("created_at", {
            ascending:false
        });


    if(error) throw error;

    return data || [];

}



async function criarBiblioteca(item){

    const { data, error } = await supabaseClient
        .from("biblioteca")
        .insert([item])
        .select();


    if(error) throw error;

    return data;

}
// ===============================
// CRONOGRAMA
// ===============================

async function buscarCronograma(){

    const { data, error } = await supabaseClient
        .from("cronograma")
        .select("*")
        .order("created_at", {
            ascending:false
        });


    if(error) throw error;

    return data || [];

}



async function criarCronograma(item){

    const { data, error } = await supabaseClient
        .from("cronograma")
        .insert([item])
        .select();


    if(error) throw error;

    return data;

}




// ===============================
// FINANCEIRO
// ===============================

async function buscarFinanceiro(){

    const { data, error } = await supabaseClient
        .from("financeiro")
        .select("*")
        .order("created_at", {
            ascending:false
        });


    if(error) throw error;

    return data || [];

}



async function criarLancamentoFinanceiro(lancamento){

    const { data, error } = await supabaseClient
        .from("financeiro")
        .insert([lancamento])
        .select();


    if(error) throw error;

    return data;

}




// ===============================
// AGENDA
// ===============================

async function buscarAgenda(){

    const { data, error } = await supabaseClient
        .from("agenda")
        .select("*")
        .order("data", {
            ascending:true
        });


    if(error) throw error;

    return data || [];

}



async function criarEventoAgenda(evento){

    const { data, error } = await supabaseClient
        .from("agenda")
        .insert([evento])
        .select();


    if(error) throw error;

    return data;

}




// ===============================
// CONFIGURAÇÕES
// ===============================

async function buscarConfiguracoes(){

    const { data, error } = await supabaseClient
        .from("configuracoes")
        .select("*")
        .limit(1)
        .single();


    if(error) throw error;

    return data;

}



async function salvarConfiguracoes(config){

    const { data, error } = await supabaseClient
        .from("configuracoes")
        .upsert(config)
        .select();


    if(error) throw error;

    return data;

}
