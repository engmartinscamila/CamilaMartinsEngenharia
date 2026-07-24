/*
=====================================================
CAMILA MARTINS ENGENHARIA
SUPABASE - CONFIGURAÇÃO GLOBAL
=====================================================
*/

(function iniciarSupabase() {
    "use strict";

    const configuracao = {
        url: "https://hghtwlopqztfcosfxafd.supabase.co",
        chavePublica: "sb_publishable_-unXLR2NSSACLs01Sr60GA_uCFnJ74f",
        administradorId: "5c9d7a0e-0495-4e96-8561-1d7f220be154"
    };

    window.CM_CONFIG = window.CM_CONFIG || Object.freeze(configuracao);
    window.ADMIN_UID = window.ADMIN_UID || configuracao.administradorId;

    window.TABELAS = window.TABELAS || Object.freeze({
        CLIENTES: "clientes",
        AGENDA: "agenda",
        PROJETOS: "projetos",
        DOCUMENTOS: "documentos",
        FOTOS: "fotos",
        BIBLIOTECA: "biblioteca",
        FINANCEIRO: "financeiro",
        CONFIGURACOES: "configuracoes",
        CRONOGRAMA: "cronograma",
        SOLICITACOES: "solicitacoes"
    });

    /* Nomes exatos e sensíveis a maiúsculas dos buckets reais. */
    window.BUCKETS = window.BUCKETS || Object.freeze({
        DOCUMENTOS: "documentos",
        FOTOS: "fotos",
        BIBLIOTECA: "biblioteca"
    });

    if (!window.supabase || typeof window.supabase.createClient !== "function") {
        throw new Error("A biblioteca do Supabase não foi carregada.");
    }

    if (!window.supabaseClient) {
        window.supabaseClient = window.supabase.createClient(
            configuracao.url,
            configuracao.chavePublica
        );
    }
})();
