/*
=====================================================
CAMILA MARTINS ENGENHARIA
DATABASE.JS - CAMADA DE ACESSO AOS DADOS (SUPABASE)
=====================================================
Reconstruído a partir do uso real dessas funções em
clientes.js, agenda.js, biblioteca.js e admin.js.

IMPORTANTE: os nomes de tabelas/buckets abaixo (em
TABELAS e BUCKETS, definidos em js/supabase.js) são um
"melhor palpite" com base no padrão do restante do
código. Confira no seu painel do Supabase se os nomes
reais das tabelas/buckets batem com esses valores e
ajuste em js/supabase.js se necessário.
=====================================================
*/


function resolverBucket(nome) {
    const chave = String(nome || "").toUpperCase();
    return BUCKETS[chave] || nome;
}


// ==========================================================
// CLIENTES
// ==========================================================

async function dbBuscarClientes() {

    const { data, error } = await supabaseClient
        .from(TABELAS.CLIENTES)
        .select("*")
        .order("created_at", { ascending: false });

    if (error) throw error;

    return data;
}


async function dbCriarCliente(dados) {

    const { data, error } = await supabaseClient
        .from(TABELAS.CLIENTES)
        .insert(dados)
        .select();

    if (error) throw error;

    return data;
}


async function dbEditarCliente(id, dados) {

    const { data, error } = await supabaseClient
        .from(TABELAS.CLIENTES)
        .update(dados)
        .eq("id", id)
        .select();

    if (error) throw error;

    return data;
}


async function dbExcluirCliente(id) {

    const { error } = await supabaseClient
        .from(TABELAS.CLIENTES)
        .delete()
        .eq("id", id);

    if (error) throw error;

    return true;
}


// ==========================================================
// AGENDA
// ==========================================================

async function dbBuscarAgenda() {

    const { data, error } = await supabaseClient
        .from(TABELAS.AGENDA)
        .select("*")
        .order("data", { ascending: true });

    if (error) throw error;

    return data;
}


async function dbCriarEventoAgenda(dados) {

    const { data, error } = await supabaseClient
        .from(TABELAS.AGENDA)
        .insert(dados)
        .select();

    if (error) throw error;

    return data;
}


async function dbEditarEventoAgenda(id, dados) {

    const { data, error } = await supabaseClient
        .from(TABELAS.AGENDA)
        .update(dados)
        .eq("id", id)
        .select();

    if (error) throw error;

    return data;
}


async function dbExcluirEventoAgenda(id) {

    const { error } = await supabaseClient
        .from(TABELAS.AGENDA)
        .delete()
        .eq("id", id);

    if (error) throw error;

    return true;
}


// ==========================================================
// PROJETOS (usado no dropdown da agenda, por exemplo)
// ==========================================================

async function dbBuscarProjetos() {

    const { data, error } = await supabaseClient
        .from(TABELAS.PROJETOS)
        .select("*")
        .order("created_at", { ascending: false });

    if (error) throw error;

    return data;
}


// ==========================================================
// BIBLIOTECA (arquivos)
// ==========================================================

async function dbBuscarBiblioteca() {

    const { data, error } = await supabaseClient
        .from(TABELAS.BIBLIOTECA)
        .select("*")
        .order("created_at", { ascending: false });

    if (error) throw error;

    return data;
}


async function dbSalvarArquivoBiblioteca(dados) {

    const { data, error } = await supabaseClient
        .from(TABELAS.BIBLIOTECA)
        .insert(dados)
        .select();

    if (error) throw error;

    return data;
}


async function dbExcluirArquivoBiblioteca(id) {

    const { error } = await supabaseClient
        .from(TABELAS.BIBLIOTECA)
        .delete()
        .eq("id", id);

    if (error) throw error;

    return true;
}


// ==========================================================
// DOCUMENTOS
// ==========================================================

async function dbBuscarDocumentos() {

    const { data, error } = await supabaseClient
        .from(TABELAS.DOCUMENTOS)
        .select("*")
        .order("created_at", { ascending: false });

    if (error) throw error;

    return data;
}


async function dbCriarDocumento(dados) {

    const { data, error } = await supabaseClient
        .from(TABELAS.DOCUMENTOS)
        .insert(dados)
        .select();

    if (error) throw error;

    return data;
}


async function dbExcluirDocumento(id) {

    const { error } = await supabaseClient
        .from(TABELAS.DOCUMENTOS)
        .delete()
        .eq("id", id);

    if (error) throw error;

    return true;
}


// ==========================================================
// FOTOS
// ==========================================================

