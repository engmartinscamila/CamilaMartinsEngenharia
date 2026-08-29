/*
==========================================================
CAMILA MARTINS ENGENHARIA
CADASTRO INTELIGENTE — VERSÃO ESTÁVEL
==========================================================
Recursos:
- consulta opcional de CNPJ;
- preenchimento de CEP;
- persistência do campo Parceria;
- indicação visual de parceria sem MutationObserver recursivo.
*/

(function () {
    "use strict";

    const supabase = window.supabaseClient;
    const timers = new Map();

    function quandoPronto(callback) {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", callback, { once: true });
        } else {
            callback();
        }
    }

    function somenteDigitos(valor) {
        return String(valor || "").replace(/\D/g, "");
    }

    function definirStatus(id, texto, tipo = "") {
        const elemento = document.getElementById(id);
        if (!elemento) return;

        elemento.textContent = texto || "";

        if (tipo) elemento.dataset.type = tipo;
        else delete elemento.dataset.type;
    }

    function agendar(chave, callback, atraso = 450) {
        window.clearTimeout(timers.get(chave));
        timers.set(chave, window.setTimeout(callback, atraso));
    }

    async function fetchJsonComTimeout(url, timeout = 7000) {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), timeout);

        try {
            const resposta = await fetch(url, {
                signal: controller.signal,
                headers: { Accept: "application/json" }
            });

            if (!resposta.ok) {
                throw new Error(`HTTP ${resposta.status}`);
            }

            return await resposta.json();
        } finally {
            window.clearTimeout(timer);
        }
    }

    async function consultarCnpj() {
        const campo = document.getElementById("clienteCpf");
        if (!campo) return;

        const cnpj = somenteDigitos(campo.value);

        if (!cnpj) {
            definirStatus("cnpjStatus", "");
            return;
        }

        if (cnpj.length !== 14) {
            if (cnpj.length === 11) definirStatus("cnpjStatus", "CPF informado.");
            else definirStatus("cnpjStatus", "");
            return;
        }

        definirStatus("cnpjStatus", "Consultando CNPJ...", "loading");

        try {
            const dados = await fetchJsonComTimeout(
                `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`
            );

            const razao =
                String(dados.razao_social || dados.nome_fantasia || "").trim();

            const nome = document.getElementById("clienteNome");

            if (nome && razao && !nome.value.trim()) {
                nome.value = razao;
                nome.dispatchEvent(new Event("input", { bubbles: true }));
            }

            definirStatus(
                "cnpjStatus",
                razao ? `CNPJ localizado: ${razao}` : "CNPJ localizado.",
                "success"
            );
        } catch (erro) {
            const mensagem = erro?.name === "AbortError"
                ? "A consulta do CNPJ demorou. Você pode preencher manualmente."
                : "Não foi possível consultar o CNPJ. Você pode preencher manualmente.";

            definirStatus("cnpjStatus", mensagem, "warning");
        }
    }

    function vincularCnpj() {
        const campo = document.getElementById("clienteCpf");
        if (!campo || campo.dataset.cmeCnpjBound === "true") return;

        campo.dataset.cmeCnpjBound = "true";

        const executar = () => {
            agendar("cnpj", consultarCnpj, 500);
        };

        campo.addEventListener("input", executar);
        campo.addEventListener("blur", consultarCnpj);
    }

    function preencherSeVazio(id, valor) {
        const elemento = document.getElementById(id);
        if (!elemento || valor == null || valor === "") return;

        if (!elemento.value.trim()) {
            elemento.value = String(valor);
            elemento.dispatchEvent(new Event("input", { bubbles: true }));
            elemento.dispatchEvent(new Event("change", { bubbles: true }));
        }
    }

    async function consultarCep(config) {
        const campo = document.getElementById(config.cep);
        if (!campo) return;

        const cep = somenteDigitos(campo.value);

        if (!cep) {
            if (config.status) definirStatus(config.status, "");
            return;
        }

        if (cep.length !== 8) {
            if (config.status) definirStatus(config.status, "CEP incompleto.", "warning");
            return;
        }

        if (config.status) definirStatus(config.status, "Consultando CEP...", "loading");

        try {
            const dados = await fetchJsonComTimeout(
                `https://viacep.com.br/ws/${cep}/json/`
            );

            if (dados.erro) throw new Error("CEP não encontrado");

            preencherSeVazio(config.endereco, dados.logradouro);
            preencherSeVazio(config.bairro, dados.bairro);
            preencherSeVazio(config.cidade, dados.localidade);
            preencherSeVazio(config.estado, dados.uf);

            if (config.status) {
                definirStatus(config.status, "CEP localizado.", "success");
            }
        } catch (erro) {
            if (config.status) {
                definirStatus(
                    config.status,
                    erro?.name === "AbortError"
                        ? "A consulta do CEP demorou. Preencha manualmente."
                        : "Não foi possível consultar o CEP.",
                    "warning"
                );
            }
        }
    }

    function vincularCep(config) {
        const campo = document.getElementById(config.cep);
        if (!campo || campo.dataset.cmeCepBound === "true") return;

        campo.dataset.cmeCepBound = "true";

        campo.addEventListener("blur", () => consultarCep(config));
        campo.addEventListener("input", () => {
            if (somenteDigitos(campo.value).length === 8) {
                agendar(`cep:${config.cep}`, () => consultarCep(config), 350);
            }
        });
    }

    function envolverFuncaoBanco(nome, indiceDados, checkboxId) {
        const original = window[nome];

        if (
            typeof original !== "function" ||
            original.__cmePartnershipWrapped === true
        ) {
            return;
        }

        const wrapper = function (...args) {
            const checkbox = document.getElementById(checkboxId);
            const dados = args[indiceDados] || {};

            args[indiceDados] = {
                ...dados,
                parceria: Boolean(checkbox?.checked)
            };

            return original.apply(this, args);
        };

        wrapper.__cmePartnershipWrapped = true;
        wrapper.__cmeOriginal = original;
        window[nome] = wrapper;
    }

    function vincularPersistenciaParceria() {
        envolverFuncaoBanco("dbCriarCliente", 0, "clienteParceria");
        envolverFuncaoBanco("dbEditarCliente", 1, "clienteParceria");
        envolverFuncaoBanco("dbCriarProjeto", 0, "projetoParceria");
        envolverFuncaoBanco("dbEditarProjeto", 1, "projetoParceria");
    }

    async function carregarParceriaPorId(tabela, id, checkboxId) {
        if (!supabase || !id) return;

        const checkbox = document.getElementById(checkboxId);
        if (!checkbox) return;

        try {
            const { data, error } = await supabase
                .from(tabela)
                .select("parceria")
                .eq("id", id)
                .maybeSingle();

            if (!error) checkbox.checked = Boolean(data?.parceria);
        } catch (erro) {
            console.warn(`Não foi possível carregar parceria de ${tabela}.`, erro);
        }
    }

    function vincularEdicaoParceria() {
        if (document.documentElement.dataset.cmePartnershipClicks === "true") return;
        document.documentElement.dataset.cmePartnershipClicks = "true";

        document.addEventListener("click", event => {
            const novoCliente = event.target.closest("#novoCliente");
            if (novoCliente) {
                const campo = document.getElementById("clienteParceria");
                if (campo) campo.checked = false;
            }

            const novoProjeto = event.target.closest("#novoProjeto");
            if (novoProjeto && document.getElementById("modalProjeto")) {
                const campo = document.getElementById("projetoParceria");
                if (campo) campo.checked = false;
            }

            const editarCliente = event.target.closest(
                '[data-acao-cliente="editar"][data-cliente-id]'
            );

            if (editarCliente) {
                carregarParceriaPorId(
                    "clientes",
                    editarCliente.dataset.clienteId,
                    "clienteParceria"
                );
            }

            const editarProjeto = event.target.closest(
                '[data-acao="editar"][data-id]'
            );

            if (
                editarProjeto &&
                document.getElementById("projetoParceria")
            ) {
                carregarParceriaPorId(
                    "projetos",
                    editarProjeto.dataset.id,
                    "projetoParceria"
                );
            }
        }, true);
    }

    function criarBadgeParceria(titulo) {
        if (!titulo || titulo.querySelector(".parceria-badge")) return;

        const badge = document.createElement("span");
        badge.className = "parceria-badge";
        badge.textContent = "Parceria";
        titulo.appendChild(badge);
    }

    async function atualizarBadgesParceria() {
        if (!supabase) return;

        try {
            const tarefas = [];

            const listaClientes = document.getElementById("listaClientes");
            if (listaClientes) {
                tarefas.push(
                    supabase
                        .from("clientes")
                        .select("id")
                        .eq("parceria", true)
                        .then(({ data, error }) => {
                            if (error) return;
                            const ids = new Set((data || []).map(item => String(item.id)));

                            listaClientes
                                .querySelectorAll("[data-cliente-id]")
                                .forEach(item => {
                                    const titulo = item.querySelector("h3");
                                    const deveTer = ids.has(String(item.dataset.clienteId));
                                    const atual = titulo?.querySelector(".parceria-badge");

                                    if (deveTer && !atual) criarBadgeParceria(titulo);
                                    if (!deveTer && atual) atual.remove();
                                });
                        })
                );
            }

            const listaProjetos = document.getElementById("listaProjetos");
            if (listaProjetos) {
                tarefas.push(
                    supabase
                        .from("projetos")
                        .select("id")
                        .eq("parceria", true)
                        .then(({ data, error }) => {
                            if (error) return;
                            const ids = new Set((data || []).map(item => String(item.id)));

                            listaProjetos
                                .querySelectorAll("[data-id]")
                                .forEach(item => {
                                    const titulo = item.querySelector("h3");
                                    const deveTer = ids.has(String(item.dataset.id));
                                    const atual = titulo?.querySelector(".parceria-badge");

                                    if (deveTer && !atual) criarBadgeParceria(titulo);
                                    if (!deveTer && atual) atual.remove();
                                });
                        })
                );
            }

            await Promise.allSettled(tarefas);
        } catch (erro) {
            console.warn("Não foi possível atualizar indicadores de parceria.", erro);
        }
    }

    function iniciar() {
        vincularPersistenciaParceria();
        vincularEdicaoParceria();
        vincularCnpj();

        vincularCep({
            cep: "clienteCep",
            endereco: "clienteEndereco",
            bairro: "clienteBairro",
            cidade: "clienteCidade",
            estado: "clienteEstado",
            status: "cepStatus"
        });

        vincularCep({
            cep: "projetoCepObra",
            endereco: "projetoEnderecoObra",
            bairro: "projetoBairroObra",
            cidade: "projetoCidadeObra",
            estado: "projetoEstadoObra",
            status: null
        });

        // Atualizações pontuais. Não há MutationObserver nem loop.
        window.setTimeout(atualizarBadgesParceria, 700);
        window.setTimeout(atualizarBadgesParceria, 2200);

        document.getElementById("formCliente")?.addEventListener("submit", () => {
            window.setTimeout(atualizarBadgesParceria, 1200);
        });

        document.getElementById("formProjeto")?.addEventListener("submit", () => {
            window.setTimeout(atualizarBadgesParceria, 1200);
        });
    }

    quandoPronto(iniciar);
}());
