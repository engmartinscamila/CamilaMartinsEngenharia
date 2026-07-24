/*
=====================================================
CAMILA MARTINS ENGENHARIA
STORAGE.JS - Helpers de upload/leitura de arquivos
=====================================================
Usado pelas páginas do portal do cliente que ainda não
carregam js/database.js (ex: cronograma.html).
=====================================================
*/

async function uploadArquivoStorage(bucket, caminho, arquivo) {
    const nomeBucket = (typeof resolverBucket === "function")
        ? resolverBucket(bucket)
        : bucket;

    const { data, error } = await supabaseClient
        .storage
        .from(nomeBucket)
        .upload(caminho, arquivo, { upsert: true });

    if (error) throw error;

    return data;
}

function obterUrlPublicaStorage(bucket, caminho) {
    const nomeBucket = (typeof resolverBucket === "function")
        ? resolverBucket(bucket)
        : bucket;

    const { data } = supabaseClient
        .storage
        .from(nomeBucket)
        .getPublicUrl(caminho);

    return data?.publicUrl || "";
}

async function removerArquivoStorage(bucket, caminho) {
    const nomeBucket = (typeof resolverBucket === "function")
        ? resolverBucket(bucket)
        : bucket;

    const { error } = await supabaseClient
        .storage
        .from(nomeBucket)
        .remove([caminho]);

    if (error) throw error;

    return true;
}
