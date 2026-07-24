/*
=====================================================
CAMILA MARTINS ENGENHARIA
SUPABASE - INICIALIZAÇÃO DO CLIENTE GLOBAL
=====================================================
Este arquivo cria o cliente "supabaseClient" usado por
todos os outros scripts (auth.js, admin.js, clientes.js,
agenda.js, biblioteca.js, database.js, etc).

Precisa ser carregado DEPOIS da tag:
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
e ANTES de qualquer outro script que use supabaseClient.
=====================================================
*/

const SUPABASE_URL = "https://hghtwlopqztfcosfxafd.supabase.co";
const SUPABASE_KEY = "sb_publishable_-unXLR2NSSACLs01Sr60GA_uCFnJ74f";

// UID do administrador (usado para checagens de permissão, se necessário)
const ADMIN_UID = "5c9d7a0e-0495-4e96-8561-1d7f220be154";

// Nomes das tabelas no banco (ajuste aqui se os nomes reais no Supabase forem diferentes)
const TABELAS = {
    CLIENTES: "clientes",
    AGENDA: "agenda",
    PROJETOS: "projetos",
    DOCUMENTOS: "documentos",
    FOTOS: "fotos",
    BIBLIOTECA: "biblioteca",
    FINANCEIRO: "financeiro",
    CONFIGURACOES: "configuracoes",
    CRONOGRAMA: "cronograma"
};

// Nomes dos buckets de Storage (ajuste aqui se os nomes reais no Supabase forem diferentes)
const BUCKETS = {
    DOCUMENTOS: "documentos",
    FOTOS: "fotos",
    BIBLIOTECA: "biblioteca"
};

// "supabase" aqui é o objeto global criado pelo script do jsdelivr (UMD)
const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);
