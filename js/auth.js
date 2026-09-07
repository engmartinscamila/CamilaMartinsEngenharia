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
    "orcamentos-contratos.html",
    "documentos-contratuais.html",
    "arquivo-documental.html",
    "documentos.html",
    "biblioteca.html",
    "fotos.html",
    "financeiro.html",
    "agenda.html",
    "configuracoes.html",
    "cronograma.html",
    "solicitacoes.html",
    "protecao-pdf-admin.html"
]);

document.addEventListener("DOMContentLoaded", iniciarAuth);

function paginaAtual() {
    let pagina = location.pathname.split("/").filter(Boolean).pop() || "index.html";
    if (!pagina.includes(".")) pagina += ".html";
    return pagina.toLowerCase();
}

async function obterSessao() {
    const { data, error } = await window.supabaseClient.auth.getSession();
    if (error) {
        console.error("Erro ao verificar sessão:", error);
        return null;
    }
    return data.session || null;
}

async function usuarioEhAdmin() {
    try {
        const { data, error } = await window.supabaseClient.rpc("is_portal_admin");
        if (error) {
            console.error("Erro ao verificar autorização administrativa:", error);
            return false;
        }
        return data === true;
    } catch (error) {
        console.error("Falha ao verificar autorização administrativa:", error);
        return false;
    }
}

async function destinoDaSessao() {
    return (await usuarioEhAdmin()) ? "admin.html" : "portal.html";
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

    if (PAGINAS_ADMINISTRATIVAS.has(pagina)) {
        const autorizado = await usuarioEhAdmin();
        if (!autorizado) {
            location.replace("portal.html");
            return;
        }
    }

    carregarNomeUsuario(session);
    configurarBotaoSair();
}

