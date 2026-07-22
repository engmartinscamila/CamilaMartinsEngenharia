/*
==========================================================
CAMILA MARTINS ENGENHARIA
SUPABASE
==========================================================
*/

const SUPABASE_URL = "COLE_AQUI_SUA_URL_DO_SUPABASE";

const SUPABASE_ANON_KEY = "COLE_AQUI_SUA_CHAVE_ANON";

const supabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
        auth:{

            persistSession:true,

            autoRefreshToken:true,

            detectSessionInUrl:true

        }
    }
);

/*
==========================================================
USUÁRIO LOGADO
==========================================================
*/

async function getUsuario(){

    const { data, error } = await supabase.auth.getUser();

    if(error){

        console.error(error);

        return null;

    }

    return data.user;

}

/*
==========================================================
SESSÃO
==========================================================
*/

async function possuiSessao(){

    const { data } = await supabase.auth.getSession();

    return data.session !== null;

}

/*
==========================================================
LOGOUT
==========================================================
*/

async function logout(){

    await supabase.auth.signOut();

    location.href="login.html";

}

/*
==========================================================
FORMATAR DATA
==========================================================
*/

function formatarData(data){

    if(!data) return "";

    return new Date(data).toLocaleDateString(
        "pt-BR"
    );

}

/*
==========================================================
FORMATAR DINHEIRO
==========================================================
*/

function dinheiro(valor){

    return Number(valor || 0).toLocaleString(
        "pt-BR",
        {

            style:"currency",

            currency:"BRL"

        }
    );

}

/*
==========================================================
UPLOAD DOCUMENTOS
==========================================================
*/

async function uploadDocumento(arquivo,nome){

    const{

        data,

        error

    } = await supabase.storage
    .from("documentos")
    .upload(nome,arquivo,{

        upsert:true

    });

    if(error) throw error;

    return data.path;

}

/*
==========================================================
UPLOAD FOTOS
==========================================================
*/

async function uploadFoto(arquivo,nome){

    const{

        data,

        error

    } = await supabase.storage
    .from("fotos")
    .upload(nome,arquivo,{

        upsert:true

    });

    if(error) throw error;

    return data.path;

}

/*
==========================================================
UPLOAD BIBLIOTECA
==========================================================
*/

async function uploadBiblioteca(arquivo,nome){

    const{

        data,

        error

    } = await supabase.storage
    .from("biblioteca")
    .upload(nome,arquivo,{

        upsert:true

    });

    if(error) throw error;

    return data.path;

}

/*
==========================================================
DOWNLOAD
==========================================================
*/

async function urlPublica(bucket,arquivo){

    return supabase
    .storage
    .from(bucket)
    .getPublicUrl(arquivo)
    .data
    .publicUrl;

}

/*
==========================================================
REMOVER ARQUIVO
==========================================================
*/

async function removerArquivo(bucket,arquivo){

    return await supabase
    .storage
    .from(bucket)
    .remove([arquivo]);

}
);
