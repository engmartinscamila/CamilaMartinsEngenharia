/*
=====================================================
CAMILA MARTINS ENGENHARIA
AUTENTICAÇÃO
=====================================================
*/

const PAGINAS_ADMINISTRATIVAS = new Set([
    "admin.html",
    "dashboard.html",
    "clientes.html",
    "projetos.html",
    "documentos.html",
    "biblioteca.html",
    "fotos.html",
    "financeiro.html",
    "agenda.html",
    "configuracoes.html",
    "cronograma.html",
    "solicitacoes.html"
]);

document.addEventListener("DOMContentLoaded", iniciarAuth);


function paginaAtual() {
    return location.pathname.split("/").pop() || "index.html";
}


async function obterSessao() {
    const { data, error } = await window.supabaseClient.auth.getSession();

    if (error) {
        console.error("Erro ao verificar sessão:", error);
        return null;
    }

    return data.session || null;
}


function destinoDaSessao(session) {
    return session?.user?.id === window.ADMIN_UID
        ? "admin.html"
        : "portal.html";
}


async function iniciarAuth() {
    const pagina = paginaAtual();

    if (pagina === "login.html") {
        prepararLogin();
        return;
    }

    const session = await obterSessao();

    if (!session) {
        location.replace("login.html");
        return;
    }

    if (
        PAGINAS_ADMINISTRATIVAS.has(pagina) &&
        session.user.id !== window.ADMIN_UID
    ) {
        location.replace("portal.html");
        return;
    }

    carregarNomeUsuario(session);
    configurarBotaoSair();
}


function prepararLogin() {
    const formulario = document.getElementById("loginForm");
    const campoEmail = document.getElementById("email");
    const campoSenha = document.getElementById("senha");
    const botaoEntrar = document.getElementById("loginButton");
    const mensagem = document.getElementById("formMessage");
    const botaoAlternarSenha = document.getElementById("togglePassword");
    const botaoRecuperarSenha = document.getElementById("forgotPassword");

    if (!formulario || !campoEmail || !campoSenha) return;

    const mostrarMensagem = (texto, tipo = "erro") => {
        if (!mensagem) return;
        mensagem.textContent = texto;
        mensagem.classList.toggle("success", tipo === "sucesso");
        mensagem.classList.toggle("error", tipo !== "sucesso");
    };

    botaoAlternarSenha?.addEventListener("click", () => {
        const senhaVisivel = campoSenha.type === "text";
        campoSenha.type = senhaVisivel ? "password" : "text";
        botaoAlternarSenha.setAttribute(
            "aria-label",
            senhaVisivel ? "Mostrar senha" : "Ocultar senha"
        );
    });

    botaoRecuperarSenha?.addEventListener("click", async event => {
        event.preventDefault();

        const email = campoEmail.value.trim();

        if (!email) {
            mostrarMensagem("Digite seu e-mail para recuperar a senha.");
            campoEmail.focus();
            return;
        }

        const redirectTo = new URL(
            "redefinir-senha.html",
            window.location.href
        ).href;

        const { error } =
            await window.supabaseClient.auth.resetPasswordForEmail(
                email,
                { redirectTo }
            );

        if (error) {
            console.error("Erro ao solicitar recuperação:", error);
            mostrarMensagem("Não foi possível enviar o link de recuperação.");
            return;
        }

        mostrarMensagem(
            "Enviamos o link de recuperação para o seu e-mail.",
            "sucesso"
        );
    });

    formulario.addEventListener("submit", async event => {
        event.preventDefault();
        mostrarMensagem("");

        if (botaoEntrar) {
            botaoEntrar.disabled = true;
        }

        const { data, error } =
            await window.supabaseClient.auth.signInWithPassword({
                email: campoEmail.value.trim(),
                password: campoSenha.value
            });

        if (error || !data.session) {
            mostrarMensagem("E-mail ou senha incorretos.");

            if (botaoEntrar) {
                botaoEntrar.disabled = false;
            }

            return;
        }

        location.replace(destinoDaSessao(data.session));
    });
}


function configurarBotaoSair() {
    const botao = document.querySelector("#logoutButton, #btnSair");

    if (!botao || botao.dataset.authBound === "true") return;

    botao.dataset.authBound = "true";
    botao.addEventListener("click", async () => {
        const { error } = await window.supabaseClient.auth.signOut();

        if (error) {
            console.error("Erro ao sair:", error);
            return;
        }

        location.replace("login.html");
    });
}


function carregarNomeUsuario(session) {
    const nome = document.querySelector(
        "#nomeAdministrador, #adminName, #topUserName"
    );

    if (nome) {
        nome.textContent =
            session.user.user_metadata?.nome ||
            session.user.email ||
            "Usuário";
    }
}
