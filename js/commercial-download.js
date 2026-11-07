/* Download local de documentos Word em base64. */
(function(){'use strict';
  function b64blob(base64, type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type });
  }

  function download(base64, name) {
    const url = URL.createObjectURL(b64blob(base64));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name || 'documento.docx';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }


window.CMECommercialDownload={b64blob,download};
}());
