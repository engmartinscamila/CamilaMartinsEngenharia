import {
    supabase,
    ADMIN_UID
} from "./config/supabase.js";

const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");
const formMessage = document.getElementById("formMessage");
const forgotPassword = document.getElementById("forgotPassword");
const loginButton = loginForm?.querySelector('button[type="submit"]');

function mostrarMensagem(mensagem, tipo = "erro") {
    if (!formMessage) return;

    formMessage.textContent = mensagem;

    formMessage.style.color =
        tipo === "sucesso"
            ? "#9fd3a9"
            : "#d88a8a";
}

function alterarCarregamento(ativo) {
    if (!loginButton) return;

    loginButton.disabled = ativo;
    loginButton.textContent = ativo
        ? "Entrando..."
        : "Entrar";
}

async function verificarSessaoExistente() {
    const { data, error } =
        await supabase.auth.getSession();

    if (error || !data.session) return;

    const usuario = data.session.user;

    window.location.replace(
        usuario.id === ADMIN_UID
            ? "admin.html"
            : "portal.html"
    );
}

if (togglePassword && passwordInput) {
    togglePassword.addEventListener("click", function () {
        const mostrar =
            passwordInput.type === "password";

        passwordInput.type =
            mostrar ? "text" : "password";

        const icon =
            togglePassword.querySelector("i");

        if (icon) {
            icon.className =
                mostrar
                    ? "bi bi-eye-slash"
                    : "bi bi-eye";
        }
    });
}

if (loginForm) {
    loginForm.addEventListener(
        "submit",
        async function (event) {
            event.preventDefault();

            mostrarMensagem("");
            alterarCarregamento(true);

            const email =
                emailInput.value.trim();

            const password =
                passwordInput.value;

            try {
                const { data, error } =
                    await supabase.auth.signInWithPassword({
                        email,
                        password
                    });

                if (error) {
                    mostrarMensagem(
                        "E-mail ou senha inválidos."
                    );
                    return;
                }

                const usuario = data.user;

                window.location.replace(
                    usuario.id === ADMIN_UID
                        ? "admin.html"
                        : "portal.html"
                );

            } catch (error) {
                console.error(error);

                mostrarMensagem(
                    "Não foi possível entrar. Tente novamente."
                );

            } finally {
                alterarCarregamento(false);
            }
        }
    );
}

if (forgotPassword) {
    forgotPassword.addEventListener(
        "click",
        async function (event) {
            event.preventDefault();

            const email = emailInput.value.trim();

            if (!email) {
                mostrarMensagem(
                    "Digite seu e-mail para receber o link de recuperação."
                );

                emailInput.focus();
                return;
            }

            mostrarMensagem(
                "Enviando link de recuperação...",
                "sucesso"
            );

            const { error } =
                await supabase.auth.resetPasswordForEmail(
                    email,
                    {
                        redirectTo:
                            "https://camilamartinsengenharia.com.br/redefinir-senha.html"
                    }
                );

            if (error) {
                console.log("ERRO COMPLETO:", error);
                alert(JSON.stringify(error, null, 2));

                mostrarMensagem(
                    "Não foi possível enviar o e-mail."
                );

                return;
            }

            mostrarMensagem(
                "Link enviado! Verifique sua caixa de entrada.",
                "sucesso"
            );
        }
    );
}

verificarSessaoExistente();
