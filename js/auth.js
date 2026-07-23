/*
==========================================================
CAMILA MARTINS ENGENHARIA
AUTH
==========================================================
*/

const supabase = window.supabase.createClient(
    "https://hghtwlopqztfcosxfafd.supabase.co",
    "sb_publishable_-unXLR2NSSACLs01Sr60GA_uCFnJ74f"
);

document.addEventListener("DOMContentLoaded", () => {

    iniciarAuth();

});

async function iniciarAuth(){

    const pagina = location.pathname.split("/").pop();

    if(pagina === "login.html"){

        prepararLogin();

        return;

    }

    const possui = await possuiSessao();

    if(!possui){

        location.href = "login.html";

        return;

    }

    carregarNomeAdministrador();

}

async function carregarNomeAdministrador(){

    const usuario = await getUsuario();

    if(!usuario) return;

    const nome = usuario.user_metadata?.nome
        || usuario.user_metadata?.name
        || usuario.email
        || "Administrador";

    const campo = document.getElementById("adminName");

    if(campo){

        campo.textContent = nome;

    }

}

function prepararLogin(){

    const form = document.getElementById("loginForm");

    if(!form) return;

    form.addEventListener("submit", fazerLogin);

}

async function fazerLogin(event){

    event.preventDefault();

    const email = document.getElementById("email").value.trim();

    const senha = document.getElementById("senha").value;

    try{

        const { error } = await supabase.auth.signInWithPassword({

            email,

            password:senha

        });

        if(error){

            alert(error.message);

            return;

        }

        location.href="admin.html";

    }

    catch(erro){

        console.error(erro);

        alert("Erro ao realizar login.");

    }

}

async function sair(){

    await logout();

}
