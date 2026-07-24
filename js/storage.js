/*
=====================================================
CAMILA MARTINS ENGENHARIA
STORAGE.JS - Helpers de upload/leitura de arquivos
=====================================================
Usado pelas páginas administrativas que não carregam
js/database.js (ex: cronograma.html).
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

async function obterUrlPublicaStorage(bucket, caminho) {
    const nomeBucket = (typeof resolverBucket === "function")
        ? resolverBucket(bucket)
        : bucket;

    const { data, error } = await supabaseClient
        .storage
        .from(nomeBucket)
        .createSignedUrl(caminho, 3600);

    if (error) throw error;
    return data?.signedUrl || "";
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
