(function () {
  "use strict";

  const LISTA = "#listaClientes";

  async function enviarConvite(cliente, botao) {
    const original = botao.innerHTML;
    try {
      if (!cliente || !cliente.email) {
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
      if (data && data.ok === false) throw new Error(data.message || "Falha no envio");

      alert("Link de acesso enviado para " + cliente.email + ".");
    } catch (error) {
      console.error("Erro ao enviar acesso:", error);
      alert("Não foi possível enviar o acesso.");
    } finally {
      botao.disabled = false;
      botao.innerHTML = original;
    }
  }

  async function aplicarBotoes() {
    const lista = document.querySelector(LISTA);
    if (!lista || !window.supabaseClient) return;

    let clientes = [];
    try {
      const resultado = await window.supabaseClient
        .from("clientes")
        .select("id,nome,email")
        .order("nome");

      if (resultado.error) throw resultado.error;
      clientes = resultado.data || [];
    } catch (error) {
      console.error("Erro ao buscar clientes:", error);
      return;
    }

    Array.from(lista.children).forEach((card) => {
      if (card.querySelector(".btn-reenviar-acesso")) return;

      const texto = (card.textContent || "").toLowerCase();
      const cliente = clientes.find((c) =>
        c.email && texto.includes(String(c.email).toLowerCase())
      );

      if (!cliente) return;

      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "btn-reenviar-acesso";
      botao.innerHTML = "✉ Reenviar acesso";
      botao.onclick = () => enviarConvite(cliente, botao);
      card.appendChild(botao);
    });
  }

  function iniciar() {
    aplicarBotoes();

    const lista = document.querySelector(LISTA);
    if (!lista) return;

    new MutationObserver(() => aplicarBotoes())
      .observe(lista, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})();