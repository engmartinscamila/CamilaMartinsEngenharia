/*
=====================================================
CAMILA MARTINS ENGENHARIA
AUTH
=====================================================
*/
async function possuiSessao(){

   const { data } = await supabaseClient.auth.getSession();

    return !!data.session;

}

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



async function prepararLogin(){


    const formulario = document.querySelector("form");


    if(!formulario) return;



    formulario.addEventListener("submit", async(e)=>{


        e.preventDefault();



        const email = document.querySelector("#email").value;

        const senha = document.querySelector("#senha").value;



        const {data,error}=await supabaseClient.auth.signInWithPassword({

            email,

            password:senha

        });



        if(error){

            alert("Usuário ou senha incorretos");

            return;

        }



        location.href="admin.html";


    });


}




async function carregarNomeAdministrador(){


    const usuario = await supabaseClient.auth.getUser();


    const nome = document.querySelector("#nomeAdministrador");


    if(nome && usuario.data.user){

        nome.innerHTML = usuario.data.user.email;

    }


}