function prepararLogin() {
    const formulario = document.getElementById("loginForm");
    const campoEmail = document.getElementById("email");
    const campoSenha = document.getElementById("senha");
    const grupoSenha = campoSenha?.closest(".form-group");
    const botaoEntrar = document.getElementById("loginButton");
    const mensagem = document.getElementById("formMessage");
    const botaoAlternarSenha = document.getElementById("togglePassword");
    const botaoRecuperarSenha = document.getElementById("forgotPassword");
    const botaoPrimeiroAcesso = document.getElementById("firstAccess");
    const grupoConfirmarSenha = document.getElementById("confirmarSenhaGroup");
    const campoConfirmarSenha = document.getElementById("confirmarSenha");
    const orientacaoSenha = document.getElementById("passwordSecurityAdvice");

    let modoPrimeiroAcesso = false;
    if (!formulario || !campoEmail || !campoSenha) return;

    const mostrarMensagem = (texto, tipo = "erro") => {
        if (!mensagem) return;
        mensagem.textContent = texto;
        mensagem.classList.toggle("success", tipo === "sucesso");
        mensagem.classList.toggle("error", tipo !== "sucesso");
    };

    const definirCarregamento = (ativo, textoTemporario = "Enviando...") => {
        if (!botaoEntrar) return;
        if (ativo) {
            botaoEntrar.dataset.textoAnterior = botaoEntrar.textContent || "Entrar";
            botaoEntrar.textContent = textoTemporario;
            botaoEntrar.disabled = true;
        } else {
            botaoEntrar.disabled = false;
            botaoEntrar.textContent = modoPrimeiroAcesso
                ? "Enviar link para criar senha"
                : "Entrar";
        }
    };

    const solicitarLinkSenha = async (email) => {
        try {
            const { data, error } = await window.supabaseClient.functions.invoke("client-password-link", {
                body: { email }
            });

            if (error || data?.ok === false) {
                console.error("Erro ao solicitar link de senha:", error || data);
                return {
                    ok: false,
                    mensagem: data?.message || "Não foi possível enviar o link agora. Tente novamente em alguns minutos."
                };
            }

            return {
                ok: true,
                mensagem: data?.message || "Se este e-mail estiver autorizado, enviaremos um link seguro para criar ou redefinir a senha. Verifique também a caixa de spam."
            };
        } catch (error) {
            console.error("Falha ao solicitar link de senha:", error);
            return {
                ok: false,
                mensagem: "Não foi possível enviar o link agora. Tente novamente em alguns minutos."
            };
        }
    };

    const aplicarModoPrimeiroAcesso = (ativo) => {
        modoPrimeiroAcesso = ativo;

        if (grupoSenha) grupoSenha.hidden = ativo;
        if (grupoConfirmarSenha) grupoConfirmarSenha.hidden = true;
        if (campoConfirmarSenha) {
            campoConfirmarSenha.required = false;
            campoConfirmarSenha.value = "";
        }

        campoSenha.required = !ativo;
        campoSenha.value = "";
        campoSenha.autocomplete = "current-password";

        if (orientacaoSenha) {
            orientacaoSenha.hidden = !ativo;
            if (ativo) {
                orientacaoSenha.innerHTML = '<i class="bi bi-shield-check" aria-hidden="true"></i><strong>Primeiro acesso seguro:</strong> informe o mesmo e-mail cadastrado pela engenheira. Você receberá um link pessoal para definir sua senha.';
            }
        }

        if (botaoEntrar) {
            botaoEntrar.disabled = false;
            botaoEntrar.textContent = ativo ? "Enviar link para criar senha" : "Entrar";
        }

        if (botaoPrimeiroAcesso) {
            botaoPrimeiroAcesso.textContent = ativo ? "Já tenho senha" : "Primeiro acesso: criar minha senha";
        }

        mostrarMensagem(
            ativo ? "Digite seu e-mail cadastrado e enviaremos o link seguro para criação da senha." : "",
            "sucesso"
        );
    };

    botaoAlternarSenha?.addEventListener("click", () => {
        const senhaVisivel = campoSenha.type === "text";
        campoSenha.type = senhaVisivel ? "password" : "text";
        botaoAlternarSenha.setAttribute("aria-label", senhaVisivel ? "Mostrar senha" : "Ocultar senha");
    });

    botaoPrimeiroAcesso?.addEventListener("click", (event) => {
        event.preventDefault();
        aplicarModoPrimeiroAcesso(!modoPrimeiroAcesso);
        campoEmail.focus();
    });

    botaoRecuperarSenha?.addEventListener("click", async (event) => {
        event.preventDefault();
        const email = campoEmail.value.trim();
        if (!email) {
            mostrarMensagem("Digite seu e-mail para recuperar a senha.");
            campoEmail.focus();
            return;
        }

        const textoOriginal = botaoRecuperarSenha.textContent;
        botaoRecuperarSenha.style.pointerEvents = "none";
        botaoRecuperarSenha.textContent = "Enviando link...";

        const resultado = await solicitarLinkSenha(email);
        mostrarMensagem(resultado.mensagem, resultado.ok ? "sucesso" : "erro");

        botaoRecuperarSenha.style.pointerEvents = "";
        botaoRecuperarSenha.textContent = textoOriginal;
    });

    formulario.addEventListener("submit", async (event) => {
        event.preventDefault();
        mostrarMensagem("");

        const email = campoEmail.value.trim();
        if (!email) {
            mostrarMensagem("Digite seu e-mail.");
            campoEmail.focus();
            return;
        }

        if (modoPrimeiroAcesso) {
            definirCarregamento(true, "Enviando link...");
            const resultado = await solicitarLinkSenha(email);
            mostrarMensagem(resultado.mensagem, resultado.ok ? "sucesso" : "erro");
            definirCarregamento(false);
            return;
        }

        definirCarregamento(true, "Entrando...");
        const { data, error } = await window.supabaseClient.auth.signInWithPassword({
            email,
            password: campoSenha.value
        });

        if (error || !data.session) {
            mostrarMensagem("E-mail ou senha incorretos.");
            definirCarregamento(false);
            return;
        }

        location.replace(await destinoDaSessao());
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
    const nome = document.querySelector("#nomeAdministrador, #adminName, #topUserName");
    if (nome) {
        nome.textContent = session.user.user_metadata?.nome || session.user.email || "Usuário";
    }
}
