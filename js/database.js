/*
==========================================================
CAMILA MARTINS ENGENHARIA
DATABASE - SUPABASE
==========================================================
*/


// ==========================================================
// CLIENTES
// ==========================================================


async function criarCliente(cliente){

    const { data, error } = await supabaseClient
        .from("clientes")
        .insert([cliente])
        .select();


    if(error) throw error;


    return data;

}



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



async function buscarCliente(id){

    const { data, error } = await supabaseClient
        .from("clientes")
        .select("*")
        .eq("id", id)
        .single();


    if(error) throw error;


    return data;

}



async function atualizarCliente(id, cliente){

    const { data, error } = await supabaseClient
        .from("clientes")
        .update(cliente)
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




// ==========================================================
// PROJETOS
// ==========================================================


async function criarProjeto(projeto){

    const { data, error } = await supabaseClient
        .from("projetos")
        .insert([projeto])
        .select();


    if(error) throw error;


    return data;

}



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



async function buscarProjeto(id){

    const { data, error } = await supabaseClient
        .from("projetos")
        .select("*")
        .eq("id", id)
        .single();


    if(error) throw error;


    return data;

}



async function atualizarProjeto(id, projeto){

    const { data, error } = await supabaseClient
        .from("projetos")
        .update(projeto)
        .eq("id", id)
        .select();


    if(error) throw error;


    return data;

}



async function removerProjeto(id){

    const { error } = await supabaseClient
        .from("projetos")
        .delete()
        .eq("id", id);


    if(error) throw error;

}
// ==========================================================
// DOCUMENTOS
// ==========================================================


async function criarDocumento(documento){

    const { data, error } = await supabaseClient
        .from("documentos")
        .insert([documento])
        .select();


    if(error) throw error;


    return data;

}



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



async function buscarDocumento(id){

    const { data, error } = await supabaseClient
        .from("documentos")
        .select("*")
        .eq("id", id)
        .single();


    if(error) throw error;


    return data;

}



async function atualizarDocumento(id, documento){

    const { data, error } = await supabaseClient
        .from("documentos")
        .update(documento)
        .eq("id", id)
        .select();


    if(error) throw error;


    return data;

}



async function removerDocumento(id){

    const { error } = await supabaseClient
        .from("documentos")
        .delete()
        .eq("id", id);


    if(error) throw error;

}




// ==========================================================
// FOTOS
// ==========================================================


async function criarFoto(foto){

    const { data, error } = await supabaseClient
        .from("fotos")
        .insert([foto])
        .select();


    if(error) throw error;


    return data;

}



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



async function removerFoto(id){

    const { error } = await supabaseClient
        .from("fotos")
        .delete()
        .eq("id", id);


    if(error) throw error;

}




// ==========================================================
// BIBLIOTECA
// ==========================================================


async function criarItemBiblioteca(item){

    const { data, error } = await supabaseClient
        .from("biblioteca")
        .insert([item])
        .select();


    if(error) throw error;


    return data;

}



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



async function removerItemBiblioteca(id){

    const { error } = await supabaseClient
        .from("biblioteca")
        .delete()
        .eq("id", id);


    if(error) throw error;

}
// ==========================================================
// CRONOGRAMA
// ==========================================================


async function criarCronograma(item){

    const { data, error } = await supabaseClient
        .from("cronograma")
        .insert([item])
        .select();


    if(error) throw error;


    return data;

}



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



async function atualizarCronograma(id, item){

    const { data, error } = await supabaseClient
        .from("cronograma")
        .update(item)
        .eq("id", id)
        .select();


    if(error) throw error;


    return data;

}



async function removerCronograma(id){

    const { error } = await supabaseClient
        .from("cronograma")
        .delete()
        .eq("id", id);


    if(error) throw error;

}




// ==========================================================
// FINANCEIRO
// ==========================================================


async function criarLancamentoFinanceiro(lancamento){

    const { data, error } = await supabaseClient
        .from("financeiro")
        .insert([lancamento])
        .select();


    if(error) throw error;


    return data;

}



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



async function atualizarLancamentoFinanceiro(id, lancamento){

    const { data, error } = await supabaseClient
        .from("financeiro")
        .update(lancamento)
        .eq("id", id)
        .select();


    if(error) throw error;


    return data;

}



async function removerLancamentoFinanceiro(id){

    const { error } = await supabaseClient
        .from("financeiro")
        .delete()
        .eq("id", id);


    if(error) throw error;

}




// ==========================================================
// AGENDA
// ==========================================================


async function criarEventoAgenda(evento){

    const { data, error } = await supabaseClient
        .from("agenda")
        .insert([evento])
        .select();


    if(error) throw error;


    return data;

}



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



async function atualizarEventoAgenda(id, evento){

    const { data, error } = await supabaseClient
        .from("agenda")
        .update(evento)
        .eq("id", id)
        .select();


    if(error) throw error;


    return data;

}



async function removerEventoAgenda(id){

    const { error } = await supabaseClient
        .from("agenda")
        .delete()
        .eq("id", id);


    if(error) throw error;

}
// ==========================================================
// CONFIGURAÇÕES
// ==========================================================


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




// ==========================================================
// STORAGE - DOCUMENTOS
// ==========================================================


async function uploadDocumento(arquivo, caminho){


    const { data, error } =
    await supabaseClient.storage
    .from("documentos")
    .upload(
        caminho,
        arquivo,
        {
            upsert:true
        }
    );


    if(error) throw error;


    return data.path;

}




// ==========================================================
// STORAGE - FOTOS
// ==========================================================


async function uploadFoto(arquivo, caminho){


    const { data, error } =
    await supabaseClient.storage
    .from("fotos")
    .upload(
        caminho,
        arquivo,
        {
            upsert:true
        }
    );


    if(error) throw error;


    return data.path;

}




// ==========================================================
// STORAGE - BIBLIOTECA
// ==========================================================


async function uploadBiblioteca(arquivo, caminho){


    const { data, error } =
    await supabaseClient.storage
    .from("biblioteca")
    .upload(
        caminho,
        arquivo,
        {
            upsert:true
        }
    );


    if(error) throw error;


    return data.path;

}




// ==========================================================
// URL PÚBLICA ARQUIVOS
// ==========================================================


function obterUrlArquivo(bucket, arquivo){


    const { data } =
    supabaseClient.storage
    .from(bucket)
    .getPublicUrl(arquivo);



    return data.publicUrl;

}




// ==========================================================
// REMOVER ARQUIVO STORAGE
// ==========================================================


async function removerArquivo(bucket, arquivo){


    const { data, error } =
    await supabaseClient.storage
    .from(bucket)
    .remove([
        arquivo
    ]);



    if(error) throw error;


    return data;

}
