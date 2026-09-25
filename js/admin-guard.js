/*
=====================================================
CAMILA MARTINS ENGENHARIA
GUARD DE AUTORIZAÇÃO ADMINISTRATIVA
=====================================================
*/

window.CMEAdminGuard = {
    async validar() {
        try {
            const { data: sessaoData } = await window.supabaseClient.auth.getSession();

            if (!sessaoData?.session) {
                location.replace("login.html");
                return false;
            }

            const { data, error } = await window.supabaseClient.rpc("is_portal_admin");

            if (error || data !== true) {
                location.replace("portal.html");
                return false;
            }

            return true;
        } catch (erro) {
            console.error("Falha no guard administrativo:", erro);
            location.replace("login.html");
            return false;
        }
    }
};
