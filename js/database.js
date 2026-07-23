// =====================================================
// CAMILA MARTINS ENGENHARIA
// DATABASE COMPLETO SUPABASE
// PARTE 1/3
// =====================================================


// =====================================================
// CLIENTES
// =====================================================


async function criarCliente(cliente){

    const { data, error } = await supabaseClient
        .from("clientes")
        .insert([cliente])
        .select();


    if(error){
        console.error(error);
        throw error;
    }


    return data;

}



async function buscarClientes(){

    const { data, error } = await supabaseClient
        .from("clientes")
        .select("*")
        .order("created_at", { ascending:false });


    if(error){
        console.error(error);
        return [];

    }


    return data;

}



async function buscarClientePorId(id){

    const { data, error } = await supabaseClient
        .from("clientes")
        .select("*")
        .eq("id", id)
        .single();


    if(error){
        console.error(error);
        return null;
    }


    return data;

}



async function editarCliente(id, cliente){

    const { data, error } = await supabaseClient
        .from("clientes")
        .update(cliente)
        .eq("id", id)
        .select();


    if(error){
        console.error(error);
        throw error;
    }


    return data;

}



async function excluirCliente(id){

    const { error } = await supabaseClient
        .from("clientes")
        .delete()
        .eq("id", id);


    if(error){
        console.error(error);
        throw error;
    }


    return true;

}




// =====================================================
// PROJETOS
// =====================================================



async function criarProjeto(projeto){

    const { data, error } = await supabaseClient
        .from("projetos")
        .insert([projeto])
        .select();


    if(error){
        console.error(error);
        throw error;
    }


    return data;

}



async function buscarProjetos(){

    const { data, error } = await supabaseClient
        .from("projetos")
        .select("*")
        .order("created_at",{ascending:false});


    if(error){
        console.error(error);
        return [];
    }


    return data;

}



async function buscarProjetosCliente(cliente_id){

    const { data, error } = await supabaseClient
        .from("projetos")
        .select("*")
        .eq("cliente_id", cliente_id);


    if(error){
        console.error(error);
        return [];
    }


    return data;

}



async function editarProjeto(id, projeto){

    const {data,error}=await supabaseClient
        .from("projetos")
        .update(projeto)
        .eq("id",id)
        .select();


    if(error){
        console.error(error);
        throw error;
    }


    return data;

}
// =====================================================
// DOCUMENTOS
// =====================================================


async function salvarDocumento(documento){

    const { data, error } = await supabaseClient
        .from("documentos")
        .insert([documento])
        .select();


    if(error){
        console.error(error);
        throw error;
    }


    return data;

}



async function buscarDocumentos(){

    const { data, error } = await supabaseClient
        .from("documentos")
        .select("*")
        .order("created_at",{ascending:false});


    if(error){
        console.error(error);
        return [];
    }


    return data;

}



async function buscarDocumentosCliente(cliente_id){

    const { data, error } = await supabaseClient
        .from("documentos")
        .select("*")
        .eq("cliente_id",cliente_id);


    if(error){
        console.error(error);
        return [];
    }


    return data;

}




// =====================================================
// FOTOS
// =====================================================



async function salvarFoto(foto){

    const { data, error } = await supabaseClient
        .from("fotos")
        .insert([foto])
        .select();


    if(error){
        console.error(error);
        throw error;
    }


    return data;

}



async function buscarFotos(){

    const { data, error } = await supabaseClient
        .from("fotos")
        .select("*")
        .order("created_at",{ascending:false});


    if(error){
        console.error(error);
        return [];
    }


    return data;

}



async function buscarFotosProjeto(projeto_id){

    const { data,error } = await supabaseClient
        .from("fotos")
        .select("*")
        .eq("projeto_id",projeto_id);


    if(error){
        console.error(error);
        return [];
    }


    return data;

}




// =====================================================
// BIBLIOTECA
// =====================================================



async function salvarArquivoBiblioteca(arquivo){

    const { data,error } = await supabaseClient
        .from("biblioteca")
        .insert([arquivo])
        .select();


    if(error){
        console.error(error);
        throw error;
    }


    return data;

}



async function buscarBiblioteca(){

    const { data,error } = await supabaseClient
        .from("biblioteca")
        .select("*")
        .order("created_at",{ascending:false});


    if(error){
        console.error(error);
        return [];
    }


    return data;

}




// =====================================================
// UPLOAD STORAGE
// =====================================================



async function uploadArquivo(bucket, caminho, arquivo){

    const { data,error } = await supabaseClient
        .storage
        .from(bucket)
        .upload(caminho,arquivo);


    if(error){
        console.error(error);
        throw error;
    }


    return data;

}



function pegarUrlArquivo(bucket,caminho){

    const { data } = supabaseClient
        .storage
        .from(bucket)
        .getPublicUrl(caminho);


    return data.publicUrl;

}
// =====================================================
// FINANCEIRO
// =====================================================


async function criarLancamentoFinanceiro(lancamento){

    const { data,error } = await supabaseClient
        .from("financeiro")
        .insert([lancamento])
        .select();


    if(error){
        console.error(error);
        throw error;
    }


    return data;

}



async function buscarFinanceiro(){

    const { data,error } = await supabaseClient
        .from("financeiro")
        .select("*")
        .order("created_at",{ascending:false});


    if(error){
        console.error(error);
        return [];
    }


    return data;

}





// =====================================================
// AGENDA
// =====================================================


async function criarEventoAgenda(evento){

    const { data,error } = await supabaseClient
        .from("agenda")
        .insert([evento])
        .select();


    if(error){
        console.error(error);
        throw error;
    }


    return data;

}



async function buscarAgenda(){

    const { data,error } = await supabaseClient
        .from("agenda")
        .select("*")
        .order("data",{ascending:true});


    if(error){
        console.error(error);
        return [];
    }


    return data;

}





// =====================================================
// CONFIGURAÇÕES
// =====================================================


async function buscarConfiguracoes(){

    const { data,error } = await supabaseClient
        .from("configuracoes")
        .select("*")
        .limit(1)
        .single();


    if(error){
        console.error(error);
        return null;
    }


    return data;

}



async function salvarConfiguracoes(config){

    const { data,error } = await supabaseClient
        .from("configuracoes")
        .upsert(config)
        .select();


    if(error){
        console.error(error);
        throw error;
    }


    return data;

}





// =====================================================
// SESSÃO / USUÁRIO
// =====================================================


async function possuiSessao(){

    const { data } = await supabaseClient
        .auth
        .getSession();


    return data.session;

}



async function sairSistema(){

    await supabaseClient
        .auth
        .signOut();

}
