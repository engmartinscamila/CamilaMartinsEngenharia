/*
====================================
CAMILA MARTINS ENGENHARIA
CONEXÃO SUPABASE
====================================
*/


const SUPABASE_URL = "https://hghtwlopqztfcosfxafd.supabase.co";


const SUPABASE_KEY = "sb_publishable_-unXLR2NSSACLs01Sr60GA_uCFnJ74f";


// Criar conexão global
window.supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


// Atalho global para os scripts antigos
window.supabaseDB = window.supabaseClient;


console.log("SUPABASE CONECTADO COM SUCESSO");
