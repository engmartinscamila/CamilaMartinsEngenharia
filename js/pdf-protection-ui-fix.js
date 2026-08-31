(function () {
    "use strict";

    const codigo = document.getElementById("pdfIssueCode");
    const download = document.getElementById("protectedPdfDownload");
    const legal = document.querySelector(".pdf-protection-legal");

    if (!codigo) return;

    const textoLegalProtegido = legal?.textContent?.trim() || "";
    const textoLegalOriginal =
        "© 2026 Camila Martins Engenharia. Documento disponibilizado com acesso " +
        "controlado pelo portal. Arquivos não autorais são fornecidos no formato " +
        "original e não recebem código de rastreamento autoral.";

    function definirBotao(protegido) {
        if (!download) return;
        download.innerHTML = protegido
            ? '<i class="bi bi-shield-check"></i> Baixar cópia identificada'
            : '<i class="bi bi-download"></i> Baixar documento';
    }

    function sincronizarEstado() {
        const texto = String(codigo.textContent || "").trim();
        const possuiCodigo = /CME-[A-Z2-7]{8,20}/i.test(texto);
        const codigoInvalido =
            /c[oó]digo\s+da\s+c[oó]pia\s*:\s*(?:null|undefined)?\s*$/i.test(texto) ||
            /\b(?:null|undefined)\b/i.test(texto);

        if (possuiCodigo) {
            definirBotao(true);
            if (legal && textoLegalProtegido) {
                legal.textContent = textoLegalProtegido;
            }
            return;
        }

        if (codigoInvalido) {
            codigo.textContent = "Documento original • sem identificação autoral";
            definirBotao(false);
            if (legal) legal.textContent = textoLegalOriginal;
        }
    }

    const observador = new MutationObserver(sincronizarEstado);
    observador.observe(codigo, {
        childList: true,
        characterData: true,
        subtree: true
    });

    sincronizarEstado();
}());
