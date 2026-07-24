/*
=====================================================
CAMILA MARTINS ENGENHARIA
DATABASE.JS - CAMADA DE ACESSO AOS DADOS (SUPABASE)
=====================================================
Camada única usada pelas páginas administrativas para
consultas, cadastros e arquivos do Supabase.
=====================================================
*/

function ocultarCarregamentoPagina() {
    const loading = document.getElementById("loading");

    if (loading) {
        loading.style.display = "none";
    }
}


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

async function dbBuscarProjetosCliente(clienteId) {

    const { data, error } = await supabaseClient
        .from(TABELAS.PROJETOS)
        .select("*")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false });

    if (error) throw error;

    return data || [];
}


async function dbBuscarDocumentosCliente(clienteId) {

    const { data, error } = await supabaseClient
        .from(TABELAS.DOCUMENTOS)
        .select("*")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false });

    if (error) throw error;

    return data || [];
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
        .select("*, clientes(nome)")
        .order("created_at", { ascending: false });

    if (error) throw error;

    return data || [];
}


async function dbBuscarProjetoPorId(id) {

    const { data, error } = await supabaseClient
        .from(TABELAS.PROJETOS)
        .select("*, clientes(nome)")
        .eq("id", id)
        .maybeSingle();

    if (error) throw error;

    return data;
}


async function dbCriarProjeto(dados) {

    const { data, error } = await supabaseClient
        .from(TABELAS.PROJETOS)
        .insert(dados)
        .select();

    if (error) throw error;

    return data;
}


async function dbEditarProjeto(id, dados) {

    const { data, error } = await supabaseClient
        .from(TABELAS.PROJETOS)
        .update(dados)
        .eq("id", id)
        .select();

    if (error) throw error;

    return data;
}


async function dbExcluirProjeto(id) {

    const { error } = await supabaseClient
        .from(TABELAS.PROJETOS)
        .delete()
        .eq("id", id);

    if (error) throw error;

    return true;
}


async function dbBuscarDocumentosProjeto(projetoId) {

    const { data, error } = await supabaseClient
        .from(TABELAS.DOCUMENTOS)
        .select("*")
        .eq("projeto_id", projetoId)
        .order("created_at", { ascending: false });

    if (error) throw error;

    return data || [];
}


async function dbBuscarFotosProjeto(projetoId) {

    const { data, error } = await supabaseClient
        .from(TABELAS.FOTOS)
        .select("*")
        .eq("projeto_id", projetoId)
        .order("created_at", { ascending: false });

    if (error) throw error;

    return dbAdicionarUrlsTemporarias(
        data || [],
        BUCKETS.FOTOS
    );
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

    return dbAdicionarUrlsTemporarias(
        data || [],
        BUCKETS.BIBLIOTECA
    );
}


async function dbSalvarArquivoBiblioteca(dados) {

    const { data, error } = await supabaseClient
        .from(TABELAS.BIBLIOTECA)
        .insert(dados)
        .select();

    if (error) throw error;

    return data;
}


async function dbEditarArquivoBiblioteca(id, dados) {

    const { data, error } = await supabaseClient
        .from(TABELAS.BIBLIOTECA)
        .update(dados)
        .eq("id", id)
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

    return dbAdicionarUrlsTemporarias(
        data || [],
        BUCKETS.DOCUMENTOS
    );
}


async function dbCriarDocumento(dados) {

    const { data, error } = await supabaseClient
        .from(TABELAS.DOCUMENTOS)
        .insert(dados)
        .select();

    if (error) throw error;

    return data;
}


async function dbEditarDocumento(id, dados) {

    const { data, error } = await supabaseClient
        .from(TABELAS.DOCUMENTOS)
        .update(dados)
        .eq("id", id)
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

    return dbAdicionarUrlsTemporarias(
        data || [],
        BUCKETS.FOTOS
    );
}


async function dbCriarFoto(dados) {

    const { data, error } = await supabaseClient
        .from(TABELAS.FOTOS)
        .insert(dados)
        .select();

    if (error) throw error;

    return data;
}


async function dbEditarFoto(id, dados) {

    const { data, error } = await supabaseClient
        .from(TABELAS.FOTOS)
        .update(dados)
        .eq("id", id)
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
        .order("data_inicio", { ascending: true });

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
// SOLICITAÇÕES
// ==========================================================

async function dbBuscarSolicitacoes() {

    const { data, error } = await supabaseClient
        .from(TABELAS.SOLICITACOES)
        .select("*, clientes(nome), projetos(nome)")
        .order("created_at", { ascending: false });

    if (error) throw error;

    return data || [];
}


async function dbCriarSolicitacao(dados) {

    const { data, error } = await supabaseClient
        .from(TABELAS.SOLICITACOES)
        .insert(dados)
        .select();

    if (error) throw error;

    return data;
}


async function dbEditarSolicitacao(id, dados) {

    const { data, error } = await supabaseClient
        .from(TABELAS.SOLICITACOES)
        .update(dados)
        .eq("id", id)
        .select();

    if (error) throw error;

    return data;
}


async function dbExcluirSolicitacao(id) {

    const { error } = await supabaseClient
        .from(TABELAS.SOLICITACOES)
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

    const bucketResolvido = resolverBucket(bucket);
    const { data, error } = await supabaseClient
        .storage
        .from(bucketResolvido)
        .upload(caminho, arquivo, {
            upsert: true,
            cacheControl: "3600",
            contentType: arquivo?.type || undefined
        });

    if (error) throw error;

    /*
    A confirmação só é exibida depois que o arquivo também pode ser lido.
    Isso evita o falso "carregado com sucesso" quando a gravação ocorreu,
    mas uma política do Storage impede a exibição no portal.
    */
    const signedUrl = await dbGerarUrlArquivo(
        bucketResolvido,
        caminho,
        21600
    );

    if (!signedUrl) {
        throw new Error(
            "O arquivo foi enviado, mas não pôde ser disponibilizado para leitura."
        );
    }

    return { ...data, signedUrl };
}


async function dbGerarUrlArquivo(bucket, caminho, validade = 21600) {

    if (!caminho) return "";

    const { data, error } = await supabaseClient
        .storage
        .from(resolverBucket(bucket))
        .createSignedUrl(caminho, validade);

    if (error) throw error;

    return data?.signedUrl || "";
}


async function dbAdicionarUrlsTemporarias(lista, bucket) {

    return Promise.all(
        (lista || []).map(async item => {
            if (!item.arquivo) {
                return { ...item, url: "", urlErro: "" };
            }

            try {
                return {
                    ...item,
                    url: await dbGerarUrlArquivo(bucket, item.arquivo),
                    urlErro: ""
                };
            }
            catch (error) {
                console.error(
                    `Arquivo indisponível no bucket ${resolverBucket(bucket)}:`,
                    item.arquivo,
                    error
                );

                return {
                    ...item,
                    url: "",
                    urlErro: error?.message || "Arquivo indisponível."
                };
            }
        })
    );
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
