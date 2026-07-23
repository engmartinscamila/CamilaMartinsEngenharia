// CONEXÃO SUPABASE

const SUPABASE_URL = "https://hghtwlopqztfcosfxafd.supabase.co";

const SUPABASE_KEY = "sb_publishable_-unXLR2NSSACLs01Sr60GA_uCFnJ74f";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);
