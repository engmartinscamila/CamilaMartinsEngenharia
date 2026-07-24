/*
==========================================================
CAMILA MARTINS ENGENHARIA
CLIENTES.JS - CRUD ADMINISTRATIVO
==========================================================
*/

(function iniciarModuloClientes() {
    "use strict";

    let clientes = [];
    let clienteSelecionadoId = null;
    let eventosConfigurados = false;
    let temporizadorCep = null;
    let ultimaConsultaCep = "";

    document.addEventListener("DOMContentLoaded", iniciarClientes);

    async function iniciarClientes() {
        configurarEventosClientes();

        try {
            if (paginaCompletaDeClientes()) {
                await carregarClientes();
            }
            else if (document.getElementById("listaClientes")) {
                clientes = await dbBuscarClientes();
            }
        }
        catch (error) {
            console.error("Erro ao iniciar clientes:", error);
            mostrarMensagem(
                "Não foi possível iniciar o gerenciamento de clientes.",
                "erro"
            );
        }
        finally {
            if (typeof window.ocultarCarregamentoPagina === "function") {
                window.ocultarCarregamentoPagina();
            }
        }
    }

    function paginaCompletaDeClientes() {
        return Boolean(document.getElementById("detalhesCliente"));
    }

    async function carregarClientes() {
        const lista = document.getElementById("listaClientes");

        if (!lista) return;

        lista.innerHTML = estadoLista("Carregando clientes...");

        try {
            clientes = await dbBuscarClientes();
            renderizarClientes(clientes);

            if (clienteSelecionadoId) {
                const clienteAtual = clientes.find(
                    cliente => cliente.id === clienteSelecionadoId
                );

                if (clienteAtual) {
                    await exibirDetalhesCliente(clienteAtual, false);
                }
                else {
                    limparDetalhesCliente();
                }
            }
        }
        catch (error) {
            console.error("Erro ao carregar clientes:", error);
            lista.innerHTML = estadoLista(
                "Não foi possível carregar os clientes.",
                "erro"
            );
            mostrarMensagem(
                mensagemSupabase(
                    error,
                    "Não foi possível carregar os clientes."
                ),
                "erro"
            );
        }
    }

    function renderizarClientes(lista) {
        const elemento = document.getElementById("listaClientes");
        const exibirDetalhes = paginaCompletaDeClientes();

        if (!elemento) return;

        if (!lista.length) {
            elemento.innerHTML = estadoLista("Nenhum cliente cadastrado.");
            return;
        }

        elemento.innerHTML = lista
            .map(cliente => `
                <article class="item-lista" data-cliente-id="${escaparTexto(cliente.id)}">
                    <div class="item-info">
                        <h3>${escaparTexto(cliente.nome || "Cliente sem nome")}</h3>
                        <span>${escaparTexto(cliente.email || "E-mail não informado")}</span>
                        <span class="badge ${classeStatus(cliente.status)}">
                            ${escaparTexto(rotuloStatus(cliente.status))}
                        </span>
                    </div>

                    <div class="item-acoes">
                        ${exibirDetalhes ? `
                            <button
                                type="button"
                                class="btn-icon"
                                data-acao-cliente="abrir"
                                data-cliente-id="${escaparTexto(cliente.id)}"
                                title="Abrir detalhes"
                                aria-label="Abrir detalhes de ${escaparTexto(cliente.nome)}">
                                <i class="fa-solid fa-eye"></i>
                            </button>
                        ` : ""}

                        <button
                            type="button"
                            class="btn-icon edit"
                            data-acao-cliente="editar"
                            data-cliente-id="${escaparTexto(cliente.id)}"
                            title="Editar cliente"
                            aria-label="Editar ${escaparTexto(cliente.nome)}">
                            <i class="fa-solid fa-pen"></i>
                        </button>

                        <button
                            type="button"
                            class="btn-icon delete"
                            data-acao-cliente="excluir"
                            data-cliente-id="${escaparTexto(cliente.id)}"
                            title="Excluir cliente"
                            aria-label="Excluir ${escaparTexto(cliente.nome)}">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </article>
            `)
            .join("");
    }

    function pesquisarClientes() {
        const termo = document
            .getElementById("pesquisaCliente")
            ?.value
            .trim()
            .toLocaleLowerCase("pt-BR") || "";

        if (!termo) {
            renderizarClientes(clientes);
            return;
        }

        const resultado = clientes.filter(cliente => {
            const campos = [
                cliente.nome,
                cliente.email,
                cliente.telefone,
                cliente.cpf_cnpj,
                cliente.cidade,
                cliente.status
            ];

            return campos.some(campo =>
                String(campo || "")
                    .toLocaleLowerCase("pt-BR")
                    .includes(termo)
            );
        });

        renderizarClientes(resultado);
    }

    function configurarEventosClientes() {
        if (eventosConfigurados) return;
        eventosConfigurados = true;

        document
            .getElementById("novoCliente")
            ?.addEventListener("click", abrirNovoCliente);

        document
            .getElementById("fecharModalCliente")
            ?.addEventListener("click", fecharModalCliente);

        document
            .getElementById("cancelarCliente")
            ?.addEventListener("click", fecharModalCliente);

        document
            .getElementById("formCliente")
            ?.addEventListener("submit", salvarCliente);

        document
            .getElementById("pesquisaCliente")
            ?.addEventListener("input", pesquisarClientes);

        document
            .getElementById("btnPesquisarCliente")
            ?.addEventListener("click", pesquisarClientes);

        document
            .getElementById("clienteCep")
            ?.addEventListener("input", tratarDigitacaoCep);

        document
            .getElementById("clienteCep")
            ?.addEventListener("blur", consultarCepDoFormulario);

        document
            .getElementById("listaClientes")
            ?.addEventListener("click", tratarAcaoDaLista);

        document
            .getElementById("detalhesCliente")
            ?.addEventListener("click", tratarAcaoDosDetalhes);

        document
            .getElementById("modalCliente")
            ?.addEventListener("click", event => {
                if (event.target.id === "modalCliente") {
                    fecharModalCliente();
                }
            });

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                fecharModalCliente();
            }
        });
    }

    function tratarAcaoDaLista(event) {
        const botao = event.target.closest("[data-acao-cliente]");

        if (!botao) return;

        executarAcaoCliente(
            botao.dataset.acaoCliente,
            botao.dataset.clienteId
        );
    }

    function tratarAcaoDosDetalhes(event) {
        const botao = event.target.closest("[data-acao-cliente]");

        if (!botao) return;

        executarAcaoCliente(
            botao.dataset.acaoCliente,
            botao.dataset.clienteId
        );
    }

    function executarAcaoCliente(acao, id) {
        if (acao === "abrir") {
            selecionarCliente(id);
            return;
        }

        if (acao === "editar") {
            editarCliente(id);
            return;
        }

        if (acao === "portal") {
            window.location.href =
                `portal.html?preview=1&cliente=${encodeURIComponent(id)}`;
            return;
        }

        if (acao === "excluir") {
            excluirCliente(id);
        }
    }

    function abrirNovoCliente() {
        clienteSelecionadoId = null;
        limparFormularioCliente();
        atualizarTituloModal("Cadastrar Cliente");
        abrirModalCliente();
    }

    function abrirModalCliente() {
        const modal = document.getElementById("modalCliente");

        if (!modal) return;

        modal.style.display = "flex";
        modal.classList.add("show");
        modal.setAttribute("aria-hidden", "false");

        window.setTimeout(() => {
            document.getElementById("clienteNome")?.focus();
        }, 50);
    }

    function fecharModalCliente() {
        const modal = document.getElementById("modalCliente");

        if (!modal) return;

        modal.classList.remove("show");
        modal.style.display = "none";
        modal.setAttribute("aria-hidden", "true");
    }

    function atualizarTituloModal(texto) {
        const titulo = document.querySelector(
            "#modalCliente .modal-header h2"
        );

        if (titulo) titulo.textContent = texto;
    }

    async function salvarCliente(event) {
        event?.preventDefault();

        const dados = obterDadosFormulario();

        if (!dados.nome || !dados.email) {
            mostrarMensagem(
                "Preencha o nome e o e-mail do cliente.",
                "erro"
            );
            return;
        }

        const botaoSalvar = document.getElementById("salvarCliente");
        const textoOriginal = botaoSalvar?.innerHTML;

        if (botaoSalvar) {
            botaoSalvar.disabled = true;
            botaoSalvar.textContent = "Salvando...";
        }

        try {
            if (clienteSelecionadoId) {
                await dbEditarCliente(clienteSelecionadoId, dados);
            }
            else {
                await dbCriarCliente(dados);
            }

            const estavaEditando = Boolean(clienteSelecionadoId);

            fecharModalCliente();
            limparFormularioCliente();
            mostrarMensagem(
                estavaEditando
                    ? "Cliente atualizado com sucesso."
                    : "Cliente cadastrado com sucesso.",
                "sucesso"
            );

            if (paginaCompletaDeClientes()) {
                await carregarClientes();
            }
            else {
                clientes = await dbBuscarClientes();

                if (typeof window.carregarDashboard === "function") {
                    await window.carregarDashboard();
                }
            }
        }
        catch (error) {
            console.error("Erro ao salvar cliente:", error);
            mostrarMensagem(
                mensagemSupabase(
                    error,
                    "Não foi possível salvar o cliente."
                ),
                "erro"
            );
        }
        finally {
            if (botaoSalvar) {
                botaoSalvar.disabled = false;
                botaoSalvar.innerHTML = textoOriginal || "Salvar Cliente";
            }
        }
    }

    function obterDadosFormulario() {
        return {
            nome: valorCampo("clienteNome"),
            email: valorCampo("clienteEmail").toLocaleLowerCase("pt-BR"),
            telefone: valorCampo("clienteTelefone"),
            cpf_cnpj: valorCampo("clienteCpf"),
            endereco: valorCampo("clienteEndereco"),
            cidade: valorCampo("clienteCidade"),
            estado: valorCampo("clienteEstado"),
            cep: valorCampo("clienteCep"),
            status: valorCampo("clienteStatus") || "ativo",
            observacoes: valorCampo("clienteObservacoes")
        };
    }

    function tratarDigitacaoCep(event) {
        const campo = event.currentTarget;
        const digitos = somenteDigitos(campo.value).slice(0, 8);

        campo.value = digitos.length > 5
            ? `${digitos.slice(0, 5)}-${digitos.slice(5)}`
            : digitos;

        window.clearTimeout(temporizadorCep);

        if (digitos.length !== 8) {
            ultimaConsultaCep = "";
            atualizarStatusCep(
                digitos.length
                    ? "Digite os 8 números do CEP."
                    : "",
                ""
            );
            return;
        }

        temporizadorCep = window.setTimeout(
            consultarCepDoFormulario,
            450
        );
    }

    async function consultarCepDoFormulario() {
        const campoCep = document.getElementById("clienteCep");
        const cep = somenteDigitos(campoCep?.value);

        if (!campoCep || cep.length !== 8 || cep === ultimaConsultaCep) {
            return;
        }

        ultimaConsultaCep = cep;
        atualizarStatusCep("Buscando endereço...", "");
        campoCep.setAttribute("aria-busy", "true");

        try {
            const resposta = await fetch(
                `https://viacep.com.br/ws/${encodeURIComponent(cep)}/json/`,
                {
                    method: "GET",
                    headers: { Accept: "application/json" }
                }
            );

            if (!resposta.ok) {
                throw new Error("Serviço de CEP indisponível.");
            }

            const endereco = await resposta.json();

            if (endereco.erro) {
                throw new Error("CEP não encontrado.");
            }

            const partesEndereco = [
                endereco.logradouro,
                endereco.bairro
            ].filter(Boolean);

            preencherCampo(
                "clienteEndereco",
                partesEndereco.join(" — ")
            );
            preencherCampo(
                "clienteCidade",
                endereco.localidade || ""
            );
            preencherCampo(
                "clienteEstado",
                endereco.uf || endereco.estado || ""
            );
            campoCep.value = endereco.cep || campoCep.value;
            atualizarStatusCep(
                "Endereço preenchido. Você pode alterar qualquer campo.",
                "sucesso"
            );

            document.getElementById("clienteEndereco")?.focus();
        }
        catch (error) {
            ultimaConsultaCep = "";
            console.warn("Não foi possível consultar o CEP:", error);
            atualizarStatusCep(
                `${error.message || "Não foi possível consultar o CEP"} Digite o endereço manualmente.`,
                "erro"
            );
        }
        finally {
            campoCep.removeAttribute("aria-busy");
        }
    }

    function somenteDigitos(valor) {
        return String(valor || "").replace(/\D/g, "");
    }

    function atualizarStatusCep(texto, tipo) {
        const status = document.getElementById("cepStatus");
        if (!status) return;

        status.textContent = texto;
        status.className = `cep-status ${tipo || ""}`.trim();
    }

    function valorCampo(id) {
        return document.getElementById(id)?.value.trim() || "";
    }

    function limparFormularioCliente() {
        document.getElementById("formCliente")?.reset();
        clienteSelecionadoId = null;
        ultimaConsultaCep = "";
        atualizarStatusCep("", "");

        const status = document.getElementById("clienteStatus");
        if (status) status.value = "ativo";
    }

    function editarCliente(id) {
        const cliente = localizarCliente(id);

        if (!cliente) {
            mostrarMensagem("Cliente não encontrado.", "erro");
            return;
        }

        clienteSelecionadoId = cliente.id;
        preencherCampo("clienteNome", cliente.nome);
        preencherCampo("clienteEmail", cliente.email);
        preencherCampo("clienteTelefone", cliente.telefone);
        preencherCampo("clienteCpf", cliente.cpf_cnpj);
        preencherCampo("clienteEndereco", cliente.endereco);
        preencherCampo("clienteCidade", cliente.cidade);
        preencherCampo("clienteEstado", cliente.estado);
        preencherCampo("clienteCep", cliente.cep);
        preencherCampo("clienteStatus", cliente.status || "ativo");
        preencherCampo("clienteObservacoes", cliente.observacoes);
        atualizarTituloModal("Editar Cliente");
        ultimaConsultaCep = somenteDigitos(cliente.cep);
        atualizarStatusCep(
            "Altere o CEP para buscar outro endereço.",
            ""
        );
        abrirModalCliente();
    }

    function preencherCampo(id, valor) {
        const campo = document.getElementById(id);
        if (campo) campo.value = valor || "";
    }

    async function excluirCliente(id) {
        const cliente = localizarCliente(id);

        if (!cliente) {
            mostrarMensagem("Cliente não encontrado.", "erro");
            return;
        }

        const confirmar = window.confirm(
            `Deseja realmente excluir o cliente "${cliente.nome}"?`
        );

        if (!confirmar) return;

        try {
            await dbExcluirCliente(cliente.id);

            if (clienteSelecionadoId === cliente.id) {
                clienteSelecionadoId = null;
                limparDetalhesCliente();
            }

            mostrarMensagem("Cliente excluído com sucesso.", "sucesso");

            if (paginaCompletaDeClientes()) {
                await carregarClientes();
            }
            else {
                clientes = await dbBuscarClientes();

                if (typeof window.carregarDashboard === "function") {
                    await window.carregarDashboard();
                }
            }
        }
        catch (error) {
            console.error("Erro ao excluir cliente:", error);

            const mensagem = error?.code === "23503"
                ? "Este cliente possui projetos ou arquivos vinculados. Exclua esses registros antes de excluir o cliente."
                : mensagemSupabase(
                    error,
                    "Não foi possível excluir o cliente."
                );

            mostrarMensagem(mensagem, "erro");
        }
    }

    async function selecionarCliente(id) {
        const cliente = localizarCliente(id);

        if (!cliente) {
            mostrarMensagem("Cliente não encontrado.", "erro");
            return;
        }

        clienteSelecionadoId = cliente.id;
        await exibirDetalhesCliente(cliente, true);
    }

    async function exibirDetalhesCliente(cliente, rolarAteDetalhes) {
        const detalhes = document.getElementById("detalhesCliente");

        if (!detalhes) return;

        detalhes.innerHTML = `
            <div class="cliente-detalhes-grid">
                ${campoDetalhe("Nome", cliente.nome)}
                ${campoDetalhe("E-mail", cliente.email)}
                ${campoDetalhe("Telefone", cliente.telefone)}
                ${campoDetalhe("CPF/CNPJ", cliente.cpf_cnpj)}
                ${campoDetalhe("Endereço", cliente.endereco)}
                ${campoDetalhe("Cidade", cliente.cidade)}
                ${campoDetalhe("Estado", cliente.estado)}
                ${campoDetalhe("CEP", cliente.cep)}
                ${campoDetalhe("Status", rotuloStatus(cliente.status))}
                ${campoDetalhe("Observações", cliente.observacoes)}
            </div>

            <div class="cliente-detalhes-acoes">
                <button
                    type="button"
                    data-acao-cliente="portal"
                    data-cliente-id="${escaparTexto(cliente.id)}">
                    <i class="fa-solid fa-user-shield"></i>
                    Visualizar portal do cliente
                </button>

                <button
                    type="button"
                    data-acao-cliente="editar"
                    data-cliente-id="${escaparTexto(cliente.id)}">
                    <i class="fa-solid fa-pen"></i>
                    Editar cliente
                </button>

                <button
                    type="button"
                    class="acao-excluir"
                    data-acao-cliente="excluir"
                    data-cliente-id="${escaparTexto(cliente.id)}">
                    <i class="fa-solid fa-trash"></i>
                    Excluir cliente
                </button>
            </div>
        `;

        renderizarRelacionadosCarregando();

        const [projetos, documentos] = await Promise.allSettled([
            dbBuscarProjetosCliente(cliente.id),
            dbBuscarDocumentosCliente(cliente.id)
        ]);

        renderizarProjetosCliente(
            projetos.status === "fulfilled" ? projetos.value : []
        );
        renderizarDocumentosCliente(
            documentos.status === "fulfilled" ? documentos.value : []
        );

        if (projetos.status === "rejected") {
            console.error(
                "Erro ao carregar projetos do cliente:",
                projetos.reason
            );
        }

        if (documentos.status === "rejected") {
            console.error(
                "Erro ao carregar documentos do cliente:",
                documentos.reason
            );
        }

        if (rolarAteDetalhes) {
            detalhes
                .closest(".card-grande")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }

    function campoDetalhe(rotulo, valor) {
        return `
            <div class="cliente-detalhe-campo">
                <strong>${escaparTexto(rotulo)}</strong>
                <span>${escaparTexto(valor || "Não informado")}</span>
            </div>
        `;
    }

    function renderizarRelacionadosCarregando() {
        const projetos = document.getElementById("projetosCliente");
        const documentos = document.getElementById("documentosCliente");

        if (projetos) {
            projetos.innerHTML = estadoLista("Carregando projetos...");
        }

        if (documentos) {
            documentos.innerHTML = estadoLista("Carregando documentos...");
        }
    }

    function renderizarProjetosCliente(projetos) {
        const elemento = document.getElementById("projetosCliente");

        if (!elemento) return;

        if (!projetos.length) {
            elemento.innerHTML = estadoLista(
                "Nenhum projeto vinculado a este cliente."
            );
            return;
        }

        elemento.innerHTML = projetos
            .map(projeto => `
                <div class="item-lista">
                    <div class="item-info">
                        <h3>${escaparTexto(projeto.nome || "Projeto")}</h3>
                        <span>${escaparTexto(projeto.tipo || "Tipo não informado")}</span>
                    </div>
                    <span class="badge ${classeStatus(projeto.status)}">
                        ${escaparTexto(rotuloStatus(projeto.status))}
                    </span>
                </div>
            `)
            .join("");
    }

    function renderizarDocumentosCliente(documentos) {
        const elemento = document.getElementById("documentosCliente");

        if (!elemento) return;

        if (!documentos.length) {
            elemento.innerHTML = estadoLista(
                "Nenhum documento vinculado a este cliente."
            );
            return;
        }

        elemento.innerHTML = documentos
            .map(documento => `
                <div class="item-lista">
                    <div class="item-info">
                        <h3>${escaparTexto(documento.nome || "Documento")}</h3>
                        <span>${escaparTexto(documento.tipo || "Tipo não informado")}</span>
                    </div>
                    <div class="item-acoes">
                        ${documento.url ? `
                            <a
                                class="btn-icon"
                                href="${escaparTexto(documento.url)}"
                                target="_blank"
                                rel="noopener"
                                title="Visualizar documento"
                                aria-label="Visualizar ${escaparTexto(documento.nome || "documento")}">
                                <i class="fa-solid fa-eye"></i>
                            </a>
                        ` : ""}
                        <a
                            class="btn-icon edit"
                            href="documentos.html?documento=${encodeURIComponent(documento.id)}&acao=editar"
                            title="Alterar ou substituir documento"
                            aria-label="Alterar ${escaparTexto(documento.nome || "documento")}">
                            <i class="fa-solid fa-pen"></i>
                        </a>
                    </div>
                </div>
            `)
            .join("");
    }

    function limparDetalhesCliente() {
        const detalhes = document.getElementById("detalhesCliente");
        const projetos = document.getElementById("projetosCliente");
        const documentos = document.getElementById("documentosCliente");

        if (detalhes) {
            detalhes.innerHTML =
                "<p>Selecione um cliente para visualizar os detalhes.</p>";
        }

        if (projetos) projetos.innerHTML = "";
        if (documentos) documentos.innerHTML = "";
    }

    function localizarCliente(id) {
        return clientes.find(cliente => cliente.id === id);
    }

    function estadoLista(texto, tipo = "") {
        return `
            <div class="estado-vazio ${tipo}">
                ${escaparTexto(texto)}
            </div>
        `;
    }

    function rotuloStatus(status) {
        const rotulos = {
            ativo: "Ativo",
            orcamento: "Orçamento",
            pausado: "Pausado",
            concluido: "Concluído",
            finalizado: "Finalizado",
            em_andamento: "Em andamento"
        };

        return rotulos[status] || status || "Ativo";
    }

    function classeStatus(status) {
        const classes = {
            ativo: "ativo",
            orcamento: "orcamento",
            pausado: "pausado",
            concluido: "finalizado",
            finalizado: "finalizado",
            em_andamento: "andamento"
        };

        return classes[status] || "ativo";
    }

    function mostrarMensagem(texto, tipo = "info") {
        let mensagem = document.getElementById("mensagemClientes");

        if (!mensagem) {
            mensagem = document.createElement("div");
            mensagem.id = "mensagemClientes";
            mensagem.setAttribute("role", "status");

            const conteudo = document.querySelector(".conteudo");
            conteudo?.prepend(mensagem);
        }

        if (!mensagem) {
            window.alert(texto);
            return;
        }

        const classes = {
            sucesso: "alert-success",
            erro: "alert-error",
            aviso: "alert-warning",
            info: "alert-info"
        };

        mensagem.className = `alert ${classes[tipo] || classes.info}`;
        mensagem.textContent = texto;
        mensagem.hidden = false;
        mensagem.scrollIntoView({ behavior: "smooth", block: "start" });

        window.clearTimeout(mostrarMensagem.timeout);
        mostrarMensagem.timeout = window.setTimeout(() => {
            mensagem.hidden = true;
        }, 6000);
    }

    function mensagemSupabase(error, padrao) {
        if (error?.code === "23505") {
            return "Já existe um cliente cadastrado com este e-mail.";
        }

        if (error?.code === "42501") {
            return "Sua sessão não possui permissão para realizar esta operação. Saia e entre novamente como administradora.";
        }

        return error?.message
            ? `${padrao} ${error.message}`
            : padrao;
    }

    function escaparTexto(texto) {
        return String(texto ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    window.carregarClientesAdmin = carregarClientes;
})();
