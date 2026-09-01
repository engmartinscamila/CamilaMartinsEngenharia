(function () {
    "use strict";

    let lancamentos = [];
    let projetos = [];
    let historico = [];

    const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
    const texto = id => document.getElementById(id)?.value?.trim() || "";
    const valor = item => Number(item?.valor) || 0;
    const normalizar = value => String(value ?? "").toLocaleLowerCase("pt-BR");
    const dataReferencia = item => item.data_vencimento || item.data || "";
    const hojeIso = () => new Date().toISOString().slice(0, 10);

    function clienteSupabase() {
        return window.supabaseClient || null;
    }

    function camposAdicionais() {
        const status = texto("financeiroStatus") || "pendente";
        let pagamento = texto("financeiroPagamento") || null;
        if (status === "pago" && !pagamento) pagamento = hojeIso();
        return {
            status,
            categoria: texto("financeiroCategoria") || "outros",
            data_vencimento: texto("financeiroVencimento") || null,
            data_pagamento: pagamento,
            forma_pagamento: texto("financeiroFormaPagamento") || null
        };
    }

    function envolverBusca() {
        const original = window.dbBuscarFinanceiro;
        if (typeof original !== "function" || original.__cmeAvancado) return;
        const wrapper = async function (...args) {
            const resultado = await original.apply(this, args);
            lancamentos = Array.isArray(resultado) ? resultado : [];
            window.setTimeout(renderizar, 0);
            return resultado;
        };
        wrapper.__cmeAvancado = true;
        window.dbBuscarFinanceiro = wrapper;
    }

    function envolverGravacao(nome, indicePayload, indiceId = -1) {
        const original = window[nome];
        if (typeof original !== "function" || original.__cmeAvancado) return;
        const wrapper = async function (...args) {
            const atual = indiceId >= 0
                ? lancamentos.find(item => String(item.id) === String(args[indiceId]))
                : null;
            const formulario = document.getElementById("formFinanceiro");
            const formularioDoRegistro = indiceId < 0
                || formulario?.dataset.cmeFinanceiroId === String(args[indiceId]);
            const extras = formularioDoRegistro
                ? camposAdicionais()
                : {
                    status: atual?.status || "pago",
                    categoria: atual?.categoria || "outros",
                    data_vencimento: atual?.data_vencimento || null,
                    data_pagamento: atual?.data_pagamento || null,
                    forma_pagamento: atual?.forma_pagamento || null
                };
            args[indicePayload] = { ...(args[indicePayload] || {}), ...extras };
            const resposta = await original.apply(this, args);
            window.setTimeout(atualizarDados, 80);
            return resposta;
        };
        wrapper.__cmeAvancado = true;
        window[nome] = wrapper;
    }

    function situacaoEfetiva(item) {
        if (["pago", "cancelado"].includes(item.status)) return item.status;
        if (item.data_vencimento && item.data_vencimento < hojeIso()) return "atrasado";
        return item.status || "pendente";
    }

    function filtrados() {
        const projeto = texto("filtroFinanceiroProjeto");
        const status = texto("filtroFinanceiroStatus");
        const mes = texto("filtroFinanceiroMes");
        return lancamentos.filter(item => {
            if (projeto && String(item.projeto_id || "") !== projeto) return false;
            if (status && situacaoEfetiva(item) !== status) return false;
            if (mes && !dataReferencia(item).startsWith(mes)) return false;
            return true;
        });
    }

    function total(itens, tipo) {
        return itens
            .filter(item => !tipo || item.tipo === tipo)
            .reduce((soma, item) => soma + valor(item), 0);
    }

    function nomeProjeto(id) {
        return projetos.find(item => String(item.id) === String(id))?.nome || "Sem projeto";
    }

    function escapar(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function renderizar() {
        if (!document.getElementById("financeiroResumoProjetos")) return;
        const itens = filtrados();
        const ativos = itens.filter(item => situacaoEfetiva(item) !== "cancelado");
        const aReceber = ativos.filter(item => item.tipo === "entrada" && situacaoEfetiva(item) !== "pago");
        const atrasados = ativos.filter(item => situacaoEfetiva(item) === "atrasado");
        const limite = new Date();
        limite.setDate(limite.getDate() + 30);
        const limiteIso = limite.toISOString().slice(0, 10);
        const proximos = ativos.filter(item => {
            const data = dataReferencia(item);
            return situacaoEfetiva(item) !== "pago" && data >= hojeIso() && data <= limiteIso;
        });

        document.getElementById("financeiroAReceber").textContent = moeda.format(total(aReceber));
        document.getElementById("financeiroEmAtraso").textContent = moeda.format(total(atrasados));
        document.getElementById("financeiroResultadoPrevisto").textContent = moeda.format(total(ativos, "entrada") - total(ativos, "saida"));
        document.getElementById("financeiroProximos30").textContent = moeda.format(total(proximos, "entrada") - total(proximos, "saida"));

        const grupos = new Map();
        ativos.forEach(item => {
            const chave = item.projeto_id || "sem-projeto";
            const grupo = grupos.get(chave) || { entradas: 0, saidas: 0, pendencias: 0 };
            if (item.tipo === "entrada") grupo.entradas += valor(item);
            if (item.tipo === "saida") grupo.saidas += valor(item);
            if (!["pago", "cancelado"].includes(situacaoEfetiva(item))) grupo.pendencias += 1;
            grupos.set(chave, grupo);
        });

        const corpo = document.getElementById("financeiroResumoProjetos");
        if (!grupos.size) {
            corpo.innerHTML = '<tr><td colspan="5">Nenhum lançamento corresponde aos filtros.</td></tr>';
        } else {
            corpo.innerHTML = [...grupos.entries()].map(([id, grupo]) => `
                <tr>
                    <td>${escapar(id === "sem-projeto" ? "Sem projeto" : nomeProjeto(id))}</td>
                    <td>${moeda.format(grupo.entradas)}</td>
                    <td>${moeda.format(grupo.saidas)}</td>
                    <td class="${grupo.entradas - grupo.saidas < 0 ? "valor-negativo" : "valor-positivo"}">${moeda.format(grupo.entradas - grupo.saidas)}</td>
                    <td>${grupo.pendencias}</td>
                </tr>`).join("");
        }
        renderizarHistorico();
    }

    function preencherProjetos() {
        const select = document.getElementById("filtroFinanceiroProjeto");
        if (!select) return;
        const atual = select.value;
        select.innerHTML = '<option value="">Todos os projetos</option>' + projetos
            .map(projeto => `<option value="${escapar(projeto.id)}">${escapar(projeto.nome || "Projeto")}</option>`)
            .join("");
        select.value = atual;
    }

    function preencherEdicao(item) {
        if (!item) return;
        const form = document.getElementById("formFinanceiro");
        if (form) form.dataset.cmeFinanceiroId = String(item.id);
        const valores = {
            financeiroStatus: item.status || "pago",
            financeiroCategoria: item.categoria || "outros",
            financeiroVencimento: item.data_vencimento || "",
            financeiroPagamento: item.data_pagamento || "",
            financeiroFormaPagamento: item.forma_pagamento || ""
        };
        Object.entries(valores).forEach(([id, value]) => {
            const campo = document.getElementById(id);
            if (campo) campo.value = value;
        });
    }

    function detectarEdicao(evento) {
        const botao = evento.target.closest("button[data-id], [data-acao][data-id], [data-action][data-id]");
        if (!botao) return;
        const acao = normalizar(`${botao.dataset.acao || ""} ${botao.dataset.action || ""} ${botao.title || ""} ${botao.textContent || ""} ${botao.innerHTML || ""}`);
        if (!acao.includes("edit") && !acao.includes("pen") && !acao.includes("alterar")) return;
        const item = lancamentos.find(registro => String(registro.id) === String(botao.dataset.id));
        preencherEdicao(item);
        window.setTimeout(() => preencherEdicao(item), 30);
    }

    async function buscarHistorico() {
        const client = clienteSupabase();
        if (!client) return [];
        const { data, error } = await client
            .from("client_financial_archive")
            .select("*")
            .order("occurred_on", { ascending: false, nullsFirst: false })
            .order("archived_at", { ascending: false });
        if (error) throw error;
        return Array.isArray(data) ? data : [];
    }

    function snapshotProjeto(item) {
        const s = item?.source_snapshot || {};
        return s?.project?.nome || s?.projeto?.nome || s?.project_name || s?.projeto_nome || "Projeto excluído / não identificado";
    }

    function snapshotCategoria(item) {
        const s = item?.source_snapshot || {};
        return s?.financeiro?.categoria || s?.financial?.categoria || s?.categoria || "";
    }

    function snapshotStatus(item) {
        const s = item?.source_snapshot || {};
        return s?.financeiro?.status || s?.financial?.status || s?.status || "arquivado";
    }

    function snapshotPagamento(item) {
        const s = item?.source_snapshot || {};
        return s?.financeiro?.data_pagamento || s?.financial?.data_pagamento || s?.data_pagamento || "";
    }

    function snapshotFormaPagamento(item) {
        const s = item?.source_snapshot || {};
        return s?.financeiro?.forma_pagamento || s?.financial?.forma_pagamento || s?.forma_pagamento || "";
    }

    function motivoHistorico(reason) {
        const mapa = {
            client_delete: "Cliente excluído",
            project_delete: "Projeto excluído",
            financial_delete: "Lançamento excluído",
            accounting_reset: "Reset contábil",
            manual_delete: "Lançamento excluído"
        };
        return mapa[reason] || reason || "Preservação automática";
    }

    function garantirPainelHistorico() {
        if (document.getElementById("historicoFinanceiroPreservado")) return;
        const ancora = document.querySelector(".financeiro-inteligente") || document.querySelector(".card-grande");
        if (!ancora) return;
        const secao = document.createElement("section");
        secao.id = "historicoFinanceiroPreservado";
        secao.className = "financeiro-inteligente";
        secao.innerHTML = `
            <div class="financeiro-inteligente-cabecalho">
                <div>
                    <span class="financeiro-eyebrow">Memória contábil</span>
                    <h2>Histórico preservado</h2>
                    <p>Registros mantidos mesmo após exclusão de clientes, projetos ou lançamentos e após reset contábil.</p>
                </div>
                <strong id="historicoFinanceiroQuantidade">0 registros</strong>
            </div>
            <div class="financeiro-tabela-wrap">
                <table class="financeiro-tabela">
                    <thead><tr><th>Data</th><th>Cliente</th><th>Projeto</th><th>Descrição</th><th>Tipo</th><th>Valor</th><th>Motivo</th></tr></thead>
                    <tbody id="historicoFinanceiroTabela"><tr><td colspan="7">Carregando histórico...</td></tr></tbody>
                </table>
            </div>`;
        ancora.insertAdjacentElement("afterend", secao);
    }

    function renderizarHistorico() {
        garantirPainelHistorico();
        const corpo = document.getElementById("historicoFinanceiroTabela");
        const contador = document.getElementById("historicoFinanceiroQuantidade");
        if (!corpo) return;
        if (contador) contador.textContent = `${historico.length} ${historico.length === 1 ? "registro" : "registros"}`;
        if (!historico.length) {
            corpo.innerHTML = '<tr><td colspan="7">Nenhum registro histórico arquivado até o momento.</td></tr>';
            return;
        }
        corpo.innerHTML = historico.map(item => `
            <tr>
                <td>${escapar(item.occurred_on || "-")}</td>
                <td>${escapar(item.client_name_snapshot || "Cliente excluído")}</td>
                <td>${escapar(snapshotProjeto(item))}</td>
                <td>${escapar(item.description || "-")}</td>
                <td>${escapar(item.transaction_type || "-")}</td>
                <td>${moeda.format(Number(item.amount) || 0)}</td>
                <td>${escapar(motivoHistorico(item.archived_reason))}</td>
            </tr>`).join("");
    }

    function dadosExtratoAtivoCompleto() {
        return lancamentos.map(item => ({
            "Origem": "Ativo",
            "Descrição": item.descricao || "",
            "Tipo": item.tipo || "",
            "Valor (R$)": valor(item),
            "Data": item.data || "",
            "Vencimento": item.data_vencimento || "",
            "Data do pagamento": item.data_pagamento || "",
            "Situação": situacaoEfetiva(item),
            "Categoria": item.categoria || "",
            "Projeto": nomeProjeto(item.projeto_id),
            "Forma de pagamento": item.forma_pagamento || "",
            "Observações": item.observacoes || ""
        }));
    }

    function dadosHistoricoExcel() {
        return historico.map(item => ({
            "Origem": "Histórico preservado",
            "Data": item.occurred_on || "",
            "Cliente": item.client_name_snapshot || "",
            "E-mail do cliente": item.client_email_snapshot || "",
            "Projeto": snapshotProjeto(item),
            "Contrato": item.contract_number_snapshot || "",
            "Serviço": item.service_type_snapshot || "",
            "Descrição": item.description || "",
            "Tipo": item.transaction_type || "",
            "Valor (R$)": Number(item.amount) || 0,
            "Categoria": snapshotCategoria(item),
            "Situação anterior": snapshotStatus(item),
            "Data do pagamento": snapshotPagamento(item),
            "Forma de pagamento": snapshotFormaPagamento(item),
            "Motivo do arquivamento": motivoHistorico(item.archived_reason),
            "Arquivado em": item.archived_at || ""
        }));
    }

    function exportarCsv() {
        const cabecalho = ["Descrição", "Tipo", "Valor", "Data", "Vencimento", "Pagamento", "Situação", "Categoria", "Projeto", "Forma de pagamento", "Observações"];
        const linhas = filtrados().map(item => [
            item.descricao, item.tipo, valor(item).toFixed(2).replace(".", ","), item.data,
            item.data_vencimento, item.data_pagamento, situacaoEfetiva(item), item.categoria,
            nomeProjeto(item.projeto_id), item.forma_pagamento, item.observacoes
        ]);
        const csv = [cabecalho, ...linhas]
            .map(linha => linha.map(campo => `"${String(campo ?? "").replaceAll('"', '""')}"`).join(";"))
            .join("\r\n");
        const link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
        link.download = `extrato-financeiro-filtrado-${hojeIso()}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
    }

    function carregarXlsx() {
        if (window.XLSX) return Promise.resolve(window.XLSX);
        if (window.__cmeXlsxPromise) return window.__cmeXlsxPromise;
        window.__cmeXlsxPromise = new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
            script.async = true;
            script.onload = () => window.XLSX ? resolve(window.XLSX) : reject(new Error("Biblioteca Excel indisponível."));
            script.onerror = () => reject(new Error("Não foi possível carregar o gerador de Excel."));
            document.head.appendChild(script);
        });
        return window.__cmeXlsxPromise;
    }

    async function exportarExcelCompleto() {
        const botao = document.getElementById("exportarFinanceiroCsv");
        const textoOriginal = botao?.innerHTML;
        try {
            await atualizarDados();
            if (botao) {
                botao.disabled = true;
                botao.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gerando backup...';
            }
            const XLSX = await carregarXlsx();
            const ativos = dadosExtratoAtivoCompleto();
            const arquivoHistorico = dadosHistoricoExcel();
            const considerados = lancamentos.filter(item => situacaoEfetiva(item) !== "cancelado");
            const resumo = [
                { "Indicador": "Data do backup", "Valor": new Date().toLocaleString("pt-BR") },
                { "Indicador": "Lançamentos ativos", "Valor": lancamentos.length },
                { "Indicador": "Registros históricos preservados", "Valor": historico.length },
                { "Indicador": "Total de entradas ativas", "Valor": total(considerados, "entrada") },
                { "Indicador": "Total de saídas ativas", "Valor": total(considerados, "saida") },
                { "Indicador": "Saldo ativo", "Valor": total(considerados, "entrada") - total(considerados, "saida") },
                { "Indicador": "Escopo", "Valor": "Backup completo: lançamentos ativos e histórico preservado, sem depender dos filtros da tela." }
            ];

            const workbook = XLSX.utils.book_new();
            const sheetAtivos = XLSX.utils.json_to_sheet(ativos.length ? ativos : [{ "Informação": "Nenhum lançamento ativo." }]);
            const sheetHistorico = XLSX.utils.json_to_sheet(arquivoHistorico.length ? arquivoHistorico : [{ "Informação": "Nenhum histórico preservado." }]);
            const sheetResumo = XLSX.utils.json_to_sheet(resumo);
            sheetAtivos["!cols"] = [{ wch: 14 }, { wch: 34 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 28 }, { wch: 20 }, { wch: 40 }];
            sheetHistorico["!cols"] = [{ wch: 20 }, { wch: 12 }, { wch: 28 }, { wch: 32 }, { wch: 28 }, { wch: 18 }, { wch: 24 }, { wch: 34 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 24 }, { wch: 22 }];
            sheetResumo["!cols"] = [{ wch: 34 }, { wch: 70 }];
            XLSX.utils.book_append_sheet(workbook, sheetAtivos, "Lançamentos ativos");
            XLSX.utils.book_append_sheet(workbook, sheetHistorico, "Histórico preservado");
            XLSX.utils.book_append_sheet(workbook, sheetResumo, "Resumo");
            XLSX.writeFile(workbook, `backup-financeiro-completo-${hojeIso()}.xlsx`, { compression: true });
        } catch (erro) {
            console.error("Falha ao gerar backup financeiro em Excel.", erro);
            alert("Não foi possível gerar o backup completo em Excel agora. Nenhum dado foi alterado.");
            throw erro;
        } finally {
            if (botao) {
                botao.disabled = false;
                botao.innerHTML = textoOriginal || '<i class="fa-solid fa-file-excel"></i> Baixar Excel completo';
            }
        }
    }

    async function resetarFinanceiroSeguro() {
        if (!lancamentos.length) {
            alert("Não há lançamentos financeiros ativos para resetar. O histórico preservado permanece disponível.");
            return;
        }

        const baixar = confirm("Antes do reset, será gerado um backup Excel completo com os lançamentos ativos e o histórico preservado. Deseja continuar?");
        if (!baixar) return;

        try {
            await exportarExcelCompleto();
        } catch {
            alert("O reset foi cancelado porque o backup Excel não pôde ser gerado.");
            return;
        }

        const confirmacao = prompt("ATENÇÃO: o reset removerá apenas os lançamentos financeiros ATIVOS. O histórico ficará preservado.\n\nPara confirmar, digite exatamente:\nRESETAR FINANCEIRO");
        if (confirmacao !== "RESETAR FINANCEIRO") {
            alert("Confirmação incorreta. Nenhum dado foi alterado.");
            return;
        }

        const segunda = confirm("Última confirmação: deseja arquivar todos os lançamentos ativos e limpar a área financeira? Clientes, projetos e histórico NÃO serão apagados.");
        if (!segunda) return;

        const client = clienteSupabase();
        if (!client) {
            alert("Não foi possível acessar o serviço financeiro. Nenhum dado foi alterado.");
            return;
        }

        const botao = document.getElementById("resetarFinanceiroSeguro");
        const original = botao?.innerHTML;
        try {
            if (botao) {
                botao.disabled = true;
                botao.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Arquivando e limpando...';
            }
            const { data, error } = await client.rpc("admin_reset_financial_data", {
                p_confirmation: "RESETAR FINANCEIRO",
                p_reason: "accounting_reset"
            });
            if (error) throw error;
            await atualizarDados();
            const removidos = Number(data?.deletedActive ?? data?.deleted_active ?? 0);
            alert(`Reset concluído com segurança. ${removidos} lançamento(s) ativo(s) foram arquivados e removidos. O histórico permanece preservado.`);
        } catch (erro) {
            console.error("Falha no reset financeiro seguro.", erro);
            alert("O reset não foi concluído. O banco protege a operação por transação; revise a mensagem e tente novamente.");
        } finally {
            if (botao) {
                botao.disabled = false;
                botao.innerHTML = original || '<i class="fa-solid fa-rotate-left"></i> Resetar dados contábeis';
            }
        }
    }

    function configurarExportacoesEReset() {
        const botao = document.getElementById("exportarFinanceiroCsv");
        if (!botao) return;
        botao.innerHTML = '<i class="fa-solid fa-file-excel"></i> Baixar Excel completo';
        botao.title = "Backup completo em Excel: lançamentos ativos + histórico preservado";
        botao.addEventListener("click", exportarExcelCompleto);

        if (!document.getElementById("exportarFinanceiroCsvAlternativo")) {
            const csv = document.createElement("button");
            csv.id = "exportarFinanceiroCsvAlternativo";
            csv.type = "button";
            csv.innerHTML = '<i class="fa-solid fa-file-csv"></i> CSV filtrado';
            csv.title = "Baixar em CSV somente os lançamentos correspondentes aos filtros atuais";
            csv.addEventListener("click", exportarCsv);
            botao.insertAdjacentElement("afterend", csv);
        }

        if (!document.getElementById("resetarFinanceiroSeguro")) {
            const reset = document.createElement("button");
            reset.id = "resetarFinanceiroSeguro";
            reset.type = "button";
            reset.innerHTML = '<i class="fa-solid fa-rotate-left"></i> Resetar dados contábeis';
            reset.title = "Gera backup, arquiva os lançamentos e limpa somente os dados financeiros ativos";
            reset.style.marginLeft = "8px";
            reset.addEventListener("click", resetarFinanceiroSeguro);
            document.getElementById("exportarFinanceiroCsvAlternativo")?.insertAdjacentElement("afterend", reset);
        }
    }

    async function atualizarDados() {
        try {
            const tarefas = [
                window.dbBuscarFinanceiro(),
                typeof window.dbBuscarProjetos === "function" ? window.dbBuscarProjetos() : Promise.resolve([]),
                buscarHistorico()
            ];
            [lancamentos, projetos, historico] = await Promise.all(tarefas);
            lancamentos = Array.isArray(lancamentos) ? lancamentos : [];
            projetos = Array.isArray(projetos) ? projetos : [];
            historico = Array.isArray(historico) ? historico : [];
            preencherProjetos();
            renderizar();
        } catch (erro) {
            console.warn("Não foi possível atualizar toda a visão financeira.", erro);
            preencherProjetos();
            renderizar();
        }
    }

    function iniciar() {
        garantirPainelHistorico();
        ["filtroFinanceiroProjeto", "filtroFinanceiroStatus", "filtroFinanceiroMes"]
            .forEach(id => document.getElementById(id)?.addEventListener("change", renderizar));
        document.getElementById("limparFiltrosFinanceiros")?.addEventListener("click", () => {
            ["filtroFinanceiroProjeto", "filtroFinanceiroStatus", "filtroFinanceiroMes"]
                .forEach(id => { const campo = document.getElementById(id); if (campo) campo.value = ""; });
            renderizar();
        });
        configurarExportacoesEReset();
        document.addEventListener("click", detectarEdicao, true);
        document.getElementById("novoLancamento")?.addEventListener("click", () => {
            const form = document.getElementById("formFinanceiro");
            if (form) delete form.dataset.cmeFinanceiroId;
            window.setTimeout(() => {
                const status = document.getElementById("financeiroStatus");
                const categoria = document.getElementById("financeiroCategoria");
                if (status) status.value = "pendente";
                if (categoria) categoria.value = "honorarios";
            }, 30);
        }, true);
        document.getElementById("financeiroStatus")?.addEventListener("change", evento => {
            const pagamento = document.getElementById("financeiroPagamento");
            if (evento.target.value === "pago" && pagamento && !pagamento.value) pagamento.value = hojeIso();
        });
        window.setTimeout(atualizarDados, 250);
    }

    envolverBusca();
    envolverGravacao("dbCriarLancamentoFinanceiro", 0);
    envolverGravacao("dbEditarLancamentoFinanceiro", 1, 0);

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
    else iniciar();
}());