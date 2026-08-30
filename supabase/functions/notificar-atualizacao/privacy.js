/**
 * Remove identificadores pessoais e documentais antes que o texto saia do
 * ambiente da aplicação. O filtro é aplicado tanto ao e-mail quanto ao SMS.
 */
export function protegerDadosConfidenciais(valor) {
  let texto = String(valor ?? "").slice(0, 2000);

  // Documentos brasileiros em formatos usuais.
  texto = texto
    .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, "[DADO PROTEGIDO]")
    .replace(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g, "[DADO PROTEGIDO]");

  // Identificadores apresentados com rótulo, inclusive ART/RRT e contrato.
  texto = texto.replace(
    /\b(CPF|CNPJ|RG|CNH|passaporte|documento|contrato|ART|RRT|orçamento|orcamento|proposta)\s*(?:n(?:º|°|o|\.)?)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9./_-]{2,})/gi,
    (trecho, rotulo, identificador) => /\d/.test(identificador)
      ? `${rotulo} [DADO PROTEGIDO]`
      : trecho,
  );

  // Sequências longas que possam representar documentos ou telefones no corpo.
  texto = texto.replace(/\b(?:\d[ .\/-]?){8,}\d\b/g, "[DADO PROTEGIDO]");
  return texto;
}
