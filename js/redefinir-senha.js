const formulario =
    document.getElementById("formRedefinirSenha");

const novaSenha =
    document.getElementById("novaSenha");

const confirmarSenha =
    document.getElementById("confirmarSenha");

const mensagem =
    document.getElementById("mensagem");

const botaoSalvar =
    document.getElementById("botaoSalvar");

function mostrarMensagem(texto, tipo = "erro") {
    mensagem.textContent = texto;

    mensagem.style.color =
        tipo === "sucesso"
            ? "#9fd3a9"
            : "#d88a8a";
}

async function verificarRecuperacao() {
    const { data, error } =
        await window.supabaseClient.auth.getSession();

    if (!error && data.session) {
        botaoSalvar.disabled = false;
        return;
    }

    const sessaoRecuperada = await new Promise(resolve => {
        let assinatura;
        const temporizador = window.setTimeout(() => {
            assinatura?.unsubscribe();
            resolve(false);
        }, 2500);
        const { data: listener } =
            window.supabaseClient.auth.onAuthStateChange((evento, sessao) => {
                if (evento === "PASSWORD_RECOVERY" && sessao) {
                    window.clearTimeout(temporizador);
                    assinatura?.unsubscribe();
                    resolve(true);
                }
            });
        assinatura = listener.subscription;
    });

    if (!sessaoRecuperada) {
        mostrarMensagem(
            "O link é inválido ou expirou. Solicite um novo link."
        );

        botaoSalvar.disabled = true;
    }
}

formulario.addEventListener(
    "submit",
    async function (event) {
        event.preventDefault();

        mostrarMensagem("");

        if (novaSenha.value.length < 8) {
            mostrarMensagem(
                "A senha precisa ter pelo menos 8 caracteres."
            );

            return;
        }

        if (novaSenha.value !== confirmarSenha.value) {
            mostrarMensagem(
                "As senhas digitadas não são iguais."
            );

            return;
        }

        botaoSalvar.disabled = true;
        botaoSalvar.textContent = "Salvando...";

        const { error } =
            await window.supabaseClient.auth.updateUser({
                password: novaSenha.value
            });

        if (error) {
            console.error(error);

            mostrarMensagem(
                "Não foi possível alterar a senha. Solicite um novo link."
            );

            botaoSalvar.disabled = false;
            botaoSalvar.textContent = "Salvar nova senha";

            return;
        }

        mostrarMensagem(
            "Senha alterada com sucesso. Você será direcionado ao login.",
            "sucesso"
        );

        await window.supabaseClient.auth.signOut();

        setTimeout(function () {
            window.location.replace("login.html");
        }, 2000);
    }
);

verificarRecuperacao();
