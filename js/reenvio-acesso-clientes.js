(function () {
  "use strict";

  const LISTA = "#listaClientes";
  const STYLE_ID = "reenvio-acesso-clientes-style";

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, function (char) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char];
    });
  }

  function adicionarEstilo() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .btn-reenviar-acesso {
        display:inline-flex;
        align-items:center;
        gap:6px;
        margin-left:6px;
      }
      .btn-reenviar-acesso:disabled { opacity:.65; cursor:wait; }
    `;
    document.head.appendChild(style);
  }

  async function obterClientes() {
    if (typeof window.dbBuscarClientes === "function") {
      return await window.dbBuscarClientes();
    }
    const { data, error } = await window.supabaseClient
      .from("clientes")
      .select("id,nome,email,auth_id")
      .order("nome");
    if (error) throw error;
    return data || [];
  }

  function identificarCliente(card, clientes) {
    const texto = (card.textContent || "").toLowerCase();
    const porEmail = clientes.find(function (cliente) {
      return cliente.email && texto.includes(String(cliente.email).toLowerCase());
    });
    if (porEmail) return porEmail;

    return clientes.find(function (cliente) {
      return cliente.nome && texto.includes(String(cliente.nome).toLowerCase());
    }) || null;
  }

  async function enviarConvite(cliente, botao) {
    const original = botao.innerHTML;
    if (!cliente?.id) return;

    if (!cliente.email) {
      alert("Este cliente não possui e-mail cadastrado.");
      return;
    }

    if (!confirm("Enviar/reenviar o acesso para " + cliente.nome + " (" + cliente.email + ")?")) {
      return;
    }

    botao.disabled = true;
    botao.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';

    try {
      const { data, error } = await window.supabaseClient.functions.invoke(
        "admin-invite-client",
        { body: { clientId: cliente.id } }
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.alreadyLinked) {
        alert("Este cliente já possui acesso vinculado. Nenhum novo convite foi enviado.");
      } else if (data?.invitationSent) {
        alert("Convite enviado com sucesso para " + cliente.email + ".");
      } else {
        alert(data?.message || "O acesso foi processado, mas nenhum novo convite foi enviado.");
      }
    } catch (error) {
      console.error("Erro ao enviar/reenviar acesso:", error);
      alert("Não foi possível enviar o acesso. " + (error?.message || ""));
    } finally {
      botao.disabled = false;
      botao.innerHTML = original;
    }
  }

  async function aplicarBotoes() {
    const lista = document.querySelector(LISTA);
    if (!lista || !window.supabaseClient) return;

    const cards = Array.from(lista.querySelectorAll(".item-cliente"));
    if (!cards.length) return;

    let clientes;
    try {
      clientes = await obterClientes();
    } catch (error) {
      console.error("Não foi possível carregar os clientes para o reenvio de acesso:", error);
      return;
    }

    cards.forEach(function (card) {
      if (card.querySelector(".btn-reenviar-acesso")) return;

      const cliente = identificarCliente(card, clientes);
      if (!cliente) return;

      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "btn-reenviar-acesso";
      botao.title = "Enviar ou reenviar acesso do cliente";
      botao.innerHTML = '<i class="fa-solid fa-envelope"></i> Reenviar acesso';
      botao.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        enviarConvite(cliente, botao);
      });

      const areaAcoes =
        card.querySelector(".item-acoes") ||
        card.querySelector(".acoes-item") ||
        card.querySelector(".acoes") ||
        card;

      areaAcoes.appendChild(botao);
    });
  }

  function iniciar() {
    adicionarEstilo();
    aplicarBotoes();

    const lista = document.querySelector(LISTA);
    if (!lista) return;

    const observer = new MutationObserver(function () {
      aplicarBotoes();
    });

    observer.observe(lista, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})();
