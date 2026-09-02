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
    let governanceState = {
        contract: null,
        contractBody: "",
        pending: [],
        services: [],
        levels: [],
        texts: [],
        preflight: null
    };

    document.addEventListener("DOMContentLoaded", iniciar, { once: true });

    async function iniciar() {
        configurarEventos();
        await carregarConfiguracoes();
        await carregarIdentidadeProfissional();
        await carregarGovernancaDocumental();
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

        document.getElementById("publishContractMaster")
            ?.addEventListener("click", publicarContratoMestre);

        document.getElementById("governanceLevelSelect")
            ?.addEventListener("change", preencherEditorNivel);

        document.getElementById("newGovernanceLevel")
            ?.addEventListener("click", limparEditorNivel);

        document.getElementById("saveGovernanceLevel")
            ?.addEventListener("click", salvarNivelGovernanca);

        document.getElementById("governanceServiceSelect")
            ?.addEventListener("change", preencherEditorServico);

        document.getElementById("saveGovernanceService")
            ?.addEventListener("click", salvarServicoGovernanca);

        document.getElementById("governanceTextSelect")
            ?.addEventListener("change", preencherEditorTexto);

        document.getElementById("saveGovernanceText")
            ?.addEventListener("click", salvarTextoGovernanca);

        document.getElementById("governancePendingReviews")
            ?.addEventListener("click", tratarCliqueRevisao);
    }

    async function carregarConfiguracoes() {
        if (carregando) return;
        carregando = true;

        try {
            const config = await dbBuscarConfiguracoes();

            if (config) {
                preencher("empresaNome", config.nome_empresa);
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
                "nome_empresa","email","telefone","endereco","cidade",
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
            const cnpj = document.getElementById("professionalCnpj");
            const rg = document.getElementById("professionalRg");

            if (cpf) {
                cpf.value = "";
                cpf.placeholder = data?.cpf_set
                    ? "Já cadastrado " + (data?.cpf_masked || "") + " — digite somente para substituir"
                    : "Não cadastrado";
            }

            if (cnpj) {
                cnpj.value = "";
                cnpj.placeholder = data?.cnpj_set
                    ? "Já cadastrado " + (data?.cnpj_masked || "") + " — digite somente para substituir"
                    : "Não cadastrado";
            }

            if (rg) {
                rg.value = "";
                rg.placeholder = data?.rg_set
                    ? "Já cadastrado " + (data?.rg_masked || "") + " — digite somente para substituir"
                    : "Não cadastrado";
            }

            if (status) {
                if (data?.contract_ready) {
                    status.textContent = "Identificação profissional completa, protegida e pronta para propostas, contratos e documentos auxiliares.";
                    status.dataset.type = "sucesso";
                } else if (data?.document_ready) {
                    const faltantes = Array.isArray(data?.missing_contract_fields)
                        ? data.missing_contract_fields.join(", ")
                        : "dados jurídicos do contrato";
                    status.textContent = "Dados profissionais básicos prontos. Para gerar o contrato definitivo, complete: " + faltantes + ".";
                    status.dataset.type = "aviso";
                } else {
                    status.textContent = "Complete o nome civil e ao menos uma inscrição no CREA antes de gerar documentos.";
                    status.dataset.type = "aviso";
                }
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
            cnpj: valor("professionalCnpj"),
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
            const cnpj = document.getElementById("professionalCnpj");
            const rg = document.getElementById("professionalRg");
            if (cpf) cpf.value = "";
            if (cnpj) cnpj.value = "";
            if (rg) rg.value = "";

            if (status) {
                status.textContent =
                    "Dados profissionais salvos no Supabase Vault. CPF, RG e CNPJ profissional não ficam expostos na tabela comum nem no backup.";
                status.dataset.type = "sucesso";
            }

            if (cpf && data?.cpf_set) {
                cpf.placeholder = "Já cadastrado " + (data?.cpf_masked || "") + " — digite somente para substituir";
            }
            if (cnpj && data?.cnpj_set) {
                cnpj.placeholder = "Já cadastrado " + (data?.cnpj_masked || "") + " — digite somente para substituir";
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


    async function carregarGovernancaDocumental() {
        const status = document.getElementById("governanceStatus");

        try {
            const [governanceRes, contractRes] = await Promise.all([
                window.supabaseClient.rpc("admin_document_governance_status"),
                window.supabaseClient.rpc("admin_contract_master_current")
            ]);

            if (governanceRes.error) throw governanceRes.error;
            if (contractRes.error) throw contractRes.error;

            const data = governanceRes.data || {};
            governanceState = {
                contract: data.contract || null,
                contractBody: contractRes.data?.body || "",
                pending: Array.isArray(data.pending_reviews) ? data.pending_reviews : [],
                services: Array.isArray(data.services) ? data.services : [],
                levels: Array.isArray(data.levels) ? data.levels : [],
                texts: Array.isArray(data.texts) ? data.texts : [],
                preflight: data.preflight || null
            };

            preencherTexto(
                "governanceContractVersion",
                governanceState.contract?.version
                    ? "v" + governanceState.contract.version
                    : "—"
            );
            preencherTexto("governancePendingCount", String(governanceState.pending.length));
            preencherTexto("governanceServiceCount", String(governanceState.services.length));
            preencherTexto("governanceLevelCount", String(governanceState.levels.length));

            preencher("governanceContractBody", governanceState.contractBody);
            preencher(
                "governanceContractLabel",
                governanceState.contract?.version
                    ? "Contrato Mestre v" + (Number(governanceState.contract.version) + 1)
                    : "Contrato Mestre v1"
            );
            preencher("governanceContractNotes", "");
            preencher("governanceChangedClauses", "");

            renderizarPendenciasGovernanca();
            renderizarSelectNiveis();
            renderizarSelectServicos();
            renderizarSelectTextos();

            if (status) {
                if (governanceState.preflight?.ready === false) {
                    const preflight = governanceState.preflight;
                    status.textContent =
                        "Geração bloqueada com segurança: " +
                        (preflight.pending_total || 0) + " revisão(ões) pendente(s), " +
                        ((preflight.outdated_services || 0) + (preflight.outdated_levels || 0) + (preflight.outdated_texts || 0)) +
                        " item(ns) fora da versão do Contrato Mestre e " +
                        (preflight.items_without_clause_refs || 0) + " item(ns) sem cláusulas vinculadas.";
                    status.dataset.type = "aviso";
                } else {
                    status.textContent =
                        "Governança documental consistente. Novos documentos podem ser criados normalmente.";
                    status.dataset.type = "sucesso";
                }
            }
        } catch (erro) {
            console.error("Erro ao carregar governança documental:", erro);
            if (status) {
                status.textContent =
                    "Não foi possível carregar a governança documental." +
                    (erro?.message ? " " + erro.message : "");
                status.dataset.type = "erro";
            }
        }
    }

    function preencherTexto(id, conteudo) {
        const elemento = document.getElementById(id);
        if (elemento) elemento.textContent = conteudo ?? "";
    }

    function linhas(valorCampo) {
        return valor(valorCampo)
            .split(/\r?\n/)
            .map(item => item.trim())
            .filter(Boolean);
    }

    function listaVirgulas(valorCampo) {
        return valor(valorCampo)
            .split(",")
            .map(item => item.trim())
            .filter(Boolean);
    }

    function listaParaLinhas(lista) {
        return Array.isArray(lista) ? lista.join("\n") : "";
    }

    function listaParaVirgulas(lista) {
        return Array.isArray(lista) ? lista.join(", ") : "";
    }

    function renderizarPendenciasGovernanca() {
        const box = document.getElementById("governancePendingReviews");
        if (!box) return;

        if (!governanceState.pending.length) {
            box.innerHTML =
                '<div class="governance-review"><div><strong>Nenhuma pendência</strong>' +
                '<small>Contrato, serviços, níveis e textos padrão estão sincronizados.</small></div></div>';
            return;
        }

        const tipo = {
            service: "Serviço",
            level: "Nível",
            text: "Texto padrão",
            contract: "Contrato Mestre"
        };

        box.innerHTML = governanceState.pending.map(item => {
            const refs = Array.isArray(item.clause_refs) && item.clause_refs.length
                ? item.clause_refs.join(", ")
                : "revisão geral";

            return '<div class="governance-review">' +
                '<div><strong>' + escaparGovernanca(tipo[item.source_type] || item.source_type) +
                ': ' + escaparGovernanca(item.source_code) + '</strong>' +
                '<small>' + escaparGovernanca(item.reason || "") +
                ' Cláusulas: ' + escaparGovernanca(refs) + '.</small></div>' +
                '<button type="button" data-governance-review="' +
                escaparGovernanca(item.id) + '">Confirmar sem alteração</button>' +
                '</div>';
        }).join("");
    }

    function escaparGovernanca(texto) {
        return String(texto ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    async function tratarCliqueRevisao(event) {
        const botao = event.target.closest("[data-governance-review]");
        if (!botao) return;

        const reviewId = botao.dataset.governanceReview;
        if (!reviewId) return;
        const review = governanceState.pending.find(item => item.id === reviewId);
        const pergunta = review?.source_type === "contract"
            ? "Confirma que o Contrato Mestre já cobre corretamente este serviço ou nível, sem necessidade de publicar uma nova versão?"
            : "Confirma que este texto/regra continua coerente com a versão atual do Contrato Mestre, sem necessidade de alteração?";

        if (!confirm(pergunta)) return;

        const textoOriginal = botao.textContent;

        try {
            alternarBotao(botao, true, "Confirmando...");
            const { data, error } = await window.supabaseClient
                .rpc("admin_confirm_document_rule_review", { p_review_id: reviewId });

            if (error) throw error;
            if (data !== true) throw new Error("A revisão já foi resolvida ou não foi encontrada.");

            await carregarGovernancaDocumental();
        } catch (erro) {
            console.error("Erro ao confirmar revisão:", erro);
            alert("Não foi possível confirmar a revisão. " + (erro?.message || ""));
        } finally {
            alternarBotao(botao, false, textoOriginal || "Confirmar sem alteração");
        }
    }

    async function publicarContratoMestre() {
        const botao = document.getElementById("publishContractMaster");
        const textoOriginal = botao?.textContent || "Publicar nova versão";
        const body = valor("governanceContractBody");
        const label = valor("governanceContractLabel");
        const notes = valor("governanceContractNotes");
        const clauses = listaVirgulas("governanceChangedClauses");

        if (!body || !label) {
            alert("Informe o nome da versão e o texto completo do Contrato Mestre.");
            return;
        }

        const aviso = clauses.length
            ? "O sistema detectará automaticamente as cláusulas alteradas e também considerará este complemento manual: " + clauses.join(", ") + "."
            : "O sistema comparará as versões e detectará automaticamente as cláusulas alteradas. Mudanças sem numeração identificável gerarão uma revisão geral.";

        if (!confirm(
            "Publicar uma nova versão do Contrato Mestre?\n\n" +
            aviso +
            "\n\nContratos e documentos antigos continuarão presos às versões anteriores."
        )) return;

        try {
            alternarBotao(botao, true, "Publicando...");
            const { error } = await window.supabaseClient.rpc(
                "admin_publish_contract_master",
                {
                    p_body: body,
                    p_label: label,
                    p_notes: notes || null,
                    p_changed_clause_refs: clauses
                }
            );

            if (error) throw error;
            await carregarGovernancaDocumental();
            alert("Nova versão do Contrato Mestre publicada. Revise as pendências indicadas antes de criar novos ORCs ou contratos.");
        } catch (erro) {
            console.error("Erro ao publicar Contrato Mestre:", erro);
            alert("Não foi possível publicar a nova versão. " + (erro?.message || ""));
        } finally {
            alternarBotao(botao, false, textoOriginal);
        }
    }

    function renderizarSelectNiveis() {
        const select = document.getElementById("governanceLevelSelect");
        if (!select) return;

        select.innerHTML =
            '<option value="">Selecione ou crie um novo nível</option>' +
            [...governanceState.levels]
                .sort((a, b) => String(a.label || a.code).localeCompare(String(b.label || b.code), "pt-BR"))
                .map(item =>
                '<option value="' + escaparGovernanca(item.code) + '">' +
                escaparGovernanca(item.label) + ' — ' +
                escaparGovernanca(item.subtitle || "Personalizado") +
                ' (v' + escaparGovernanca(item.version) + ')</option>'
            ).join("");

        if (governanceState.levels.length) {
            select.value = governanceState.levels[0].code;
            preencherEditorNivel();
        } else {
            limparEditorNivel();
        }
    }

    function preencherEditorNivel() {
        const code = document.getElementById("governanceLevelSelect")?.value || "";
        const item = governanceState.levels.find(level => level.code === code);
        if (!item) {
            limparEditorNivel();
            return;
        }

        preencher("governanceLevelCode", item.code);
        preencher("governanceLevelLabel", item.label);
        preencher("governanceLevelSubtitle", item.subtitle);
        preencher("governanceLevelDescription", item.description);
        preencher("governanceLevelFeatures", listaParaLinhas(item.features));
        preencher("governanceLevelExclusions", listaParaLinhas(item.exclusions));
        preencher("governanceLevelClauses", listaParaVirgulas(item.contract_clause_refs));

        const codeInput = document.getElementById("governanceLevelCode");
        if (codeInput) codeInput.readOnly = true;
    }

    function limparEditorNivel() {
        const select = document.getElementById("governanceLevelSelect");
        if (select) select.value = "";

        [
            "governanceLevelCode","governanceLevelLabel","governanceLevelSubtitle",
            "governanceLevelDescription","governanceLevelFeatures",
            "governanceLevelExclusions","governanceLevelClauses"
        ].forEach(id => preencher(id, ""));

        const codeInput = document.getElementById("governanceLevelCode");
        if (codeInput) codeInput.readOnly = false;
    }

    async function salvarNivelGovernanca() {
        const botao = document.getElementById("saveGovernanceLevel");
        const textoOriginal = botao?.textContent || "Salvar nível";

        const payload = {
            code: valor("governanceLevelCode").toLowerCase(),
            label: valor("governanceLevelLabel"),
            subtitle: valor("governanceLevelSubtitle"),
            description: valor("governanceLevelDescription"),
            features: linhas("governanceLevelFeatures"),
            exclusions: linhas("governanceLevelExclusions"),
            contract_clause_refs: listaVirgulas("governanceLevelClauses")
        };

        if (!payload.code || !payload.label || !payload.description || !payload.contract_clause_refs.length) {
            alert("Preencha código, nome, descrição e ao menos uma cláusula relacionada ao nível.");
            return;
        }

        try {
            alternarBotao(botao, true, "Salvando...");
            const { error } = await window.supabaseClient
                .rpc("admin_upsert_service_level", { p_data: payload });
            if (error) throw error;

            await carregarGovernancaDocumental();
            alert("Nível versionado. Confirme as revisões do Contrato Mestre, dos serviços elegíveis e dos textos inteligentes antes de gerar documentos.");
        } catch (erro) {
            console.error("Erro ao salvar nível:", erro);
            alert("Não foi possível salvar o nível. " + (erro?.message || ""));
        } finally {
            alternarBotao(botao, false, textoOriginal);
        }
    }

    function renderizarSelectServicos() {
        const select = document.getElementById("governanceServiceSelect");
        if (!select) return;

        select.innerHTML = governanceState.services.map(item =>
            '<option value="' + escaparGovernanca(item.code) + '">(' +
            escaparGovernanca(item.code) + ') ' + escaparGovernanca(item.name) +
            ' — v' + escaparGovernanca(item.version) + '</option>'
        ).join("");

        if (governanceState.services.length) {
            select.value = governanceState.services[0].code;
            preencherEditorServico();
        }
    }

    function preencherEditorServico() {
        const code = document.getElementById("governanceServiceSelect")?.value || "";
        const item = governanceState.services.find(service => service.code === code);
        if (!item) return;

        preencher("governanceServiceCode", item.code);
        preencher("governanceServiceName", item.name);
        preencher("governanceServiceCategory", item.category);
        preencher("governanceServiceRevisions", item.default_revisions ?? "");
        preencher("governanceServiceLevelApplicable", String(item.level_applicable === true));
        preencher("governanceServiceAcceptance", String(item.acceptance_required !== false));
        preencher("governanceServiceDescription", item.description);
        preencher("governanceServiceDeliverables", listaParaLinhas(item.deliverables));
        preencher("governanceServiceExclusions", listaParaLinhas(item.exclusions));
        preencher("governanceServiceInputs", listaParaLinhas(item.client_inputs));
        preencher("governanceServiceFormats", listaParaVirgulas(item.delivery_formats));
        preencher("governanceServiceClauses", listaParaVirgulas(item.contract_clause_refs));
        preencher("governanceServicePlanning", item.planning_reference || "");

        const codeInput = document.getElementById("governanceServiceCode");
        if (codeInput) codeInput.readOnly = true;
    }

    async function salvarServicoGovernanca() {
        const botao = document.getElementById("saveGovernanceService");
        const textoOriginal = botao?.textContent || "Salvar nova versão do serviço";

        const revisoes = valor("governanceServiceRevisions");
        const payload = {
            code: valor("governanceServiceCode").toLowerCase(),
            name: valor("governanceServiceName"),
            category: valor("governanceServiceCategory") || "projeto",
            level_applicable: document.getElementById("governanceServiceLevelApplicable")?.value === "true",
            description: valor("governanceServiceDescription"),
            deliverables: linhas("governanceServiceDeliverables"),
            exclusions: linhas("governanceServiceExclusions"),
            client_inputs: linhas("governanceServiceInputs"),
            default_revisions: revisoes === "" ? null : Number(revisoes),
            delivery_formats: listaVirgulas("governanceServiceFormats"),
            acceptance_required: document.getElementById("governanceServiceAcceptance")?.value !== "false",
            planning_reference: valor("governanceServicePlanning"),
            contract_clause_refs: listaVirgulas("governanceServiceClauses")
        };

        if (!payload.code || !payload.name || !payload.description || !payload.contract_clause_refs.length) {
            alert("O serviço precisa de código, nome, descrição e ao menos uma cláusula relacionada.");
            return;
        }

        try {
            alternarBotao(botao, true, "Versionando...");
            const { error } = await window.supabaseClient
                .rpc("admin_upsert_service_catalog", { p_data: payload });
            if (error) throw error;

            await carregarGovernancaDocumental();
            alert("Serviço versionado. Confirme a cobertura do Contrato Mestre e revise os textos inteligentes relacionados antes de gerar documentos.");
        } catch (erro) {
            console.error("Erro ao salvar serviço:", erro);
            alert("Não foi possível salvar o serviço. " + (erro?.message || ""));
        } finally {
            alternarBotao(botao, false, textoOriginal);
        }
    }

    function renderizarSelectTextos() {
        const select = document.getElementById("governanceTextSelect");
        if (!select) return;

        select.innerHTML = governanceState.texts.map(item =>
            '<option value="' + escaparGovernanca(item.code) + '">' +
            escaparGovernanca(item.title) + ' — ' +
            escaparGovernanca(item.document_kind) +
            ' (v' + escaparGovernanca(item.version) + ')</option>'
        ).join("");

        if (governanceState.texts.length) {
            select.value = governanceState.texts[0].code;
            preencherEditorTexto();
        }
    }

    function preencherEditorTexto() {
        const code = document.getElementById("governanceTextSelect")?.value || "";
        const item = governanceState.texts.find(texto => texto.code === code);
        if (!item) return;

        preencher("governanceTextTitle", item.title);
        preencher("governanceTextClauses", listaParaVirgulas(item.contract_clause_refs));
        preencher("governanceTextBody", item.body);
    }

    async function salvarTextoGovernanca() {
        const botao = document.getElementById("saveGovernanceText");
        const textoOriginal = botao?.textContent || "Salvar nova versão do texto";
        const code = document.getElementById("governanceTextSelect")?.value || "";
        const atual = governanceState.texts.find(item => item.code === code);

        if (!atual) {
            alert("Selecione um texto padrão.");
            return;
        }

        const payload = {
            code: atual.code,
            document_kind: atual.document_kind,
            title: valor("governanceTextTitle"),
            body: valor("governanceTextBody"),
            contract_clause_refs: listaVirgulas("governanceTextClauses")
        };

        if (!payload.body || !payload.contract_clause_refs.length) {
            alert("O texto padrão precisa de conteúdo e de ao menos uma cláusula relacionada.");
            return;
        }

        try {
            alternarBotao(botao, true, "Versionando...");
            const { error } = await window.supabaseClient
                .rpc("admin_upsert_document_text", { p_data: payload });
            if (error) throw error;

            await carregarGovernancaDocumental();
        } catch (erro) {
            console.error("Erro ao salvar texto padrão:", erro);
            alert("Não foi possível salvar o texto. " + (erro?.message || ""));
        } finally {
            alternarBotao(botao, false, textoOriginal);
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
