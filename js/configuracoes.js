/*
=====================================================
CAMILA MARTINS ENGENHARIA
CONFIGURAÇÕES — VERSÃO ESTÁVEL E TESTÁVEL
=====================================================
*/

(function () {
    "use strict";

    let eventosRegistrados = false;
    let carregando = false;

    document.addEventListener("DOMContentLoaded", iniciar, { once: true });

    async function iniciar() {
        configurarEventos();
        await carregarConfiguracoes();
        await carregarIdentidadeProfissional();
    }

    function configurarEventos() {
        if (eventosRegistrados) return;
        eventosRegistrados = true;

        document.getElementById("formConfiguracoes")
            ?.addEventListener("submit", salvarConfiguracoes);

        document.getElementById("gerarBackup")
            ?.addEventListener("click", gerarBackup);

        document.getElementById("limparCache")
            ?.addEventListener("click", limparCache);

        document.getElementById("sistemaTema")
            ?.addEventListener("change", aplicarPrevia);

        document.getElementById("sistemaCorPrincipal")
            ?.addEventListener("input", aplicarPrevia);

        document.getElementById("sistemaNotificacoes")
            ?.addEventListener("change", aplicarPrevia);

        document.getElementById("saveProfessionalIdentity")
            ?.addEventListener("click", salvarIdentidadeProfissional);
    }

    async function carregarConfiguracoes() {
        if (carregando) return;
        carregando = true;

        try {
            const config = await dbBuscarConfiguracoes();

            if (config) {
                preencher("empresaNome", config.nome_empresa);
                preencher("empresaCnpj", config.cnpj);
                preencher("empresaEmail", config.email);
                preencher("empresaTelefone", config.telefone);
                preencher("empresaEndereco", config.endereco);
                preencher("empresaCidade", config.cidade);
                preencher("empresaEstado", config.estado);
                preencher("empresaDescricao", config.descricao);
                preencher("sistemaTema", config.tema || "escuro");
                preencher("sistemaCorPrincipal", config.cor_principal || "#b89a63");
                preencher("sistemaNotificacoes", config.notificacoes === false ? "inativo" : "ativo");
            } else {
                preencher("sistemaTema", "escuro");
                preencher("sistemaCorPrincipal", "#b89a63");
                preencher("sistemaNotificacoes", "ativo");
            }

            aplicarPrevia();
        } catch (erro) {
            console.error("Erro ao carregar configurações:", erro);
            mostrarStatus("Não foi possível carregar as configurações do banco.", "erro");
        } finally {
            carregando = false;
            window.ocultarCarregamentoPagina?.();
        }
    }

    function obterDados() {
        return {
            nome_empresa: valor("empresaNome"),
            cnpj: valor("empresaCnpj"),
            email: valor("empresaEmail"),
            telefone: valor("empresaTelefone"),
            endereco: valor("empresaEndereco"),
            cidade: valor("empresaCidade"),
            estado: valor("empresaEstado"),
            descricao: valor("empresaDescricao"),
            tema: document.getElementById("sistemaTema")?.value || "escuro",
            cor_principal: document.getElementById("sistemaCorPrincipal")?.value || "#b89a63",
            notificacoes: document.getElementById("sistemaNotificacoes")?.value !== "inativo"
        };
    }

    function aplicarPrevia() {
        const dados = obterDados();

        window.CMEAplicarPreferenciasAdmin?.({
            tema: dados.tema,
            cor_principal: dados.cor_principal,
            notificacoes: dados.notificacoes
        });
    }

    async function salvarConfiguracoes(event) {
        event.preventDefault();

        const dados = obterDados();
        const botao = document.getElementById("salvarConfiguracoes");
        const texto = botao?.textContent || "Salvar Configurações";

        try {
            alternarBotao(botao, true, "Salvando...");
            mostrarStatus("Salvando configurações...", "carregando");

            await dbSalvarConfiguracoes(dados);

            window.CMEAplicarPreferenciasAdmin?.({
                tema: dados.tema,
                cor_principal: dados.cor_principal,
                notificacoes: dados.notificacoes
            });

            const confirmado = await dbBuscarConfiguracoes();
            const campos = [
                "nome_empresa","cnpj","email","telefone","endereco","cidade",
                "estado","descricao","tema","cor_principal","notificacoes"
            ];

            const divergencias = campos.filter(chave =>
                String(confirmado?.[chave] ?? "") !== String(dados[chave] ?? "")
            );

            if (divergencias.length) {
                throw new Error("A confirmação do banco divergiu nos campos: " + divergencias.join(", "));
            }

            mostrarStatus("Configurações salvas e confirmadas no banco.", "sucesso");
        } catch (erro) {
            console.error("Erro ao salvar configurações:", erro);
            mostrarStatus(
                "Não foi possível salvar as configurações." +
                (erro?.message ? " " + erro.message : ""),
                "erro"
            );
        } finally {
            alternarBotao(botao, false, texto);
        }
    }


    async function carregarIdentidadeProfissional() {
        const status = document.getElementById("professionalIdentityStatus");

        try {
            const { data, error } = await window.supabaseClient
                .rpc("admin_professional_identity_status");

            if (error) throw error;

            preencher("professionalFullName", data?.full_name || "");
            preencher("professionalTitle", data?.professional_title || "Engenheira Civil");
            preencher("professionalNationality", data?.nationality || "");
            preencher("professionalMaritalStatus", data?.marital_status || "");
            preencher("professionalCreaRj", data?.crea_rj || "");
            preencher("professionalCreaSp", data?.crea_sp || "");
            preencher("professionalRgIssuer", data?.rg_issuer || "");
            preencher("professionalAddress", data?.professional_address || "");
            preencher("professionalCity", data?.professional_city || "");
            preencher("professionalState", data?.professional_state || "");
            preencher("professionalEmail", data?.email_professional || "");
            preencher("professionalPhone", data?.phone_professional || "");

            const cpf = document.getElementById("professionalCpf");
            const rg = document.getElementById("professionalRg");

            if (cpf) {
                cpf.value = "";
                cpf.placeholder = data?.cpf_set
                    ? "Já cadastrado " + (data?.cpf_masked || "") + " — digite somente para substituir"
                    : "Não cadastrado";
            }

            if (rg) {
                rg.value = "";
                rg.placeholder = data?.rg_set
                    ? "Já cadastrado " + (data?.rg_masked || "") + " — digite somente para substituir"
                    : "Não cadastrado";
            }

            if (status) {
                status.textContent = data?.configured
                    ? "Identificação profissional protegida e disponível para os geradores de documentos."
                    : "Complete os dados profissionais antes de gerar contratos definitivos.";
                status.dataset.type = data?.configured ? "sucesso" : "aviso";
            }
        } catch (erro) {
            console.error("Erro ao carregar identificação profissional:", erro);
            if (status) {
                status.textContent = "Não foi possível consultar a área sigilosa.";
                status.dataset.type = "erro";
            }
        }
    }

    async function salvarIdentidadeProfissional() {
        const botao = document.getElementById("saveProfessionalIdentity");
        const texto = botao?.textContent || "Salvar dados sigilosos";
        const status = document.getElementById("professionalIdentityStatus");

        const patch = {
            full_name: valor("professionalFullName"),
            professional_title: valor("professionalTitle"),
            nationality: valor("professionalNationality"),
            marital_status: valor("professionalMaritalStatus"),
            crea_rj: valor("professionalCreaRj"),
            crea_sp: valor("professionalCreaSp"),
            cpf: valor("professionalCpf"),
            rg: valor("professionalRg"),
            rg_issuer: valor("professionalRgIssuer"),
            professional_address: valor("professionalAddress"),
            professional_city: valor("professionalCity"),
            professional_state: valor("professionalState").toUpperCase(),
            email_professional: valor("professionalEmail"),
            phone_professional: valor("professionalPhone")
        };

        if (!patch.full_name) {
            if (status) {
                status.textContent = "Informe o nome civil completo.";
                status.dataset.type = "erro";
            }
            return;
        }

        if (!patch.crea_rj && !patch.crea_sp) {
            if (status) {
                status.textContent = "Informe ao menos uma inscrição no CREA.";
                status.dataset.type = "erro";
            }
            return;
        }

        try {
            alternarBotao(botao, true, "Protegendo dados...");
            if (status) {
                status.textContent = "Salvando no cofre criptografado...";
                status.dataset.type = "carregando";
            }

            const { data, error } = await window.supabaseClient
                .rpc("admin_save_professional_identity", { p_patch: patch });

            if (error) throw error;

            const cpf = document.getElementById("professionalCpf");
            const rg = document.getElementById("professionalRg");
            if (cpf) cpf.value = "";
            if (rg) rg.value = "";

            if (status) {
                status.textContent =
                    "Dados profissionais salvos no Supabase Vault. CPF e RG não ficam expostos na tabela comum nem no backup.";
                status.dataset.type = "sucesso";
            }

            if (cpf && data?.cpf_set) {
                cpf.placeholder = "Já cadastrado " + (data?.cpf_masked || "") + " — digite somente para substituir";
            }
            if (rg && data?.rg_set) {
                rg.placeholder = "Já cadastrado " + (data?.rg_masked || "") + " — digite somente para substituir";
            }
        } catch (erro) {
            console.error("Erro ao salvar identificação profissional:", erro);
            if (status) {
                status.textContent =
                    "Não foi possível salvar os dados sigilosos." +
                    (erro?.message ? " " + erro.message : "");
                status.dataset.type = "erro";
            }
        } finally {
            alternarBotao(botao, false, texto);
        }
    }

    async function gerarBackup() {
        const botao = document.getElementById("gerarBackup");
        const texto = botao?.textContent || "Gerar Backup";

        try {
            alternarBotao(botao, true, "Gerando backup...");

            const [
                clientes, projetos, documentos, fotos, financeiro,
                agenda, biblioteca, cronograma, solicitacoes, configuracoes
            ] = await Promise.all([
                dbBuscarClientes().catch(() => []),
                dbBuscarProjetos().catch(() => []),
                dbBuscarDocumentos().catch(() => []),
                dbBuscarFotos().catch(() => []),
                dbBuscarFinanceiro().catch(() => []),
                dbBuscarAgenda().catch(() => []),
                dbBuscarBiblioteca().catch(() => []),
                dbBuscarCronograma().catch(() => []),
                dbBuscarSolicitacoes().catch(() => []),
                dbBuscarConfiguracoes().catch(() => null)
            ]);

            const backup = {
                versao: 2,
                gerado_em: new Date().toISOString(),
                clientes, projetos, documentos, fotos, financeiro,
                agenda, biblioteca, cronograma, solicitacoes, configuracoes
            };

            const blob = new Blob(
                [JSON.stringify(backup, null, 2)],
                { type: "application/json;charset=utf-8" }
            );

            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "backup-camila-martins-" +
                new Date().toISOString().slice(0, 10) + ".json";
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);

            mostrarStatus("Backup gerado com sucesso.", "sucesso");
        } catch (erro) {
            console.error("Erro ao gerar backup:", erro);
            mostrarStatus("Não foi possível gerar o backup.", "erro");
        } finally {
            alternarBotao(botao, false, texto);
        }
    }

    function limparCache() {
        if (!confirm("Limpar o cache local da interface? Sua sessão permanecerá conectada.")) return;

        sessionStorage.clear();

        for (const chave of Object.keys(localStorage)) {
            if (chave.startsWith("cme_cache_") || chave.startsWith("cme_temp_")) {
                localStorage.removeItem(chave);
            }
        }

        mostrarStatus("Cache local limpo. Recarregando...", "sucesso");
        window.setTimeout(() => location.reload(), 350);
    }

    function mostrarStatus(texto, tipo) {
        let status = document.getElementById("statusConfiguracoes");

        if (!status) {
            status = document.createElement("p");
            status.id = "statusConfiguracoes";
            status.setAttribute("role", "status");
            status.setAttribute("aria-live", "polite");

            const footer = document.querySelector("#formConfiguracoes > .modal-footer");
            footer?.insertAdjacentElement("beforebegin", status);
        }

        if (status) {
            status.textContent = texto;
            status.dataset.type = tipo || "";
        }
    }

    function alternarBotao(botao, desabilitado, texto) {
        if (!botao) return;
        botao.disabled = desabilitado;
        botao.textContent = texto;
    }

    function valor(id) {
        return document.getElementById(id)?.value?.trim() || "";
    }

    function preencher(id, conteudo) {
        const campo = document.getElementById(id);
        if (campo && conteudo !== undefined && conteudo !== null) {
            campo.value = conteudo;
        }
    }
}());
