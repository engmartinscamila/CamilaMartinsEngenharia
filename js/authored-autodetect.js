/* Marcação automática de "Arquivo autoral" no envio de documentos.
   - PDFs com nome da série de guias (ex.: "CM_Guia_09_...", "10_Guia_de_...", "...Camila_Martins")
     marcam a opção sozinhos, enquanto você não a alterar manualmente.
   - Imagens (JPG, PNG, WebP) também podem ser autorais: o cliente recebe a cópia carimbada.
   - Avisa quando "autoral" está marcado com formato sem proteção (nem PDF nem imagem). */
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
    const isImage = (file) => /\.(jpe?g|png|webp)$/i.test(file.name) || /^image\/(jpeg|png|webp)$/.test(file.type);
    function update() {
      const list = files();
      note.textContent = '';
      if (!list.length) return;
      const allPdf = list.every(isPdf);
      const allSupported = list.every((file) => isPdf(file) || isImage(file));
      if (!touchedByUser) {
        const looksAuthored = allSupported && list.every((file) => AUTHORED_NAME.test(file.name));
        box.checked = looksAuthored;
        if (looksAuthored) note.textContent = 'Marcado como autoral pelo nome do arquivo. Para enviar o mesmo guia a vários clientes e trocar para todos depois, use "Meus guias autorais".';
      }
      if (box.checked && !allSupported) note.textContent = 'Atenção: a cópia protegida funciona com PDF e imagens (JPG, PNG, WebP). Outros formatos serão entregues sem a proteção autoral.';
      else if (box.checked && !allPdf && !note.textContent) note.textContent = 'Imagens autorais chegam ao cliente como cópia com o nome dele gravado na imagem.';
    }
    box.addEventListener('change', () => { touchedByUser = true; update(); });
    input.addEventListener('change', update);
    document.getElementById('novoDocumento')?.addEventListener('click', () => { touchedByUser = false; note.textContent = ''; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
}());
