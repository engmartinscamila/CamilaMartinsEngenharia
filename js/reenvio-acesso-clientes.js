(function () {
  "use strict";

  async function enviarConvite(clientId, botao) {
    if (botao.disabled) return;
    const original = botao.textContent;
    botao.disabled = true;
    botao.textContent = "Enviando...";
    try {
      const { data, error } = await window.supabaseClient.functions.invoke(
        "admin-invite-client", { body: { clientId } }
      );
      if (error) {
        let detalhe;
        try { detalhe = await error.context?.json(); } catch (_) { /* Sem corpo JSON. */ }
        throw new Error(detalhe?.error || error.message || "Falha ao enviar o acesso.");
      }
      if (data?.invitationSent !== true) {
        throw new Error(data?.error || data?.message || "O envio não foi confirmado.");
      }
      alert("E-mail de acesso enviado. Verifique também a caixa de spam.");
    } catch (error) {
      console.error("Erro ao enviar acesso:", error);
      alert(error.message || "Não foi possível enviar o acesso. Tente novamente.");
    } finally {
      botao.disabled = false;
      botao.textContent = original;
    }
  }

  function iniciar() {
    const lista = document.querySelector("#listaClientes");
    if (!lista) return;
    function aplicarBotoes() {
      // Cards already identify the client by UUID; no extra query or email matching.
      lista.querySelectorAll("article[data-cliente-id]").forEach((card) => {
        if (card.querySelector(".btn-reenviar-acesso")) return;
        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = "btn-reenviar-acesso btn-secundario";
        botao.textContent = "✉ Reenviar e-mail de acesso";
        botao.addEventListener("click", () => enviarConvite(card.dataset.clienteId, botao));
        (card.querySelector(".item-acoes") || card).appendChild(botao);
      });
    }
    aplicarBotoes();
    new MutationObserver(aplicarBotoes).observe(lista, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})();
