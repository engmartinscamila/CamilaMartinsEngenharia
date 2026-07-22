import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const SUPABASE_URL =
    "https://hghtwlopqztfcosfxafd.supabase.co";

export const SUPABASE_KEY =
    "sb_publishable_-unXLR2NSSACLs01Sr60GA_uCFnj74f";

export const ADMIN_UID =
    "5c9d7a0e-0495-4e96-8561-1d7f220be154";

export const TABELAS = {
    CLIENTES: "CLIENTES",
    DOCUMENTOS: "DOCUMENTOS",
    FOTOS: "FOTOS"
};

export const BUCKETS = {
    DOCUMENTOS: "DOCUMENTOS",
    FOTOS: "FOTOS"
};

export const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
            storageKey: "camila-martins-auth"
        }
    }
);
