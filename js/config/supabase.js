import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = "https://hghtwlopqztfcosfxafd.supabase.co";

const supabaseKey =
    "sb_publishable_-unXLR2NSSACLs01Sr60GA_uCFnJ74f";

export const supabase = createClient(
    supabaseUrl,
    supabaseKey
);
