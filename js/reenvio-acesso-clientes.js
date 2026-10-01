(function () {
  "use strict";

  const LISTA = "#listaClientes";

  async function enviarConvite(cliente, botao) {
    const original = botao.innerHTML;
    try {
      if (!cliente?.email) {
        alert("Este cliente não possui e-mail cadastrado.");
        return;
      }

      botao.disabled = true;
      botao.innerHTML = "Enviando...";

      const { data, error } = await window.supabaseClient.functions.invoke(
        "client-password-link",
        { body: { email: cliente.email } }
      );

      if (error) throw error;
      if (data?.ok === false) throw new Error(data.message || "Falha no envio");

      alert("Link de acesso enviado para " + cliente.email + ".");
    } catch (error) {
      console.error(error);
      alert("Não foi possível enviar o acesso.");
    } finally {
      botao.disabled = false;
      botao.innerHTML = original;
    }
  }

  async function iniciar() {
    const lista = document.querySelector(LISTA);
    if (!lista || !window.supabaseClient) return;

    const { data: clientes } = await window.supabaseClient
      .from("clientes")
      .select("id,nome,email")
      .order("nome");

    Array.from(lista.children).forEach((card) => {
      const texto = (card.textContent || "").toLowerCase();
      const cliente = (clientes || []).find(c =>
        c.email && texto.includes(c.email.toLowerCase())
      );
      if (!cliente || card.querySelector(".btn-reenviar-acesso")) return;

      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "btn-reenviar-acesso";
      botao.innerHTML = "✉ Reenviar acesso";
      botao.onclick = () => enviarConvite(cliente, botao);
      card.appendChild(botao);
    });
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", iniciar)
    : iniciar();
})();