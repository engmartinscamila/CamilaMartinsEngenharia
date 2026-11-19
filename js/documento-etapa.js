/*
 * Upload de documentos ligado ao cronograma simples.
 * A administradora pode indicar que a entrega enviada conclui uma etapa do
 * cronograma do projeto. O banco conclui a etapa e registra o documento.
 */
(function moduloDocumentoEtapa() {
    "use strict";

    const ID = "documentoConcluiEtapa";
    let etapas = [];
    let carregando = null;
    let ultimoProjeto = "";

    const cliente = () => window.supabaseClient;
    const escapar = valor => String(valor ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const concluida = etapa => ["concluido", "concluído", "concluida", "concluída"].includes(String(etapa?.status || "").trim().toLowerCase());

    function criarCampo() {
        if (document.getElementById(ID)) return;
        const descricao = document.getElementById("documentoDescricao");
        const campoDescricao = descricao?.closest(".campo");
        if (!campoDescricao) return;
        const campo = document.createElement("div");
        campo.className = "campo campo-full";
        campo.innerHTML = `
            <label for="${ID}">Esta entrega conclui a etapa do cronograma</label>
            <select id="${ID}"><option value="">Não concluir nenhuma etapa</option></select>
            <small class="ajuda-campo">Opcional. Ao salvar, a etapa escolhida aparece como concluída no portal do cliente, com este documento como registro. Serviços que exigem Termo de Aceite também podem ser concluídos pelo aceite do cliente.</small>`;
        campoDescricao.after(campo);
    }

    async function carregar(projetoId, selecionada = "") {
        const select = document.getElementById(ID);
        if (!select) return;
        ultimoProjeto = String(projetoId || "");
        select.innerHTML = '<option value="">Não concluir nenhuma etapa</option>';
        etapas = [];
        if (!projetoId || !cliente()) return;
        carregando = cliente().from("cronograma")
            .select("id,nome,status,ordem,exige_aceite,origem")
            .eq("projeto_id", projetoId)
            .order("ordem", { ascending: true });
        const { data, error } = await carregando;
        if (error || String(document.getElementById("documentoProjeto")?.value || "") !== String(projetoId)) return;
        etapas = data || [];
        select.innerHTML += etapas
            .filter(etapa => !concluida(etapa) || String(etapa.id) === String(selecionada))
            .map(etapa => `<option value="${escapar(etapa.id)}">${escapar(etapa.nome)}${etapa.exige_aceite ? " (exige Termo de Aceite)" : ""}</option>`)
            .join("");
        if (selecionada) select.value = selecionada;
    }

    // Grava o vínculo depois que os documentos foram salvos.
    async function vincular({ caminhos = [], documentoId = null }) {
        const etapaId = document.getElementById(ID)?.value;
        if (!etapaId || !cliente()) return { vinculado: false };
        let consulta = cliente().from("documentos").update({ conclui_etapa_id: etapaId });
        consulta = documentoId ? consulta.eq("id", documentoId) : consulta.in("arquivo", caminhos);
        const { error } = await consulta;
        if (error) throw error;
        const etapa = etapas.find(item => String(item.id) === String(etapaId));
        return { vinculado: true, etapa: etapa?.nome || "" };
    }

    function iniciar() {
        criarCampo();
        const projeto = document.getElementById("documentoProjeto");
        projeto?.addEventListener("change", () => carregar(projeto.value));
        document.getElementById("documentoCliente")?.addEventListener("change", () => carregar(""));
        // O formulário é preenchido por código ao abrir; acompanha a troca do valor.
        setInterval(() => {
            const modalAberto = document.getElementById("formDocumento")?.offsetParent !== null;
            if (!projeto || !modalAberto || String(projeto.value || "") === ultimoProjeto) return;
            carregar(projeto.value);
        }, 600);
    }

    window.CMEEtapaEntrega = { vincular, carregar };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
    else iniciar();
})();
