/*
=====================================================
CAMILA MARTINS ENGENHARIA
ÁREAS DO PORTAL DO CLIENTE
=====================================================
*/

(function iniciarAreaCliente() {
    "use strict";

    const clienteSupabase = window.supabaseClient;
    const area = document.body.dataset.area || "";
    const container = document.getElementById("areaContent");
    const nomeCliente = document.getElementById("clientName");
    const nomeProjeto = document.getElementById("clientProject");
    const ano = document.getElementById("currentYear");
    const logout = document.getElementById("logoutButton");

    let clienteAtual = null;
    let projetosCliente = [];

    const areasPermitidas = new Set([
        "biblioteca",
        "documentos",
        "cronograma",
        "fotos",
        "solicitacoes"
    ]);

    function escapar(valor) {
        return String(valor ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function formatarData(valor) {
        if (!valor) return "Data não informada";

        const texto = String(valor);
        const data = new Date(
            /^\d{4}-\d{2}-\d{2}$/.test(texto)
                ? `${texto}T00:00:00`
                : texto
        );

        return Number.isNaN(data.getTime())
            ? texto
            : data.toLocaleDateString("pt-BR");
    }

    function urlSegura(valor) {
        if (!valor) return "";

        try {
            const url = new URL(valor, window.location.href);
            return ["http:", "https:"].includes(url.protocol)
                ? url.href
                : "";
        }
        catch {
            return "";
        }
    }

    async function urlArquivo(item, bucket) {
        const urlSalva = urlSegura(item?.url);
        if (urlSalva) return urlSalva;
        if (!item?.arquivo) return "";

        const { data, error } = await clienteSupabase
            .storage
            .from(bucket)
            .createSignedUrl(item.arquivo, 21600);

        if (error) {
            console.error(
                `Não foi possível abrir ${bucket}/${item.arquivo}:`,
                error
            );
            return "";
        }

        return urlSegura(data?.signedUrl);
    }

    function mostrarErro(mensagem) {
        container.innerHTML = `
            <div class="error-state">
                <i class="bi bi-exclamation-circle"></i>
                <strong>Não foi possível carregar esta área.</strong>
                <span>${escapar(mensagem)}</span>
            </div>
        `;
    }

    function mostrarVazio(icone, titulo, texto) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="bi ${escapar(icone)}"></i>
                <strong>${escapar(titulo)}</strong>
                <span>${escapar(texto)}</span>
            </div>
        `;
    }

    async function buscarLista(tabela, opcoes = {}) {
        let consulta = clienteSupabase
            .from(tabela)
            .select("*");

        if (opcoes.cliente) {
            consulta = consulta.eq("cliente_id", clienteAtual.id);
        }

        if (opcoes.ordem) {
            consulta = consulta.order(opcoes.ordem, {
                ascending: opcoes.crescente === true
            });
        }

        const { data, error } = await consulta;
        if (error) throw error;
        return data || [];
    }

    async function renderizarArquivos(itens, bucket, biblioteca = false) {
        if (!itens.length) {
            mostrarVazio(
                biblioteca ? "bi-journals" : "bi-folder2-open",
                biblioteca
                    ? "Nenhum material disponível."
                    : "Nenhum documento disponível.",
                "Os arquivos publicados aparecerão aqui."
            );
            return;
        }

        const itensComUrl = await Promise.all(
            itens.map(async item => ({
                item,
                url: await urlArquivo(item, bucket)
            }))
        );

        container.innerHTML = `
            <div class="items-grid">
                ${itensComUrl.map(({ item, url }) => {
                    const titulo = item.nome || item.titulo || "Arquivo";
                    return `
                        <article class="item-card">
                            <h2>${escapar(titulo)}</h2>
                            <p>${escapar(item.descricao || "Arquivo disponibilizado para consulta.")}</p>
                            <div class="item-meta">
                                <span><i class="bi bi-tag"></i> ${escapar(item.categoria || item.tipo || "Geral")}</span>
                                <span><i class="bi bi-calendar3"></i> ${escapar(formatarData(item.created_at))}</span>
                            </div>
                            ${url ? `
                                <a class="item-link" href="${escapar(url)}" target="_blank" rel="noopener noreferrer">
                                    <i class="bi bi-box-arrow-up-right"></i>
                                    Abrir arquivo
                                </a>
                            ` : `
                                <div class="arquivo-indisponivel">
                                    <i class="bi bi-exclamation-triangle"></i>
                                    Arquivo temporariamente indisponível.
                                </div>
                            `}
                        </article>
                    `;
                }).join("")}
            </div>
        `;
    }

    async function renderizarFotos(itens) {
        if (!itens.length) {
            mostrarVazio(
                "bi-images",
                "Nenhuma foto disponível.",
                "As imagens publicadas da obra aparecerão aqui."
            );
            return;
        }

        const itensComUrl = await Promise.all(
            itens.map(async item => ({
                item,
                url: await urlArquivo(item, window.BUCKETS.FOTOS)
            }))
        );

        container.innerHTML = `
            <div class="items-grid">
                ${itensComUrl.map(({ item, url }) => {
                    const titulo = item.nome || item.titulo || "Foto da obra";
                    return `
                        <article class="item-card photo-card">
                            ${url
                                ? `<a href="${escapar(url)}" target="_blank" rel="noopener noreferrer">
                                    <img src="${escapar(url)}" alt="${escapar(titulo)}" loading="lazy">
                                </a>`
                                : `<div class="arquivo-indisponivel">
                                    <i class="bi bi-image"></i>
                                    Imagem temporariamente indisponível.
                                </div>`}
                            <div class="item-body">
                                <h2>${escapar(titulo)}</h2>
                                <div class="item-meta">
                                    <span><i class="bi bi-calendar3"></i> ${escapar(formatarData(item.created_at))}</span>
                                </div>
                            </div>
                        </article>
                    `;
                }).join("")}
            </div>
        `;
    }

    function renderizarCronograma(itens) {
        if (!itens.length) {
            mostrarVazio(
                "bi-calendar-check",
                "Nenhuma etapa disponível.",
                "O cronograma publicado do projeto aparecerá aqui."
            );
            return;
        }

        container.innerHTML = `
            <div class="timeline">
                ${itens.map(item => `
                    <article class="item-card">
                        <h2>${escapar(item.nome || item.etapa || "Etapa")}</h2>
                        <p>${escapar(item.descricao || "Sem descrição adicional.")}</p>
                        <div class="item-meta">
                            <span>
                                <i class="bi bi-calendar-event"></i>
                                ${escapar(formatarData(item.inicio || item.data_inicio))}
                                — ${escapar(formatarData(item.fim || item.data_fim))}
                            </span>
                        </div>
                        <div class="status">${escapar(item.status || "Pendente")}</div>
                    </article>
                `).join("")}
            </div>
        `;
    }

    function renderizarSolicitacoes(itens) {
        const lista = itens.length
            ? `
                <div class="timeline">
                    ${itens.map(item => `
                        <article class="item-card">
                            <h2>${escapar(item.titulo || "Solicitação")}</h2>
                            <p>${escapar(item.mensagem || "Sem mensagem.")}</p>
                            <div class="item-meta">
                                <span><i class="bi bi-calendar3"></i> ${escapar(formatarData(item.created_at))}</span>
                            </div>
                            <div class="status">${escapar(item.status || "Aberta")}</div>
                        </article>
                    `).join("")}
                </div>
            `
            : `
                <div class="empty-state">
                    <i class="bi bi-chat-left-text"></i>
                    <strong>Nenhuma solicitação enviada.</strong>
                    <span>Use o formulário para iniciar um atendimento.</span>
                </div>
            `;

        container.innerHTML = `
            <div class="requests-layout">
                <form class="request-form" id="clientRequestForm">
                    <h2>Nova solicitação</h2>
                    <div class="form-group">
                        <label for="requestTitle">Título</label>
                        <input id="requestTitle" name="titulo" maxlength="120" required>
                    </div>
                    <div class="form-group">
                        <label for="requestMessage">Mensagem</label>
                        <textarea id="requestMessage" name="mensagem" rows="7" maxlength="2000" required></textarea>
                    </div>
                    <button class="submit-button" type="submit">Enviar solicitação</button>
                    <p class="form-message" id="requestMessageStatus" aria-live="polite"></p>
                </form>
                <section aria-label="Solicitações enviadas">${lista}</section>
            </div>
        `;

        document
            .getElementById("clientRequestForm")
            ?.addEventListener("submit", salvarSolicitacaoCliente);
    }

    async function salvarSolicitacaoCliente(evento) {
        evento.preventDefault();

        const formulario = evento.currentTarget;
        const botao = formulario.querySelector("button[type='submit']");
        const retorno = document.getElementById("requestMessageStatus");
        const titulo = formulario.elements.titulo.value.trim();
        const mensagem = formulario.elements.mensagem.value.trim();

        if (!titulo || !mensagem) return;

        botao.disabled = true;
        retorno.textContent = "Enviando...";

        const { error } = await clienteSupabase
            .from(window.TABELAS.SOLICITACOES)
            .insert([{
                titulo,
                mensagem,
                status: "Aberta",
                cliente_id: clienteAtual.id,
                projeto_id: projetosCliente[0]?.id || null
            }]);

        if (error) {
            console.error("Erro ao enviar solicitação:", error);
            retorno.textContent = "Não foi possível enviar. Tente novamente.";
            botao.disabled = false;
            return;
        }

        formulario.reset();
        retorno.textContent = "Solicitação enviada com sucesso.";
        await carregarArea();
    }

    async function carregarArea() {
        try {
            if (area === "biblioteca") {
                const itens = await buscarLista(
                    window.TABELAS.BIBLIOTECA,
                    { ordem: "created_at" }
                );
                await renderizarArquivos(itens, window.BUCKETS.BIBLIOTECA, true);
                return;
            }

            if (area === "documentos") {
                const itens = await buscarLista(
                    window.TABELAS.DOCUMENTOS,
                    { cliente: true, ordem: "created_at" }
                );
                await renderizarArquivos(itens, window.BUCKETS.DOCUMENTOS);
                return;
            }

            if (area === "fotos") {
                const itens = await buscarLista(
                    window.TABELAS.FOTOS,
                    { cliente: true, ordem: "created_at" }
                );
                await renderizarFotos(itens);
                return;
            }

            if (area === "cronograma") {
                const itens = await buscarLista(
                    window.TABELAS.CRONOGRAMA,
                    { cliente: true, ordem: "data_inicio", crescente: true }
                );
                renderizarCronograma(itens);
                return;
            }

            const itens = await buscarLista(
                window.TABELAS.SOLICITACOES,
                { cliente: true, ordem: "created_at" }
            );
            renderizarSolicitacoes(itens);
        }
        catch (error) {
            console.error(`Erro ao carregar ${area}:`, error);
            mostrarErro(error.message || "Tente novamente em alguns instantes.");
        }
    }

    async function autenticar() {
        if (!clienteSupabase || !areasPermitidas.has(area)) {
            mostrarErro("Configuração inválida.");
            return;
        }

        const {
            data: { session },
            error: sessionError
        } = await clienteSupabase.auth.getSession();

        if (sessionError || !session) {
            window.location.replace("login.html");
            return;
        }

        if (session.user.id === window.ADMIN_UID) {
            window.location.replace("admin.html");
            return;
        }

        const { data: cliente, error: clienteError } = await clienteSupabase
            .from(window.TABELAS.CLIENTES)
            .select("*")
            .eq("auth_id", session.user.id)
            .maybeSingle();

        if (clienteError || !cliente) {
            await clienteSupabase.auth.signOut();
            window.location.replace("login.html");
            return;
        }

        clienteAtual = cliente;

        const { data: projetos, error: projetosError } = await clienteSupabase
            .from(window.TABELAS.PROJETOS)
            .select("*")
            .eq("cliente_id", cliente.id)
            .order("created_at", { ascending: false });

        projetosCliente = projetosError ? [] : (projetos || []);
        nomeCliente.textContent = cliente.nome || "Cliente";
        nomeProjeto.textContent =
            projetosCliente[0]?.nome ||
            cliente.projeto ||
            "Portal do Cliente";

        await carregarArea();
    }

    logout?.addEventListener("click", async () => {
        await clienteSupabase.auth.signOut();
        window.location.replace("login.html");
    });

    if (ano) ano.textContent = new Date().getFullYear();

    autenticar().catch(error => {
        console.error("Erro ao iniciar área do cliente:", error);
        mostrarErro("Tente novamente em alguns instantes.");
    });
})();