async function dbBuscarFotos() {

    const { data, error } = await supabaseClient
        .from(TABELAS.FOTOS)
        .select("*")
        .order("created_at", { ascending: false });

    if (error) throw error;

    return data;
}


async function dbCriarFoto(dados) {

    const { data, error } = await supabaseClient
        .from(TABELAS.FOTOS)
        .insert(dados)
        .select();

    if (error) throw error;

    return data;
}


async function dbExcluirFoto(id) {

    const { error } = await supabaseClient
        .from(TABELAS.FOTOS)
        .delete()
        .eq("id", id);

    if (error) throw error;

    return true;
}


// ==========================================================
// FINANCEIRO
// ==========================================================

async function dbBuscarFinanceiro() {

    const { data, error } = await supabaseClient
        .from(TABELAS.FINANCEIRO)
        .select("*")
        .order("data", { ascending: false });

    if (error) throw error;

    return data;
}


async function dbCriarLancamentoFinanceiro(dados) {

    const { data, error } = await supabaseClient
        .from(TABELAS.FINANCEIRO)
        .insert(dados)
        .select();

    if (error) throw error;

    return data;
}


async function dbEditarLancamentoFinanceiro(id, dados) {

    const { data, error } = await supabaseClient
        .from(TABELAS.FINANCEIRO)
        .update(dados)
        .eq("id", id)
        .select();

    if (error) throw error;

    return data;
}


async function dbExcluirLancamentoFinanceiro(id) {

    const { error } = await supabaseClient
        .from(TABELAS.FINANCEIRO)
        .delete()
        .eq("id", id);

    if (error) throw error;

    return true;
}


// ==========================================================
// CRONOGRAMA (etapas de obra)
// ==========================================================

async function dbBuscarCronograma() {

    const { data, error } = await supabaseClient
        .from(TABELAS.CRONOGRAMA)
        .select("*")
        .order("inicio", { ascending: true });

    if (error) throw error;

    return data;
}


async function dbCriarEtapaCronograma(dados) {

    const { data, error } = await supabaseClient
        .from(TABELAS.CRONOGRAMA)
        .insert(dados)
        .select();

    if (error) throw error;

    return data;
}


async function dbEditarEtapaCronograma(id, dados) {

    const { data, error } = await supabaseClient
        .from(TABELAS.CRONOGRAMA)
        .update(dados)
        .eq("id", id)
        .select();

    if (error) throw error;

    return data;
}


async function dbExcluirEtapaCronograma(id) {

    const { error } = await supabaseClient
        .from(TABELAS.CRONOGRAMA)
        .delete()
        .eq("id", id);

    if (error) throw error;

    return true;
}


// ==========================================================
// CONFIGURAÇÕES (linha única com os dados da empresa/sistema)
// ==========================================================

async function dbBuscarConfiguracoes() {

    const { data, error } = await supabaseClient
        .from(TABELAS.CONFIGURACOES)
        .select("*")
        .limit(1)
        .maybeSingle();

    if (error) throw error;

    return data;
}


async function dbSalvarConfiguracoes(dados) {

    const existente = await dbBuscarConfiguracoes();

    if (existente && existente.id) {

        const { data, error } = await supabaseClient
            .from(TABELAS.CONFIGURACOES)
            .update(dados)
            .eq("id", existente.id)
            .select();

        if (error) throw error;

        return data;
    }

    const { data, error } = await supabaseClient
        .from(TABELAS.CONFIGURACOES)
        .insert(dados)
        .select();

    if (error) throw error;

    return data;
}


// ==========================================================
// STORAGE (upload, url e exclusão de arquivos)
// ==========================================================

async function dbUploadArquivo(bucket, caminho, arquivo) {

    const { data, error } = await supabaseClient
        .storage
        .from(resolverBucket(bucket))
        .upload(caminho, arquivo, { upsert: true });

    if (error) throw error;

    return data;
}


function dbGerarUrlArquivo(bucket, caminho) {

    const { data } = supabaseClient
        .storage
        .from(resolverBucket(bucket))
        .getPublicUrl(caminho);

    return data?.publicUrl || "";
}


async function dbExcluirArquivoStorage(bucket, caminho) {

    const { error } = await supabaseClient
        .storage
        .from(resolverBucket(bucket))
        .remove([caminho]);

    if (error) throw error;

    return true;
}


// ==========================================================
// SESSÃO
// ==========================================================

async function dbSairSistema() {

    const { error } = await supabaseClient.auth.signOut();

    if (error) throw error;

    location.href = "login.html";
}
