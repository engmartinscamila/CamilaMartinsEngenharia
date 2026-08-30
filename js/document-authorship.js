(function () {
    "use strict";

    const paginasCliente = new Set([
        "documentos-cliente.html",
        "biblioteca-cliente.html"
    ]);

    function paginaAtual() {
        return (location.pathname.split("/").pop() || "").toLowerCase();
    }

    function checkboxAtual() {
        return document.getElementById("documentoAutoral")
            || document.getElementById("arquivoAutoral");
    }

    function valorAutoral() {
        return Boolean(checkboxAtual()?.checked);
    }

    async function autoriaExistente(tabela, id) {
        if (!tabela || !id || !window.supabaseClient) return false;
        const { data, error } = await window.supabaseClient
            .from(tabela)
            .select("autoral")
            .eq("id", id)
            .maybeSingle();
        if (error) throw error;
        return data?.autoral === true;
    }

    function envolverGravacao(nome, indicePayload, tabela = "", indiceId = -1) {
        const original = window[nome];
        if (typeof original !== "function" || original.__cmeAutoria) return;

        const wrapper = async function (...args) {
            const payload = args[indicePayload];
            if (payload && typeof payload === "object") {
                const input = checkboxAtual();
                const editarSemAlterarMarcacao = indiceId >= 0
                    && input?.dataset.touched !== "true";
                const autoral = editarSemAlterarMarcacao
                    ? await autoriaExistente(tabela, args[indiceId])
                    : valorAutoral();
                args[indicePayload] = { ...payload, autoral };
            }
            return original.apply(this, args);
        };

        wrapper.__cmeAutoria = true;
        wrapper.__cmeOriginal = original;
        window[nome] = wrapper;
    }

    function prepararFormularioAdmin() {
        const input = checkboxAtual();
        if (!input) return;

        input.addEventListener("change", () => {
            input.dataset.touched = "true";
        });

        const resetar = () => {
            input.checked = false;
            input.dataset.touched = "false";
        };

        document.getElementById("novoDocumento")?.addEventListener("click", resetar, true);
        document.getElementById("novoArquivo")?.addEventListener("click", resetar, true);

        envolverGravacao("dbCriarDocumento", 0);
        envolverGravacao("dbEditarDocumento", 1, "documentos", 0);
        envolverGravacao("dbSalvarArquivoBiblioteca", 0);
        envolverGravacao("dbEditarArquivoBiblioteca", 1, "biblioteca", 0);
    }

    function extrairCaminhoProtegido(link) {
        try {
            const url = new URL(link.href, location.href);
            if (!url.pathname.endsWith("pdf-protegido.html")) return null;
            return {
                bucket: url.searchParams.get("bucket") || "",
                path: url.searchParams.get("path") || ""
            };
        } catch {
            return null;
        }
    }

    function adicionarSelo(card) {
        if (!card || card.querySelector(".cme-authorship-badge")) return;
        const selo = document.createElement("span");
        selo.className = "cme-authorship-badge";
        selo.innerHTML = '<i class="bi bi-shield-check"></i> Cópia autoral rastreável';
        const corpo = card.querySelector(".item-body, .cm-file-copy") || card;
        corpo.appendChild(selo);
    }

    async function decorarPortalCliente() {
        if (!paginasCliente.has(paginaAtual()) || !window.supabaseClient) return;

        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (!session?.user) return;

        const contexto = typeof window.obterContextoPortal === "function"
            ? await window.obterContextoPortal(session)
            : null;
        const clienteId = contexto?.cliente?.id;
        if (!clienteId) return;

        const [documentos, biblioteca] = await Promise.all([
            window.supabaseClient.from("documentos")
                .select("arquivo,autoral").eq("cliente_id", clienteId),
            window.supabaseClient.from("biblioteca")
                .select("arquivo,autoral").eq("cliente_id", clienteId)
        ]);

        const autorais = new Set([
            ...(documentos.data || [])
                .filter(item => item.autoral === true)
                .map(item => `documentos|${item.arquivo}`),
            ...(biblioteca.data || [])
                .filter(item => item.autoral === true)
                .map(item => `biblioteca|${item.arquivo}`)
        ]);

        let tentativas = 0;
        const aplicar = () => {
            document.querySelectorAll('a[href*="pdf-protegido.html"]').forEach(link => {
                const origem = extrairCaminhoProtegido(link);
                if (!origem || !autorais.has(`${origem.bucket}|${origem.path}`)) return;
                adicionarSelo(link.closest(".item-card, .cm-file-card, article"));
            });

            tentativas += 1;
            if (tentativas < 8) window.setTimeout(aplicar, 350);
        };
        aplicar();
    }

    function iniciar() {
        prepararFormularioAdmin();
        decorarPortalCliente().catch(erro => {
            console.warn("Não foi possível identificar os selos de autoria.", erro);
        });
    }

    window.CMEArquivoAutoralSelecionado = valorAutoral;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciar, { once: true });
    } else {
        iniciar();
    }
}());
