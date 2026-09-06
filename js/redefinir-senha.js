/*
=====================================================
CAMILA MARTINS ENGENHARIA
REDEFINIÇÃO DE SENHA
=====================================================
*/

const formulario = document.getElementById("formRedefinirSenha");
const novaSenha = document.getElementById("novaSenha");
const confirmarSenha = document.getElementById("confirmarSenha");
const mensagem = document.getElementById("mensagem");
const botaoSalvar = document.getElementById("botaoSalvar");

function mostrarMensagem(texto, tipo = "erro") {
    if (!mensagem) return;
    mensagem.textContent = texto;
    mensagem.style.color = tipo === "sucesso" ? "#9fd3a9" : "#d88a8a";
}

function habilitarFormulario(habilitado) {
    if (novaSenha) novaSenha.disabled = !habilitado;
    if (confirmarSenha) confirmarSenha.disabled = !habilitado;
    if (botaoSalvar) botaoSalvar.disabled = !habilitado;
}

async function ativarRecuperacao() {
    if (!window.supabaseClient) {
        mostrarMensagem("Não foi possível iniciar a recuperação de senha. Atualize a página e tente novamente.");
        habilitarFormulario(false);
        return false;
    }

    habilitarFormulario(false);
    mostrarMensagem("Validando seu link seguro...", "sucesso");

    const parametros = new URLSearchParams(window.location.search);
    const tokenHash = parametros.get("token_hash");
    const tipo = parametros.get("type");

    if (tokenHash && tipo === "recovery") {
        const { data, error } = await window.supabaseClient.auth.verifyOtp({
            token_hash: tokenHash,
            type: "recovery"
        });

        if (error || !data?.session) {
            console.error("Link de recuperação inválido ou expirado:", error);
            mostrarMensagem("Este link é inválido ou expirou. Volte ao login e solicite um novo link.");
            habilitarFormulario(false);
            return false;
        }

        const urlLimpa = `${window.location.pathname}`;
        window.history.replaceState({}, document.title, urlLimpa);
        habilitarFormulario(true);
        mostrarMensagem("Link validado. Agora crie sua nova senha.", "sucesso");
        novaSenha?.focus();
        return true;
    }

    const { data, error } = await window.supabaseClient.auth.getSession();
    if (!error && data?.session) {
        habilitarFormulario(true);
        mostrarMensagem("Crie sua nova senha.", "sucesso");
        novaSenha?.focus();
        return true;
    }

    const recuperacaoRecebida = await new Promise((resolver) => {
        let subscription;
        const timer = window.setTimeout(() => {
            subscription?.unsubscribe();
            resolver(false);
        }, 2500);

        const { data } = window.supabaseClient.auth.onAuthStateChange((evento, sessao) => {
            if (evento === "PASSWORD_RECOVERY" && sessao) {
                window.clearTimeout(timer);
                subscription?.unsubscribe();
                resolver(true);
            }
        });

        subscription = data.subscription;
    });

    if (recuperacaoRecebida) {
        habilitarFormulario(true);
        mostrarMensagem("Link validado. Agora crie sua nova senha.", "sucesso");
        novaSenha?.focus();
        return true;
    }

    mostrarMensagem("Este link é inválido ou expirou. Volte ao login e solicite um novo link.");
    habilitarFormulario(false);
    return false;
}

formulario?.addEventListener("submit", async (event) => {
    event.preventDefault();
    mostrarMensagem("");

    if (!novaSenha || !confirmarSenha || !botaoSalvar) return;

    if (novaSenha.value.length < 8) {
        mostrarMensagem("A senha deve ter pelo menos 8 caracteres.");
        novaSenha.focus();
        return;
    }

    if (novaSenha.value !== confirmarSenha.value) {
        mostrarMensagem("As senhas digitadas não são iguais.");
        confirmarSenha.focus();
        return;
    }

    botaoSalvar.disabled = true;
    botaoSalvar.textContent = "Salvando...";

    const { error } = await window.supabaseClient.auth.updateUser({
        password: novaSenha.value
    });

    if (error) {
        console.error("Erro ao redefinir senha:", error);
        mostrarMensagem("Não foi possível salvar a nova senha. Solicite um novo link e tente novamente.");
        botaoSalvar.disabled = false;
        botaoSalvar.textContent = "Salvar nova senha";
        return;
    }

    mostrarMensagem("Senha criada com sucesso. Você será direcionado para o login.", "sucesso");
    botaoSalvar.textContent = "Senha salva";

    window.setTimeout(async () => {
        await window.supabaseClient.auth.signOut().catch(() => {});
        window.location.replace("login.html");
    }, 1400);
});

ativarRecuperacao();
