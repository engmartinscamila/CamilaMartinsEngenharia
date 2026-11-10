/* Marcação automática de "Arquivo autoral" no envio de documentos.
   - PDFs com nome da série de guias (ex.: "CM_Guia_09_...", "10_Guia_de_...", "...Camila_Martins")
     marcam a opção sozinhos, enquanto você não a alterar manualmente.
   - Avisa quando "autoral" está marcado com arquivo que não é PDF (a cópia protegida só vale para PDF). */
(function () {
  'use strict';
  const AUTHORED_NAME = /(^|[\s_-])(cm[\s_-]+guia|guia[\s_-]+de[\s_-]+(obra|interiores)|\d{1,3}[\s_-]+guia)|camila[\s_-]*martins/i;
  function init() {
    const input = document.getElementById('documentoArquivo');
    const box = document.getElementById('documentoAutoral');
    if (!input || !box) return;
    let touchedByUser = false;
    const card = box.closest('label') || box.parentElement;
    const note = document.createElement('small');
    note.className = 'cme-authorship-autonote';
    note.style.cssText = 'display:block;margin-top:.35rem';
    card?.insertAdjacentElement('afterend', note);
    const files = () => [...(input.files || [])];
    const isPdf = (file) => /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
    function update() {
      const list = files();
      note.textContent = '';
      if (!list.length) return;
      const allPdf = list.every(isPdf);
      if (!touchedByUser) {
        const looksAuthored = allPdf && list.every((file) => AUTHORED_NAME.test(file.name));
        box.checked = looksAuthored;
        if (looksAuthored) note.textContent = 'Marcado como autoral pelo nome do arquivo. Para enviar o mesmo guia a vários clientes e trocar para todos depois, use "Meus guias autorais".';
      }
      if (box.checked && !allPdf) note.textContent = 'Atenção: a cópia protegida só funciona com PDF. Arquivos que não são PDF serão entregues sem a proteção autoral.';
    }
    box.addEventListener('change', () => { touchedByUser = true; update(); });
    input.addEventListener('change', update);
    document.getElementById('novoDocumento')?.addEventListener('click', () => { touchedByUser = false; note.textContent = ''; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
}());
